import { getSupabase } from './supabase';
import { reportError } from './sentry';

/**
 * J2-A · 数据看板客户端 store
 *
 * 5 个 fetcher 对应 5 个 RPC
 */

export interface SeriesPoint {
  date: string;
  count?: number;
  cv?: number;
}

export interface UserActivity {
  total_users: number;
  active_today: number;
  active_week: number;
  active_month: number;
  new_today: number;
  new_week: number;
  new_month: number;
  dau_series: SeriesPoint[];
  new_users_series: SeriesPoint[];
  window_days: number;
}

export interface LevelDist {
  levels: Array<{
    level: number;
    level_name: string;
    count: number;
  }>;
}

export interface QuestVolume {
  total_all: number;
  total_today: number;
  total_week: number;
  total_month: number;
  volume_series: SeriesPoint[];
  window_days: number;
}

export interface QuestQuality {
  approved: number;
  rejected: number;
  pending: number;
  workshop_breakdown: Array<{
    workshop: string;
    count: number;
    cv: number;
    unique_users: number;
  }>;
}

export interface CVFlow {
  total_cv: number;
  today_cv: number;
  week_cv: number;
  month_cv: number;
  avg_cv_per_user: number;
  avg_cv_per_task: number;
  cv_series: SeriesPoint[];
  top_earners: Array<{
    name: string;
    username: string;
    avatar_url: string;
    cv: number;
    tasks: number;
  }>;
  window_days: number;
}

export type TimeWindow = 7 | 30 | 90;

async function callRpc<T>(
  rpcName: string,
  args: Record<string, unknown> = {}
): Promise<T | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc(rpcName, args);
    if (error) {
      reportError(rpcName, error);
      return null;
    }
    if (data && (data as { error?: string }).error) return null;
    return data as T;
  } catch (err) {
    reportError(rpcName, err);
    return null;
  }
}

export async function fetchUserActivity(days: TimeWindow = 30): Promise<UserActivity | null> {
  return callRpc<UserActivity>('dashboard_user_activity', { p_days: days });
}

export async function fetchLevelDistribution(): Promise<LevelDist | null> {
  return callRpc<LevelDist>('dashboard_level_distribution', {});
}

export async function fetchQuestVolume(days: TimeWindow = 30): Promise<QuestVolume | null> {
  return callRpc<QuestVolume>('dashboard_quest_volume', { p_days: days });
}

export async function fetchQuestQuality(): Promise<QuestQuality | null> {
  return callRpc<QuestQuality>('dashboard_quest_quality', {});
}

export async function fetchCVFlow(days: TimeWindow = 30): Promise<CVFlow | null> {
  return callRpc<CVFlow>('dashboard_cv_flow', { p_days: days });
}


// ============================================================================
// J2-B · 社交健康 + 错误埋点
// ============================================================================

export interface ChatHealth {
  total_messages: number;
  today_messages: number;
  week_messages: number;
  world_count: number;
  scene_count: number;
  private_count: number;
  unique_senders_month: number;
  avg_per_user_week: number;
  message_series: SeriesPoint[];
  window_days: number;
  note?: string;
}

export interface FriendsHealth {
  total_pairs: number;
  pending_count: number;
  new_friendships_week: number;
  friendships_series: SeriesPoint[];
  top_socializers: Array<{
    name: string;
    username: string;
    avatar_url: string;
    friend_count: number;
  }>;
  window_days: number;
  note?: string;
}

export interface FollowsHealth {
  total_follows: number;
  today_follows: number;
  week_follows: number;
  unique_followers: number;
  unique_followees: number;
  follow_series: SeriesPoint[];
  top_followed: Array<{
    name: string;
    username: string;
    avatar_url: string;
    followers_count: number;
  }>;
  window_days: number;
  note?: string;
}

export interface ErrorHealth {
  total_errors: number;
  today_errors: number;
  week_errors: number;
  unique_users_affected: number;
  top_contexts: Array<{
    context: string;
    cnt: number;
    last_seen: string;
  }>;
  recent_errors: Array<{
    id: number;
    context: string;
    message: string;
    url: string | null;
    created_at: string;
  }>;
  error_series: SeriesPoint[];
  window_days: number;
}

export async function fetchChatHealth(days: TimeWindow = 30): Promise<ChatHealth | null> {
  return callRpc<ChatHealth>('dashboard_chat_health', { p_days: days });
}

export async function fetchFriendsHealth(days: TimeWindow = 30): Promise<FriendsHealth | null> {
  return callRpc<FriendsHealth>('dashboard_friends_health', { p_days: days });
}

export async function fetchFollowsHealth(days: TimeWindow = 30): Promise<FollowsHealth | null> {
  return callRpc<FollowsHealth>('dashboard_follows_health', { p_days: days });
}

export async function fetchErrorHealth(days: TimeWindow = 7): Promise<ErrorHealth | null> {
  return callRpc<ErrorHealth>('dashboard_error_health', { p_days: days });
}


// ============================================================================
// J2-C · 留存 + 在线时长 + scene 分布
// ============================================================================

export interface RetentionData {
  d1: number;
  d7: number;
  d30: number;
  d1_cohort_size: number;
  d7_cohort_size: number;
  d30_cohort_size: number;
  d1_returned: number;
  d7_returned: number;
  d30_returned: number;
  retention_curve: Array<{ day: number; rate: number }>;
}

export interface OnlineDuration {
  total_sessions: number;
  active_now: number;
  today_sessions: number;
  week_sessions: number;
  avg_duration_seconds: number;
  median_duration_seconds: number;
  p90_duration_seconds: number;
  total_hours: number;
  duration_by_day: SeriesPoint[];
  top_users: Array<{
    name: string;
    username: string;
    avatar_url: string;
    total_hours: number;
    session_count: number;
  }>;
  window_days: number;
}

export interface SceneDistribution {
  active_now: number;
  scenes_now: Array<{
    scene: string;
    count: number;
  }>;
  scenes_30d: Array<{
    scene: string;
    visit_count: number;
    total_minutes: number;
    total_seconds: number;
  }>;
}

export async function fetchRetention(): Promise<RetentionData | null> {
  return callRpc<RetentionData>('dashboard_retention', {});
}

export async function fetchOnlineDuration(days: TimeWindow = 30): Promise<OnlineDuration | null> {
  return callRpc<OnlineDuration>('dashboard_online_duration', { p_days: days });
}

export async function fetchSceneDistribution(): Promise<SceneDistribution | null> {
  return callRpc<SceneDistribution>('dashboard_scene_distribution', {});
}
