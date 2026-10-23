import { applications, languageOptions, type AppLanguage } from '@remoteai/i18n';
import { useSyncExternalStore } from 'react';
import { getInterfaceLanguage, subscribeInterfaceLanguage } from '../../../../shared/i18n/interfaceLanguage';
import { localeForLanguage } from '../../../../shared/i18n/language';
import { translateText, type TranslationValues } from '../../../../shared/i18n/translate';

export const LANGUAGE_OPTIONS = languageOptions(applications.native);
export { languageLabel } from '@remoteai/i18n';
export type Language = AppLanguage<'native'>;
export const getLanguage = getInterfaceLanguage;
export const getLocale = () => localeForLanguage(getLanguage());
export const t = (source: string, values?: TranslationValues) => translateText(getLanguage(), source, values);
export const useLanguage = () => useSyncExternalStore(subscribeInterfaceLanguage, getLanguage, () => 'zh' as const);
