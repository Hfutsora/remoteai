import { remoteErrorText } from '../localization/errors';
import { defaultText } from '../localization/messages';
import { useState, type MouseEvent } from 'react';
import { Download, Image as ImageIcon, LoaderCircle } from 'lucide-react';
import { useImageViewer } from './useImageViewer';
import type { PreviewImageLoader } from '../remote-chat/previewProgress';
import { PreviewTransferProgress } from './PreviewTransferProgress';
import { IMAGE_ZOOM_FACTOR, useImageGestures } from './useImageGestures';
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
  const gestures = useImageGestures();
  return <dialog ref={(dialog) => { if (dialog && !dialog.open) dialog.showModal(); }}
    className="cs-image-viewer" aria-label={description} onCancel={close}>
    <div className="cs-image-stage" {...gestures.stageProps} onDragStart={event => event.preventDefault()}
      onContextMenu={(event) => {
        if (!contextMenu) return;
        event.preventDefault();
        if (image.url && !image.error) contextMenu(event, image.url);
      }}>
      <img src={image.url ?? thumbnail} alt={description} draggable={false} referrerPolicy="no-referrer"
        onError={image.fail} ref={gestures.imageRef} />
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
      <button type="button" aria-label={translate("client.shared.zoomOut")}
        onClick={() => gestures.zoom(1 / IMAGE_ZOOM_FACTOR)}>−</button>
      <button type="button" aria-label={translate("client.shared.resetZoom")} onClick={gestures.reset}>
        {Math.round(gestures.scale * 100)}%</button>
      <button type="button" aria-label={translate("client.shared.zoomIn")}
        onClick={() => gestures.zoom(IMAGE_ZOOM_FACTOR)}>+</button>
      <button type="button" aria-label={translate("client.shared.rotateImage")} onClick={gestures.rotate}>↻</button>
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
