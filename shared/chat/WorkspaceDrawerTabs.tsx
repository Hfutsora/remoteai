import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useDiffText } from './diffText';
import type { WorkspaceTab } from './workspaceDrawer';
import './workspaceDrawer.css';

export function WorkspaceDrawerTabs({ tabs, selected, visible, choose, close }: {
  tabs: WorkspaceTab[]; selected: string | null; visible: boolean;
  choose: (id: string) => void; close: (id: string) => void;
}) {
  const t = useDiffText();
  const bar = useRef<HTMLDivElement>(null);
  const focusSelected = () => bar.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
    ?.focus({ preventScroll: true });
  useEffect(() => {
    if (visible) bar.current?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [visible, selected]);
  return <div ref={bar} className="workspace-drawer-tabs" role="tablist"
    aria-label={t('client.desktopGuiExtras.sidebarContent')}>
    {tabs.map((tab, index) => <div key={tab.id} className="workspace-drawer-tab" data-active={selected === tab.id}>
      <button type="button" className="workspace-drawer-tab-select" role="tab"
        aria-selected={selected === tab.id} tabIndex={selected === tab.id ? 0 : -1}
        onClick={() => choose(tab.id)} onKeyDown={event => {
          const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -index,
            End: tabs.length - index - 1 };
          if (!(event.key in offsets)) return;
          event.preventDefault();
          choose(tabs[(index + offsets[event.key] + tabs.length) % tabs.length].id);
          requestAnimationFrame(focusSelected);
        }}>
        {tab.icon}<span>{tab.title}</span>
      </button>
      <button type="button" className="workspace-drawer-tab-close"
        aria-label={t('client.mobile.close', { value1: tab.title })} onClick={() => {
          close(tab.id); requestAnimationFrame(focusSelected);
        }}><X size={14} /></button>
    </div>)}
  </div>;
}
