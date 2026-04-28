import { useEffect } from 'react';
import { EventBus } from '../game/EventBus';

/**
 * D9-A · Pack 1 · H 键打开任务历史
 *
 * - input/textarea 聚焦时不响应
 * - 不带 Cmd/Ctrl 修饰
 */
export function QuestHistoryKeyListener() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'h' && e.key !== 'H') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable)
          return;
      }

      e.preventDefault();
      EventBus.emit('open-quest-history');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
