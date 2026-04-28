import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import type { RemotePlayerInfo } from '../lib/realtimePresence';

/**
 * G3 · E 键监听器
 *
 * - 仅在有 nearestPlayer 时响应（≤60px）
 * - input/textarea 聚焦时不响应
 * - 不带 Cmd/Ctrl 修饰
 *
 * ⚠️ 已知冲突：玩家若同时靠近 NPC + 真人玩家，按 E 会同时触发两者的 E 互动。
 *   暂未处理，等真出 bug 再优化。
 */
export function PlayerInteractKeyListener() {
  const [nearest, setNearest] = useState<RemotePlayerInfo | null>(null);

  useEffect(() => {
    const onNearest = (info: RemotePlayerInfo | null) => {
      setNearest(info);
    };
    EventBus.on('nearest-player-changed', onNearest);
    return () => {
      EventBus.off('nearest-player-changed', onNearest);
    };
  }, []);

  useEffect(() => {
    if (!nearest) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'e' && e.key !== 'E') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;
      }

      e.preventDefault();
      EventBus.emit('open-player-interact-menu', nearest);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nearest]);

  return null;
}
