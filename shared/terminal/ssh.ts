import type { TerminalInfo, TerminalSize } from './types';

export interface SshEndpoint { host: string; port: number }
export interface SshRemote extends SshEndpoint { username: string }
export interface SshConnect {
  endpoint: SshEndpoint; username: string; fingerprint: string; size: TerminalSize;
  password?: string; privateKey?: string; passphrase?: string;
}
export interface SshEntry { name: string; path: string; directory: boolean; size: number }
export type SshFileAction = { type: 'list' | 'read' | 'createFolder' | 'delete'; path: string }
  | { type: 'rename'; path: string; destination: string }
  | { type: 'upload'; path: string; data: string };
export type SshFileReply = { type: 'list'; path: string; entries: SshEntry[]; truncated: boolean }
  | { type: 'file'; data: string } | { type: 'done' };
export interface SshApi {
  probe: (endpoint: SshEndpoint) => Promise<string>;
  open: (request: SshConnect, projectCwd: string) => Promise<TerminalInfo>;
  files: (id: string, request: SshFileAction) => Promise<SshFileReply>;
}
export const SSH_FILE_LIMIT = 4 * 1024 * 1024;

/** Keep error keys intact until rendering so open views follow language changes. */
export const sshError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;
