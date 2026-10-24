import { usePageSwipe } from '../../../../shared/navigation/PageSwipeContext';
import { useHorizontalSwipe } from '../navigation/useHorizontalSwipe';

export function useChatDrawerSwipe(enabled: boolean, onOpen: () => void, onNext?: () => void) {
  const swipe = usePageSwipe();
  return useHorizontalSwipe({ enabled, onRight: onOpen, onLeft: swipe?.onNext ?? onNext,
    onMove: swipe?.onMove, onEnd: swipe?.onEnd });
}
