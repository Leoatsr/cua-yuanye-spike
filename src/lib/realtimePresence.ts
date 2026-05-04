import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { reportError } from './sentry';
import { EventBus } from '../game/EventBus';

/**
 * G1.0 · Multiplayer Realtime
 *
 * 架构:
 *   - Presence: 跟踪谁在线 (每个 scene 一个 channel)
 *   - Broadcast: 高频位置同步 + 聊天 (不持久化)
 *
 * 每个玩家进入 scene → join channel `scene:<sceneKey>`
 * 离开 scene → leave channel
 *
 * 位置广播频率: 100ms 一次 (10 fps)
 *
 * 治本修复 (G10-new):
 *   - handlePositionBroadcast 不再静默 drop "未知 user 的 broadcast"
 *     而是创建 pending player record + 主动从 presenceState() 拉 meta
 *   - joinScene 后延迟 200ms 主动 syncFromPresenceState · 防止 sync 事件丢失
 *   - 同 scene re-join 时也强制重新 track 自己 · 让其它人感知
 */

export interface RemotePlayerInfo {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  face: { hairstyle: number; hair_color: number; outfit_color: number };
  // Position
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'up' | 'down' | 'left' | 'right';
  // Updated locally on each broadcast receive
  last_seen: number;
  /** 元数据是否已通过 presence sync 补全。false = 仅有 user_id + 位置 (从 broadcast 创建的临时记录) */
  meta_ready: boolean;
}

export interface PresenceMeta {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  face: { hairstyle: number; hair_color: number; outfit_color: number };
  online_at: number;
  is_bot?: boolean;
}

interface BroadcastPositionPayload {
  user_id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'up' | 'down' | 'left' | 'right';
}

const POSITION_BROADCAST_INTERVAL = 100; // ms
const PRESENCE_SYNC_RETRY_DELAY = 250; // ms · join 后延迟主动拉 state

class PresenceManager {
  private supabase: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private currentSceneKey: string | null = null;
  private myMeta: PresenceMeta | null = null;
  private remotePlayers = new Map<string, RemotePlayerInfo>();
  private positionBroadcastHandle: number | null = null;
  private getMyPosition: (() => BroadcastPositionPayload | null) | null = null;
  // Track all online users globally (across all scenes) — fed by separate global channel
  private globalChannel: RealtimeChannel | null = null;
  private globalCount = 0;

  /**
   * Initialize. Call once on app start (after auth ready).
   */
  async initialize(meta: Omit<PresenceMeta, 'online_at'>): Promise<void> {
    this.supabase = getSupabase();
    if (!this.supabase) return;

    this.myMeta = { ...meta, online_at: Date.now() };

    // Global online channel (cross-scene)
    if (!this.globalChannel) {
      this.globalChannel = this.supabase.channel('global-online', {
        config: { presence: { key: meta.user_id } },
      });
      this.globalChannel
        .on('presence', { event: 'sync' }, () => {
          if (!this.globalChannel) return;
          const state = this.globalChannel.presenceState();
          this.globalCount = Object.keys(state).length;
          EventBus.emit('online-count-updated', {
            global: Math.max(this.globalCount, this.remotePlayers.size + 1),
            scene: this.remotePlayers.size + 1,
          });
          EventBus.emit('global-presence-updated', {
            user_ids: Object.keys(state),
          });
        });
      await this.globalChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && this.myMeta && this.globalChannel) {
          await this.globalChannel.track(this.myMeta);
        }
      });
    }
  }

  /**
   * Update local face/profile/position-source. Called by scene/profile changes.
   */
  updateMeta(patch: Partial<Omit<PresenceMeta, 'online_at' | 'user_id'>>): void {
    if (!this.myMeta) return;
    this.myMeta = { ...this.myMeta, ...patch };
    if (this.globalChannel) {
      void this.globalChannel.track(this.myMeta);
    }
    if (this.channel) {
      void this.channel.track(this.myMeta);
    }
  }

  /**
   * Join a scene's realtime channel.
   * Pass a getter for the player's current position (called every 100ms to broadcast).
   */
  async joinScene(
    sceneKey: string,
    getPosition: () => BroadcastPositionPayload | null,
  ): Promise<void> {
    if (!this.supabase || !this.myMeta) return;
    if (this.currentSceneKey === sceneKey && this.channel) return; // already in
    await this.leaveScene();

    this.currentSceneKey = sceneKey;
    this.getMyPosition = getPosition;

    const channelName = `scene:${sceneKey}`;
    const ch = this.supabase.channel(channelName, {
      config: { presence: { key: this.myMeta.user_id } },
    });

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, PresenceMeta[]>;
      this.handlePresenceSync(state);
    });

    ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
      this.handlePositionBroadcast(payload as BroadcastPositionPayload);
    });

    await ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && this.myMeta) {
        await ch.track(this.myMeta);
      }
    });

    this.channel = ch;

    // 治本: join 后延迟 250ms 主动拉一次 state · 防止 sync 事件错过
    window.setTimeout(() => {
      if (this.channel === ch && this.currentSceneKey === sceneKey) {
        try {
          const state = ch.presenceState() as Record<string, PresenceMeta[]>;
          this.handlePresenceSync(state);
        } catch (err) {
          reportError('presence-retry-sync', err);
        }
      }
    }, PRESENCE_SYNC_RETRY_DELAY);

    // Start position broadcast loop
    this.positionBroadcastHandle = window.setInterval(() => {
      this.broadcastPosition();
    }, POSITION_BROADCAST_INTERVAL);
  }

  async leaveScene(): Promise<void> {
    if (this.positionBroadcastHandle !== null) {
      window.clearInterval(this.positionBroadcastHandle);
      this.positionBroadcastHandle = null;
    }
    if (this.channel) {
      try {
        await this.channel.untrack();
        await this.channel.unsubscribe();
      } catch (err) {
        reportError('presence-leave', err);
      }
      this.channel = null;
    }
    this.currentSceneKey = null;
    this.getMyPosition = null;
    // Clear remote players for old scene
    this.remotePlayers.clear();
    EventBus.emit('remote-players-cleared');
    EventBus.emit('online-count-updated', {
      global: Math.max(this.globalCount, this.remotePlayers.size + 1),
      scene: 1,
    });
  }

  private handlePresenceSync(state: Record<string, PresenceMeta[]>): void {
    const newSet = new Set<string>();
    for (const userId in state) {
      const metas = state[userId];
      if (!metas || metas.length === 0) continue;
      const meta = metas[0];
      if (!this.myMeta || meta.user_id === this.myMeta.user_id) continue;
      newSet.add(meta.user_id);
      // Add or update remote player
      const existing = this.remotePlayers.get(meta.user_id);
      if (!existing) {
        this.remotePlayers.set(meta.user_id, {
          user_id: meta.user_id,
          username: meta.username,
          display_name: meta.display_name,
          avatar_url: meta.avatar_url,
          face: meta.face,
          x: 0, y: 0, vx: 0, vy: 0, facing: 'down',
          last_seen: Date.now(),
          meta_ready: true,
        });
        EventBus.emit('remote-player-joined', this.remotePlayers.get(meta.user_id));
      } else {
        // 治本: 如果之前是从 broadcast 创建的 pending record (meta_ready=false) ·
        //       这次 sync 把 meta 补全后要重新 emit 'remote-player-joined' 让 scene 重渲染
        const wasPending = !existing.meta_ready;
        existing.username = meta.username;
        existing.display_name = meta.display_name;
        existing.avatar_url = meta.avatar_url;
        existing.face = meta.face;
        existing.meta_ready = true;
        if (wasPending) {
          EventBus.emit('remote-player-joined', existing);
        }
      }
    }
    // Remove players who left (但 pending player 不删 · 等待 sync 补全 · 避免误删)
    for (const userId of Array.from(this.remotePlayers.keys())) {
      if (!newSet.has(userId)) {
        const player = this.remotePlayers.get(userId);
        if (player && !player.meta_ready) {
          // pending · 给个 grace period (5s) 后再删 · 防止 sync race 误删
          if (Date.now() - player.last_seen > 5000) {
            this.remotePlayers.delete(userId);
            EventBus.emit('remote-player-left', player);
          }
        } else {
          this.remotePlayers.delete(userId);
          EventBus.emit('remote-player-left', player);
        }
      }
    }
    EventBus.emit('online-count-updated', {
      global: Math.max(this.globalCount, this.remotePlayers.size + 1),
      scene: this.remotePlayers.size + 1,
    });
    EventBus.emit('roster-updated', Array.from(this.remotePlayers.values()).concat([{
      user_id: this.myMeta?.user_id ?? 'self',
      username: this.myMeta?.username ?? '',
      display_name: this.myMeta?.display_name ?? '',
      avatar_url: this.myMeta?.avatar_url ?? null,
      face: this.myMeta?.face ?? { hairstyle: 0, hair_color: 0, outfit_color: 0 },
      x: 0, y: 0, vx: 0, vy: 0, facing: 'down',
      last_seen: Date.now(),
      meta_ready: true,
    }]));
  }

  private handlePositionBroadcast(payload: BroadcastPositionPayload): void {
    if (!this.myMeta || payload.user_id === this.myMeta.user_id) return;
    let player = this.remotePlayers.get(payload.user_id);

    // 治本: 不再静默 drop · 创建 pending player record + 主动尝试拉 meta
    if (!player) {
      // 先尝试从当前 channel.presenceState() 同步拉 meta
      let meta: PresenceMeta | null = null;
      if (this.channel) {
        try {
          const state = this.channel.presenceState() as Record<string, PresenceMeta[]>;
          const metas = state[payload.user_id];
          if (metas && metas.length > 0) {
            meta = metas[0];
          }
        } catch (err) {
          reportError('presence-state-pull', err);
        }
      }

      player = {
        user_id: payload.user_id,
        username: meta?.username ?? '',
        display_name: meta?.display_name ?? '加载中...',
        avatar_url: meta?.avatar_url ?? null,
        face: meta?.face ?? { hairstyle: 0, hair_color: 0, outfit_color: 0 },
        x: payload.x,
        y: payload.y,
        vx: payload.vx,
        vy: payload.vy,
        facing: payload.facing,
        last_seen: Date.now(),
        meta_ready: meta !== null,
      };
      this.remotePlayers.set(payload.user_id, player);
      EventBus.emit('remote-player-joined', player);
      EventBus.emit('online-count-updated', {
        global: Math.max(this.globalCount, this.remotePlayers.size + 1),
        scene: this.remotePlayers.size + 1,
      });
      // 如果 meta 还没补全 · 主动延迟 500ms 再拉一次 (等 presence sync 到位)
      if (!meta) {
        window.setTimeout(() => {
          if (this.channel) {
            try {
              const state = this.channel.presenceState() as Record<string, PresenceMeta[]>;
              this.handlePresenceSync(state);
            } catch (err) {
              reportError('presence-state-pull-delayed', err);
            }
          }
        }, 500);
      }
    } else {
      player.x = payload.x;
      player.y = payload.y;
      player.vx = payload.vx;
      player.vy = payload.vy;
      player.facing = payload.facing;
      player.last_seen = Date.now();
    }
    EventBus.emit('remote-player-moved', player);
  }

  private broadcastPosition(): void {
    if (!this.channel || !this.getMyPosition) return;
    const pos = this.getMyPosition();
    if (!pos) return;
    void this.channel.send({
      type: 'broadcast',
      event: 'pos',
      payload: pos,
    });
  }

  getRemotePlayers(): RemotePlayerInfo[] {
    return Array.from(this.remotePlayers.values());
  }

  getMyMeta(): PresenceMeta | null {
    return this.myMeta;
  }

  /** G5-B: 拉所有全局在线用户 user_id (不含 bots) */
  getGlobalUserIds(): string[] {
    if (!this.globalChannel) return [];
    const state = this.globalChannel.presenceState();
    return Object.keys(state);
  }

  /**
   * For fakeBot.ts to inject simulated remote players directly
   * (bypasses Realtime — bots are local-only, not actual connections).
   */
  injectFakePlayer(info: Omit<RemotePlayerInfo, 'meta_ready'>): void {
    const fullInfo: RemotePlayerInfo = { ...info, meta_ready: true };
    this.remotePlayers.set(fullInfo.user_id, fullInfo);
    EventBus.emit('remote-player-joined', fullInfo);
    EventBus.emit('roster-updated', this.getRosterIncludingSelf());
    EventBus.emit('online-count-updated', {
      global: Math.max(this.globalCount, this.remotePlayers.size + 1),
      scene: this.remotePlayers.size + 1,
    });
  }

  removeFakePlayer(userId: string): void {
    const player = this.remotePlayers.get(userId);
    if (!player) return;
    this.remotePlayers.delete(userId);
    EventBus.emit('remote-player-left', player);
    EventBus.emit('roster-updated', this.getRosterIncludingSelf());
    EventBus.emit('online-count-updated', {
      global: Math.max(this.globalCount, this.remotePlayers.size + 1),
      scene: this.remotePlayers.size + 1,
    });
  }

  updateFakePlayerPosition(userId: string, payload: BroadcastPositionPayload): void {
    const player = this.remotePlayers.get(userId);
    if (!player) return;
    player.x = payload.x;
    player.y = payload.y;
    player.vx = payload.vx;
    player.vy = payload.vy;
    player.facing = payload.facing;
    player.last_seen = Date.now();
    EventBus.emit('remote-player-moved', player);
  }

  private getRosterIncludingSelf(): RemotePlayerInfo[] {
    const list = Array.from(this.remotePlayers.values());
    if (this.myMeta) {
      list.push({
        user_id: this.myMeta.user_id,
        username: this.myMeta.username,
        display_name: this.myMeta.display_name,
        avatar_url: this.myMeta.avatar_url,
        face: this.myMeta.face,
        x: 0, y: 0, vx: 0, vy: 0, facing: 'down',
        last_seen: Date.now(),
        meta_ready: true,
      });
    }
    return list;
  }
}

// Singleton
export const presence = new PresenceManager();

// Expose to window for debugging
declare global {
  interface Window {
    __presence?: PresenceManager;
  }
}
if (typeof window !== 'undefined') {
  window.__presence = presence;
}
