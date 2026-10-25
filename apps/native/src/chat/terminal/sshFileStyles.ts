import { createThemedStyles } from '../../theme/styles';
import { textMetrics } from '../../theme/text';

export const useSshFileStyles = createThemedStyles(color => ({
  content: { paddingBottom: 16 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  navigation: { flexDirection: 'row', padding: 3, borderRadius: 14, backgroundColor: color('#f1f5f3', 'canvas') },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconButton: { width: 44, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { backgroundColor: color('#14806f', 'accent') },
  pressed: { opacity: .65 },
  disabled: { opacity: .4 },
  path: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 3,
    borderWidth: 1, borderColor: color('#dfe5df', 'border'), borderRadius: 12, gap: 8 },
  pathInput: { ...textMetrics(14, 22), color: color('#17211b', 'ink'), flex: 1, minWidth: 0,
    paddingVertical: 10 },
  search: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    borderRadius: 12, gap: 8, backgroundColor: color('#f1f5f3', 'canvas') },
  searchInput: { ...textMetrics(14, 22), color: color('#17211b', 'ink'), flex: 1, minWidth: 0,
    paddingVertical: 10 },
}));
