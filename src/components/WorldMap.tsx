import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';

interface WorldMapEvent {
  currentScene: 'Main' | 'SproutCity' | 'GovHill' | 'GrandPlaza';
}

type LocationId = 'sproutown' | 'sproutcity' | 'zhengzheng' | 'dasaiji';
type SceneKey = 'Main' | 'SproutCity' | 'GovHill' | 'GrandPlaza';

interface MapLocation {
  id: LocationId;
  name: string;
  xPct: number;
  yPct: number;
  sceneKey: SceneKey;
}

const LOCATIONS: MapLocation[] = [
  { id: 'sproutown',  name: '萌芽镇',     xPct: 28, yPct: 60, sceneKey: 'Main' },
  { id: 'sproutcity', name: '共创之都',   xPct: 58, yPct: 35, sceneKey: 'SproutCity' },
  { id: 'zhengzheng', name: '议政高地',   xPct: 80, yPct: 20, sceneKey: 'GovHill' },
  { id: 'dasaiji',    name: '大集会广场', xPct: 50, yPct: 78, sceneKey: 'GrandPlaza' },
];

export function WorldMap() {
  const [open, setOpen] = useState(false);
  const [currentScene, setCurrentScene] = useState<SceneKey>('Main');
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (data: WorldMapEvent) => {
      setCurrentScene(data.currentScene);
      setOpen(true);
    };
    EventBus.on('open-world-map', onOpen);
    return () => {
      EventBus.off('open-world-map', onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const handleClick = (loc: MapLocation) => {
    if (loc.sceneKey === currentScene) {
      setOpen(false);
      return;
    }
    EventBus.emit('worldmap-travel', { sceneKey: loc.sceneKey });
    setOpen(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(20, 14, 8, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 10',
          width: '100%',
          maxWidth: 1100,
          maxHeight: '88vh',
          opacity: 0.92,
        }}
      >
        <svg
          viewBox="0 0 1600 1000"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <pattern id="wm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--paper-3)" strokeWidth="0.5" opacity="0.4" />
            </pattern>
            <linearGradient id="wm-land" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e8dba8" />
              <stop offset="100%" stopColor="#d4c490" />
            </linearGradient>
            <linearGradient id="wm-water" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a8c4d8" />
              <stop offset="100%" stopColor="#7ba2bc" />
            </linearGradient>
          </defs>

          <rect width="1600" height="1000" fill="url(#wm-water)" opacity="0.85" />

          <path
            d="M 200 200 L 240 200 L 240 180 L 280 180 L 280 200 L 320 200
               L 320 160 L 400 160 L 400 140 L 480 140 L 480 160 L 600 160
               L 600 120 L 720 120 L 720 100 L 840 100 L 840 120 L 960 120
               L 960 140 L 1080 140 L 1080 160 L 1200 160 L 1200 180 L 1280 180
               L 1280 220 L 1320 220 L 1320 280 L 1360 280 L 1360 360 L 1380 360
               L 1380 480 L 1360 480 L 1360 560 L 1320 560 L 1320 640 L 1280 640
               L 1280 720 L 1240 720 L 1240 780 L 1200 780 L 1200 840 L 1080 840
               L 1080 880 L 920 880 L 920 900 L 720 900 L 720 880 L 600 880
               L 600 860 L 480 860 L 480 820 L 400 820 L 400 780 L 320 780
               L 320 720 L 280 720 L 280 640 L 240 640 L 240 540 L 200 540
               L 200 460 L 180 460 L 180 360 L 200 360 Z"
            fill="url(#wm-land)"
            stroke="var(--wood-3)"
            strokeWidth="3"
          />

          <rect width="1600" height="1000" fill="url(#wm-grid)" />

          <DecorMountain x={1200} y={180} />
          <DecorMountain x={1280} y={250} />
          <DecorMountain x={1240} y={140} />

          <DecorTree x={400} y={400} />
          <DecorTree x={460} y={420} />
          <DecorTree x={380} y={460} />
          <DecorTree x={1100} y={500} />
          <DecorTree x={1150} y={530} />
          <DecorTree x={760} y={620} />
          <DecorTree x={820} y={650} />

          <path d="M 448 600 Q 700 480, 928 350 Q 1100 270, 1280 200" fill="none" stroke="var(--wood-3)" strokeWidth="2" strokeDasharray="6 4" opacity="0.5" />
          <path d="M 928 350 Q 850 500, 800 780" fill="none" stroke="var(--wood-3)" strokeWidth="2" strokeDasharray="6 4" opacity="0.5" />

          {LOCATIONS.map((loc) => (
            <LocationMarker
              key={loc.id}
              loc={loc}
              isHovered={hovered === loc.id}
              isCurrent={loc.sceneKey === currentScene}
              onClick={() => handleClick(loc)}
              onHover={() => setHovered(loc.id)}
              onLeave={() => setHovered(null)}
            />
          ))}

          <text x="800" y="60" textAnchor="middle" fontFamily="var(--f-pixel)" fontSize="36" fill="var(--wood-3)" opacity="0.4" style={{ letterSpacing: '0.3em' }}>
            CUA 基地 · 全境
          </text>
        </svg>

        {/* 提示 */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            fontSize: 11,
            color: 'var(--wood-4)',
            background: 'rgba(253, 240, 207, 0.9)',
            border: '1px solid var(--wood-3)',
            padding: '4px 10px',
            fontFamily: 'var(--f-pixel)',
          }}
        >
          点击传送 · M / ESC 关闭
        </div>
      </div>
    </div>
  );
}

function DecorMountain({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <polygon points="-30,40 0,-20 30,40" fill="var(--wood-2)" opacity="0.5" />
      <polygon points="-15,30 0,-10 15,30" fill="var(--wood-3)" opacity="0.7" />
    </g>
  );
}

function DecorTree({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-3" y="0" width="6" height="14" fill="var(--wood-3)" />
      <circle cx="0" cy="-4" r="14" fill="#7fc090" opacity="0.7" />
      <circle cx="-6" cy="-2" r="8" fill="#6dab7e" opacity="0.6" />
      <circle cx="6" cy="-2" r="8" fill="#6dab7e" opacity="0.6" />
    </g>
  );
}

function LocationMarker({
  loc,
  isHovered,
  isCurrent,
  onClick,
  onHover,
  onLeave,
}: {
  loc: MapLocation;
  isHovered: boolean;
  isCurrent: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  const cx = (loc.xPct / 100) * 1600;
  const cy = (loc.yPct / 100) * 1000;
  const fill = '#daa520';

  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <circle r="50" fill="transparent" />

      {(isHovered || isCurrent) && (
        <circle r="40" fill="none" stroke={isCurrent ? '#daa520' : 'var(--wood-3)'} strokeWidth="3" strokeDasharray="4 2" opacity="0.7" />
      )}

      <circle r="28" fill="var(--paper-1)" stroke={fill} strokeWidth="3" />
      <circle r="14" fill={fill} />

      {isCurrent && (
        <g transform="translate(28, -28)">
          <rect x="-14" y="-8" width="28" height="14" fill="#daa520" stroke="var(--wood-3)" strokeWidth="1" />
          <text textAnchor="middle" y="3" fontSize="9" fontFamily="var(--f-pixel)" fill="white">当前</text>
        </g>
      )}

      <g transform="translate(0, 56)">
        <rect x="-50" y="-12" width="100" height="22" fill="var(--paper-1)" stroke="var(--wood-3)" strokeWidth="1.5" />
        <text textAnchor="middle" y="3" fontFamily="var(--f-sans)" fontSize="13" fontWeight="600" fill="var(--wood-3)">
          {loc.name}
        </text>
      </g>
    </g>
  );
}