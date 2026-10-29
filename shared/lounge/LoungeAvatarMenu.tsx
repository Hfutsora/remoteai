import { useState, type ReactNode } from 'react';
import { ThreadContextMenu } from '../chat/ThreadContextMenu';
import { displayText as t } from '../localization/messages';
import './contextMenu.css';

export function LoungeAvatarMenu({ children, mention }: { children: ReactNode; mention: () => void }) {
  const [open, setOpen] = useState(false);
  return <ThreadContextMenu open={open} onOpenChange={setOpen} overlayClassName="lounge-context-menu"
    menu={{ items: [{ key: 'mention', label: t('client.lounge.mentionUser') }],
      onClick: () => { setOpen(false); mention(); } }}>
    <span className="lounge-avatar-menu">{children}</span>
  </ThreadContextMenu>;
}
