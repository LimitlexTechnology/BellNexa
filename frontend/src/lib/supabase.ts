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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

export const isSupabaseConfigured = (): boolean => {
  const url = getRuntimeEnv('VITE_SUPABASE_URL');
  const anonKey = getRuntimeEnv('VITE_SUPABASE_ANON_KEY');

  // Modern publishable keys (sb_publishable_...) are ~52 chars
  // Legacy anon keys (JWT format starting with eyJ) are 200+ chars
  const isValidKeyFormat = anonKey.startsWith('sb_publishable_') || 
                          anonKey.startsWith('eyJ') || 
                          anonKey.startsWith('sb_secret_');

  return Boolean(
    url &&
    anonKey &&
    url.length > 20 &&
    /^https:\/\/.+\.supabase\.co$/.test(url) &&
    url !== 'https://placeholder-schoolbell.supabase.co' &&
    anonKey.length >= 40 &&
    isValidKeyFormat &&
    anonKey !== 'placeholder-anon-key' &&
    !url.includes('example.com') &&
    !anonKey.includes('placeholder')
  );
};
