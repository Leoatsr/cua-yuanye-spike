import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';

interface WorldMapEvent {
  currentScene: 'Main' | 'SproutCity' | 'GovHill' | 'GrandPlaza';
}

interface MapLocation {
  id: 'sproutown' | 'sproutcity' | 'zhengzheng' | 'dasaiji';
  name: string;
  description: string;
  /** Position on the world map UI (percentage of container) */
  xPct: number;
  yPct: number;
  /** Whether this location is reachable */
  available: boolean;
  /** The Phaser scene key to switch to (if available) */
  sceneKey?: string;
}

const LOCATIONS: MapLocation[] = [
  {
    id: 'sproutown',
    name: '萌芽镇',
    description: '新人入村的第一站，老村长阿降的家。',
    xPct: 30,
    yPct: 60,
    available: true,
    sceneKey: 'Main',
  },
  {
    id: 'sproutcity',
    name: '共创之都',
    description: '九大工坊环绕中央喷泉广场。CUA 工作组的物理化身。',
    xPct: 60,
    yPct: 35,
    available: true,
    sceneKey: 'SproutCity',
  },
  {
    id: 'zhengzheng',
    name: '议政高地',
    description: '远见塔、执政厅、明镜阁——治理中心。',
    xPct: 80,
    yPct: 20,
    available: true,
    sceneKey: 'GovHill',
  },
  {
    id: 'dasaiji',
    name: '大集会广场',
    description: '年度大会的舞台。平时空旷，活动时万人云集。',
    xPct: 50,
    yPct: 80,
    available: true,
    sceneKey: 'GrandPlaza',
  },
];

export function WorldMap() {
  const [open, setOpen] = useState(false);
  const [currentScene, setCurrentScene] = useState<'Main' | 'SproutCity' | 'GovHill' | 'GrandPlaza'>('Main');

  useEffect(() => {
    const onOpen = (data: WorldMapEvent) => {
      setCurrentScene(data.currentScene);
      setOpen((prev) => !prev); // toggle - press M again to close
    };

    EventBus.on('open-world-map', onOpen);

    // Also support Escape to close
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      EventBus.off('open-world-map', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;

  const handleTravel = (loc: MapLocation) => {
    if (!loc.available || !loc.sceneKey) return;
    if (loc.sceneKey === currentScene) {
      // Already here
      setOpen(false);
      return;
    }
    // Emit travel event — Phaser scenes listen and switch
    EventBus.emit('world-map-travel', { sceneKey: loc.sceneKey });
    setOpen(false);
  };

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(8, 12, 18, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(2px)',
        animation: 'mapFadeIn 0.25s ease-out',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: '6%',
          color: '#FFD700',
          fontSize: 22,
          letterSpacing: '0.3em',
          textShadow: '0 0 10px rgba(255, 215, 0, 0.4)',
        }}
      >
        🗺️ 源野世界地图
      </div>

      {/* Map container — click on it doesn't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(720px, 80vw)',
          height: 'min(480px, 60vh)',
          background:
            'radial-gradient(ellipse at center, #2a3528 0%, #1a2018 60%, #0d1109 100%)',
          border: '2px solid rgba(220, 180, 60, 0.4)',
          borderRadius: 8,
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6)',
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent 0, transparent 18px, rgba(220, 180, 60, 0.02) 18px, rgba(220, 180, 60, 0.02) 19px)',
        }}
      >
        {/* Decorative compass */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            color: '#a8b3a0',
            fontSize: 11,
            letterSpacing: '0.05em',
          }}
        >
          N · 北
        </div>

        {/* Pseudo-paths between locations (visual flavor) */}
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {/* Sproutown ↔ Sproutcity */}
          <line
            x1="30%" y1="60%" x2="60%" y2="35%"
            stroke="rgba(220, 180, 60, 0.5)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
          {/* Sproutcity ↔ Zhengzheng (now unlocked) */}
          <line
            x1="60%" y1="35%" x2="80%" y2="20%"
            stroke="rgba(220, 180, 60, 0.5)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
          {/* Sproutcity ↔ Dasaiji (now unlocked) */}
          <line
            x1="60%" y1="35%" x2="50%" y2="80%"
            stroke="rgba(220, 180, 60, 0.5)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        </svg>

        {/* Location markers */}
        {LOCATIONS.map((loc) => {
          const isCurrent =
            (currentScene === 'Main' && loc.id === 'sproutown') ||
            (currentScene === 'SproutCity' && loc.id === 'sproutcity') ||
            (currentScene === 'GovHill' && loc.id === 'zhengzheng') ||
            (currentScene === 'GrandPlaza' && loc.id === 'dasaiji');
          return (
            <div
              key={loc.id}
              onClick={() => handleTravel(loc)}
              style={{
                position: 'absolute',
                left: `${loc.xPct}%`,
                top: `${loc.yPct}%`,
                transform: 'translate(-50%, -50%)',
                cursor: loc.available ? 'pointer' : 'not-allowed',
                opacity: loc.available ? 1 : 0.4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                userSelect: 'none',
              }}
            >
              {/* Pin */}
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: isCurrent
                    ? '#FFD700'
                    : loc.available
                      ? '#7fc090'
                      : '#666',
                  border: `2px solid ${isCurrent ? '#FFA500' : '#333'}`,
                  boxShadow: isCurrent
                    ? '0 0 16px rgba(255, 215, 0, 0.7)'
                    : loc.available
                      ? '0 0 8px rgba(127, 192, 144, 0.4)'
                      : 'none',
                  animation: isCurrent ? 'pinPulse 1.5s ease-in-out infinite' : 'none',
                }}
              />
              {/* Label */}
              <div
                style={{
                  fontSize: 13,
                  color: isCurrent
                    ? '#FFD700'
                    : loc.available
                      ? '#f5f0e0'
                      : '#999',
                  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                }}
              >
                {loc.name}
                {isCurrent && (
                  <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 400 }}>
                    （当前）
                  </span>
                )}
                {!loc.available && (
                  <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 400 }}>
                    🔒
                  </span>
                )}
              </div>
              {/* Description (always shown) */}
              <div
                style={{
                  fontSize: 10,
                  color: '#a8b3a0',
                  textAlign: 'center',
                  maxWidth: 140,
                  lineHeight: 1.4,
                  textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                }}
              >
                {loc.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '6%',
          color: '#8a8576',
          fontSize: 12,
          letterSpacing: '0.1em',
        }}
      >
        点击目的地传送 · M / Esc 关闭
      </div>

      <style>{`
        @keyframes mapFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pinPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
