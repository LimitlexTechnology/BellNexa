import { createClient } from '@supabase/supabase-js';

const getRuntimeEnv = (key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string => {
  const metaValue = import.meta.env[key];
  const windowValue = typeof window !== 'undefined'
    ? window.__BELLNEXA_ENV__?.[key]
    : undefined;

  return (metaValue ?? windowValue ?? '').trim();
};

type BellNexaRuntimeConfig = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

declare global {
  interface Window {
    __BELLNEXA_ENV__?: BellNexaRuntimeConfig;
  }
}

const supabaseUrl = getRuntimeEnv('VITE_SUPABASE_URL') || 'https://placeholder-schoolbell.supabase.co';
const supabaseAnonKey = getRuntimeEnv('VITE_SUPABASE_ANON_KEY') || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = (): boolean => {
  const url = getRuntimeEnv('VITE_SUPABASE_URL');
  const anonKey = getRuntimeEnv('VITE_SUPABASE_ANON_KEY');

  return Boolean(
    url &&
    anonKey &&
    url !== 'https://placeholder-schoolbell.supabase.co' &&
    anonKey !== 'placeholder-anon-key' &&
    !url.includes('example.com') &&
    !anonKey.includes('placeholder')
  );
};
