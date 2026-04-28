import { getSupabase } from './supabase';
import { reportError } from './sentry';

/**
 * D9-A · Pack 1 · Quest history store
 *
 * 客户端封装 015_quest_history.sql 的 RPC 调用：
 *   - fetchMyQuestHistory()
 *   - fetchMyQuestStats()
 */

export interface QuestHistoryEntry {
  submission_id: string;
  workshop: string;
  quest_id: string;
  quest_title: string;
  cv_amount: number;
  status: string;
  submitted_at: string;
  source: 'workshop' | 'sprout' | 'review' | 'proposal' | 'other';
}

export interface QuestStats {
  total_tasks: number;
  total_cv: number;
  workshop_distribution: Record<string, number>;
  source_distribution: Record<string, number>;
  first_submission_at: string | null;
  last_submission_at: string | null;
}

/** 拉取我的任务历史（最多 limit 条，默认 100）。 */
export async function fetchMyQuestHistory(
  limit: number = 100
): Promise<QuestHistoryEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('get_my_quest_history', {
      p_limit: limit,
    });
    if (error) {
      reportError('fetch-quest-history', error);
      return [];
    }
    return (data as QuestHistoryEntry[]) ?? [];
  } catch (err) {
    reportError('fetch-quest-history', err);
    return [];
  }
}

/** 拉取我的统计聚合 */
export async function fetchMyQuestStats(): Promise<QuestStats | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('get_my_quest_stats');
    if (error) {
      reportError('fetch-quest-stats', error);
      return null;
    }
    if (!data || (data as { error?: string }).error) {
      return null;
    }
    return data as QuestStats;
  } catch (err) {
    reportError('fetch-quest-stats', err);
    return null;
  }
}

/** Source label 的中文映射 */
export function sourceLabel(s: string): string {
  switch (s) {
    case 'workshop':
      return '工坊';
    case 'sprout':
      return '萌芽镇';
    case 'review':
      return '审核';
    case 'proposal':
      return '提案';
    default:
      return '其他';
  }
}

/** Source 颜色映射（用于饼图 + 标签）*/
export function sourceColor(s: string): string {
  switch (s) {
    case 'workshop':
      return '#7fc090'; // green
    case 'sprout':
      return '#e0b060'; // gold
    case 'review':
      return '#a78bfa'; // purple
    case 'proposal':
      return '#a5c8ff'; // blue
    default:
      return '#6e6856'; // ink
  }
}

/** Workshop 颜色映射（9 工坊配色）*/
export function workshopColor(w: string): string {
  const map: Record<string, string> = {
    '百晓居（百科）': '#7fc090',
    '开源楼（开源）': '#a78bfa',
    '声闻台（播客）': '#f4a8c0',
    '度量阁（测评）': '#a5c8ff',
    '引才坊（招聘）': '#e0b060',
    '司算所（数据）': '#7fc090',
    '议事厅（会议）': '#a78bfa',
    '望气楼（内参）': '#f4a8c0',
    '功德堂（贡献）': '#a5c8ff',
    萌芽镇: '#e0b060',
  };
  return map[w] ?? '#6e6856';
}


// ============================================================================
// D9-B · Pack 2 · 全社区时间线 + 工坊统计 + 全局看板
// ============================================================================

export interface GlobalTimelineEntry {
  submission_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string;
  workshop: string;
  quest_title: string;
  cv_amount: number;
  submitted_at: string;
  source: 'workshop' | 'sprout' | 'review' | 'proposal' | 'other';
}

export interface WorkshopStat {
  workshop: string;
  total_completions: number;
  total_cv: number;
  unique_contributors: number;
  avg_cv_per_task: number;
  last_activity_at: string;
  rank: number;
}

export interface GlobalStats {
  all_time: {
    completions: number;
    total_cv: number;
    total_players: number;
  };
  past_week: {
    completions: number;
    total_cv: number;
    active_players: number;
  };
  past_month: {
    completions: number;
    total_cv: number;
    active_players: number;
  };
  top_contributors_month: Array<{
    name: string;
    username: string;
    avatar_url: string;
    cv: number;
    tasks: number;
  }>;
  top_workshops_month: Array<{
    name: string;
    cv: number;
    tasks: number;
  }>;
}

/** 全社区任务时间线 */
export async function fetchGlobalTimeline(
  limit: number = 50,
  workshopFilter: string | null = null
): Promise<GlobalTimelineEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('get_global_quest_timeline', {
      p_limit: limit,
      p_workshop_filter: workshopFilter,
    });
    if (error) {
      reportError('fetch-global-timeline', error);
      return [];
    }
    return (data as GlobalTimelineEntry[]) ?? [];
  } catch (err) {
    reportError('fetch-global-timeline', err);
    return [];
  }
}

/** 9 工坊聚合统计 */
export async function fetchWorkshopStats(): Promise<WorkshopStat[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('get_workshop_stats');
    if (error) {
      reportError('fetch-workshop-stats', error);
      return [];
    }
    return (data as WorkshopStat[]) ?? [];
  } catch (err) {
    reportError('fetch-workshop-stats', err);
    return [];
  }
}

/** 全局看板 */
export async function fetchGlobalStats(): Promise<GlobalStats | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('get_global_stats');
    if (error) {
      reportError('fetch-global-stats', error);
      return null;
    }
    if (!data || (data as { error?: string }).error) {
      return null;
    }
    return data as GlobalStats;
  } catch (err) {
    reportError('fetch-global-stats', err);
    return null;
  }
}


// ============================================================================
// D9-C · Pack 3 · 公开页历史 + 单任务历史 + 时间筛选
// ============================================================================

export type TimeRangeFilter = 'all' | 'week' | 'month' | 'quarter';

/** 时间筛选转 ISO datetime 字符串（>=） */
export function timeRangeStart(range: TimeRangeFilter): Date | null {
  const now = new Date();
  switch (range) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'quarter':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return null;
  }
}

/** 客户端按时间过滤 entries */
export function filterByTimeRange<T extends { submitted_at: string }>(
  entries: T[],
  range: TimeRangeFilter
): T[] {
  const start = timeRangeStart(range);
  if (!start) return entries;
  return entries.filter((e) => new Date(e.submitted_at) >= start);
}

/** 客户端按工坊过滤 */
export function filterByWorkshop<T extends { workshop: string }>(
  entries: T[],
  workshop: string | null
): T[] {
  if (!workshop) return entries;
  return entries.filter((e) => e.workshop === workshop);
}


// 用户公开历史 entry（同 QuestHistoryEntry 但少 status 字段）
export interface PublicHistoryEntry {
  submission_id: string;
  workshop: string;
  quest_id: string;
  quest_title: string;
  cv_amount: number;
  submitted_at: string;
  source: 'workshop' | 'sprout' | 'review' | 'proposal' | 'other';
}

/** 拉任意用户的公开任务史（用于 /u/[username]）*/
export async function fetchUserPublicHistory(
  username: string,
  limit: number = 30
): Promise<PublicHistoryEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('get_user_public_history', {
      p_username: username,
      p_limit: limit,
    });
    if (error) {
      reportError('fetch-user-public-history', error);
      return [];
    }
    return (data as PublicHistoryEntry[]) ?? [];
  } catch (err) {
    reportError('fetch-user-public-history', err);
    return [];
  }
}


// 单任务完成记录
export interface QuestCompletion {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  cv_amount: number;
  submitted_at: string;
}

/** 拉某 quest 的所有完成记录 */
export async function fetchQuestCompletions(
  questId: string,
  limit: number = 30
): Promise<QuestCompletion[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('get_quest_completions', {
      p_quest_id: questId,
      p_limit: limit,
    });
    if (error) {
      reportError('fetch-quest-completions', error);
      return [];
    }
    return (data as QuestCompletion[]) ?? [];
  } catch (err) {
    reportError('fetch-quest-completions', err);
    return [];
  }
}
