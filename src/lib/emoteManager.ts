import { EventBus } from '../game/EventBus';
import { chatManager } from './chatStore';
import {
  parseEmoteCommand,
  type EmoteDef,
} from './emoteCatalog';

/**
 * G6 · emote 管理器
 *
 * 触发表情：
 *   1. 用户从 EmotePanel 点击 → emoteManager.trigger('/yi')
 *   2. → 通过 chatManager 发世界聊天（消息文本就是命令本身，C2 方案）
 *   3. → chatStore 收到广播后 emit 'chat-message-received'
 *   4. → emoteManager 监听该事件 → 检测命令 → emit 'emote-triggered'
 *   5. → EmoteOverlay 监听 'emote-triggered' → 渲染
 *
 * 不需要新 channel / 不需要 broadcast —— 完全复用 chat 基建。
 */

export interface EmoteEvent {
  user_id: string;
  display_name: string;
  emote: EmoteDef;
  triggered_at: number;
}

interface ChatMessagePayload {
  sender_id: string;
  sender_name: string;
  content: string;
  channel_type?: string;
}

class EmoteManager {
  private started = false;

  /** 启动 chat 监听（App 启动后调一次）*/
  start(): void {
    if (this.started) return;
    this.started = true;

    EventBus.on('chat-message-received', (msg: ChatMessagePayload) => {
      const text = msg.content ?? '';
      const def = parseEmoteCommand(text);
      if (!def) return;

      EventBus.emit('emote-triggered', {
        user_id: msg.sender_id,
        display_name: msg.sender_name,
        emote: def,
        triggered_at: Date.now(),
      } as EmoteEvent);
    });
  }

  /** 自己触发表情（来自 EmotePanel 点击）*/
  async trigger(command: string): Promise<void> {
    const def = parseEmoteCommand(command);
    if (!def) return;
    // 走 chat 系统发出去（C2 方案 — 显示在聊天里）
    // chatManager 会把消息广播 + 本地也会通过 chat-message-received 拿回
    await chatManager.sendMessage('world', command);
  }
}

export const emoteManager = new EmoteManager();

if (typeof window !== 'undefined') {
  (window as unknown as { __emote: EmoteManager }).__emote = emoteManager;
}
