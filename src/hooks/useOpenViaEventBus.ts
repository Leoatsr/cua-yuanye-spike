import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';

/**
 * 监听旧 EventBus "open-XXX" 事件 + 新 NewGameAppHUD 'toggle-panel' 事件
 *
 * 旧 keyListener emit 'open-mailbox' / 'open-friends-panel' (无 toggle 概念)
 * 新 NewGameAppHUD 5 图标按钮 emit 'toggle-panel' { panel: 'mail' | 'friends' }
 *
 * 旧的：每次 emit 都"打开"（如果已开则保持开）
 * 新的：toggle 模式
 *
 * 这里两边都监听：旧 = 打开；新 = toggle
 */
export function useOpenViaEventBus(
  panelName: string,
  legacyOpenEvent: string,
): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // 旧事件：打开（不切换）
    const onLegacyOpen = () => setOpen(true);

    // 新事件：toggle
    const onTogglePanel = (data: { panel: string }) => {
      if (data.panel === panelName) {
        setOpen((prev) => !prev);
      }
    };

    EventBus.on(legacyOpenEvent, onLegacyOpen);
    EventBus.on('toggle-panel', onTogglePanel);

    return () => {
      EventBus.off(legacyOpenEvent, onLegacyOpen);
      EventBus.off('toggle-panel', onTogglePanel);
    };
  }, [panelName, legacyOpenEvent]);

  return [open, setOpen];
}
