import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

if (url && anonKey) {
  const cleanUrl = url.replace(/\/+$/, '');

  _client = createClient(cleanUrl, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // CRITICAL: turn off automatic URL detection — we handle it manually.
      // Supabase v2's detection has known timing issues with React 19 strict mode.
      detectSessionInUrl: false,
      flowType: 'implicit',
      storage: window.localStorage,
    },
  });

  if (typeof window !== 'undefined') {
    (window as unknown as { __supabase: SupabaseClient }).__supabase = _client;
  }
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. Auth disabled.'
  );
}

export function getSupabase(): SupabaseClient | null {
  return _client;
}

export function isAuthEnabled(): boolean {
  return _client !== null;
}
