import { displayText } from '../i18n/index';
import { t, useLanguage } from '../i18n';
import { useState } from 'react';
import { Button, Dialog, Switch } from 'antd-mobile';
import { ChevronRight, Grid2X2, IdCard, Info, LockKeyhole, LogOut,
  Download, Monitor, RefreshCw, ShieldCheck, Type, UserRound } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../hooks';
import { signOut } from '../store';
import type { useTotpVault } from '../useTotpVault';
import { AdaptiveSheet } from '../components/AdaptiveSheet';
import { version } from '../../../../package.json';
import { SettingsRow } from './SettingsRow';
import { DesktopVersionSheet } from './DesktopVersionSheet';
import { loadRefreshMinutes } from './refreshInterval';
import { RefreshIntervalSheet } from './RefreshIntervalSheet';
import { PasswordSheet } from './PasswordSheet';
import { AboutPage } from './AboutPage';
import { LanguageSettingsRow } from './LanguageSettingsRow';
import { ThemeSheet } from './ThemeSheet';
import { ThemeSettingsRow } from './ThemeSettingsRow';
import { profileRole } from '../i18n/profile';
import './styles.css';
import { DownloadManagerPage } from '../downloads/DownloadManagerPage';
import { downloadOwner } from '../downloads/manager';
import { AutoSaveSettings } from '../../../../shared/project-browser/AutoSaveSettings';
import { useBrowserPreferences } from '../../../../shared/project-browser/useBrowserPreferences';
import { GlobalFontSettings } from '../../../../shared/appearance/GlobalFontSettings';
import { useGlobalFontSize } from '../../../../shared/appearance/fontSize';

type Panel = 'profile' | 'identity' | 'refresh' | 'totp' | 'password' | 'about'
  | 'downloads' | 'desktop' | 'theme' | 'files' | 'font' | null;

export function SettingsPage({ totpManager }: { totpManager: ReturnType<typeof useTotpVault> }) {
  useLanguage();
  const fontSize = useGlobalFontSize();
  const filePreferences = useBrowserPreferences();
  const dispatch = useAppDispatch();
  const session = useAppSelector(state => state.auth.session);
  const profile = useAppSelector(state => state.data.profile) ?? session?.profile;
  const [panel, setPanel] = useState<Panel>(null);
  const [minutes, setMinutes] = useState(loadRefreshMinutes);
  const email = profile?.email || session?.email || '';
  const role = profileRole(profile);
  const close = () => setPanel(null);
  const logout = async () => {
    const confirmed = await Dialog.confirm({ title: t("client.settings.signOutOfThisAccount"),
      content: t("client.settings.youWillNeedToSignInAgainYourCloudData"), confirmText: t("client.app.signOut"), cancelText: t("client.settings.staySignedIn") });
    if (confirmed) void dispatch(signOut());
  };
  if (panel === 'about') return <AboutPage onBack={close} />;
  if (panel === 'downloads' && session) return <DownloadManagerPage owner={downloadOwner(session)} onBack={close} />;
  return <>
    <div className="page-body settings-page">
      <div className="settings-layout"><section className="settings-group settings-profile-group">
        <button type="button" className="settings-profile" onClick={() => setPanel('profile')} aria-label={t("client.settings.viewProfile")}>
          <span className="settings-avatar">{email.slice(0, 2).toUpperCase()}</span>
          <span><strong>{email}</strong><small>{t("client.settings.remoteAiCloudAccount")}</small></span><ChevronRight size={20} /></button>
        <SettingsRow label={t("client.settings.profile")} value={email} icon={UserRound} tone="blue" onClick={() => setPanel('profile')} />
        <SettingsRow label={t("client.settings.roleDetails")} value={role} icon={IdCard} tone="blue" onClick={() => setPanel('identity')} />
      </section>
      <div className="settings-preferences">
        <section className="settings-group">
          <ThemeSettingsRow onOpen={() => setPanel('theme')} />
          <SettingsRow label={t('client.appearance.globalFontSize')} value={`${fontSize}px`} icon={Type}
            onClick={() => setPanel('font')} />
          <SettingsRow label={t("client.downloads.downloads")} icon={Download} onClick={() => setPanel('downloads')} />
          <SettingsRow label={t("client.projectBrowser.autoSaveFiles")} icon={RefreshCw} onClick={() => setPanel('files')} />
          <LanguageSettingsRow />
          <SettingsRow label={t("client.settings.autoRefreshUsage")} value={t("client.settings.minutes", { value1: minutes })} icon={RefreshCw}
            onClick={() => setPanel('refresh')} />
          <SettingsRow label={t("client.app.2faKeys")} value={totpManager.cloudSyncEnabled ? t("client.settings.on") : t("client.settings.off")} icon={ShieldCheck}
            onClick={() => setPanel('totp')} />
        </section>
        {profile?.role === 'admin' && <section className="settings-group">
          <SettingsRow label={t("client.settings.adminConsole")} icon={Grid2X2}
            onClick={() => window.location.assign(`${session?.baseUrl ?? window.location.origin}/admin`)} />
        </section>}
        <section className="settings-group"><SettingsRow label={t("client.settings.changePassword")} icon={LockKeyhole} tone="orange"
          onClick={() => setPanel('password')} /></section>
        <section className="settings-group">
          <SettingsRow label={t("client.settings.desktopVersion")} icon={Monitor} tone="blue" onClick={() => setPanel('desktop')} />
          <SettingsRow label={t("client.settings.aboutRemoteAi")} value={`v${version}`}
          icon={Info} tone="blue" onClick={() => setPanel('about')} /></section>
      </div></div>
      <Button className="settings-logout" block color="danger" fill="outline" onClick={() => void logout()}>
        <LogOut size={21} />{t("client.app.signOut")}</Button>
    </div>
    <AdaptiveSheet open={panel === 'files'} title={t("client.projectBrowser.fileBrowserSettings")} onClose={close} width={400}>
      <div className="settings-sync"><AutoSaveSettings preferences={filePreferences} t={displayText} /></div>
    </AdaptiveSheet>
    <AdaptiveSheet open={panel === 'font'} title={t('client.appearance.globalFontSize')} onClose={close} width={480}>
      <GlobalFontSettings t={t} />
    </AdaptiveSheet>
    <AdaptiveSheet open={panel === 'profile' || panel === 'identity'} onClose={close} width={400}
      title={panel === 'identity' ? t("client.settings.roleDetails") : t("client.settings.profile")}>
      <dl className="settings-profile-details"><dt>{t("client.app.email")}</dt><dd>{email}</dd><dt>{t("client.settings.role")}</dt><dd>{role}</dd></dl>
    </AdaptiveSheet>
    <AdaptiveSheet open={panel === 'totp'} title={t("client.app.2faKeys")} onClose={close} width={400}>
      <div className="settings-sync"><div><strong>{t("client.settings.cloudSync")}</strong>
        <p>{t("client.settings.useTheSame2faKeysOnYourPhoneAndThe")}</p></div>
        <Switch aria-label={t("client.settings.cloudSync")} checked={totpManager.cloudSyncEnabled} disabled={totpManager.syncing}
          onChange={totpManager.setCloudSyncEnabled} /></div>
    </AdaptiveSheet>
    {panel === 'refresh' && <RefreshIntervalSheet minutes={minutes} onSaved={setMinutes} onClose={close} />}
    {panel === 'password' && <PasswordSheet onClose={close} />}
    {panel === 'theme' && <ThemeSheet onClose={close} />}
    {panel === 'desktop' && <DesktopVersionSheet onClose={close} />}
  </>;
}
