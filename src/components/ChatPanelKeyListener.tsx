import { useEffect } from 'react';
import { EventBus } from '../game/EventBus';

/**
 * G2-A · T 键开关聊天面板
 *
 * 与 P 键同款逻辑：
 * - 在 input/textarea 聚焦时不响应（避免输入"t"时关闭）
 * - 不带 Cmd/Ctrl 修饰
 */
export function ChatPanelKeyListener() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 't' && e.key !== 'T') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;
      }

      e.preventDefault();
      EventBus.emit('toggle-chat-panel');
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
