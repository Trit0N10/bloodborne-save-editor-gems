import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { getLocale, setLocale, subscribeLocale, tr } from './zh.js';

const LocaleContext = createContext('en');
export function LocaleProvider({ children }) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, () => 'en');
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  // Same component identities on switch: loaded save and unsaved drafts survive.
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
export function useLocale() { return useContext(LocaleContext); }
export function LanguageSelector({ disabled = false }) {
  const locale = useLocale();
  return <label className="language-selector"><span>{tr('Language')}</span>
    <select aria-label={tr('Interface language')} value={locale}
      disabled={disabled} onChange={event => setLocale(event.target.value)}>
      <option value="en">English</option><option value="zh-CN">简体中文</option>
    </select></label>;
}
