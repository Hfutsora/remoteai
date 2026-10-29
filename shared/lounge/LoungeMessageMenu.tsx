import { useState, type HTMLAttributes, type ReactElement } from 'react';
import { ThreadContextMenu } from '../chat/ThreadContextMenu';
import { displayText as t } from '../localization/messages';
import type { LoungeMessage } from './types';

export interface LoungeMessageMenuActions {
  reply: (message: LoungeMessage) => void;
  direct?: () => void; block?: () => void; blocked?: boolean;
}

export function LoungeMessageMenu({ message, reply, children, direct, block, blocked }: LoungeMessageMenuActions & {
  message: LoungeMessage;
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}) {
  const [open, setOpen] = useState(false);
  return <ThreadContextMenu open={open} onOpenChange={setOpen}
    menu={{ items: [{ key: 'reply', label: t('client.lounge.quoteReply') },
      ...(direct ? [{ key: 'direct', label: t('client.lounge.directChat') }] : []),
      ...(block ? [{ key: 'block', label: t(blocked ? 'client.lounge.unblockUser' : 'client.lounge.blockUser') }] : [])],
      onClick: ({ key }) => {
        setOpen(false);
        if (key === 'direct') direct?.();
        else if (key === 'block') block?.();
        else reply(message);
      } }}>{children}</ThreadContextMenu>;
}
