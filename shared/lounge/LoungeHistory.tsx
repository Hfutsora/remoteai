import { Button, Drawer, Input } from 'antd';
import { Search } from 'lucide-react';
import { displayText as t } from '../localization/messages';
import { getInterfaceLanguage } from '../localization/interfaceLanguage';
import { localeForLanguage } from '../localization/language';
import { LoungeAvatar } from './LoungeAvatar';
import { LoungeMessageBody } from './LoungeMessageBody';
import { useLoungeHistory } from './useLoungeHistory';
import type { LoungeController } from './controller';
import { LoungeMessageMenu } from './LoungeMessageMenu';
import type { LoungeMessage } from './types';

export function LoungeHistory({ controller, open, close, preview, reply }: {
  controller: LoungeController; open: boolean; close: () => void; preview: (source: string) => void;
  reply: (message: LoungeMessage) => void;
}) {
  const history = useLoungeHistory(controller, open);
  const format = new Intl.DateTimeFormat(localeForLanguage(getInterfaceLanguage()), {
    dateStyle: 'short', timeStyle: 'short',
  });
  return <Drawer open={open} title={t('client.lounge.history')} width="min(560px, 100vw)" onClose={close}
    className="lounge-history" styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}>
    <div className="lounge-history-search">
      <Input value={history.query} onChange={event => history.setQuery(event.target.value)} allowClear
        prefix={<Search size={17} />}
        aria-label={t('client.lounge.searchHistory')} placeholder={t('client.lounge.searchHistory')} />
      <p>{t('client.lounge.historyHint')}</p>
      <span role="status">{history.loading ? t('client.lounge.historyLoading')
        : t('client.lounge.historyCount', { count: history.messages.length })}</span>
      {history.error && <p role="alert">{t('client.lounge.historyLoadFailed')}
        <Button type="link" onClick={history.retry}>{t('client.lounge.historyRetry')}</Button></p>}
    </div>
    <div className="lounge-history-list">
      {!history.loading && !history.error && !history.messages.length && <p className="lounge-history-empty">
        {t(history.query.trim()
        ? 'client.lounge.historyNoResults' : 'client.lounge.historyEmpty')}</p>}
      {history.messages.map(message => <LoungeMessageMenu key={`${message.sender.id}:${message.id}`}
        message={message} reply={reply}><article className="lounge-history-message" tabIndex={0}>
        <LoungeAvatar user={message.sender} />
        <div className="lounge-history-message-main"><div className="lounge-account">{message.sender.account}</div>
          <time dateTime={message.sentAt}>{format.format(new Date(message.sentAt))}</time>
          <LoungeMessageBody message={message} preview={preview} />
        </div>
      </article></LoungeMessageMenu>)}
    </div>
    <nav className="lounge-history-pagination" aria-label={t('client.lounge.history')}>
      <Button onClick={history.previous} disabled={history.loading || !history.hasPrevious}>
        {t('client.lounge.historyPrevious')}</Button>
      <Button onClick={history.next} disabled={history.loading || !history.hasNext}>
        {t('client.lounge.historyNext')}</Button>
    </nav>
  </Drawer>;
}
