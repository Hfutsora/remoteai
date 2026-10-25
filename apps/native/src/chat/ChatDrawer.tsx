import { useThemeColor } from '../theme/store';
import { createThemedStyles } from '../theme/styles';
import { forwardRef, useCallback, useEffect, useImperativeHandle, type ReactNode } from 'react';
import { Animated, Pressable, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { chatDrawerWidth } from '../../../../shared/navigation/drawerMotion';
import type { SwipeDirection } from '../../../../shared/navigation/pageSwipe';
import { useHorizontalSwipe } from '../navigation/useHorizontalSwipe';
import { useDrawerMotion } from './useDrawerMotion';

export interface ChatDrawerMethods {
  openDrawer: () => void;
  closeDrawer: () => void;
  moveDrawer: (dx: number) => void;
  cancelDrawer: () => void;
}
interface Props {
  children: ReactNode; navigation: ReactNode; enabled: boolean;
  onOpen: () => void; onClose: () => void; onMoving: () => void;
}
// Leave room to start just inside Android's system back-gesture strip.
const EDGE_WIDTH = 48;

/** Keep the same mounted list visible during both edge and conversation-surface drags. */
export const ChatDrawer = forwardRef<ChatDrawerMethods, Props>(function ChatDrawer(
  { children, navigation, enabled, onOpen, onClose, onMoving }, ref,
) {
  const drawerStyles = useDrawerStyles();
  const color = useThemeColor();
  const width = chatDrawerWidth(useWindowDimensions().width);
  const { motion, offset, open, visible } = useDrawerMotion({ width, onOpen, onClose, onMoving });
  const fromEdge = useCallback((event: GestureResponderEvent) => event.nativeEvent.pageX <= EDGE_WIDTH, []);
  const end = useCallback((direction?: SwipeDirection) => { if (!direction) motion.cancel(); }, [motion]);
  const edge = useHorizontalSwipe({ enabled: enabled && !open, shouldStart: fromEdge,
    onRight: motion.open, onMove: motion.move, onEnd: end });
  const close = useHorizontalSwipe({ enabled: enabled && visible,
    onLeft: motion.close, onMove: motion.move, onEnd: end });
  useImperativeHandle(ref, () => ({ openDrawer: motion.open, closeDrawer: motion.close,
    moveDrawer: motion.move, cancelDrawer: motion.cancel }), [motion]);
  useEffect(() => { if (!enabled) motion.close(); }, [enabled, motion]);
  return <GestureHandlerRootView style={drawerStyles.root}>
    <View style={drawerStyles.root} {...edge.panHandlers}
      accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
      {children}
    </View>
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[drawerStyles.overlay,
      { opacity: offset.interpolate({ inputRange: [0, width], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
      <Pressable style={drawerStyles.root} onPress={motion.close} accessible={false} {...close.panHandlers} />
    </Animated.View>
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} accessibilityViewIsModal={visible}
      accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[drawerStyles.panel, { width, backgroundColor: color('#fff', 'surface'),
        transform: [{ translateX: Animated.subtract(offset, width) }] }]} {...close.panHandlers}>
      {navigation}
    </Animated.View>
  </GestureHandlerRootView>;
});

const useDrawerStyles = createThemedStyles(() => ({
  root: { flex: 1, overflow: 'hidden' },
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(6, 20, 15, 0.45)' },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0,
    borderTopRightRadius: 20, borderBottomRightRadius: 20, overflow: 'hidden' },
}));
