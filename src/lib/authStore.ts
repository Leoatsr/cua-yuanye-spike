/**
 * Auth state singleton — module-level state with subscriber pattern.
 *
 * Why this exists:
 * Previous versions used useAuth hook with internal useState/useEffect.
 * Multiple components mounting useAuth caused race conditions:
 * - Each instance independently processed URL hash
 * - Each instance had its own loading state
 * - INITIAL_SESSION fired before some hooks subscribed
 *
 * This module fixes that by making auth state a global singleton:
 * - Hash processing runs ONCE at module load time
 * - Single source of truth (currentState)
 * - Components subscribe via useAuth and get updates via setState callbacks
 * - No race conditions possible
 */

import { getSupabase, isAuthEnabled } from './supabase';
import type { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  githubUsername: string;
  displayName: string;
  avatarUrl: string;
}

export interface AuthSnapshot {
  user: AuthUser | null;
  loading: boolean;
  authEnabled: boolean;
}

function userFromSupabase(u: User | null): AuthUser | null {
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  const username = (meta.user_name ?? meta.preferred_username ?? '') as string;
  const displayName = (meta.full_name ?? meta.name ?? username) as string;
  const avatarUrl = (meta.avatar_url ?? '') as string;
  return {
    id: u.id,
    githubUsername: username,
    displayName: displayName || username || u.email || 'Unknown',
    avatarUrl,
  };
}

// === MODULE-LEVEL STATE ===
let currentState: AuthSnapshot = {
  user: null,
  loading: true,
  authEnabled: isAuthEnabled(),
};

// === SUBSCRIBERS ===
const listeners = new Set<(s: AuthSnapshot) => void>();

function setState(next: AuthSnapshot) {
  currentState = next;
  listeners.forEach((l) => l(next));
}

export function getAuthSnapshot(): AuthSnapshot {
  return currentState;
}

export function subscribeAuth(listener: (s: AuthSnapshot) => void): () => void {
  listeners.add(listener);
  // Immediately push current state so subscriber doesn't have to wait
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

// === INIT (runs once at module load) ===
async function init() {
  const supabase = getSupabase();
  if (!supabase) {
    setState({ user: null, loading: false, authEnabled: false });
    return;
  }

  // Subscribe to auth changes — this catches all future events
  supabase.auth.onAuthStateChange((event, session) => {
    // eslint-disable-next-line no-console
    console.log('[authStore] event:', event, 'session:', !!session);
    setState({
      user: userFromSupabase(session?.user ?? null),
      loading: false,
      authEnabled: true,
    });
  });

  // Process URL hash (if present from OAuth callback)
  if (typeof window !== 'undefined') {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.slice(1));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        // eslint-disable-next-line no-console
        console.log('[authStore] processing OAuth callback...');
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[authStore] setSession failed:', error.message);
        } else {
          // eslint-disable-next-line no-console
          console.log('[authStore] setSession ok');
        }
        // Clear hash regardless
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }

  // Read current session (might already be set by setSession or by persisted session)
  const { data } = await supabase.auth.getSession();
  // eslint-disable-next-line no-console
  console.log('[authStore] init session:', !!data.session);
  setState({
    user: userFromSupabase(data.session?.user ?? null),
    loading: false,
    authEnabled: true,
  });
}

// Kick off init at module load — ONCE, no React involvement
init();

// === ACTIONS ===
export async function authSignIn() {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[authStore] signIn error:', error.message);
  }
}

export async function authSignOut() {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[authStore] signOut error:', error.message);
  }
}
