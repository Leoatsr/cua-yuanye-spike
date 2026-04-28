import { useEffect } from 'react';
import { EventBus } from '../game/EventBus';

/**
 * D10 · N 键打开通知中心
 */
export function NotificationKeyListener() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable)
          return;
      }

      e.preventDefault();
      EventBus.emit('open-notifications');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
