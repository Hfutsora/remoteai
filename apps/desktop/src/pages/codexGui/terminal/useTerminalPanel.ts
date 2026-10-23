import { useState } from "react";
import type { TerminalInfo } from '../../../../../../shared/terminal/types';

export const MAX_TERMINAL_TABS = 8;
export interface TerminalTab { id: string; cwd: string; session?: TerminalInfo }

export function useTerminalPanel(cwd: string) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const addInDirectory = (directory: string) => {
    setOpen(true);
    if (tabs.length >= MAX_TERMINAL_TABS) {
      setError('client.terminal.closeATerminalBeforeOpeningAnotherOne'); return;
    }
    setError('');
    const tab = { id: crypto.randomUUID(), cwd: directory };
    setTabs((current) => [...current, tab]); setSelected(tab.id);
  };
  const add = () => addInDirectory(cwd);
  const remove = (id: string) => {
    const remaining = tabs.filter((tab) => tab.id !== id);
    setTabs(remaining);
    setError('');
    if (selected === id) setSelected(remaining.at(-1)?.id ?? "");
    if (!remaining.length) setOpen(false);
  };
  return { tabs, selected, open, error, add, addInDirectory, remove, select: setSelected, hide: () => setOpen(false),
    toggle: () => { if (!tabs.length) add(); else setOpen(!open); } };
}

export type TerminalPanelState = ReturnType<typeof useTerminalPanel>;
