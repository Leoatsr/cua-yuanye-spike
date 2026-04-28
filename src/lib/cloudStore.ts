/**
 * cloudStore — abstraction over localStorage and Supabase.
 *
 * Strategy: "dual-track"
 * - Not logged in → all reads/writes go to localStorage (no change from before)
 * - Logged in → reads from Supabase, writes go to BOTH (local first, cloud async)
 *
 * Each domain (cv, mail, quest, review) has its own table-specific module.
 * This file provides shared primitives: are-we-logged-in detection, write
 * coordination, error handling.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { reportError } from './sentry';

// ----- Auth detection (synchronous; reads cached session) -----

export function getCurrentUser(): User | null {
  const supabase = getSupabase();
  if (!supabase) return null;
  // Supabase client caches the session synchronously after init
  // We read it via the public getSession but the cached value is sync
  // Workaround: read from localStorage where supabase persists session
  try {
    const keys = Object.keys(localStorage);
    const sessionKey = keys.find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!sessionKey) return null;
    const raw = localStorage.getItem(sessionKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: User; expires_at?: number };
    if (!parsed.user) return null;
    // Check expiry
    if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) return null;
    return parsed.user;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getCurrentUser() !== null;
}

// ----- Cloud write queue (fire-and-forget with logging) -----

interface CloudWriteFn {
  (supabase: SupabaseClient, userId: string): Promise<{ error: unknown }>;
}

/**
 * Fire a cloud write asynchronously. Doesn't block local writes.
 * If the write fails, log it but don't throw — local data is the source of truth.
 */
export function fireCloudWrite(label: string, fn: CloudWriteFn): void {
  const supabase = getSupabase();
  const user = getCurrentUser();
  if (!supabase || !user) return;

  fn(supabase, user.id)
    .then(({ error }) => {
      if (error) {
        reportError(`cloud-write:${label}`, error, {
          userId: user.id,
          label,
        });
      }
    })
    .catch((err) => {
      reportError(`cloud-write:${label}`, err, {
        userId: user.id,
        label,
        threw: true,
      });
    });
}

/**
 * Read from cloud, returning null on any failure.
 * Caller must handle null (typically by falling back to localStorage).
 */
export async function readCloud<T>(
  label: string,
  fn: (supabase: SupabaseClient, userId: string) => Promise<{ data: T | null; error: unknown }>,
): Promise<T | null> {
  const supabase = getSupabase();
  const user = getCurrentUser();
  if (!supabase || !user) return null;

  try {
    const { data, error } = await fn(supabase, user.id);
    if (error) {
      reportError(`cloud-read:${label}`, error, { userId: user.id, label });
      return null;
    }
    return data;
  } catch (err) {
    reportError(`cloud-read:${label}`, err, { userId: user.id, label, threw: true });
    return null;
  }
}
