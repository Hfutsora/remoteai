import { getLanguage } from './language';
import { applications, languageOptions } from '@remoteai/i18n';
import { translateText, type TranslationValues } from '../../../../shared/i18n/translate';

export { getLanguage, getLocale, setLanguage, useLanguage } from './language';
export const LANGUAGE_OPTIONS = languageOptions(applications.web);
export { languageLabel } from '@remoteai/i18n';
export type { Language } from './language';
export const t = (source: string, values?: TranslationValues): string => translateText(getLanguage(), source, values);
