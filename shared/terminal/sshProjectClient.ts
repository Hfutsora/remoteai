import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { toByteArray } from 'base64-js';
import type { ProjectBrowserClient, ProjectDocument, ProjectFileSave } from '../project-browser/protocol';
import { PROJECT_FILE_LIMIT } from '../project-browser/protocol';
import type { EntryRequest } from '../project-browser/entryActions';
import { browserSshDownload } from './sshTransfers';
import type { SshApi, SshEntry } from './ssh';
import { SSH_FILE_LIMIT } from './ssh';
import { sshChild, sshParent, validSshName } from './useSshFiles';
import { decodeSshText, sshTextUpload, type SshTextContent } from './sshTextFile';
import { uploadSshFile } from './sshUpload';
import { searchSshProject } from './sshProjectSearch';

export type SshListDirectory = (path: string) => Promise<{
  path: string; entries: SshEntry[]; truncated: boolean;
}>;

const imageTypes: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', ico: 'image/x-icon',
};

function documentFromData(path: string, data: string): ProjectDocument {
  const bytes = toByteArray(data);
  const base = { path, size: bytes.length, revision: bytesToHex(sha256(bytes)), readOnly: true };
  if (bytes.length > PROJECT_FILE_LIMIT) return { ...base, kind: 'large' };
  const imageType = imageTypes[path.split('.').at(-1)?.toLowerCase() ?? ''];
  if (imageType) return { ...base, kind: 'image', image: `data:${imageType};base64,${data}` };
  const content = decodeSshText(data);
  return content ? { ...base, kind: 'text', text: content.text, readOnly: false } : { ...base, kind: 'binary' };
}

export function createSshProjectClient(api: SshApi, id: string) {
  const list: SshListDirectory = async path => {
    const reply = await api.files(id, { type: 'list', path });
    if (reply.type !== 'list') throw new Error('client.ssh.fileFailed');
    return { ...reply, entries: [...reply.entries].sort((a, b) =>
      Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name)) };
  };
  const entry = async (path: string) => {
    const directory = await list(sshParent(path));
    const found = directory.entries.find(item => item.path === path);
    if (!found) throw new Error('client.ssh.fileFailed');
    return found;
  };
  const readData = async (path: string) => {
    const reply = await api.files(id, { type: 'read', path });
    if (reply.type !== 'file') throw new Error('client.ssh.fileFailed');
    return reply.data;
  };
  const client: ProjectBrowserClient = {
    list: async (cwd, directory, query) => {
      if (query) return searchSshProject({ list, root: cwd, query });
      const result = await list(directory || cwd);
      return { directory: result.path, parent: result.path === '/' ? null : sshParent(result.path),
        entries: result.entries, truncated: result.truncated };
    },
    read: async ({ path }) => {
      const file = await entry(path);
      if (file.directory) throw new Error('client.ssh.fileFailed');
      if (file.size > PROJECT_FILE_LIMIT) return {
        path, size: file.size, revision: '', kind: 'large', readOnly: true,
      };
      return documentFromData(path, await readData(path));
    },
    save: target => saveSshDocument({ api, id, target, readData }),
    mutate: request => mutateSshEntry({ api, id, request, entry }),
  };
  const download = async ({ path }: { path: string }) => {
    const file = await entry(path);
    if (file.directory) throw new Error('client.ssh.fileFailed');
    if (file.size > SSH_FILE_LIMIT) throw new Error('client.ssh.fileTooLarge');
    await browserSshDownload(file, await readData(path));
    return '';
  };
  return { client, download };
}

async function saveSshDocument({ api, id, target, readData }: {
  api: SshApi; id: string; target: ProjectFileSave; readData: (path: string) => Promise<string>;
}) {
  const data = await readData(target.path);
  const previous = documentFromData(target.path, data);
  const content = decodeSshText(data);
  if (!content || previous.revision !== target.revision) {
    throw new Error('client.projectBrowser.thisFileChangedElsewhereCopyYourEditsBeforeReloadingIt');
  }
  const file = editableUpload(target.path.split('/').at(-1) ?? '', { ...content, text: target.text });
  let replacing = false;
  await uploadSshFile({ api, id, path: target.path, file, signal: new AbortController().signal,
    progress: () => {}, resolveConflict: async () => {
      if (replacing) throw new Error('client.ssh.fileFailed');
      replacing = true;
      return 'overwrite';
    } });
  return documentFromData(target.path, await file.read(0, file.size));
}

function editableUpload(name: string, content: SshTextContent) {
  const tooLarge = 'client.projectBrowser.filesLargerThan2MbCannotBeEditedHere';
  try {
    const file = sshTextUpload(name, content);
    if (file.size > PROJECT_FILE_LIMIT) throw new Error(tooLarge);
    return file;
  } catch (error) {
    // The transfer helper has a higher limit; editor errors must still describe the editing limit.
    if (error instanceof Error && error.message === 'client.ssh.fileTooLarge') throw new Error(tooLarge);
    throw error;
  }
}

async function mutateSshEntry({ api, id, request, entry }: {
  api: SshApi; id: string; request: EntryRequest; entry: (path: string) => Promise<SshEntry>;
}) {
  if ('name' in request && !validSshName(request.name)) throw new Error('client.ssh.invalidName');
  if (request.action === 'createFile' || request.action === 'createFolder') {
    const path = sshChild(request.path, request.name);
    await api.files(id, { type: request.action, path });
    return { path, directory: request.action === 'createFolder' };
  }
  const source = await entry(request.path);
  if (request.action === 'delete') {
    await api.files(id, { type: source.directory ? 'deleteTree' : 'delete', path: request.path });
    return { path: request.path, directory: source.directory };
  }
  if (request.action === 'copy') throw new Error('client.ssh.fileFailed');
  const path = 'directory' in request ? sshChild(request.directory, source.name)
    : sshChild(sshParent(request.path), request.name);
  await api.files(id, { type: 'rename', path: request.path, destination: path });
  return { path, directory: source.directory };
}
