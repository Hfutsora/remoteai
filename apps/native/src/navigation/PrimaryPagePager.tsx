import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Keyboard, StyleSheet, View } from 'react-native';
import { PRIMARY_PAGES, type PrimaryPage } from '../../../../shared/navigation/pageSwipe';
import { PagePreviewContext, PageSwipeContext } from '../../../../shared/navigation/PageSwipeContext';
import { usePageTransition } from '../../../../shared/navigation/usePageTransition';
import { useThemeColor } from '../theme/store';
import { usePrimaryPageSwipe } from './usePrimaryPageSwipe';
import { createPageAnimation } from './pageAnimation';

interface Props {
  page: string; onChange: (page: PrimaryPage) => void;
  pages: Record<PrimaryPage, ReactNode>; children?: ReactNode;
}

export function PrimaryPagePager({ page, onChange, pages, children }: Props) {
  const color = useThemeColor();
  const [width, setWidth] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const animation = useMemo(() => createPageAnimation(offset), [offset]);
  const { preview, progress, navigate } = usePageTransition({ page, width, onChange, animation });
  const handlers = usePrimaryPageSwipe(page, navigate, progress);
  const onNext = useCallback(() => { Keyboard.dismiss(); navigate('accounts'); }, [navigate]);
  const chatSwipe = useMemo(() => ({ ...progress, onNext }), [progress, onNext]);
  const displayedPage = page === 'token-summary' ? 'chat' : page;
  const primary = PRIMARY_PAGES.some(key => key === displayedPage);
  // Include every slot in the native bounds so Android can hit-test and expose the visible pane to accessibility.
  const trackWidth = width * PRIMARY_PAGES.length;
  return <PageSwipeContext.Provider value={chatSwipe}>
    <PagePreviewContext.Provider value={preview?.page}>
      <View style={styles.viewport} onLayout={event => setWidth(event.nativeEvent.layout.width)} {...handlers}>
        <Animated.View style={[styles.track, { width: trackWidth, transform: [{ translateX: offset }] },
          !primary && styles.hidden]}>
          {PRIMARY_PAGES.map((key, index) => {
            const active = key === displayedPage;
            const incoming = key === preview?.page;
            const visible = active || incoming;
            const left = index * width;
            return <View key={key} testID={`primary-page-${key}`}
              pointerEvents={active ? 'auto' : 'none'} accessibilityElementsHidden={!active}
              importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
              style={[styles.pane, { backgroundColor: color(key === 'settings' ? '#fff' : '#ededed',
                key === 'settings' ? 'surface' : 'canvas'), left, width },
              !visible && styles.hidden]}>
              {(visible || key === 'chat') && pages[key]}
            </View>;
          })}
        </Animated.View>
        {children}
      </View>
    </PagePreviewContext.Provider>
  </PageSwipeContext.Provider>;
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  track: { flex: 1 },
  pane: { position: 'absolute', top: 0, bottom: 0 },
  hidden: { display: 'none' },
});
