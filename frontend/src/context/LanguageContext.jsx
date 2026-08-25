import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import en from '../locales/en.json'
import rw from '../locales/rw.json'

const translations = { en, rw }

const resolve = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('bcml_lang') || 'en')

  useEffect(() => {
    localStorage.setItem('bcml_lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key) => {
      const v = resolve(translations[lang], key) ?? resolve(translations.en, key)
      return typeof v === 'string' ? v : key
    },
    [lang]
  )

  const toggleLang = () => setLang((l) => (l === 'en' ? 'rw' : 'en'))

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)

export const formatMoney = (value, currency = 'RWF') =>
  `${Number(value || 0).toLocaleString()} ${currency}`
