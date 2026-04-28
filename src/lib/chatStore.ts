import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { reportError } from './sentry';
import { EventBus } from '../game/EventBus';

/**
 * G2-A · 聊天系统
 *
 * 频道：
 *   - world  : 所有玩家，持久化 (chat_messages 表)
 *   - scene  : 当前 scene 的玩家，仅实时（不持久）
 *   - private: 1v1 私聊，持久化（G2-C 启用）
 *
 * Realtime channels:
 *   - "chat:world"  - broadcast 'msg'
 *   - "chat:scene:<sceneKey>" - broadcast 'msg'
 *   - "chat:private:<sortedUserIds>" - broadcast 'msg' (G2-C)
 *
 * 5s anti-spam: 每个频道每 5 秒最多发 1 条
 */

export type ChatChannelType = 'world' | 'scene' | 'private';

export interface ChatMessage {
  id: string;
  channel_type: ChatChannelType;
  channel_key: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  sender_face: { hairstyle: number; hair_color: number; outfit_color: number } | null;
  recipient_id: string | null;
  content: string;
  created_at: string;
}

/** G2-C: a private conversation (one entry per other user we've messaged) */
export interface PrivateConversation {
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string | null;
  other_user_face: { hairstyle: number; hair_color: number; outfit_color: number } | null;
  channel_key: string;
  last_message_content: string;
  last_message_at: string;
  last_message_sender_id: string;
  unread_count: number;
}

export const CHAT_LIMITS = {
  CONTENT_MAX: 200,
  COOLDOWN_MS: 5000,
  HISTORY_LIMIT: 50,
};

/** G2-C: build canonical private channel key from 2 user ids */
export function buildPrivateChannelKey(userA: string, userB: string): string {
  const ids = [userA, userB].sort();
  return `${ids[0]}::${ids[1]}`;
}

class ChatManager {
  private worldChannel: RealtimeChannel | null = null;
  private sceneChannel: RealtimeChannel | null = null;
  private currentSceneKey: string | null = null;
  private privateChannels: Map<string, RealtimeChannel> = new Map();  // G2-C: keyed by other_user_id
  private lastSendAt: Map<string, number> = new Map();

  /**
   * Subscribe to world channel. Call once on app start.
   */
  async subscribeWorld(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;
    if (this.worldChannel) return;

    const ch = supabase.channel('chat:world');
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      const msg = payload as ChatMessage;
      EventBus.emit('chat-message-received', msg);
    });
    await ch.subscribe();
    this.worldChannel = ch;

    // Pull recent history
    void this.loadRecentHistory('world', 'world');
  }

  /**
   * Subscribe to a scene's local chat channel.
   * Call when entering a scene; call leaveScene when exiting.
   */
  async subscribeScene(sceneKey: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;
    await this.leaveScene();

    this.currentSceneKey = sceneKey;
    const ch = supabase.channel(`chat:scene:${sceneKey}`);
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      const msg = payload as ChatMessage;
      EventBus.emit('chat-message-received', msg);
    });
    await ch.subscribe();
    this.sceneChannel = ch;
    EventBus.emit('chat-scene-changed', { sceneKey });
  }

  async leaveScene(): Promise<void> {
    if (this.sceneChannel) {
      try {
        await this.sceneChannel.unsubscribe();
      } catch (err) {
        reportError('chat-leave-scene', err);
      }
      this.sceneChannel = null;
    }
    this.currentSceneKey = null;
    EventBus.emit('chat-scene-changed', { sceneKey: null });
  }

  getCurrentSceneKey(): string | null {
    return this.currentSceneKey;
  }

  // ============== G2-C · Private chat ==============

  /**
   * Subscribe to a private 1v1 channel with another user.
   * Idempotent: re-call doesn't duplicate.
   */
  async subscribePrivate(otherUserId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;
    if (this.privateChannels.has(otherUserId)) return;

    const { data: { session } } = await supabase.auth.getSession();
    const myId = session?.user?.id;
    if (!myId) return;

    const channelKey = buildPrivateChannelKey(myId, otherUserId);
    const ch = supabase.channel(`chat:private:${channelKey}`);
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      const msg = payload as ChatMessage;
      EventBus.emit('chat-message-received', msg);
    });
    await ch.subscribe();
    this.privateChannels.set(otherUserId, ch);
  }

  async unsubscribePrivate(otherUserId: string): Promise<void> {
    const ch = this.privateChannels.get(otherUserId);
    if (!ch) return;
    try {
      await ch.unsubscribe();
    } catch (err) {
      reportError('chat-unsub-private', err);
    }
    this.privateChannels.delete(otherUserId);
  }

  /**
   * Subscribe to all conversations the user has had.
   * Call once on app start — auto-subscribes to incoming private msgs.
   */
  async subscribeAllExistingPrivate(): Promise<void> {
    const conversations = await this.loadMyConversations();
    for (const conv of conversations) {
      await this.subscribePrivate(conv.other_user_id);
    }
  }

  /**
   * Load full message history for a private conversation.
   */
  async loadPrivateHistory(otherUserId: string): Promise<ChatMessage[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data: { session } } = await supabase.auth.getSession();
    const myId = session?.user?.id;
    if (!myId) return [];
    const channelKey = buildPrivateChannelKey(myId, otherUserId);
    return this.loadRecentHistory('private', channelKey, CHAT_LIMITS.HISTORY_LIMIT);
  }

  /**
   * Get list of all conversations the user has (with unread counts).
   */
  async loadMyConversations(): Promise<PrivateConversation[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.rpc('get_my_private_conversations');
      if (error) {
        reportError('load-convs', error);
        return [];
      }
      const list = (data as PrivateConversation[]) ?? [];
      EventBus.emit('chat-conversations-loaded', list);
      return list;
    } catch (err) {
      reportError('load-convs', err);
      return [];
    }
  }

  /**
   * Send a private message. Auto-subscribes if not already.
   * Refuses to send to bot user_ids (those start with "bot-").
   */
  async sendPrivate(recipientId: string, content: string):
    Promise<{ ok: boolean; error?: string; message?: ChatMessage }>
  {
    if (recipientId.startsWith('bot-') || recipientId === 'system') {
      return { ok: false, error: '不能私聊机器人' };
    }
    // Ensure subscribed (so we receive replies)
    await this.subscribePrivate(recipientId);
    return this.sendMessage('private', content, recipientId);
  }

  /**
   * Send a message. Returns { ok, error?, message? }.
   * - World: persist + broadcast
   * - Scene: broadcast only (no persist)
   */
  async sendMessage(
    channelType: ChatChannelType,
    content: string,
    recipientId?: string,
  ): Promise<{ ok: boolean; error?: string; message?: ChatMessage }> {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: '未连接' };

    const trimmed = content.trim();
    if (trimmed.length === 0) return { ok: false, error: '消息为空' };
    if (trimmed.length > CHAT_LIMITS.CONTENT_MAX) {
      return { ok: false, error: `消息过长（最多 ${CHAT_LIMITS.CONTENT_MAX} 字）` };
    }

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return { ok: false, error: '请先登录' };

    // Determine channel_key
    let channelKey: string;
    if (channelType === 'world') {
      channelKey = 'world';
    } else if (channelType === 'scene') {
      if (!this.currentSceneKey) return { ok: false, error: '当前没有 scene' };
      channelKey = this.currentSceneKey;
    } else if (channelType === 'private') {
      if (!recipientId) return { ok: false, error: '私聊需要接收者' };
      // Sort user IDs to canonicalize
      const ids = [user.id, recipientId].sort();
      channelKey = `${ids[0]}::${ids[1]}`;
    } else {
      return { ok: false, error: '未知频道' };
    }

    // Anti-spam: 5s cooldown per channel
    const cooldownKey = `${channelType}:${channelKey}`;
    const lastAt = this.lastSendAt.get(cooldownKey) ?? 0;
    const now = Date.now();
    if (now - lastAt < CHAT_LIMITS.COOLDOWN_MS) {
      const remaining = Math.ceil((CHAT_LIMITS.COOLDOWN_MS - (now - lastAt)) / 1000);
      return { ok: false, error: `请等 ${remaining}s 再发` };
    }

    // Get sender meta (from profile)
    const meta = user.user_metadata ?? {};
    const senderName = (meta.full_name ?? meta.user_name ?? user.email ?? 'Unknown') as string;
    const senderAvatar = (meta.avatar_url ?? null) as string | null;

    // Get face from local cache
    let senderFace: ChatMessage['sender_face'] = null;
    try {
      const raw = localStorage.getItem('cua-yuanye-face-v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        senderFace = parsed.data ?? null;
      }
    } catch {
      // ignore
    }

    const messageId = crypto.randomUUID();
    const message: ChatMessage = {
      id: messageId,
      channel_type: channelType,
      channel_key: channelKey,
      sender_id: user.id,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      sender_face: senderFace,
      recipient_id: recipientId ?? null,
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    // Broadcast first (instant)
    let broadcastChannel: RealtimeChannel | null = null;
    if (channelType === 'world') broadcastChannel = this.worldChannel;
    else if (channelType === 'scene') broadcastChannel = this.sceneChannel;
    else if (channelType === 'private' && recipientId) {
      broadcastChannel = this.privateChannels.get(recipientId) ?? null;
    }

    if (broadcastChannel) {
      try {
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'msg',
          payload: message,
        });
      } catch (err) {
        reportError('chat-broadcast', err);
      }
    }

    // Persist (world + private)
    if (channelType === 'world' || channelType === 'private') {
      try {
        const { error } = await supabase.from('chat_messages').insert({
          id: messageId,
          channel_type: channelType,
          channel_key: channelKey,
          sender_id: user.id,
          sender_name: senderName,
          sender_avatar: senderAvatar,
          sender_face: senderFace,
          recipient_id: recipientId ?? null,
          content: trimmed,
        });
        if (error) {
          reportError('chat-insert', error);
          return { ok: false, error: error.message };
        }
      } catch (err) {
        reportError('chat-insert', err);
        return { ok: false, error: '保存失败' };
      }
    }

    this.lastSendAt.set(cooldownKey, now);

    // Echo to local listeners (so sender sees own message immediately)
    EventBus.emit('chat-message-received', message);

    return { ok: true, message };
  }

  /**
   * Pull recent history from DB (only world + private have history).
   * Emits each message via EventBus.
   */
  async loadRecentHistory(
    channelType: ChatChannelType,
    channelKey: string,
    limit = CHAT_LIMITS.HISTORY_LIMIT,
  ): Promise<ChatMessage[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    if (channelType === 'scene') return [];  // scene not persisted

    try {
      const { data, error } = await supabase.rpc('get_recent_chat_messages', {
        p_channel_type: channelType,
        p_channel_key: channelKey,
        p_limit: limit,
      });
      if (error) {
        reportError('chat-history', error);
        return [];
      }
      const messages = (data as ChatMessage[]) ?? [];
      // Reverse so oldest first (server returns DESC)
      const ordered = messages.slice().reverse();
      EventBus.emit('chat-history-loaded', { channelType, channelKey, messages: ordered });
      return ordered;
    } catch (err) {
      reportError('chat-history', err);
      return [];
    }
  }

  /**
   * Inject a synthetic message (used by bots).
   * Does NOT persist + does NOT broadcast (bots are local-only).
   */
  injectLocalMessage(message: ChatMessage): void {
    EventBus.emit('chat-message-received', message);
  }
}

export const chatManager = new ChatManager();

declare global {
  interface Window {
    __chat?: ChatManager;
  }
}
if (typeof window !== 'undefined') {
  window.__chat = chatManager;
}
