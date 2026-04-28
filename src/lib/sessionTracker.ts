import { getSupabase } from './supabase';
import { EventBus } from '../game/EventBus';

/**
 * J2-C · Session 追踪
 *
 * 流程：
 *   1. App 启动后调 start() → 调 RPC session_start → 拿 sessionId
 *   2. 每 30 秒发一次心跳（session_heartbeat）+ 当前 scene
 *   3. 监听 chat-scene-changed 事件，scene 变化时立刻心跳
 *   4. beforeunload 调 session_end（best-effort，浏览器关闭时不一定触发）
 *   5. 服务端 90s 没收到心跳就认为离线（在 dashboard 查询里处理）
 */

const HEARTBEAT_INTERVAL_MS = 30 * 1000;

class SessionTracker {
  private sessionId: number | null = null;
  private currentScene = 'Main';
  private heartbeatTimer: number | null = null;
  private started = false;

  /** 启动 session 追踪 */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const ua =
        typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null;
      const { data, error } = await supabase.rpc('session_start', {
        p_scene: this.currentScene,
        p_user_agent: ua,
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[session] start failed:', error.message);
        return;
      }
      this.sessionId = (data as number) ?? null;
    } catch {
      // ignore
    }

    // 启动心跳
    if (typeof window !== 'undefined') {
      this.heartbeatTimer = window.setInterval(() => {
        void this.heartbeat();
      }, HEARTBEAT_INTERVAL_MS);

      // 监听 scene 切换 — 立刻发心跳
      EventBus.on('chat-scene-changed', (data: { sceneKey?: string }) => {
        if (data && typeof data.sceneKey === 'string') {
          this.currentScene = data.sceneKey;
          void this.heartbeat();
        }
      });

      // 浏览器关闭尝试 end（best-effort）
      window.addEventListener('beforeunload', () => {
        void this.end();
      });

      // visibilitychange 切换标签时心跳一次保持活跃
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.heartbeat();
        }
      });
    }
  }

  /** 心跳 */
  async heartbeat(): Promise<void> {
    if (this.sessionId === null) return;
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      await supabase.rpc('session_heartbeat', {
        p_session_id: this.sessionId,
        p_scene: this.currentScene,
      });
    } catch {
      // ignore
    }
  }

  /** 结束 session */
  async end(): Promise<void> {
    if (this.sessionId === null) return;
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      await supabase.rpc('session_end', {
        p_session_id: this.sessionId,
      });
    } catch {
      // ignore
    }

    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.sessionId = null;
  }

  /** 手动设置 scene（外部触发）*/
  setScene(scene: string): void {
    this.currentScene = scene;
    void this.heartbeat();
  }

  getSessionId(): number | null {
    return this.sessionId;
  }
}

export const sessionTracker = new SessionTracker();

if (typeof window !== 'undefined') {
  (window as unknown as { __session: SessionTracker }).__session = sessionTracker;
}
