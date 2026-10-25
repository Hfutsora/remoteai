import { useCallback, useRef, type RefObject } from 'react';
import { usePageSwipe } from '../../../../shared/navigation/PageSwipeContext';
import type { SwipeDirection } from '../../../../shared/navigation/pageSwipe';
import { useHorizontalSwipe } from '../navigation/useHorizontalSwipe';
import type { ChatDrawerMethods } from './ChatDrawer';

export function useChatDrawerSwipe(enabled: boolean, onOpen: () => void, onNext?: () => void,
  drawer?: RefObject<ChatDrawerMethods | null>) {
  const swipe = usePageSwipe();
  const direction = useRef<SwipeDirection | undefined>(undefined);
  const onMove = useCallback((dx: number, next: SwipeDirection) => {
    direction.current = next;
    if (next === 'right') drawer?.current?.moveDrawer(dx);
    else swipe?.onMove?.(dx, next);
  }, [drawer, swipe]);
  const onEnd = useCallback((completed?: SwipeDirection) => {
    if (direction.current === 'right') {
      if (!completed) drawer?.current?.cancelDrawer();
    } else swipe?.onEnd?.(completed);
    direction.current = undefined;
  }, [drawer, swipe]);
  return useHorizontalSwipe({ enabled, onRight: onOpen, onLeft: swipe?.onNext ?? onNext,
    onMove, onEnd });
}
