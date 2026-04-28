import { getSupabase } from './supabase';
import { reportError } from './sentry';
import { EventBus } from '../game/EventBus';

/**
 * D10 · Pack 4 · 通知 store
 *
 * - fetch / mark read / count unread
 * - Realtime subscription via postgres_changes
 *   (notifications 表 INSERT 推送给当前用户)
 * - 也支持本地推送（如客户端检测到的 task_due 等）
 */

export type NotificationKind =
  | 'task_new'
  | 'review_result'
  | 'proposal_vote'
  | 'task_due'
  | 'level_up'
  | 'system';

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  task_new: '🆕 新任务',
  review_result: '⚖️ 审核结果',
  proposal_vote: '🗳 提案投票',
  task_due: '⏰ 任务到期',
  level_up: '🌟 升级',
  system: '📢 系统',
};

export const NOTIFICATION_KIND_COLORS: Record<NotificationKind, string> = {
  task_new: '#7fc090',
  review_result: '#e0b060',
  proposal_vote: '#a78bfa',
  task_due: '#e07a6e',
  level_up: '#f4a8c0',
  system: '#a5c8ff',
};

class NotificationManager {
  private subscribed = false;
  private subscribeAttemptedAt = 0;

  /** 拉取最近通知 */
  async fetchRecent(
    limit: number = 50,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.rpc('get_my_notifications', {
        p_limit: limit,
        p_unread_only: unreadOnly,
      });
      if (error) {
        reportError('fetch-notifications', error);
        return [];
      }
      return (data as Notification[]) ?? [];
    } catch (err) {
      reportError('fetch-notifications', err);
      return [];
    }
  }

  /** 计数未读 */
  async countUnread(): Promise<number> {
    const supabase = getSupabase();
    if (!supabase) return 0;
    try {
      const { data, error } = await supabase.rpc(
        'count_unread_notifications'
      );
      if (error) return 0;
      return (data as number) ?? 0;
    } catch {
      return 0;
    }
  }

  /** 标记已读（null = 全部） */
  async markRead(ids: string[] | null): Promise<number> {
    const supabase = getSupabase();
    if (!supabase) return 0;
    try {
      const { data, error } = await supabase.rpc('mark_notifications_read', {
        p_ids: ids,
      });
      if (error) {
        reportError('mark-notifications-read', error);
        return 0;
      }
      const count = (data as number) ?? 0;
      EventBus.emit('notifications-marked-read', { ids, count });
      return count;
    } catch (err) {
      reportError('mark-notifications-read', err);
      return 0;
    }
  }

  /** 客户端创建本地通知（用于 task_due 等无服务端触发的场景） */
  async createLocal(
    kind: NotificationKind,
    title: string,
    body?: string,
    link?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;
      await supabase.from('notifications').insert({
        user_id: session.user.id,
        kind,
        title,
        body: body ?? null,
        link: link ?? null,
        metadata: metadata ?? null,
      });
      // realtime trigger 会自动推送 → 不需要手动 emit
    } catch (err) {
      reportError('create-local-notification', err);
    }
  }

  /** 启动 Realtime 订阅 */
  async subscribe(): Promise<void> {
    if (this.subscribed) return;
    // 防止 StrictMode 双订阅
    const now = Date.now();
    if (now - this.subscribeAttemptedAt < 1000) return;
    this.subscribeAttemptedAt = now;

    const supabase = getSupabase();
    if (!supabase) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const myId = session.user.id;

    const ch = supabase.channel(`notifications:${myId}`);
    ch.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${myId}`,
      },
      (payload) => {
        const n = payload.new as Notification;
        EventBus.emit('notification-received', n);
      }
    );
    await ch.subscribe();
    this.subscribed = true;
  }
}

export const notificationManager = new NotificationManager();

// Expose for debugging
if (typeof window !== 'undefined') {
  (window as unknown as { __notifications: NotificationManager }).__notifications =
    notificationManager;
}
