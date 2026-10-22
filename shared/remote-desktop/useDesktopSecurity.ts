import { useEffect, useRef, useState } from 'react';
import { DEFAULT_DESKTOP_SECURITY, type DesktopSecurity, type DesktopSecurityChange } from './security';
import type { DesktopDisplaySession } from './displaySession';

export function useDesktopSecurity(receiver: { current?: DesktopDisplaySession }, active: boolean) {
  const [value, setValue] = useState(DEFAULT_DESKTOP_SECURITY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const [clipboardSync, setClipboardSync] = useState(true);
  useEffect(() => { if (!active) setError(''); }, [active]);
  const update = async (change: DesktopSecurityChange) => {
    const current = receiver.current;
    if (!current || pending.current) return;
    pending.current = true; setSaving(true); setError('');
    try {
      const state = await current.security(change);
      if (receiver.current === current) setValue(state);
    } catch {
      if (receiver.current === current) setError('安全选项未能保存，请重试。');
    } finally { pending.current = false; setSaving(false); }
  };
  const receive = (state?: DesktopSecurity) => setValue(state ?? DEFAULT_DESKTOP_SECURITY);
  return { value, saving, error, update, receive, clipboardSync,
    toggleClipboardSync: () => setClipboardSync(current => !current) };
}
