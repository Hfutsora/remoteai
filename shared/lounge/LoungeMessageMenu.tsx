import { useState, type HTMLAttributes, type ReactElement } from 'react';
import { ThreadContextMenu } from '../chat/ThreadContextMenu';
import { displayText as t } from '../localization/messages';
import type { LoungeMessage } from './types';

export function LoungeMessageMenu({ message, reply, children }: {
  message: LoungeMessage; reply: (message: LoungeMessage) => void;
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}) {
  const [open, setOpen] = useState(false);
  return <ThreadContextMenu open={open} onOpenChange={setOpen}
    menu={{ items: [{ key: 'reply', label: t('client.lounge.quoteReply') }],
      onClick: () => { setOpen(false); reply(message); } }}>{children}</ThreadContextMenu>;
}
