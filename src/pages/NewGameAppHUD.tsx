import { useEffect, useState } from 'react';
import { Sprite } from '../ui';
import {
  AvatarPanel,
  CVBar,
  TopRightChips,
  Minimap,
  QuestCard,
  IconBar,
  Hotbar,
} from '../ui/hud';
import {
  useProfile,
  useCV,
  useLevel,
  useGameTime,
  useOnlineCount,
} from '../hooks';
import { EventBus } from '../game/EventBus';

/**
 * NewGameApp · /play 路由替换 MainGameApp 视觉部分
 *
 * Wave 7.E.1 改动：
 *   - 删右下角 ? 帮助按钮（跟左下 hotbar 公告重复）
 *   - 时钟用真实世界时间 + 真实昼夜 phase（替代 timeStore.formatTime）
 *   - 节气保持 gameTime.solarTerm（游戏机制 · 不是真实节气）
 */

/** 真实世界时间 + phase */
function useRealClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const hour = now.getHours();
  const phase =
    hour >= 5 && hour < 8 ? '清晨'
    : hour >= 8 && hour < 17 ? '白昼'
    : hour >= 17 && hour < 19 ? '黄昏'
    : '夜晚';
  return { clockTime: `${hh}:${mm}`, daypart: phase };
}

interface NewGameAppHUDProps {
  visible?: boolean;
}

export function NewGameAppHUD({ visible = true }: NewGameAppHUDProps) {
  const profile = useProfile();
  const cv = useCV();
  const levelInfo = useLevel();
  const gameTime = useGameTime();
  const online = useOnlineCount();
  const realClock = useRealClock();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!visible) return null;

  const triggerPanel = (panel: 'announcement' | 'questlog' | 'mail' | 'chat' | 'friends') => {
    EventBus.emit('toggle-panel', { panel });
    if (panel === 'questlog') {
      EventBus.emit('open-quest-log');
    }
  };

  const onAvatarClick = () => {
    EventBus.emit('toggle-account-menu');
  };

  return (
    <>
      {/* 顶部中心 — 在线人数 chip */}
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 60,
          pointerEvents: 'auto',
        }}
      >
        <div
          title={`全服在线 ${online.global} 人 · 此场景 ${online.scene} 人`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 16px',
            background: 'var(--paper-1, #fdf0cf)',
            border: '3px solid var(--wood-3, #8b4513)',
            boxShadow:
              '0 0 0 3px var(--wood-4, #5d3a1a), inset -2px -2px 0 var(--paper-shadow, #c9a55b), inset 2px 2px 0 var(--paper-0, #fff8dc)',
            fontFamily: 'var(--f-pixel, "VT323", "Courier New", monospace)',
            fontSize: 14,
            color: 'var(--wood-3, #8b4513)',
            letterSpacing: '0.05em',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#7fc090',
              boxShadow: '0 0 6px #7fc090, 0 0 2px #fff',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 10, color: 'var(--wood-2, #a0522d)', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 500 }}>
            ONLINE
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--ink-soft, #6b4f33)', letterSpacing: '0.1em' }}>全服</span>
            <strong style={{ fontSize: 16, color: 'var(--wood-3, #8b4513)', fontWeight: 700 }}>{online.global}</strong>
          </span>
          <span style={{ color: 'var(--paper-shadow, #c9a55b)' }}>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--ink-soft, #6b4f33)', letterSpacing: '0.1em' }}>此地</span>
            <strong style={{ fontSize: 16, color: 'var(--gold, #daa520)', fontWeight: 700 }}>{online.scene}</strong>
          </span>
        </div>
      </div>

      {/* 左上 — 头像 panel + ▼ */}
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          zIndex: 50,
          pointerEvents: 'auto',
        }}
      >
        <div
          onClick={onAvatarClick}
          style={{ cursor: 'pointer', position: 'relative', transition: 'transform 0.1s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
          title="点击打开账户菜单"
        >
          <AvatarPanel
            name={profile?.display_name || profile?.username || '...'}
            level={`${levelInfo.level.lv} · ${levelInfo.level.name}`}
          />
          <span
            style={{
              position: 'absolute',
              bottom: 6,
              right: 8,
              fontSize: 10,
              color: 'var(--wood-3, #8b4513)',
              fontFamily: 'var(--f-pixel, "Courier New", monospace)',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            ▼
          </span>
        </div>

        <CVBar
          current={cv}
          threshold={levelInfo.nextThreshold || 100}
          nextLevelLabel={levelInfo.nextLevelLabel}
        />
      </div>

      {/* 右上 — 节气/时间/在线 chips */}
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          display: 'flex',
          gap: 10,
          zIndex: 50,
          pointerEvents: 'auto',
        }}
      >
        <TopRightChips
          solarTerm={gameTime.solarTerm}
          clockTime={realClock.clockTime}
          daypart={realClock.daypart}
          onlineCount={online.global}
        />
      </div>

      {/* 右上 — 小地图 */}
      <div
        style={{
          position: 'fixed',
          top: 60,
          right: 12,
          zIndex: 50,
          pointerEvents: 'auto',
        }}
      >
        <Minimap
          sceneName="萌芽镇"
          playerX={45}
          playerY={55}
          landmarks={[
            { x: 30, y: 30, w: 40, h: 20, color: '#daa520' },
            { x: 20, y: 60, w: 30, h: 15, color: '#cd853f' },
          ]}
          road={{ y: 50 }}
        />
      </div>

      {/* 左中 — 当前任务 */}
      <div
        style={{
          position: 'fixed',
          top: 110,
          left: 12,
          zIndex: 50,
          width: 280,
          pointerEvents: 'auto',
        }}
      >
        <QuestCard
          title="未接取任务"
          description="靠近任意工坊主，按 E 接取任务。Phase 2.5 上线后将自动从 GitHub Issues 拉取真实贡献任务。"
          workshopName="Phase 2.5 待接入"
        />
      </div>

      {/* 左下 — 5 图标按钮 */}
      <div
        style={{
          position: 'fixed',
          bottom: 12,
          left: 12,
          zIndex: 50,
          pointerEvents: 'auto',
        }}
      >
        <IconBar
          items={[
            { icon: '📜', label: '公告', onClick: () => triggerPanel('announcement') },
            { icon: '📋', label: '任务', onClick: () => triggerPanel('questlog') },
            { icon: '✉', label: '邮件', onClick: () => triggerPanel('mail') },
            { icon: '💬', label: '聊天', onClick: () => triggerPanel('chat') },
            { icon: '👥', label: '好友', onClick: () => triggerPanel('friends') },
          ]}
        />
      </div>

      {/* Wave 7.E.1: 右下 — 仅 Hotbar (删 ? 帮助按钮 · 跟左下公告重复) */}
      <div
        style={{
          position: 'fixed',
          bottom: 12,
          right: 12,
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          zIndex: 50,
          pointerEvents: 'auto',
        }}
      >
        <Hotbar
          slots={[
            { content: <Sprite name="leaf" scale={3} /> },
            { content: <Sprite name="coin" scale={3} />, qty: cv > 0 ? cv : undefined },
            { content: <span style={{ fontSize: 22 }}>📜</span> },
            {},
            {},
          ]}
        />
      </div>
    </>
  );
}
