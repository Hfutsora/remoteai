import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import { LoungePage } from '../../../shared/lounge/LoungePage';
import { useDesktopLounge } from '../src/lounge/useDesktopLounge';
import { DashboardNavigation, type DashboardPage } from '../src/components/dashboard/DashboardNavigation';
import { translate } from '../src/i18n';
import { setGuiLanguage } from '../src/i18n/uiText';
import { useGuiLanguage } from '../src/i18n/useGuiLanguage';
import { applyThemeMode } from '../src/utils/themeMode';
import type { CloudAuthState } from '../src/types';
import 'antd/dist/reset.css';
import '../src/styles.css';

const parameters = new URLSearchParams(location.search);
const dark = parameters.has('dark');
applyThemeMode(dark ? 'dark' : 'light');
setGuiLanguage('zh');
window.loungeFixture = { setLanguage: setGuiLanguage };
declare global { interface Window { loungeFixture: { setLanguage: typeof setGuiLanguage } } }
const auth: CloudAuthState = { enabled: true, authenticated: true, baseUrl: 'https://lounge.test',
  userEmail: 'alice@example.test', userId: 'alice', lastSyncAt: null, sessionExpired: false };

function Fixture() {
  const language = useGuiLanguage();
  const [page, setPage] = useState<DashboardPage>('accounts');
  const lounge = useDesktopLounge(auth);
  return <ConfigProvider theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
    <div className="app-shell sidebar-navigation-shell" style={{ gridTemplateRows: '38px 0 minmax(0, 1fr)' }}>
      <div className="window-titlebar" style={{ padding: 8 }}>Remote AI · {parameters.get('mode') ?? 'local'}</div>
      <aside className="app-sidebar"><div className="sidebar-brand">Remote AI</div>
        <DashboardNavigation page={page} onPageChange={setPage} loungeUnread={lounge.state.unread}
          loungeAvailable={auth.authenticated}
          variant="sidebar" t={(key, values) => translate(language, key, values)} />
      </aside>
      <main className="lounge-desktop-main">{page === 'lounge' ? <LoungePage controller={lounge.controller} />
        : <div style={{ padding: 32 }} data-testid="other-page">{parameters.get('mode') ?? 'local'}</div>}</main>
    </div>
  </ConfigProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
