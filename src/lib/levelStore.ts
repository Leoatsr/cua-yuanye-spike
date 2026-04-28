import { getSupabase } from './supabase';
import { reportError } from './sentry';
import { EventBus } from '../game/EventBus';

/**
 * F5.0 · 等级系统客户端
 *
 * - 注册即得 L0
 * - L1-L3 自动按 CV/任务/提案 阈值
 * - L4 联席主席仅人工授予
 *
 * 客户端缓存 5 分钟，定期刷新。CV/提案变化时主动刷新。
 */

export interface LevelInfo {
  level: 0 | 1 | 2 | 3 | 4;
  level_name: string;
  total_cv: number;
  task_count: number;
  proposal_count: number;
  next_level: 1 | 2 | 3 | 4 | null;
  next_level_name: string | null;
  next_cv_required: number | null;
  next_tasks_required: number | null;
  next_proposals_required: number | null;
}

export const LEVEL_NAMES: Record<number, string> = {
  0: '新人',
  1: '活跃贡献者',
  2: 'mentor',
  3: '子项目负责人',
  4: '联席主席',
};

export const LEVEL_COLORS: Record<number, string> = {
  0: '#9ca3af',  // gray
  1: '#60a5fa',  // blue
  2: '#a78bfa',  // purple
  3: '#fbbf24',  // amber/gold
  4: '#dc2626',  // red (top)
};

const LS_KEY = 'cua-yuanye-level-cache-v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

interface LevelCache {
  data: LevelInfo;
  fetchedAt: number;
  userId: string;
}

let inFlight: Promise<LevelInfo | null> | null = null;

function readCache(userId: string): LevelInfo | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as LevelCache;
    if (cache.userId !== userId) return null;
    if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null;
    return cache.data;
  } catch {
    return null;
  }
}

function writeCache(userId: string, data: LevelInfo) {
  try {
    const cache: LevelCache = { data, fetchedAt: Date.now(), userId };
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/**
 * Fetch user level. Returns null if not logged in or fetch failed.
 * Uses cached value if fresh (within 5 min).
 */
export async function fetchUserLevel(forceRefresh = false): Promise<LevelInfo | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return null;

  // Cache hit
  if (!forceRefresh) {
    const cached = readCache(userId);
    if (cached) return cached;
  }

  // De-dupe concurrent calls
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_level', { p_user_id: userId });
      if (error) {
        reportError('fetch-user-level', error);
        return null;
      }
      // RPC returns array (1 row)
      const row = (data as LevelInfo[])?.[0];
      if (!row) return null;
      writeCache(userId, row);
      return row;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Force-refresh after a CV gain or proposal creation.
 * Compares old level vs new — emits 'level-up' event if upgraded.
 */
export async function refreshLevelAfterEvent(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return;

  // Get cached old level (don't trigger fetch)
  const oldCached = readCache(userId);
  const oldLevel = oldCached?.level ?? null;

  // Force-fetch new
  const newLevel = await fetchUserLevel(true);
  if (!newLevel) return;

  // Detect upgrade
  if (oldLevel !== null && newLevel.level > oldLevel) {
    EventBus.emit('level-up', {
      from: oldLevel,
      to: newLevel.level,
      newName: newLevel.level_name,
    });
  }
}

/**
 * Sync level info to listeners. Called on app start + after auth change.
 */
export async function broadcastLevelInfo(): Promise<void> {
  const info = await fetchUserLevel();
  EventBus.emit('level-updated', info);
}

export function clearLevelCache() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
}
