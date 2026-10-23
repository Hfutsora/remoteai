import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { clampZoom, INITIAL_TRANSFORM, moveImage, type ImageTransform, type Point } from './imageTransform';

const WHEEL_ZOOM_FACTOR = 1.2;
export const IMAGE_ZOOM_FACTOR = 1.5;
const point = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY });
const imageStyle = ({ x, y, rotation, scale }: ImageTransform) =>
  `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;

export function useImageGestures() {
  const image = useRef<HTMLImageElement | null>(null);
  const transform = useRef(INITIAL_TRANSFORM);
  const pointers = useRef(new Map<number, Point>());
  const anchor = useRef({ before: INITIAL_TRANSFORM, start: [] as Point[] });
  const frame = useRef<number>();
  const [scale, setScale] = useState(INITIAL_TRANSFORM.scale);
  const imageRef = useCallback((element: HTMLImageElement | null) => {
    image.current = element;
    if (element) element.style.transform = imageStyle(transform.current);
  }, []);
  useEffect(() => () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
  }, []);

  const rebase = () => {
    anchor.current = { before: transform.current, start: [...pointers.current.values()] };
  };
  const paint = () => {
    frame.current = undefined;
    if (image.current) image.current.style.transform = imageStyle(transform.current);
    setScale(transform.current.scale);
  };
  const flush = () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    paint();
  };
  const update = (next: ImageTransform) => {
    transform.current = next;
    flush();
    rebase();
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.set(event.pointerId, point(event));
    transform.current = moveImage({ ...anchor.current, current: [...pointers.current.values()] });
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    if (event.type === 'pointerup') move(event);
    pointers.current.delete(event.pointerId);
    flush();
    rebase();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const zoom = (factor: number) => update({ ...transform.current, scale: clampZoom(transform.current.scale * factor) });
  const reset = () => update(INITIAL_TRANSFORM);
  const rotate = () => update({ ...transform.current, rotation: (transform.current.rotation + 90) % 360 });

  return { imageRef, scale, zoom, reset, rotate, stageProps: {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      // Native selection/dragging can cancel pointer capture in Chromium and WebView2.
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, point(event));
      rebase();
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(event.pointerId)) return;
      move(event);
      // Keep panning off React's render path and paint only the latest position each frame.
      if (frame.current === undefined) frame.current = requestAnimationFrame(paint);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: finish,
    onDoubleClick: reset,
    onWheel: (event: { deltaY: number }) => zoom(event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR),
  } };
}
