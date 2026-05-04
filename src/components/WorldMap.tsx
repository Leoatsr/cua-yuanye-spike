import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';

interface WorldMapEvent {
  currentScene: 'Main' | 'SproutCity' | 'GovHill' | 'GrandPlaza';
}

type LocationId = 'sproutown' | 'sproutcity' | 'zhengzheng' | 'dasaiji';

interface MapLocation {
  id: LocationId;
  name: string;
  description: string;
  /** Position on the world map UI (percentage of container) */
  xPct: number;
  yPct: number;
  /** Whether this location is reachable */
  available: boolean;
  /** The Phaser scene key to switch to (if available) */
  sceneKey?: string;
  /** Sprite texture file (under /assets/sprites/) */
  sprite: string;
  /** Region polygon points (percentage coords, comma-separated "x,y x,y ...") */
  region: string;
  /** Type label for legend */
  type: string;
}

const LOCATIONS: MapLocation[] = [
  {
    id: 'sproutown',
    name: '萌芽镇',
    description: '新人入村的第一站。老村长高粱的家。',
    xPct: 28,
    yPct: 60,
    available: true,
    sceneKey: 'Main',
    sprite: 'npc-axiang.png',
    region: '11,52 26,38 38,55 30,72',
    type: '村庄',
  },
  {
    id: 'sproutcity',
    name: '共创之都',
    description: '九大工坊环绕中央喷泉广场。CUA 工作组的物理化身。',
    xPct: 53,
    yPct: 36,
    available: true,
    sceneKey: 'SproutCity',
    sprite: 'npc-merchant.png',
    region: '38,28 60,18 70,38 51,50',
    type: '城镇',
  },
  {
    id: 'zhengzheng',
    name: '议政高地',
    description: '远见塔 · 执政厅 · 明镜阁 —— 治理中心。',
    xPct: 80,
    yPct: 20,
    available: true,
    sceneKey: 'GovHill',
    sprite: 'npc-librarian.png',
    region: '69,5 92,4 95,30 75,32',
    type: '政厅',
  },
  {
    id: 'dasaiji',
    name: '大集会广场',
    description: '年度大会的舞台。平时空旷 · 活动时万人云集。',
    xPct: 50,
    yPct: 78,
    available: true,
    sceneKey: 'GrandPlaza',
    sprite: 'cat.png',
    region: '38,68 62,66 64,92 40,94',
    type: '广场',
  },
];

const ID_TO_SCENE: Record<LocationId, string> = {
  sproutown: 'Main',
  sproutcity: 'SproutCity',
  zhengzheng: 'GovHill',
  dasaiji: 'GrandPlaza',
};

export function WorldMap() {
  const [open, setOpen] = useState(false);
  const [currentScene, setCurrentScene] = useState<'Main' | 'SproutCity' | 'GovHill' | 'GrandPlaza'>('Main');
  const [hoveredId, setHoveredId] = useState<LocationId | null>(null);

  useEffect(() => {
    const onOpen = (data: WorldMapEvent) => {
      setCurrentScene(data.currentScene);
      setOpen((prev) => !prev);
    };
    EventBus.on('open-world-map', onOpen);

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
        background: 'rgba(40, 28, 16, 0.65)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(2px)',
        animation: 'wmFadeIn 0.25s ease-out',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      {/* Map panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(720px, 88vw)',
          height: 'min(480px, 64vh)',
          background: '#e8d8a8',
          border: '4px solid #5d3a1a',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* 4 corner studs */}
        <div style={cornerStudStyle('tl')} />
        <div style={cornerStudStyle('tr')} />
        <div style={cornerStudStyle('bl')} />
        <div style={cornerStudStyle('br')} />

        {/* Inner dashed border */}
        <div
          style={{
            position: 'absolute',
            inset: 12,
            border: '1px dashed #8b5a2b',
            pointerEvents: 'none',
          }}
        />

        {/* Title */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fdf0cfee',
            padding: '4px 18px',
            border: '2px solid #5d3a1a',
            color: '#5d3a1a',
            fontSize: 14,
            letterSpacing: '0.18em',
            fontWeight: 500,
            fontFamily: 'serif',
            zIndex: 5,
          }}
        >
          — CUA Base 地图 —
        </div>

        {/* Compass rose (top-left) */}
        <svg
          style={{
            position: 'absolute',
            top: 50,
            left: 30,
            width: 64,
            height: 64,
            pointerEvents: 'none',
          }}
          viewBox="-32 -32 64 64"
        >
          <circle r="28" fill="#fdf0cf" stroke="#5d3a1a" strokeWidth="1.5" />
          <circle r="22" fill="none" stroke="#8b5a2b" strokeWidth="0.5" strokeDasharray="2 2" />
          <polygon points="0,-22 4,0 0,22 -4,0" fill="#a32d2d" stroke="#5d3a1a" strokeWidth="0.5" />
          <polygon points="-22,0 0,4 22,0 0,-4" fill="#fdf0cf" stroke="#5d3a1a" strokeWidth="0.5" />
          <circle r="3" fill="#5d3a1a" />
          <text x="0" y="-25" textAnchor="middle" fontSize="10" fill="#a32d2d" fontFamily="serif" fontWeight="500">N</text>
          <text x="25" y="3" textAnchor="middle" fontSize="8" fill="#5d3a1a" fontFamily="serif">E</text>
          <text x="-25" y="3" textAnchor="middle" fontSize="8" fill="#5d3a1a" fontFamily="serif">W</text>
          <text x="0" y="30" textAnchor="middle" fontSize="8" fill="#5d3a1a" fontFamily="serif">S</text>
        </svg>

        {/* Region polygons + connecting lines */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {LOCATIONS.map((loc) => (
            <polygon
              key={`region-${loc.id}`}
              points={loc.region}
              fill="#d4a374"
              opacity={hoveredId === loc.id ? 0.22 : 0}
              style={{ transition: 'opacity 0.15s' }}
            />
          ))}
          {/* Connecting paths */}
          <line x1="28" y1="60" x2="53" y2="36" stroke="#a05a35" strokeWidth="0.4" strokeDasharray="1.2 0.8" />
          <line x1="53" y1="36" x2="80" y2="20" stroke="#a05a35" strokeWidth="0.4" strokeDasharray="1.2 0.8" />
          <line x1="53" y1="36" x2="50" y2="78" stroke="#a05a35" strokeWidth="0.4" strokeDasharray="1.2 0.8" />
        </svg>

        {/* POI markers */}
        {LOCATIONS.map((loc) => {
          const isCurrent = ID_TO_SCENE[loc.id] === currentScene;
          const isHovered = hoveredId === loc.id;
          return (
            <div
              key={loc.id}
              onMouseEnter={() => setHoveredId(loc.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleTravel(loc)}
              style={{
                position: 'absolute',
                left: `${loc.xPct}%`,
                top: `${loc.yPct}%`,
                transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.15)' : 'scale(1)'}`,
                cursor: loc.available ? 'pointer' : 'not-allowed',
                opacity: loc.available ? 1 : 0.5,
                userSelect: 'none',
                zIndex: isHovered ? 20 : 10,
                transition: 'transform 0.15s',
              }}
            >
              {/* Pulse ring (current location only) */}
              {isCurrent && (
                <div
                  style={{
                    position: 'absolute',
                    top: -6,
                    left: -6,
                    right: -6,
                    bottom: 'auto',
                    width: 'calc(100% + 12px)',
                    height: 'calc(100% + 12px)',
                    border: '2px solid #daa520',
                    pointerEvents: 'none',
                    animation: 'wmPulse 1.6s ease-out infinite',
                  }}
                />
              )}

              {/* Sprite icon (32x32 first frame from spritesheet) */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  background: isCurrent ? '#daa520' : '#fdf0cf',
                  border: '2px solid #5d3a1a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  imageRendering: 'pixelated',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    backgroundImage: `url(/assets/sprites/${loc.sprite})`,
                    backgroundPosition: '0 0',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'auto',
                    imageRendering: 'pixelated',
                  }}
                />
              </div>

              {/* Label */}
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: isCurrent ? '#a05a35' : '#3a2a1a',
                  fontSize: 12,
                  fontFamily: 'serif',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  textShadow: '0 1px 0 #fdf0cf, 0 -1px 0 #fdf0cf, 1px 0 #fdf0cf, -1px 0 #fdf0cf',
                }}
              >
                {loc.name}
                {isCurrent && (
                  <span style={{ marginLeft: 4, fontSize: 10 }}>(当前)</span>
                )}
              </div>

              {/* Tooltip (on hover) */}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 14px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#fdf0cf',
                    border: '2px solid #5d3a1a',
                    padding: '8px 12px',
                    width: 200,
                    fontSize: 11,
                    color: '#3a2a1a',
                    lineHeight: 1.5,
                    pointerEvents: 'none',
                    zIndex: 30,
                    boxShadow: '2px 2px 0 #5d3a1a',
                    fontFamily: 'serif',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: '#a05a35',
                      fontWeight: 500,
                      marginBottom: 4,
                    }}
                  >
                    {loc.name}
                  </div>
                  <div style={{ color: '#5d3a1a', marginBottom: 6 }}>
                    {loc.description}
                  </div>
                  <div
                    style={{
                      paddingTop: 4,
                      borderTop: '1px solid #c89a4a',
                      fontSize: 10,
                      color: '#8b5a2b',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>类型：{loc.type}</span>
                    <span>{isCurrent ? '★ 当前位置' : '点击传送'}</span>
                  </div>
                  {/* Tooltip tail */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid #5d3a1a',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Legend (bottom-right) */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            background: '#fdf0cfdd',
            border: '1px solid #8b5a2b',
            padding: '6px 10px',
            fontSize: 10,
            color: '#5d3a1a',
            fontFamily: 'serif',
            lineHeight: 1.6,
            pointerEvents: 'none',
          }}
        >
          {LOCATIONS.map((loc) => (
            <div
              key={`legend-${loc.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  background: '#fdf0cf',
                  border: '1px solid #5d3a1a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  imageRendering: 'pixelated',
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    backgroundImage: `url(/assets/sprites/${loc.sprite})`,
                    backgroundPosition: '0 0',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '32px 32px',
                    transform: 'scale(0.4375)',
                    transformOrigin: '0 0',
                    imageRendering: 'pixelated',
                  }}
                />
              </div>
              <span>{loc.type}</span>
            </div>
          ))}
        </div>

        {/* Bottom hint */}
        <div
          style={{
            position: 'absolute',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#8b5a2b',
            fontSize: 11,
            fontFamily: 'serif',
            letterSpacing: '0.05em',
            pointerEvents: 'none',
          }}
        >
          点击 POI 传送 · 鼠标悬停看详情 · M / Esc 关闭
        </div>
      </div>

      <style>{`
        @keyframes wmFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes wmPulse {
          0% { transform: scale(1); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function cornerStudStyle(corner: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 18,
    height: 18,
    background: '#fdf0cf',
    border: '2px solid #5d3a1a',
    borderRadius: '50%',
    pointerEvents: 'none',
  };
  switch (corner) {
    case 'tl': return { ...base, top: -4, left: -4 };
    case 'tr': return { ...base, top: -4, right: -4 };
    case 'bl': return { ...base, bottom: -4, left: -4 };
    case 'br': return { ...base, bottom: -4, right: -4 };
  }
}
