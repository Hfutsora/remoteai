import { useHorizontalSwipe } from '../navigation/useHorizontalSwipe';

export function useChatDrawerSwipe(enabled: boolean, onOpen: () => void, onNext?: () => void) {
  return useHorizontalSwipe({ enabled, onRight: onOpen, onLeft: onNext });
}
