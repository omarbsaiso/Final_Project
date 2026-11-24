import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const PreferencesContext = createContext(null);

const translations = {
  en: {
    dashboard: 'Dashboard', calls: 'Calls', knowledge: 'Knowledge base', users: 'User management',
    settings: 'Settings', overview: 'Overview', search: 'Search', logout: 'Log out',
    greeting: 'Good morning', today: 'Today', uploadCall: 'Upload a call', viewAll: 'View all',
  },
  ar: {
    dashboard: 'لوحة التحكم', calls: 'المكالمات', knowledge: 'قاعدة المعرفة', users: 'إدارة المستخدمين',
    settings: 'الإعدادات', overview: 'نظرة عامة', search: 'بحث', logout: 'تسجيل الخروج',
    greeting: 'صباح الخير', today: 'اليوم', uploadCall: 'رفع مكالمة', viewAll: 'عرض الكل',
  },
};

export function PreferencesProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('call-miner-language') || 'en');

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('call-miner-language', language);
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key) => translations[language]?.[key] || translations.en[key] || key,
  }), [language]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider.');
  return context;
}
