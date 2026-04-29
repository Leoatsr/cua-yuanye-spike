import { useEffect } from 'react';
import { EventBus } from '../game/EventBus';

/**
 * 桥接 NewGameAppHUD 5 图标按钮的 'toggle-panel' 事件
 * → 现有 panel 的 'open-XXX' 事件
 *
 * 旧 panel 的 keyListener emit:
 *   - open-mailbox       (K 键)
 *   - open-friends-panel (F 键)
 *   - open-quest-log     (J 键)
 *   - toggle-chat-panel  (T 键)
 *
 * NewGameAppHUD 5 图标 emit:
 *   - toggle-panel { panel: 'announcement' / 'questlog' / 'mail' / 'chat' / 'friends' }
 *
 * 各 New* panel 已自己处理（NewMailBox / NewFriendsPanel / NewChatPanel / NewAnnouncementPanel）
 *
 * 唯独 QuestLog 仍是旧版 → 这里桥接
 *
 * 副作用：QuestLog 旧 EventBus 已经是 toggle 模式 (setOpen(p => !p))，
 *        我们 emit 'open-quest-log' 就能切换它
 */
export function PanelToggleBridge() {
  useEffect(() => {
    const onTogglePanel = (data: { panel: string }) => {
      // 只桥接 questlog（其他 panel 都已自己监听 toggle-panel）
      if (data.panel === 'questlog') {
        EventBus.emit('open-quest-log');
      }
    };
    EventBus.on('toggle-panel', onTogglePanel);
    return () => {
      EventBus.off('toggle-panel', onTogglePanel);
    };
  }, []);

  return null;
}
