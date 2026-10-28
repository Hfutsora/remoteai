import { useMemo, useState } from 'react';
import { Drawer, Input } from 'antd';
import { Search } from 'lucide-react';
import { displayText as t } from '../localization/messages';
import { getInterfaceLanguage } from '../localization/interfaceLanguage';
import { localeForLanguage } from '../localization/language';
import { LoungeAvatar } from './LoungeAvatar';
import { LoungeMessageBody } from './LoungeMessageBody';
import { searchLoungeHistory } from './history';
import type { LoungeMessage } from './types';

export function LoungeHistory({ messages, open, close, preview }: {
  messages: readonly LoungeMessage[]; open: boolean; close: () => void; preview: (source: string) => void;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchLoungeHistory(messages, query), [messages, query]);
  const format = new Intl.DateTimeFormat(localeForLanguage(getInterfaceLanguage()), {
    dateStyle: 'short', timeStyle: 'short',
  });
  return <Drawer open={open} title={t('client.lounge.history')} width="min(560px, 100vw)" onClose={close}
    className="lounge-history" styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}>
    <div className="lounge-history-search">
      <Input value={query} onChange={event => setQuery(event.target.value)} allowClear prefix={<Search size={17} />}
        aria-label={t('client.lounge.searchHistory')} placeholder={t('client.lounge.searchHistory')} />
      <p>{t('client.lounge.historyHint')}</p>
      <span role="status">{t('client.lounge.historyCount', { count: matches.length })}</span>
    </div>
    <div className="lounge-history-list">
      {!matches.length && <p className="lounge-history-empty">{t(query.trim()
        ? 'client.lounge.historyNoResults' : 'client.lounge.historyEmpty')}</p>}
      {matches.map(message => <article className="lounge-history-message" key={`${message.sender.id}:${message.id}`}>
        <LoungeAvatar user={message.sender} />
        <div className="lounge-history-message-main"><div className="lounge-account">{message.sender.account}</div>
          <time dateTime={message.sentAt}>{format.format(new Date(message.sentAt))}</time>
          <LoungeMessageBody message={message} preview={preview} />
        </div>
      </article>)}
    </div>
  </Drawer>;
}
