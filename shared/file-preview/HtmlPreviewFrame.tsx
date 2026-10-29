import { useEffect, useRef, useState } from 'react';
import { displayText as t } from '../localization/messages';
import type { PreviewLoader } from './kinds';
import { prepareHtmlPreview } from './htmlAssets';
import { loadHtmlMedia, type HtmlMediaUpdate } from './htmlMedia';

type PreparedPreview = Awaited<ReturnType<typeof prepareHtmlPreview>> & {
  channel: string; controller: AbortController;
};

export function HtmlPreviewFrame({ text, path, load, className }: {
  text: string; path: string; load: PreviewLoader; className?: string;
}) {
  const [result, setResult] = useState<PreparedPreview>();
  const [failed, setFailed] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const started = useRef<PreparedPreview>();
  useEffect(() => {
    const controller = new AbortController();
    const channel = crypto.randomUUID();
    setResult(undefined); setFailed(false);
    void prepareHtmlPreview({ text, path, load, signal: controller.signal, mediaChannel: channel }).then(value => {
      if (!controller.signal.aborted) { setResult({ ...value, channel, controller }); setFailed(value.failed); }
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [text, path, load]);
  const loadMedia = () => {
    if (!result || started.current === result) return;
    started.current = result;
    const { controller, channel } = result;
    void loadHtmlMedia({ assets: result.media, signal: controller.signal, update: (asset, value) => {
      const update: HtmlMediaUpdate = { channel, id: asset.id, attribute: asset.attribute, value };
      frame.current?.contentWindow?.postMessage(update, '*');
      if (result.hasFailed()) setFailed(true);
    } }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
  };
  if (!result) return <p role="status">{t(failed ? 'client.filePreview.unavailable' : 'client.projectBrowser.loading')}</p>;
  return <>
    {failed && <p role="status">{t('client.filePreview.someHtmlAssetsUnavailable')}</p>}
    <iframe ref={frame} onLoad={loadMedia} title={t('client.downloads.htmlPreview')}
      srcDoc={result.html} sandbox="allow-scripts"
      referrerPolicy="no-referrer" className={className} />
  </>;
}
