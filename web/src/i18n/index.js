import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import commonEn from './locales/en/common.json'
import navigationEn from './locales/en/navigation.json'
import pagesEn from './locales/en/pages.json'
import messagesEn from './locales/en/messages.json'

const resources = {
  en: {
    common: commonEn,
    navigation: navigationEn,
    pages: pagesEn,
    messages: messagesEn,
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'navigation', 'pages', 'messages'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  })

export default i18n
