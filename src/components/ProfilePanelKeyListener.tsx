import { useEffect } from 'react';
import { EventBus } from '../game/EventBus';

/**
 * F4.1 · P 键打开资料面板
 *
 * 监听全局 P 键 — 但不与文本输入冲突。
 * 如果焦点在 input/textarea/contenteditable 上则忽略。
 */
export function ProfilePanelKeyListener() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'p' && e.key !== 'P') return;
      // 不在文本输入中触发
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;
      // Modifier keys → 不触发（避免 Cmd+P 打印）
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      EventBus.emit('open-profile-panel');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
