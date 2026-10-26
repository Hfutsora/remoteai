import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { displayText as t } from '../localization/messages';
import { PdfAssetReader, PdfCMapReader } from './pdfAssets';
import { PdfPage } from './PdfPage';
import './pdfPreview.css';

GlobalWorkerOptions.workerSrc = workerUrl;
const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export default function PdfPreview({ file, name }: { file: Blob; name: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    let closed = false;
    let task: ReturnType<typeof getDocument> | undefined;
    setDocument(undefined); setError(false); setPage(1);
    void file.arrayBuffer().then(bytes => {
      if (closed) return;
      task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true,
        useWorkerFetch: false, CMapReaderFactory: PdfCMapReader,
        StandardFontDataFactory: PdfAssetReader, WasmFactory: PdfAssetReader });
      // Password-protected files need a compatible reader; never leave an unresolved loading prompt.
      task.onPassword = () => { if (!closed) setError(true); };
      return task.promise.then(value => { if (!closed) setDocument(value); });
    }).catch(() => { if (!closed) setError(true); });
    return () => { closed = true; void task?.destroy().catch(() => console.warn('PDF cleanup failed')); };
  }, [file]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(0, entry.contentRect.width - 32)));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  return <div className="file-pdf-preview">
    {document && !error && <div className="file-pdf-toolbar">
      <button type="button" aria-label={t('client.mobile.previousPage')} disabled={page <= 1}
        onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
      <span role="status">{page} / {document.numPages}</span>
      <button type="button" aria-label={t('client.mobile.nextPage')} disabled={page >= document.numPages}
        onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
      <button type="button" aria-label={t('client.shared.zoomOut')} disabled={zoom <= MIN_ZOOM}
        onClick={() => setZoom(zoom - ZOOM_STEP)}><ZoomOut size={16} /></button>
      <button type="button" onClick={() => setZoom(1)}>{t('client.workspaceActions.fitToWindow')}</button>
      <button type="button" aria-label={t('client.shared.zoomIn')} disabled={zoom >= MAX_ZOOM}
        onClick={() => setZoom(zoom + ZOOM_STEP)}><ZoomIn size={16} /></button>
    </div>}
    <div className="file-pdf-pages" ref={host}>
      {error ? <p role="status" className="file-preview-feedback">{t('client.filePreview.pdfUnavailable')}</p>
        : document && width > 0 ? <PdfPage key={page} document={document} page={page} name={name}
          width={width * zoom} />
          : <p role="status" className="file-preview-feedback">{t('client.projectBrowser.loading')}</p>}
    </div>
  </div>;
}
