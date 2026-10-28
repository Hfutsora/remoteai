import { useEffect, useState } from 'react';
import { displayText as t } from '../localization/messages';
import type { PreviewLoader } from './kinds';
import { prepareHtmlPreview } from './htmlAssets';

export function HtmlPreviewFrame({ text, path, load, className }: {
  text: string; path: string; load: PreviewLoader; className?: string;
}) {
  const [result, setResult] = useState<{ html: string; failed: boolean }>();
  useEffect(() => {
    const controller = new AbortController();
    setResult(undefined);
    void prepareHtmlPreview({ text, path, load, signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) setResult(value);
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ html: '', failed: true });
    });
    return () => controller.abort();
  }, [text, path, load]);
  if (!result) return <p role="status">{t('client.projectBrowser.loading')}</p>;
  return <>
    {result.failed && <p role="status">{t('client.filePreview.unavailable')}</p>}
    <iframe title={t('client.downloads.htmlPreview')} srcDoc={result.html} sandbox="allow-scripts"
      referrerPolicy="no-referrer" className={className} />
  </>;
}
