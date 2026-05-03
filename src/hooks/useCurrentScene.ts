import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import { chatManager } from '../lib/chatStore';

/**
 * 监听当前 scene key（chat scope）
 *
 * 由 chatManager.subscribeScene() / leaveScene() emit 'chat-scene-changed'
 */
export function useCurrentScene(): string | null {
  const [sceneKey, setSceneKey] = useState<string | null>(() =>
    chatManager.getCurrentSceneKey(),
  );

  useEffect(() => {
    const onChange = (data: { sceneKey: string | null }) => {
      setSceneKey(data.sceneKey);
    };
    EventBus.on('chat-scene-changed', onChange);
    return () => {
      EventBus.off('chat-scene-changed', onChange);
    };
  }, []);

  return sceneKey;
}
