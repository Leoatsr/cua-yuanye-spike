import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import type { RemotePlayerInfo } from '../lib/realtimePresence';

/**
 * G3 · 屏幕底部条幅
 *
 * 走近其他玩家（≤60px）时显示"按 E 与 X 互动"。
 * 与 NPC 对话提示样式一致。
 */
export function PlayerInteractPrompt() {
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

  if (!nearest) return null;

  const isBot = nearest.user_id.startsWith('bot-');

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        padding: '8px 16px',
        background: 'rgba(20, 24, 30, 0.92)',
        border: '1px solid rgba(255, 215, 0, 0.5)',
        borderRadius: 4,
        color: '#f5f0e0',
        fontSize: 13,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
        letterSpacing: '0.05em',
        userSelect: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        animation: 'interactPromptIn 0.2s ease-out',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        display: 'inline-block',
        padding: '1px 6px',
        background: '#FFD700',
        color: '#000',
        borderRadius: 3,
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        marginRight: 8,
      }}>
        E
      </span>
      与 <strong style={{ color: isBot ? '#a78bfa' : '#7fc090' }}>{nearest.display_name}</strong> 互动
      <style>{`
        @keyframes interactPromptIn {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
