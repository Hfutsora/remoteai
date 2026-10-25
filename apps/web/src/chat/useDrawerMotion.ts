import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { chatDrawerWidth, createDrawerMotion } from '../../../../shared/navigation/drawerMotion';
import { SWIPE_SETTLE_MS } from '../../../../shared/navigation/pageSwipe';
import type { PageAnimation } from '../../../../shared/navigation/usePageTransition';

export interface DrawerMotionView {
  visible: boolean;
  rootClassName: string;
  rootStyle: CSSProperties;
}

function createAnimation(selector: string, offset: { current: number }): PageAnimation {
  let frame = 0;
  const setOffset = (value: number) => {
    offset.current = value;
    const root = document.querySelector<HTMLElement>(selector);
    root?.style.setProperty('--chat-drawer-offset', `${value}px`);
    root?.style.setProperty('--chat-drawer-progress', String(value / chatDrawerWidth(window.innerWidth)));
  };
  const stop = () => { cancelAnimationFrame(frame); };
  return { stop, setOffset, animate: (target, complete) => {
    stop();
    const start = offset.current;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / SWIPE_SETTLE_MS);
      setOffset(start + (target - start) * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else complete();
    };
    frame = requestAnimationFrame(tick);
  } };
}

export function useDrawerMotion({ open, onOpenChange }: {
  open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const id = useId().replace(/:/g, '');
  const rootClassName = `chat-drawer-motion-${id}`;
  const [width, setWidth] = useState(() => chatDrawerWidth(window.innerWidth));
  const [visible, setVisible] = useState(open);
  const committed = useRef(open);
  const offset = useRef(open ? width : 0);
  const change = useRef(onOpenChange);
  change.current = onOpenChange;
  const animation = useMemo(() => createAnimation(`.${rootClassName}`, offset), [rootClassName]);
  const motion = useMemo(() => createDrawerMotion({ width, initiallyOpen: committed.current, animation,
    onStart: () => setVisible(true),
    onSettled: next => { committed.current = next; setVisible(next); change.current(next); },
  }), [width, animation]);
  useLayoutEffect(() => {
    animation.setOffset(committed.current ? width : 0);
    setVisible(committed.current);
    return motion.dispose;
  }, [motion, animation, width]);
  useEffect(() => {
    const resize = () => setWidth(chatDrawerWidth(window.innerWidth));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (open) motion.open();
    else motion.close();
  }, [open, motion]);
  const view: DrawerMotionView = { visible, rootClassName: `chat-drawer-motion ${rootClassName}`,
    rootStyle: { '--chat-drawer-offset': `${offset.current}px`,
      '--chat-drawer-progress': offset.current / width } as CSSProperties };
  return { motion, view };
}
