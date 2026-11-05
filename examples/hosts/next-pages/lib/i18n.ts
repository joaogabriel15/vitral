import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { configure } from 'vitral'
import { i18next } from 'vitral/i18n'

// Sem as traduções dos remotes: cada um traz as dele, só na língua aberta.
if (!i18n.isInitialized) i18n.use(initReactI18next).init({ lng: 'pt-BR', fallbackLng: 'en', resources: {}, react: { useSuspense: false } })
if (typeof window !== 'undefined') configure({ i18n: i18next(i18n) })

export default i18n
