import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { Alert, Button, Form, Modal, Popconfirm, theme } from 'antd';
import { ArrowUpRight, ShieldCheck, Terminal, Trash2 } from 'lucide-react';
import type { SshApi } from './ssh';
import type { TerminalInfo } from './types';
import { sshLabel, type SshProfile } from './sshProfiles';
import { newSshValues, useSshConnection, type SshValues } from './useSshConnection';
import { SshConnectionFields } from './SshConnectionFields';
import { SshProfileList } from './SshProfileList';
import { displayText as t } from '../localization/messages';
import { remoteErrorText } from '../localization/errors';
import './ssh-dialog.css';

export function SshConnectionDialog({ api, initial, manage = false, projectCwd, close, connected, dispose, changed }: {
  api: SshApi; initial?: SshProfile; manage?: boolean; projectCwd: string; close: () => void;
  connected: (info: TerminalInfo) => void; dispose: (id: string) => Promise<void>; changed: () => void;
}) {
  const [form] = Form.useForm<SshValues>();
  const formId = useId();
  const feedback = useRef<HTMLDivElement>(null);
  const { token } = theme.useToken();
  const connection = useSshConnection({ api, initial, projectCwd, close: () => { changed(); close(); },
    connected, dispose, createId: () => crypto.randomUUID() });
  const { profiles, selected, busy, finished, error, trust, loading } = connection;
  const disabled = busy || finished || loading;
  const managing = manage || !!initial;
  useEffect(() => { if (finished) form.resetFields(); }, [finished, form]);
  useEffect(() => {
    if (trust || error) feedback.current?.scrollIntoView({ block: 'nearest' });
  }, [trust, error]);
  const choose = (profile?: SshProfile) => {
    form.resetFields();
    form.setFieldsValue(connection.choose(profile));
  };
  const remove = async () => {
    if (await connection.remove()) { form.resetFields(); form.setFieldsValue(newSshValues()); changed(); }
  };
  const colors = {
    '--ssh-surface': token.colorBgElevated, '--ssh-field': token.colorBgContainer,
    '--ssh-subtle': token.colorFillAlter, '--ssh-line': token.colorBorderSecondary,
    '--ssh-text': token.colorText, '--ssh-muted': token.colorTextSecondary,
  } as CSSProperties;
  const title = t(managing ? 'client.ssh.manage' : 'client.ssh.createTitle');
  return <Modal open centered title={<div className="ssh-dialog-heading">
    <span className="ssh-dialog-symbol"><Terminal size={24} aria-hidden /></span>
    <span><span className="ssh-dialog-title">{title}</span>
      <span className="ssh-dialog-subtitle">
        {t(managing ? 'client.ssh.manageHint' : 'client.ssh.createHint')}
      </span></span>
  </div>} width={managing ? 860 : 560} onCancel={close} footer={null} style={colors}
    maskClosable={!busy} closable={!busy} keyboard={!busy}
    className={`ssh-dialog${managing ? ' ssh-dialog-manager' : ''}`}>
    <div className="ssh-dialog-layout">
      {managing && <SshProfileList profiles={profiles} selected={selected} disabled={disabled}
        loading={loading} choose={choose} />}
      <Form id={formId} form={form} layout="vertical" className="ssh-connection-form"
        onFinish={values => void connection.submit(values)} disabled={disabled}
        initialValues={initial ?? newSshValues()} requiredMark={false} scrollToFirstError={{ block: 'center' }}
        onValuesChange={values => { if ('host' in values || 'port' in values) connection.clearTrust(); }}>
        <div className="ssh-form-scroll">
          {managing && <div className="ssh-detail-heading">
            <h3>{selected ? selected.name || sshLabel(selected) : t('client.ssh.createTitle')}</h3>
            <span className="ssh-detail-badge">
              {t(selected ? 'client.ssh.savedConnection' : 'client.ssh.newConnection')}
            </span>
          </div>}
          <SshConnectionFields form={form} />
          <div className="ssh-credentials-note"><ShieldCheck size={17} aria-hidden />
            <p>{t('client.ssh.credentialsHint')}</p></div>
          <div ref={feedback} aria-live="polite">
            {trust && <Alert showIcon type="warning" message={t('client.ssh.trustHost')}
              description={<code className="ssh-fingerprint">{trust.fingerprint}</code>} />}
            {error && <Alert showIcon type="error" role="alert" message={remoteErrorText(error)}
              action={<Button size="small" disabled={busy} onClick={() => void connection.refresh()}>
                {t('client.ssh.refresh')}</Button>} />}
          </div>
        </div>
        <div className="ssh-dialog-actions">
          {selected && <Popconfirm title={t('client.ssh.removeTitle')}
            description={t('client.ssh.removeHint')} onConfirm={remove} disabled={disabled}
            okText={t('client.ssh.removeSaved')} cancelText={t('client.ssh.cancel')}
            okButtonProps={{ danger: true }} styles={{ root: { maxWidth: 400 } }}>
            <Button className="ssh-remove" type="text" danger disabled={disabled} icon={<Trash2 size={16} />}>
              {t('client.ssh.removeSaved')}</Button>
          </Popconfirm>}
          <div className="ssh-submit-actions">
            <Button disabled={busy} onClick={close}>{t('client.ssh.cancel')}</Button>
            {!finished && <Button className="ssh-connect" type="primary" htmlType="submit"
              loading={busy || loading} icon={<ArrowUpRight size={16} />}>
              {t(trust ? 'client.ssh.trustAndConnect' : 'client.ssh.connect')}</Button>}
          </div>
        </div>
      </Form>
    </div>
  </Modal>;
}
