import { remoteErrorText } from '../localization/errors';
import { defaultText } from '../localization/messages';
import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Download, Image as ImageIcon, LoaderCircle } from 'lucide-react';
import { useImageViewer } from './useImageViewer';
import type { PreviewImageLoader } from '../remote-chat/previewProgress';
import { PreviewTransferProgress } from './PreviewTransferProgress';
import { clampZoom, INITIAL_TRANSFORM, moveImage, type Point } from './imageTransform';
import './imageViewer.css';
import { ImageAiToolbar } from './ImageAiToolbar';

interface Props {
  thumbnail: string; description: string; load: PreviewImageLoader; close: () => void;
  download?: (url: string) => void | Promise<void>;
  contextMenu?: (event: MouseEvent, url: string) => void;
  feedback?: string;
  translate?: (text: string) => string;
  formatError?: (error: unknown) => string;
}

export function ImageViewer({ thumbnail, description, load, close, download, contextMenu, feedback,
  translate = defaultText, formatError = remoteErrorText }: Props) {
  const image = useImageViewer(load);
  const [downloadError, setDownloadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [transform, setTransform] = useState(INITIAL_TRANSFORM);
  const pointers = useRef(new Map<number, Point>());
  const anchor = useRef({ before: transform, start: [] as Point[] });
  const point = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY });
  const rebase = () => { anchor.current = { before: transform, start: [...pointers.current.values()] }; };
  return <dialog ref={(dialog) => { if (dialog && !dialog.open) dialog.showModal(); }}
    className="cs-image-viewer" aria-label={description} onCancel={close}>
    <div className="cs-image-stage" onContextMenu={(event) => {
      if (!contextMenu) return;
      event.preventDefault();
      if (image.url && !image.error) contextMenu(event, image.url);
    }} onWheel={(event) => setTransform((old) => ({ ...old,
      scale: clampZoom(old.scale * (event.deltaY < 0 ? 1.2 : 1 / 1.2)) }))}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, point(event)); rebase();
      }} onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, point(event));
        setTransform(moveImage({ ...anchor.current, current: [...pointers.current.values()] }));
      }} onPointerUp={(event) => { pointers.current.delete(event.pointerId); rebase(); }}
      onPointerCancel={() => pointers.current.clear()} onDoubleClick={() => setTransform(INITIAL_TRANSFORM)}>
      <img src={image.url ?? thumbnail} alt={description} draggable={false} referrerPolicy="no-referrer"
        onError={image.fail} style={{ transform: `translate(${transform.x}px, ${transform.y}px) `
          + `rotate(${transform.rotation}deg) scale(${transform.scale})` }} />
    </div>
    <button type="button" className="cs-image-close" aria-label={translate("client.shared.closeImage")} onClick={close}>×</button>
    {download && <button type="button" className="cs-image-download" disabled={saving || image.loading}
      aria-label={translate(saving ? "client.projectBrowser.saving" : "client.shared.downloadImage")} aria-busy={saving}
      onClick={async () => {
        setSaving(true);
        setDownloadError('');
        try { await download(await image.loadOriginal()); }
        catch (error) { setDownloadError(error instanceof Error ? error.message : '下载失败，请重试。'); }
        finally { setSaving(false); }
      }}>{saving ? <LoaderCircle size={24} className="cs-image-download-spinner" aria-hidden="true" />
        : <Download size={24} aria-hidden="true" />}
      <span>{translate(saving ? "client.projectBrowser.saving" : "client.shared.downloadImage")}</span></button>}
    <div className="cs-image-toolbar">
      <button type="button" aria-label={translate("client.shared.zoomOut")} onClick={() => setTransform((v) => ({ ...v,
        scale: clampZoom(v.scale / 1.5) }))}>−</button>
      <button type="button" aria-label={translate("client.shared.resetZoom")} onClick={() => setTransform(INITIAL_TRANSFORM)}>
        {Math.round(transform.scale * 100)}%</button>
      <button type="button" aria-label={translate("client.shared.zoomIn")} onClick={() => setTransform((v) => ({ ...v,
        scale: clampZoom(v.scale * 1.5) }))}>+</button>
      <button type="button" aria-label={translate("client.shared.rotateImage")} onClick={() => setTransform((v) => ({ ...v,
        rotation: (v.rotation + 90) % 360 }))}>↻</button>
    </div>
    <ImageAiToolbar load={image.loadOriginal} close={close} translate={translate}
      originalAction={!image.url && !image.loading && <button type="button" className="cs-image-original"
        onClick={image.request}><ImageIcon size={20} aria-hidden="true" />
        <span>{translate(image.error ? "client.mobile.reloadOriginalImage" : "client.chat.viewOriginal")}</span></button>} />
    {image.loading && <div className="cs-image-status cs-image-transfer">
      <PreviewTransferProgress progress={image.progress} label={translate("client.shared.loadingFullImage")} /></div>}
    {downloadError && <div className="cs-image-status" role="status">{formatError(downloadError)}</div>}
    {feedback && <div className="cs-image-status" role="status">{feedback}</div>}
    {image.error && <div className="cs-image-status" role="status">{translate("client.shared.couldNotLoadFullImage")}</div>}
  </dialog>;
}
