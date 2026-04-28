import { useEffect } from 'react';
import { EventBus } from '../game/EventBus';

/**
 * G5-A · F 键打开好友面板
 */
export function FriendsKeyListener() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable)
          return;
      }

      e.preventDefault();
      EventBus.emit('open-friends-panel');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
