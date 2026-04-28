import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EventBus } from '../game/EventBus';
import type { RemotePlayerInfo } from '../lib/realtimePresence';

/**
 * G3 · 走近其他玩家按 E 弹中央菜单
 *
 * 选项：
 *   - 📋 查看主页（跳 /u/[username]）
 *   - 💌 私聊（emit open-private-chat）
 *   - ❌ 取消
 *
 * bot 不显示"💌 私聊"，显示"机器人不接受私聊"。
 */
export function PlayerInteractMenu() {
  const [target, setTarget] = useState<RemotePlayerInfo | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onOpen = (info: RemotePlayerInfo) => {
      setTarget(info);
    };
    EventBus.on('open-player-interact-menu', onOpen);
    return () => {
      EventBus.off('open-player-interact-menu', onOpen);
    };
  }, []);

  // ESC to close
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setTarget(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target]);

  if (!target) return null;

  const isBot = target.user_id.startsWith('bot-');

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setTarget(null)}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 99,
          backdropFilter: 'blur(2px)',
        }}
      />
      {/* Menu */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 100,
          minWidth: 280,
          background: 'linear-gradient(180deg, #1f2230 0%, #15171f 100%)',
          border: '1px solid rgba(184, 137, 58, 0.5)',
          borderRadius: 8,
          padding: 0,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
          color: '#f5f0e0',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
          animation: 'menuIn 0.2s ease-out',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px 10px',
          borderBottom: '1px solid rgba(184, 137, 58, 0.25)',
          background: 'rgba(0, 0, 0, 0.25)',
        }}>
          <div style={{
            fontSize: 11, color: '#8a8576',
            letterSpacing: '0.1em',
            marginBottom: 2,
          }}>
            互动
          </div>
          <div style={{
            fontSize: 16, fontWeight: 600,
            color: isBot ? '#a78bfa' : '#7fc090',
          }}>
            {target.display_name}
            {isBot && (
              <span style={{ fontSize: 11, color: '#8a8576', marginLeft: 8 }}>
                (机器人)
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: 6 }}>
          {!isBot && (
            <MenuItem
              icon="📋"
              label="查看主页"
              hint={`/u/${target.username}`}
              color="#a5c8ff"
              onClick={() => {
                navigate(`/u/${target.username}`);
                setTarget(null);
              }}
            />
          )}
          {!isBot && (
            <MenuItem
              icon="💌"
              label="私聊"
              hint={`发消息给 ${target.display_name}`}
              color="#e0b060"
              onClick={() => {
                EventBus.emit('open-private-chat', { otherUserId: target.user_id });
                setTarget(null);
              }}
            />
          )}
          {isBot && (
            <div style={{
              padding: '14px 12px',
              fontSize: 12,
              color: '#8a8576',
              fontStyle: 'italic',
              textAlign: 'center',
            }}>
              🤖 机器人不接受互动
            </div>
          )}
          <div style={{
            height: 1,
            background: 'rgba(245, 240, 224, 0.06)',
            margin: '4px 0',
          }} />
          <MenuItem
            icon="❌"
            label="取消"
            hint="ESC"
            color="#a8a08e"
            onClick={() => setTarget(null)}
          />
        </div>

        <style>{`
          @keyframes menuIn {
            from { opacity: 0; transform: translate(-50%, -45%); }
            to { opacity: 1; transform: translate(-50%, -50%); }
          }
        `}</style>
      </div>
    </>
  );
}

function MenuItem({
  icon, label, hint, color, onClick,
}: {
  icon: string;
  label: string;
  hint?: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        cursor: 'pointer',
        borderRadius: 4,
        display: 'flex', alignItems: 'center', gap: 10,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(184, 137, 58, 0.12)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, color }}>{label}</span>
      {hint && (
        <span style={{ fontSize: 10, color: '#6e6856', fontFamily: 'monospace' }}>
          {hint}
        </span>
      )}
    </div>
  );
}
