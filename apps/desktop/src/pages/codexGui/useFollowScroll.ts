import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { shouldFollowScroll } from "../../../../../shared/chat/scrollPosition";
import { useScrollMovement } from "../../../../../shared/chat/useScrollMovement";

export function useFollowScroll(selected: string | null, active = true) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const movement = useScrollMovement();
  const follow = useRef(true);
  const [away, setAway] = useState(false);
  const jumpToLatest = useCallback(() => {
    follow.current = true;
    setAway(false);
    if (viewport.current) {
      viewport.current.scrollTo({ top: viewport.current.scrollHeight });
      movement.remember(viewport.current);
    }
  }, [movement]);
  const pauseFollowing = useCallback(() => { follow.current = false; setAway(true); }, []);
  useLayoutEffect(() => { if (active) jumpToLatest(); }, [selected, active, jumpToLatest]);
  useEffect(() => {
    if (!content.current) return;
    const observer = new ResizeObserver(() => {
      if (follow.current && viewport.current) {
        viewport.current.scrollTop = viewport.current.scrollHeight;
      }
      movement.remember(viewport.current);
    });
    observer.observe(content.current);
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [movement]);
  const onScroll = (offsetChange: number) => {
    const node = viewport.current;
    if (!node) return;
    follow.current = shouldFollowScroll({ contentHeight: node.scrollHeight, viewportHeight: node.clientHeight,
      offset: node.scrollTop, movement: offsetChange });
    setAway(!follow.current);
  };
  return { viewport, content, movement, away, onScroll, jumpToLatest, pauseFollowing };
}
