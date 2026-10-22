/** Security changes belong to the active viewer's capture group and expire with its last display. */
export interface DesktopSecurity {
  lockOnDisconnect: boolean;
  muteHost: boolean;
}
export type DesktopSecurityChange = Partial<DesktopSecurity>;
export const DEFAULT_DESKTOP_SECURITY: DesktopSecurity = { lockOnDisconnect: false, muteHost: false };

export function validateDesktopSecurity(value: unknown): DesktopSecurityChange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('安全选项无效，请重试。');
  }
  const entries = Object.entries(value);
  if (entries.some(([key, item]) => !['lockOnDisconnect', 'muteHost'].includes(key) || typeof item !== 'boolean')) {
    throw new Error('安全选项无效，请重试。');
  }
  return Object.fromEntries(entries);
}

export interface SecuritySettingsProps {
  connected: boolean;
  control: boolean;
  supported: boolean;
  value: DesktopSecurity;
  saving: boolean;
  error: string;
  update: (change: DesktopSecurityChange) => Promise<void>;
  privacy: { available: boolean; enabled: boolean; toggle: () => Promise<void> };
  clipboard: { available: boolean; enabled: boolean; toggle: () => void };
  notice?: { message: string; label: string; run: () => void };
  close: () => void;
}
