import * as DocumentPicker from 'expo-document-picker';
import { randomUUID } from 'expo-crypto';
import { cacheDirectory, EncodingType, readAsStringAsync, getInfoAsync, deleteAsync } from 'expo-file-system';
import type { SshDownload, SshUpload } from '../../../../../shared/terminal/sshTransfers';
import { SSH_FILE_LIMIT } from '../../../../../shared/terminal/ssh';
import { nativeDownloadTarget } from '../fileDownloadTarget';
import { validSshName } from '../../../../../shared/terminal/useSshFiles';

export const nativeSshDownload: SshDownload = async (entry, data) => {
  if (!validSshName(entry.name) || entry.name.includes('\\')) throw new Error('client.ssh.invalidName');
  const target = await nativeDownloadTarget({ id: randomUUID(), name: entry.name,
    size: entry.size, mimeType: 'application/octet-stream' });
  try { await target.write(data); await target.finish(); }
  finally { await target.dispose(); }
};

export async function pickSshUpload(upload: (file: SshUpload) => Promise<boolean>) {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return;
  const file = result.assets[0];
  try {
    const info = await getInfoAsync(file.uri);
    if (!info.exists || info.isDirectory) throw new Error('client.ssh.fileFailed');
    if (info.size > SSH_FILE_LIMIT) throw new Error('client.ssh.fileTooLarge');
    await upload({ name: file.name, size: info.size,
      read: () => readAsStringAsync(file.uri, { encoding: EncodingType.Base64 }) });
  } finally {
    if (cacheDirectory && file.uri.startsWith(cacheDirectory)) await deleteAsync(file.uri, { idempotent: true });
  }
}
