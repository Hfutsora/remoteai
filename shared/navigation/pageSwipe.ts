export const PRIMARY_PAGES = ['chat', 'accounts', 'discover', 'settings'] as const;
export type PrimaryPage = typeof PRIMARY_PAGES[number];
export type SwipeDirection = 'left' | 'right';

export const SWIPE_START_DISTANCE = 12;
export const SWIPE_COMPLETE_DISTANCE = 60;
export const SWIPE_DIRECTION_RATIO = 1.5;
export const SWIPE_LONG_PRESS_MS = 500;

export function adjacentPage(page: string, direction: SwipeDirection): PrimaryPage | undefined {
  const index = PRIMARY_PAGES.findIndex(item => item === page);
  if (index < 0) return undefined;
  return PRIMARY_PAGES[index + (direction === 'left' ? 1 : -1)];
}

export function horizontalDirection(dx: number, dy: number, distance = SWIPE_START_DISTANCE) {
  if (Math.abs(dx) < distance || Math.abs(dx) <= Math.abs(dy) * SWIPE_DIRECTION_RATIO) return undefined;
  return dx < 0 ? 'left' : 'right';
}

export function verticalSwipe(dx: number, dy: number) {
  return Math.abs(dy) > SWIPE_START_DISTANCE && Math.abs(dy) >= Math.abs(dx);
}
