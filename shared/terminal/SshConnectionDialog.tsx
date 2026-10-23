import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Space } from 'antd';
import { sshError, type SshApi } from './ssh';
import type { TerminalInfo } from './types';
import { readSshProfiles, saveSshProfiles, sshEndpointKey, sshLabel, type SshProfile } from './sshProfiles';
import { displayText as t } from '../localization/messages';
import { remoteErrorText } from '../localization/errors';
import './ssh.css';

interface Values { name: string; host: string; port: number; username: string;
  auth: 'password' | 'key'; password?: string; privateKey?: string; passphrase?: string }

export function SshConnectionDialog({ api, initial, projectCwd, close, connected, dispose, changed }: {
  api: SshApi; initial?: SshProfile; projectCwd: string; close: () => void;
  connected: (info: TerminalInfo) => void; dispose: (id: string) => Promise<void>; changed: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const auth = Form.useWatch('auth', form);
  const [profiles, setProfiles] = useState(readSshProfiles);
  const [selected, setSelected] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState('');
  const [trust, setTrust] = useState<{ endpoint: string; fingerprint: string }>();
  const lifetime = useRef(true);
  const pending = useRef(false);
  useEffect(() => { lifetime.current = true; return () => { lifetime.current = false; }; }, []);
  const choose = (id?: string) => {
    const saved = profiles.find(value => value.id === id);
    setSelected(saved); setError(''); setTrust(undefined); form.resetFields();
    form.setFieldsValue(saved ?? { host: '', username: '', name: '', port: 22, auth: 'password' });
  };
  const persist = (next: SshProfile[]) => { saveSshProfiles(next); setProfiles(next); changed(); };
  const submit = async (values: Values) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const endpoint = { host: values.host.trim(), port: values.port };
      const endpointKey = sshEndpointKey({ ...endpoint, username: values.username });
      const fingerprint = await api.probe(endpoint);
      if (!lifetime.current) return;
      const known = profiles.find(value => sshEndpointKey(value) === endpointKey && value.fingerprint)?.fingerprint;
      if (known && known !== fingerprint) throw new Error('client.ssh.hostChanged');
      if (!known && (trust?.endpoint !== endpointKey || trust.fingerprint !== fingerprint)) {
        setTrust({ endpoint: endpointKey, fingerprint }); return;
      }
      const info = await api.open({ endpoint, username: values.username.trim(), fingerprint,
        size: { cols: 80, rows: 24 }, ...(values.auth === 'key'
          ? { privateKey: values.privateKey, passphrase: values.passphrase } : { password: values.password }) }, projectCwd);
      if (!lifetime.current) { await dispose(info.id); return; }
      const saved: SshProfile = { id: selected?.id ?? crypto.randomUUID(), name: values.name?.trim() ?? '',
        ...endpoint, username: values.username.trim(), auth: values.auth, fingerprint };
      let stored = true;
      try { persist([...profiles.filter(value => value.id !== saved.id), saved]); }
      catch { stored = false; setError('client.ssh.storageFailed'); }
      form.resetFields(); connected(info); setFinished(true);
      if (stored) close();
    } catch (failure) { if (lifetime.current) setError(sshError(failure, 'client.ssh.connectionFailed')); }
    finally { pending.current = false; if (lifetime.current) setBusy(false); }
  };
  return <Modal open title={t('client.ssh.connection')} width={400} onCancel={close} footer={null}
    maskClosable={!busy} closable={!busy} keyboard={!busy} className="ssh-dialog">
    <Space.Compact className="ssh-wide">
      <Select className="ssh-wide" value={selected?.id} placeholder={t('client.ssh.new')}
        disabled={busy} allowClear onChange={choose}
        options={profiles.map(value => ({ value: value.id, label: value.name || sshLabel(value) }))} />
      {selected && <Button disabled={busy} onClick={() => {
        try { persist(profiles.filter(value => value.id !== selected.id)); choose(); }
        catch { setError('client.ssh.storageFailed'); }
      }}>{t('client.ssh.removeSaved')}</Button>}
    </Space.Compact>
    <Form form={form} layout="vertical" onFinish={values => void submit(values)} disabled={busy || finished}
      initialValues={initial ?? { port: 22, auth: 'password', name: '' }}
      onValuesChange={values => { if ('host' in values || 'port' in values) setTrust(undefined); }}>
      <Form.Item name="name" label={t('client.ssh.name')}><Input maxLength={80} /></Form.Item>
      <div className="ssh-address">
        <Form.Item name="host" label={t('client.ssh.host')} rules={[{ required: true, message: t('client.ssh.required') }]}>
          <Input autoComplete="off" maxLength={253} /></Form.Item>
        <Form.Item name="port" label={t('client.ssh.port')} rules={[{ required: true, message: t('client.ssh.required') }]}>
          <InputNumber min={1} max={65535} precision={0} /></Form.Item>
      </div>
      <Form.Item name="username" label={t('client.ssh.username')}
        rules={[{ required: true, whitespace: true, message: t('client.ssh.required') }]}>
        <Input autoComplete="off" maxLength={256} /></Form.Item>
      <Form.Item name="auth" label={t('client.ssh.authentication')}><Select options={[
        { value: 'password', label: t('client.ssh.password') }, { value: 'key', label: t('client.ssh.privateKey') },
      ]} /></Form.Item>
      {auth === 'key' ? <>
        <Form.Item name="privateKey" label={t('client.ssh.privateKey')}
          rules={[{ required: true, message: t('client.ssh.required') }]}>
          <Input.TextArea rows={4} autoComplete="off" maxLength={65536} /></Form.Item>
        <Form.Item name="passphrase" label={t('client.ssh.passphrase')}>
          <Input.Password autoComplete="new-password" maxLength={4096} /></Form.Item>
      </> : <Form.Item name="password" label={t('client.ssh.password')}>
        <Input.Password autoComplete="new-password" maxLength={4096} /></Form.Item>}
      <p className="ssh-hint">{t('client.ssh.credentialsHint')}</p>
      {trust && <Alert type="warning" message={t('client.ssh.trustHost')}
        description={<code className="ssh-fingerprint">{trust.fingerprint}</code>} />}
      {error && <Alert type="error" role="alert" message={remoteErrorText(error)} />}
      <div className="ssh-dialog-actions"><Button onClick={close}>{t('client.ssh.cancel')}</Button>
        {!finished && <Button type="primary" htmlType="submit" loading={busy}>
          {t(trust ? 'client.ssh.trustAndConnect' : 'client.ssh.connect')}</Button>}</div>
    </Form>
  </Modal>;
}
