import { getInterfaceLanguage } from '../interfaceLanguage';
import type { Language } from '../language';
import { translateBackendMessage } from '@remoteai/i18n/legacy';
export * from '@remoteai/i18n/legacy/resources/backend/translateBackendMessage';

/** Compatibility adapter; the application still owns its current language. */
export function backendText(message: unknown, language: Language = getInterfaceLanguage()): string {
  return translateBackendMessage(language, message);
}
