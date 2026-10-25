import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { UsageStatus } from '../src/pages/codexGui/UsageStatus';
import { ChatUsage } from '../../web/src/chat/ChatUsage';
import { invoke } from '../src/api/backend';
import { setInterfaceLanguage } from '../../../shared/localization/interfaceLanguage';
import type { Language } from '../../../shared/localization/language';
import '../../web/src/chat/composerDesktop.css';

setInterfaceLanguage('zh');
const read = () => invoke('codex_gui_usage_summary');
function Harness() {
  const [open, setOpen] = useState(true);
  const [language, setLanguage] = useState<Language>('zh');
  return <ConfigProvider><main>
    <button onClick={() => setOpen(value => !value)}>{open ? 'Close' : 'Open'}</button>
    <select aria-label="Language" value={language} onChange={event => {
      const next = event.target.value as Language;
      setInterfaceLanguage(next); setLanguage(next);
    }}>{['zh', 'en', 'ru', 'ja'].map(value => <option key={value}>{value}</option>)}</select>
    {open && <>
      <section data-testid="local"><h2>PC local</h2><UsageStatus active /></section>
      <section data-testid="remote"><h2>PC remote / Web</h2><div className="chat-composer-status">
        <ChatUsage read={read} active ready inline={window.matchMedia('(min-width: 861px)').matches} />
      </div></section>
      <section data-testid="settings"><h2>Web settings</h2><ChatUsage read={read} active ready /></section>
    </>}
  </main></ConfigProvider>;
}
const style = document.createElement('style');
style.textContent = 'body{font-family:sans-serif;margin:20px;background:#f5f6f5}main{max-width:850px;margin:auto}'
  + 'section{background:white;padding:16px;margin:18px 0;border-radius:12px}h2{font-size:16px}'
  + ':root{--ink:#233329;--line:#dfe6e1;--muted:#66796d;--green:#0b8065}';
document.head.append(style);
createRoot(document.getElementById('root')!).render(<Harness />);
