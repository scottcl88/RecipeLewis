import { useCallback, useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'rl-theme';

export function resolveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark' {
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;
}
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => (localStorage.getItem(KEY) as ThemePref) || 'system');
  const apply = useCallback((p: ThemePref) => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = resolveTheme(p, dark);
  }, []);
  useEffect(() => {
    apply(pref);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => apply(pref);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pref, apply]);
  const set = (p: ThemePref) => { localStorage.setItem(KEY, p); setPref(p); };
  return { pref, set };
}
