import { useEffect } from 'react';
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Space } from 'antd';
import type { SshApi } from './ssh';
import type { TerminalInfo } from './types';
import { sshLabel, type SshProfile } from './sshProfiles';
import { newSshValues, useSshConnection, type SshValues } from './useSshConnection';
import { displayText as t } from '../localization/messages';
import { remoteErrorText } from '../localization/errors';
import './ssh.css';

export function SshConnectionDialog({ api, initial, projectCwd, close, connected, dispose, changed }: {
  api: SshApi; initial?: SshProfile; projectCwd: string; close: () => void;
  connected: (info: TerminalInfo) => void; dispose: (id: string) => Promise<void>; changed: () => void;
}) {
  const [form] = Form.useForm<SshValues>();
  const auth = Form.useWatch('auth', form);
  const connection = useSshConnection({ api, initial, projectCwd, close: () => { changed(); close(); },
    connected, dispose, createId: () => crypto.randomUUID() });
  const { profiles, selected, busy, finished, error, trust, loading } = connection;
  useEffect(() => { if (finished) form.resetFields(); }, [finished, form]);
  const choose = (id?: string) => {
    form.resetFields();
    form.setFieldsValue(connection.choose(profiles.find(value => value.id === id)));
  };
  return <Modal open title={t('client.ssh.connection')} width={400} onCancel={close} footer={null}
    maskClosable={!busy} closable={!busy} keyboard={!busy} className="ssh-dialog">
    <Space.Compact className="ssh-wide">
      <Select className="ssh-wide" value={selected?.id} placeholder={t('client.ssh.new')}
        disabled={busy || finished || loading} allowClear onChange={choose}
        options={profiles.map(value => ({ value: value.id, label: value.name || sshLabel(value) }))} />
      {selected && <Button disabled={busy || finished || loading} onClick={() => {
        void connection.remove().then(done => {
          if (done) { form.resetFields(); form.setFieldsValue(newSshValues()); }
        });
      }}>{t('client.ssh.removeSaved')}</Button>}
    </Space.Compact>
    <Form form={form} layout="vertical" onFinish={values => void connection.submit(values)} disabled={busy || finished || loading}
      initialValues={initial ?? { port: 22, auth: 'password', name: '' }}
      onValuesChange={values => { if ('host' in values || 'port' in values) connection.clearTrust(); }}>
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
      {error && <Alert type="error" role="alert" message={remoteErrorText(error)}
        action={<Button onClick={() => void connection.refresh()}>{t('client.ssh.refresh')}</Button>} />}
      <div className="ssh-dialog-actions"><Button disabled={busy} onClick={close}>{t('client.ssh.cancel')}</Button>
        {!finished && <Button type="primary" htmlType="submit" loading={busy || loading}>
          {t(trust ? 'client.ssh.trustAndConnect' : 'client.ssh.connect')}</Button>}</div>
    </Form>
  </Modal>;
}
