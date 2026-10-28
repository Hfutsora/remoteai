import { createRoot } from 'react-dom/client';
import { ChatFilePreviewContent } from '../src/chat/ChatFilePreview';
import type { FileClient } from '../../../shared/remote-chat/fileDownload';
import '../src/styles.css';
import '../src/chat/chat.css';

interface Fixture { path: string; text: string; assets: Record<string, { data: string; mime: string }> }
const fixture = (window as unknown as { htmlFixture: Fixture }).htmlFixture;
const sessions = new Map<string, string>();
const reads: string[] = [];
Object.assign(window, { assetReads: reads, assetSessions: sessions });
const client: FileClient = {
  open: async (threadId, path) => {
    if (threadId !== 'selected-remote-computer') throw new Error('Wrong computer');
    reads.push(path);
    const asset = fixture.assets[path];
    if (!asset) throw new Error('Missing asset');
    const id = crypto.randomUUID(); sessions.set(id, path);
    return { id, name: path.split('/').at(-1)!, size: atob(asset.data).length, mimeType: asset.mime };
  },
  read: async ({ id, offset, length }) => ({ offset,
    data: btoa(atob(fixture.assets[sessions.get(id)!].data).slice(offset, offset + length)) }),
  close: async (_threadId, id) => { sessions.delete(id); },
};
createRoot(document.getElementById('root')!).render(<ChatFilePreviewContent path={fixture.path}
  context={{ client, threadId: 'selected-remote-computer', ready: true,
    load: async () => ({ path: fixture.path, text: fixture.text }) }} />);
