import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';

/**
 * 监听 EventBus 切换 panel 显示状态
 *
 * 同时监听:
 *   - 'toggle-chat-panel' (旧 ChatPanelKeyListener 的 T 键触发)
 *   - 'toggle-panel' { panel: 'chat' } (新 NewGameAppHUD 5 图标按钮触发)
 *
 * 这样新旧入口都能切换同一个 panel
 */
export function useToggleViaEventBus(panelName: string, dedicatedEvent?: string): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onToggle = () => setOpen((prev) => !prev);

    const onTogglePanel = (data: { panel: string }) => {
      if (data.panel === panelName) {
        setOpen((prev) => !prev);
      }
    };

    if (dedicatedEvent) {
      EventBus.on(dedicatedEvent, onToggle);
    }
    EventBus.on('toggle-panel', onTogglePanel);

    return () => {
      if (dedicatedEvent) {
        EventBus.off(dedicatedEvent, onToggle);
      }
      EventBus.off('toggle-panel', onTogglePanel);
    };
  }, [panelName, dedicatedEvent]);

  return [open, setOpen];
}
