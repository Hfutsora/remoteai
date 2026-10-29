import { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, type InputRef } from 'antd';
import { displayText as t } from '../localization/messages';
import type { LoungeController } from './controller';
import type { LoungeAccount, LoungeSnapshot } from './types';
import { LoungeAvatar } from './LoungeAvatar';

export function LoungeNewChat({ controller, state, select, close }: {
  controller: LoungeController; state: LoungeSnapshot; select: (user: LoungeAccount) => void; close: () => void;
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController>();
  const input = useRef<InputRef>(null);
  useEffect(() => {
    setBusy(false); setError('');
    return () => request.current?.abort();
  }, [controller]);
  const available = state.status === 'connected' && state.accountLookupAvailable;
  const speakers = controller.recentSpeakers();
  const cancel = () => { request.current?.abort(); close(); };
  const open = (user: LoungeAccount) => { request.current?.abort(); select(user); close(); };
  const submit = async () => {
    if (!query.trim() || busy || !available) return;
    const current = new AbortController(); request.current = current;
    setBusy(true); setError('');
    try {
      const user = await controller.findAccount(query, current.signal);
      if (!current.signal.aborted) open(user);
    } catch (reason) {
      if (!current.signal.aborted) {
        setError(reason instanceof Error ? reason.message : 'client.lounge.accountLookupFailed');
      }
    } finally { if (!current.signal.aborted) setBusy(false); }
  };
  return <Modal open width={400} title={t('client.lounge.newChat')} footer={null}
    onCancel={cancel} afterOpenChange={open => { if (open) input.current?.focus(); }}
    className="lounge-new-chat-dialog">
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <p id="lounge-new-chat-hint">{t('client.lounge.accountLookupHint')}</p>
      <Input ref={input} maxLength={320} value={query} disabled={busy}
        aria-label={t('client.lounge.accountLookupLabel')} aria-describedby="lounge-new-chat-hint"
        placeholder={t('client.lounge.accountLookupLabel')}
        onChange={event => { setQuery(event.target.value); setError(''); }} />
      <Button type="primary" htmlType="submit" loading={busy} disabled={!query.trim() || !available}>
        {t('client.lounge.directChat')}</Button>
      {!available && <p role="status">{t('client.lounge.accountLookupFailed')}</p>}
      {error && <p role="alert">{t(error)}</p>}
    </form>
    <h3>{t('client.lounge.recentSpeakers')}</h3>
    <div className="lounge-new-chat-people">
      {!speakers.length && <p>{t('client.lounge.noRecentSpeakers')}</p>}
      {speakers.map(user => <button type="button" key={user.id} className="lounge-person"
        aria-label={t('client.lounge.directWith', { account: user.account })} onClick={() => open(user)}>
        <LoungeAvatar user={user} /><span className="lounge-person-copy">{user.account}</span>
      </button>)}
    </div>
  </Modal>;
}
