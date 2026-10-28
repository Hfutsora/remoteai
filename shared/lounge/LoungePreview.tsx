import { Modal } from 'antd';
import { Minus, Plus, X } from 'lucide-react';
import { IMAGE_ZOOM_FACTOR, useImageGestures } from '../chat/useImageGestures';
import { displayText as t } from '../localization/messages';
import './preview.css';

export function LoungePreview({ uri, close }: { uri: string; close: () => void }) {
  return <Modal open footer={null} width="min(900px, 90vw)" centered
    title={t('client.lounge.previewImage')} closeIcon={<X size={20} />} onCancel={close}>
    <LoungeImageViewport uri={uri} />
  </Modal>;
}

function LoungeImageViewport({ uri }: { uri: string }) {
  const gestures = useImageGestures();
  return <>
    <div className="lounge-preview-stage" ref={gestures.stageRef} {...gestures.stageProps}
      onDragStart={event => event.preventDefault()}>
      <img className="lounge-preview" src={uri} alt={t('client.lounge.image')}
        draggable={false} ref={gestures.imageRef} />
    </div>
    <div className="lounge-preview-tools">
      <button type="button" aria-label={t('client.shared.zoomOut')}
        onClick={() => gestures.zoom(1 / IMAGE_ZOOM_FACTOR)}><Minus size={20} /></button>
      <button type="button" aria-label={t('client.shared.resetZoom')} onClick={gestures.reset}>
        {Math.round(gestures.scale * 100)}%</button>
      <button type="button" aria-label={t('client.shared.zoomIn')}
        onClick={() => gestures.zoom(IMAGE_ZOOM_FACTOR)}><Plus size={20} /></button>
    </div>
  </>;
}
