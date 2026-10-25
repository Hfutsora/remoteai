import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard } from 'react-native';
import { createDrawerMotion } from '../../../../shared/navigation/drawerMotion';
import { createPageAnimation } from '../navigation/pageAnimation';
import { nativeTextSelection } from './nativeTextSelection';

interface Options {
  width: number;
  onOpen: () => void;
  onClose: () => void;
  onMoving: () => void;
}

export function useDrawerMotion({ width, ...callbacks }: Options) {
  const current = useRef(callbacks);
  current.current = callbacks;
  const committed = useRef(false);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const offset = useRef(new Animated.Value(0)).current;
  const animation = useMemo(() => createPageAnimation(offset), [offset]);
  const motion = useMemo(() => createDrawerMotion({ width, initiallyOpen: committed.current, animation,
    onStart: () => {
      Keyboard.dismiss();
      nativeTextSelection?.dismiss();
      setVisible(true);
      current.current.onMoving();
    },
    onSettled: next => {
      committed.current = next;
      setOpen(next);
      setVisible(next);
      if (next) current.current.onOpen();
      else current.current.onClose();
    },
  }), [width, animation]);
  useLayoutEffect(() => {
    animation.setOffset(committed.current ? width : 0);
    setVisible(committed.current);
    // A width change cancels the preview; also release the parent's moving state.
    if (committed.current) current.current.onOpen();
    else current.current.onClose();
    return motion.dispose;
  }, [motion, animation, width]);
  return { motion, offset, open, visible };
}
