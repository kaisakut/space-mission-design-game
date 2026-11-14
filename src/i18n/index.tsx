import { createContext, useContext, useState, type ReactNode } from 'react';
import { en } from './en';
import { ja } from './ja';

export type Lang = 'en' | 'ja';
export type Messages = { [K in keyof typeof en]: string };

/** Fill {name} placeholders in a message. */
export function fmt(msg: string, vars: Record<string, string | number>): string {
  return msg.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Look up a message by a key built at run time (for example `state_${s}`); falls back to the key. */
export function tk(t: Messages, key: string): string {
  return (t as Record<string, string>)[key] ?? key;
}

const dictionaries: Record<Lang, Messages> = { en, ja };

interface LangContextValue {
  lang: Lang;
  t: Messages;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  const toggle = () => setLang((l) => (l === 'en' ? 'ja' : 'en'));
  return (
    <LangContext.Provider value={{ lang, t: dictionaries[lang], toggle }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>');
  return ctx;
}
