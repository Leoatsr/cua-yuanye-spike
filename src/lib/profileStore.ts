import { getSupabase } from './supabase';
import { reportError } from './sentry';
import { EventBus } from '../game/EventBus';

/**
 * F4.0 · 玩家资料存储
 *
 * 字段（按 Q1 完整方案）：
 *   - username (唯一，可改，2-30 字 a-zA-Z0-9_-)
 *   - display_name (1-30 字)
 *   - bio (≤200 字)
 *   - avatar_url
 *   - workshops[] - 9 个 CUA 工作组多选
 *   - links[] - 个人链接（最多 3 个 {name, url}）
 *   - skills[] - 技能标签
 *   - location - 城市
 *   - interests[] - 兴趣标签
 *   - joined_at / visibility / created_at / updated_at
 */

export interface ProfileLink {
  name: string;
  url: string;
}

export interface UserProfile {
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  workshops: string[];
  links: ProfileLink[];
  skills: string[];
  location: string;
  interests: string[];
  joined_at: string;
  visibility: 'public' | 'private';
  created_at: string;
  updated_at: string;
}

export const WORKSHOP_OPTIONS = [
  '百晓居（百科）',
  '开源楼（开源）',
  '声闻台（播客）',
  '度量阁（测评）',
  '引才坊（招聘）',
  '司算所（数据）',
  '议事厅（会议）',
  '望气楼（内参）',
  '功德堂（贡献）',
] as const;

// Validation limits
export const PROFILE_LIMITS = {
  USERNAME_MIN: 2,
  USERNAME_MAX: 30,
  USERNAME_PATTERN: /^[a-zA-Z0-9_-]{2,30}$/,
  DISPLAY_NAME_MIN: 1,
  DISPLAY_NAME_MAX: 30,
  BIO_MAX: 200,
  LINKS_MAX: 3,
  SKILLS_MAX: 12,
  INTERESTS_MAX: 12,
  LOCATION_MAX: 30,
};

const LS_KEY = 'cua-yuanye-profile-v1';

interface ProfileCache {
  data: UserProfile;
  fetchedAt: number;
  userId: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

function readLocal(userId: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as ProfileCache;
    if (cache.userId !== userId) return null;
    if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null;
    return cache.data;
  } catch {
    return null;
  }
}

function writeLocal(userId: string, data: UserProfile) {
  try {
    const cache: ProfileCache = { data, fetchedAt: Date.now(), userId };
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/**
 * Get the current user's profile.
 * - First time: ensures profile exists (calls ensure_user_profile RPC),
 *   which auto-syncs from GitHub on first call.
 * - Subsequent: reads from cache or refetches.
 */
export async function fetchMyProfile(forceRefresh = false): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return null;

  if (!forceRefresh) {
    const cached = readLocal(userId);
    if (cached) return cached;
  }

  try {
    // Try fetch first
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      reportError('fetch-profile', error);
      return null;
    }
    if (data) {
      const profile = data as UserProfile;
      writeLocal(userId, profile);
      return profile;
    }
    // No profile yet — ensure (creates from GitHub metadata)
    return await ensureProfile();
  } catch (err) {
    reportError('fetch-profile', err);
    return null;
  }
}

/**
 * Ensure profile exists. Calls ensure_user_profile RPC which:
 * - If profile exists: returns it (is_new: false)
 * - If not: creates one from GitHub metadata (is_new: true)
 */
export async function ensureProfile(): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  try {
    const { data, error } = await supabase.rpc('ensure_user_profile');
    if (error) {
      reportError('ensure-profile', error);
      return null;
    }
    const row = (data as Array<{ user_id: string; is_new: boolean }>)?.[0];
    if (!row) return null;

    // Now fetch full profile
    const { data: full, error: fullErr } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', row.user_id)
      .single();
    if (fullErr || !full) {
      reportError('ensure-profile-fetch', fullErr ?? 'no profile');
      return null;
    }
    const profile = full as UserProfile;
    writeLocal(profile.user_id, profile);
    if (row.is_new) {
      EventBus.emit('profile-created', profile);
    }
    return profile;
  } catch (err) {
    reportError('ensure-profile', err);
    return null;
  }
}

/**
 * Check if a username is available (case-insensitive, excludes self).
 */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  if (!PROFILE_LIMITS.USERNAME_PATTERN.test(username)) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('check_username_available', { p_username: username });
    if (error) {
      reportError('check-username', error);
      return false;
    }
    return data === true;
  } catch (err) {
    reportError('check-username', err);
    return false;
  }
}

/**
 * Update the current user's profile.
 * Pass any subset of fields to update.
 */
/**
 * Update profile fields. NOTE: username is NOT updated here — must go through
 * changeUsername() which checks cooldown + writes history.
 * If `patch` contains `username`, it is silently dropped.
 */
export async function updateMyProfile(
  patch: Partial<Omit<UserProfile, 'user_id' | 'created_at' | 'joined_at'>>,
): Promise<{ ok: boolean; error?: string; profile?: UserProfile }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: '请先登录' };
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: '请先登录' };

  // Strip username from patch — go through changeUsername instead
  const { username: _username, ...safePatch } = patch;
  void _username;

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ ...safePatch, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();
    if (error) {
      reportError('update-profile', error);
      return { ok: false, error: error.message };
    }
    const profile = data as UserProfile;
    writeLocal(userId, profile);
    EventBus.emit('profile-updated', profile);
    return { ok: true, profile };
  } catch (err) {
    reportError('update-profile', err);
    return { ok: false, error: '更新失败' };
  }
}

// ============== F4.3c · username change ==============

export interface UsernameChangeStatus {
  can_change: boolean;
  next_change_after: string | null;
  days_remaining: number;
}

/**
 * Check whether the current user can change username (cooldown 30 days).
 */
export async function getUsernameChangeStatus(): Promise<UsernameChangeStatus | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('get_username_change_status');
    if (error) {
      reportError('get-username-status', error);
      return null;
    }
    const row = (data as UsernameChangeStatus[])?.[0];
    return row ?? null;
  } catch (err) {
    reportError('get-username-status', err);
    return null;
  }
}

/**
 * Change username — calls SQL RPC which checks cooldown,
 * writes history, updates user_profiles in one transaction.
 */
export async function changeUsername(newUsername: string): Promise<{
  ok: boolean;
  error?: string;
  newUsername?: string;
  nextChangeAfter?: string | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: '请先登录' };
  try {
    const { data, error } = await supabase.rpc('change_username', { p_new_username: newUsername });
    if (error) {
      reportError('change-username', error);
      return { ok: false, error: error.message };
    }
    const row = (data as Array<{
      ok: boolean; error: string; new_username: string | null; next_change_after: string | null;
    }>)?.[0];
    if (!row) return { ok: false, error: '未知错误' };
    if (!row.ok) {
      return { ok: false, error: row.error || '修改失败', nextChangeAfter: row.next_change_after };
    }
    // Refresh local cache
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (userId && row.new_username) {
      // Re-fetch full profile to get all fields
      const { data: full } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (full) {
        writeLocal(userId, full as UserProfile);
        EventBus.emit('profile-updated', full as UserProfile);
      }
    }
    return {
      ok: true,
      newUsername: row.new_username ?? undefined,
      nextChangeAfter: row.next_change_after,
    };
  } catch (err) {
    reportError('change-username', err);
    return { ok: false, error: '修改失败' };
  }
}

/**
 * Look up if a (possibly old) username has a current redirect target.
 * Used by public profile page when /u/[username] returns 404.
 */
export async function lookupUsernameHistory(username: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('lookup_username_history', { p_username: username });
    if (error) {
      reportError('lookup-history', error);
      return null;
    }
    const row = (data as Array<{ current_username: string }>)?.[0];
    return row?.current_username ?? null;
  } catch (err) {
    reportError('lookup-history', err);
    return null;
  }
}

/**
 * Fetch any user's profile by username (case-insensitive).
 * Used by public profile page.
 */
export async function fetchProfileByUsername(username: string): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .ilike('username', username)
      .maybeSingle();
    if (error) {
      reportError('fetch-by-username', error);
      return null;
    }
    return (data as UserProfile) ?? null;
  } catch (err) {
    reportError('fetch-by-username', err);
    return null;
  }
}

export function clearProfileCache() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
}
