import { useCallback } from 'react';
import { usePageSwipe } from '../../../../shared/navigation/PageSwipeContext';
import { swipeSurface } from '../navigation/swipeSurface';
import { useHorizontalSwipe } from '../navigation/useHorizontalSwipe';

interface Options {
  enabled: boolean; open: boolean; onOpenChange: (open: boolean) => void; onNext?: () => void;
}

export function useChatDrawerSwipe({ enabled, open, onOpenChange, onNext }: Options) {
  const swipe = usePageSwipe();
  const surface = useCallback((target: EventTarget | null) => swipeSurface(target,
    open ? '.chat-drawer' : '.chat-page:not([hidden]) .chat-message-region', open), [open]);
  const closeDrawer = useCallback(() => onOpenChange(false), [onOpenChange]);
  const openDrawer = useCallback(() => onOpenChange(true), [onOpenChange]);
  useHorizontalSwipe({ enabled, surface, onRight: open ? undefined : openDrawer,
    onLeft: open ? closeDrawer : swipe?.onNext ?? onNext,
    onMove: open ? undefined : swipe?.onMove, onEnd: open ? undefined : swipe?.onEnd });
}
