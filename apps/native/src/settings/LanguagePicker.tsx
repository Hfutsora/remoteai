import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LANGUAGE_OPTIONS, languageLabel, t, useLanguage, type Language } from '../i18n';
import { setLanguage } from '../i18n/preference';
import { createThemedStyles } from '../theme/styles';
import { settingsColors, useStyles } from './styles';

interface Anchor { x: number; y: number; width: number; height: number }
const MENU_MARGIN = 8;
const MENU_GAP = 6;
const MENU_MAX_HEIGHT = 240;

function menuPosition(anchor: Anchor, viewport: { width: number; height: number }) {
  const below = viewport.height - anchor.y - anchor.height - MENU_GAP - MENU_MARGIN;
  const above = anchor.y - MENU_GAP - MENU_MARGIN;
  const openAbove = below < Math.min(MENU_MAX_HEIGHT, above);
  const width = Math.min(anchor.width, viewport.width - MENU_MARGIN * 2);
  return {
    width, maxHeight: Math.max(0, Math.min(MENU_MAX_HEIGHT, openAbove ? above : below)),
    left: Math.max(MENU_MARGIN, Math.min(anchor.x, viewport.width - width - MENU_MARGIN)),
    ...(openAbove ? { bottom: viewport.height - anchor.y + MENU_GAP } : { top: anchor.y + anchor.height + MENU_GAP }),
  };
}

function LanguageOptions({ anchor, onClose, onChoose }: {
  anchor: Anchor; onClose: () => void; onChoose: (language: Language) => void;
}) {
  const styles = useLocalStyles();
  const language = useLanguage();
  const viewport = useWindowDimensions();
  const [menuViewport, setMenuViewport] = useState({ width: viewport.width, height: viewport.height });
  return <Modal transparent statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}
    supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}>
    <View style={styles.overlay} onLayout={({ nativeEvent }) => setMenuViewport(nativeEvent.layout)}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button"
        accessibilityLabel={t('client.mobile.close', { value1: t('client.settings.language') })} />
      <ScrollView style={[styles.options, menuPosition(anchor, menuViewport)]} keyboardShouldPersistTaps="handled"
        accessibilityRole="radiogroup" accessibilityLabel={t('client.settings.language')}>
        {LANGUAGE_OPTIONS.map(option => <Pressable key={option.value} accessibilityRole="radio"
          accessibilityLabel={option.label} accessibilityState={{ checked: language === option.value }}
          style={[styles.option, language === option.value && styles.selected]} onPress={() => onChoose(option.value)}>
          <Text style={styles.text}>{option.label}</Text>
          {language === option.value && <Ionicons name="checkmark" size={18} style={styles.text} />}
        </Pressable>)}
      </ScrollView>
    </View>
  </Modal>;
}

export function LanguagePicker() {
  const styles = useLocalStyles();
  const language = useLanguage();
  const viewport = useWindowDimensions();
  const landscape = viewport.width > viewport.height;
  const trigger = useRef<View>(null);
  const saving = useRef(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [error, setError] = useState(false);
  // Android modal system-bar insets can change height without changing orientation.
  useEffect(() => { setAnchor(null); }, [landscape]);
  const choose = async (next: Language) => {
    if (saving.current) return;
    saving.current = true;
    setAnchor(null);
    setError(!await setLanguage(next));
    saving.current = false;
  };
  return <View style={styles.container}>
    <Pressable ref={trigger} accessibilityRole="combobox" accessibilityLabel={t('client.settings.language')}
      accessibilityValue={{ text: languageLabel(language) }} accessibilityState={{ expanded: !!anchor }}
      style={styles.trigger} onPress={() => {
        trigger.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
      }}>
      <Text style={styles.text}>{languageLabel(language)}</Text>
      <Ionicons name={anchor ? 'chevron-up' : 'chevron-down'} size={16} style={styles.text} />
    </Pressable>
    {anchor && <LanguageOptions anchor={anchor} onClose={() => setAnchor(null)} onChoose={next => void choose(next)} />}
    {error && <Text accessibilityRole="alert" style={styles.error}>
      {t('client.mobile.languageChangedButCouldNotBeSavedChooseItAgain')}
    </Text>}
  </View>;
}

export function LanguageSettingsRow() {
  const styles = useStyles();
  const localStyles = useLocalStyles();
  return <View style={styles.row}>
    <View style={[styles.icon, localStyles.icon]}><Ionicons name="language-outline" size={22}
      style={localStyles.iconText} /></View>
    <View style={[styles.rowContent, styles.divider]}>
      <Text style={styles.label}>{t('client.settings.language')}</Text>
      <View style={styles.spacer} />
      <LanguagePicker />
    </View>
  </View>;
}

export function LoginLanguagePicker() {
  const styles = useLocalStyles();
  return <View style={styles.login}><LanguagePicker /></View>;
}

const useLocalStyles = createThemedStyles(color => ({
  container: { width: 160, maxWidth: '100%' },
  trigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8,
    borderColor: color(settingsColors.border, 'border'), backgroundColor: color('#fff', 'surface') },
  text: { color: color(settingsColors.ink, 'ink'), fontSize: 15, flexShrink: 1 },
  overlay: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  options: { position: 'absolute', flexGrow: 0, maxWidth: 400, borderWidth: 1, borderRadius: 8, elevation: 8,
    borderColor: color(settingsColors.border, 'border'), backgroundColor: color('#fff', 'surface') },
  option: { minHeight: 48, padding: 12, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8 },
  selected: { backgroundColor: color('#e5fbf3', 'accentSoft') },
  error: { maxWidth: 400, color: color(settingsColors.danger, 'danger'), fontSize: 14, marginTop: 6 },
  icon: { backgroundColor: color('#e7f3ff', 'elevated') },
  iconText: { color: color(settingsColors.blue, 'info') },
  login: { alignSelf: 'center', marginBottom: 8 },
}));
