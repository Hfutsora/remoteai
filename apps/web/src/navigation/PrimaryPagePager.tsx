import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PRIMARY_PAGES, SWIPE_SETTLE_MS, type PrimaryPage } from '../../../../shared/navigation/pageSwipe';
import { PagePreviewContext, PageSwipeContext } from '../../../../shared/navigation/PageSwipeContext';
import { usePageTransition, type PageAnimation } from '../../../../shared/navigation/usePageTransition';
import { usePrimaryPageSwipe } from './usePrimaryPageSwipe';
import './pagePager.css';

interface Props {
  page: string; onChange: (page: PrimaryPage) => void;
  pages: Record<PrimaryPage, ReactNode>; children?: ReactNode;
}

export function PrimaryPagePager({ page, onChange, pages, children }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const animation = useMemo<PageAnimation>(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      clearTimeout(timer);
      if (track.current) track.current.style.transition = '';
    };
    const setOffset = (offset: number) => {
      if (track.current) track.current.style.transform = offset ? `translate3d(${offset}px, 0, 0)` : '';
    };
    return { setOffset, stop, animate: (offset, complete) => {
      stop();
      if (track.current) track.current.style.transition = `transform ${SWIPE_SETTLE_MS}ms cubic-bezier(.2,.7,.2,1)`;
      setOffset(offset);
      timer = setTimeout(() => { stop(); complete(); }, SWIPE_SETTLE_MS);
    } };
  }, []);
  useLayoutEffect(() => {
    const node = track.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);
  const { preview, progress, navigate } = usePageTransition({ page, width, onChange, animation });
  usePrimaryPageSwipe(page, navigate, progress);
  const onNext = useCallback(() => navigate('accounts'), [navigate]);
  const chatSwipe = useMemo(() => ({ ...progress, onNext }), [progress, onNext]);
  const primary = PRIMARY_PAGES.some(key => key === page);
  return <PageSwipeContext.Provider value={chatSwipe}>
    <PagePreviewContext.Provider value={preview?.page}>
      <div className={`primary-page-viewport${primary ? ' is-primary' : ''}`}>
        <div ref={track} className={`primary-page-track${preview ? ' is-swiping' : ''}`}>
          {PRIMARY_PAGES.map(key => {
            const active = key === page;
            const incoming = key === preview?.page;
            const visible = active || incoming;
            const left = incoming ? (preview.direction === 'left' ? '100%' : '-100%') : undefined;
            return <div key={key} data-primary-page={key}
              className={`primary-page-pane${incoming ? ' is-preview' : ''}`} hidden={!visible}
              aria-hidden={!active} {...(!active ? { inert: '' } : {})} style={{ left }}>
              {(visible || key === 'chat') && pages[key]}
            </div>;
          })}
          {children}
        </div>
      </div>
    </PagePreviewContext.Provider>
  </PageSwipeContext.Provider>;
}
