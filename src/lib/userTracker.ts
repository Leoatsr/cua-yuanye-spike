/**
 * userTracker — keep Sentry user context in sync with Supabase session.
 *
 * Polls window.__supabase every 5s. When the session user changes
 * (login or logout), updates Sentry's user context so subsequent
 * errors are tagged with the correct GitHub username.
 *
 * Started from App.tsx mount.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { setSentryUser } from './sentry';

let lastUserId: string | null = null;
let intervalHandle: number | null = null;

export function startUserTracker(): void {
  if (intervalHandle !== null) return; // already running

  const check = async () => {
    const supabase = (window as unknown as { __supabase?: SupabaseClient }).__supabase;
    if (!supabase) return;
    try {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      const newId = u?.id ?? null;

      if (newId === lastUserId) return; // no change
      lastUserId = newId;

      if (u) {
        const meta = u.user_metadata ?? {};
        const githubUsername = (meta.user_name ?? meta.preferred_username ?? '') as string;
        setSentryUser({ id: u.id, githubUsername });
      } else {
        setSentryUser(null);
      }
    } catch {
      // Silent — don't disrupt app on tracker errors
    }
  };

  // Run immediately + every 5 seconds
  check();
  intervalHandle = window.setInterval(check, 5000);
}

export function stopUserTracker(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
