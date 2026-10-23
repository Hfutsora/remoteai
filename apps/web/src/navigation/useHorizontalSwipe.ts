import { useEffect } from 'react';
import {
  horizontalDirection, verticalSwipe, SWIPE_COMPLETE_DISTANCE, SWIPE_LONG_PRESS_MS, type SwipeDirection,
} from '../../../../shared/navigation/pageSwipe';

interface Swipe { x: number; y: number; id: number; started: number; direction?: SwipeDirection }
interface Options {
  enabled: boolean; surface: (target: EventTarget | null) => Element | null;
  onLeft?: () => void; onRight?: () => void;
}

function createSwipeHandlers({ surface, onLeft, onRight }: Omit<Options, 'enabled'>) {
  let swipe: Swipe | null = null;
  const actions = { left: onLeft, right: onRight };
  const hasSelection = () => window.getSelection()?.isCollapsed === false;
  const cancel = () => { swipe = null; };
  const start = (event: TouchEvent) => {
    cancel();
    if (event.touches.length !== 1 || hasSelection() || !surface(event.target)) return;
    const touch = event.touches[0];
    swipe = { x: touch.clientX, y: touch.clientY, id: touch.identifier, started: Date.now() };
  };
  const move = (event: TouchEvent) => {
    if (!swipe) return;
    const touch = event.touches[0];
    if (event.touches.length !== 1 || touch.identifier !== swipe.id || hasSelection()) { cancel(); return; }
    const dx = touch.clientX - swipe.x;
    const dy = touch.clientY - swipe.y;
    if (!swipe.direction) {
      if (verticalSwipe(dx, dy) || Date.now() - swipe.started >= SWIPE_LONG_PRESS_MS) { cancel(); return; }
      const direction = horizontalDirection(dx, dy);
      if (direction && !actions[direction]) { cancel(); return; }
      swipe.direction = direction;
    }
    if (swipe.direction && event.cancelable) event.preventDefault();
  };
  const end = (event: TouchEvent) => {
    const current = swipe;
    cancel();
    if (!current?.direction || event.touches.length || hasSelection()) return;
    const touch = Array.from(event.changedTouches).find(item => item.identifier === current.id);
    if (!touch) return;
    // A completed drag must not also click the row or button beneath it.
    if (event.cancelable) event.preventDefault();
    const direction = horizontalDirection(touch.clientX - current.x, touch.clientY - current.y,
      SWIPE_COMPLETE_DISTANCE);
    if (direction === current.direction) actions[direction]?.();
  };
  return { start, move, end, cancel };
}

export function useHorizontalSwipe({ enabled, surface, onLeft, onRight }: Options) {
  useEffect(() => {
    if (!enabled) return;
    const { start, move, end, cancel } = createSwipeHandlers({ surface, onLeft, onRight });
    document.addEventListener('touchstart', start, { capture: true, passive: true });
    document.addEventListener('touchmove', move, { capture: true, passive: false });
    document.addEventListener('touchend', end, { capture: true, passive: false });
    document.addEventListener('touchcancel', cancel, { capture: true, passive: true });
    return () => {
      document.removeEventListener('touchstart', start, true);
      document.removeEventListener('touchmove', move, true);
      document.removeEventListener('touchend', end, true);
      document.removeEventListener('touchcancel', cancel, true);
    };
  }, [enabled, surface, onLeft, onRight]);
}
