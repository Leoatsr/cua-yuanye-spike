import { useEffect, useState } from 'react';
import { Sprite } from '../ui';
import {
  AvatarPanel,
  CVBar,
  TopRightChips,
  Minimap,
  IconBar,
  Hotbar,
} from '../ui/hud';
import {
  useProfile,
  useCV,
  useLevel,
  useOnlineCount,
} from '../hooks';
import { EventBus } from '../game/EventBus';
import type { MinimapPayload } from '../game/minimap-bridge';
import { getRealSolarTerm } from '../lib/realSolarTerm';

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
  const online = useOnlineCount();
  const realClock = useRealClock();

  // Wave 7.K real solar term
  const [realTerm, setRealTerm] = useState(() => getRealSolarTerm(new Date()));
  useEffect(() => {
    const id = setInterval(() => setRealTerm(getRealSolarTerm(new Date())), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Wave 7.K · minimap 真实数据 (订阅 scene emit)
  const [minimapData, setMinimapData] = useState<MinimapPayload | null>(null);
  useEffect(() => {
    const handler = (data: MinimapPayload) => setMinimapData(data);
    EventBus.on('minimap-update', handler);
    return () => { EventBus.off('minimap-update', handler); };
  }, []);

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
          solarTerm={realTerm}
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
          sceneName={minimapData?.sceneName ?? '...'}
          worldWidth={minimapData?.worldWidth}
          worldHeight={minimapData?.worldHeight}
          player={minimapData?.player}
          landmarks={minimapData?.landmarks ?? []}
          road={minimapData?.road}
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
