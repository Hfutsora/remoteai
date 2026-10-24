import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { adjacentPage, pageSwipeOffset, type PrimaryPage, type SwipeDirection } from './pageSwipe';

export interface PageAnimation {
  setOffset: (offset: number) => void;
  animate: (offset: number, complete: () => void) => void;
  stop: () => void;
}

interface Options {
  page: string; width: number; onChange: (page: PrimaryPage) => void; animation: PageAnimation;
}
export interface PagePreview { page: PrimaryPage; direction: SwipeDirection }

/** Keep the selected tab unchanged until the incoming page has finished settling. */
export function usePageTransition({ page, width, onChange, animation }: Options) {
  const [preview, setPreview] = useState<PagePreview | null>(null);
  const current = useRef<PagePreview | null>(null);
  const settling = useRef(false);
  const revision = useRef(0);
  const change = useRef(onChange);
  change.current = onChange;
  useLayoutEffect(() => {
    revision.current++;
    animation.stop();
    animation.setOffset(0);
    current.current = null;
    settling.current = false;
    setPreview(null);
    return () => { revision.current++; animation.stop(); };
  }, [page, width, animation]);

  const onMove = useCallback((dx: number, direction: SwipeDirection) => {
    if (settling.current || width <= 0) return;
    const destination = adjacentPage(page, direction);
    if (!destination) return;
    if (!current.current) {
      current.current = { page: destination, direction };
      setPreview(current.current);
    }
    animation.setOffset(pageSwipeOffset(dx, current.current.direction, width));
  }, [page, width, animation]);

  const settle = useCallback((destination?: PrimaryPage) => {
    if (!current.current || settling.current) return;
    settling.current = true;
    const version = revision.current;
    const offset = destination ? (current.current.direction === 'left' ? -width : width) : 0;
    animation.animate(offset, () => {
      if (revision.current !== version) return;
      current.current = null;
      settling.current = false;
      if (destination) change.current(destination);
      setPreview(null);
      animation.setOffset(0);
    });
  }, [animation, width]);
  const onEnd = useCallback((direction?: SwipeDirection) => {
    if (!direction) settle();
  }, [settle]);
  const navigate = useCallback((destination: PrimaryPage) => {
    if (current.current?.page === destination) settle(destination);
  }, [settle]);
  const progress = useMemo(() => ({ onMove, onEnd }), [onMove, onEnd]);
  return { preview, progress, navigate };
}
