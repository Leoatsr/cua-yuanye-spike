import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chip } from '../ui';
import { LOCATIONS, type MapLocation } from '../lib/mapsData';

/**
 * 世界地图 · 像素古籍风
 *
 * Wave 4.A
 *
 * 范围：
 *   ✅ 大地图 SVG 像素风（4 location 标注）
 *   ✅ 右下 minimap（缩略全景 + 高亮当前 hover）
 *   ✅ 左侧详情面板（点 location 显示）
 *   ✅ "进入" 按钮 → navigate(`/play?scene=${sceneKey}`)
 *   ✅ 顶栏跟 Manual / Codex 风格统一
 *   ⏳ Wave 4.B 实现 query string 解析 + 自动切 scene
 */

export function MapsPage() {
  const [selected, setSelected] = useState<MapLocation | null>(LOCATIONS[0]);
  const [hovered, setHovered] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    document.title = '世界地图 · CUA 基地';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const handleEnter = (loc: MapLocation) => {
    if (!loc.available) return;
    navigate(`/play?scene=${loc.sceneKey}`);
  };

  return (
    <div
      className="bg-paper"
      style={{
        minHeight: '100vh',
        background: 'var(--paper-0)',
        fontFamily: 'var(--f-sans)',
        color: 'var(--ink)',
      }}
    >
      {/* 顶栏 */}
      <header
        style={{
          padding: '14px 32px',
          background: 'var(--paper-1)',
          borderBottom: '3px solid var(--wood-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            to="/"
            style={{
              fontSize: 13,
              color: 'var(--wood-3)',
              textDecoration: 'none',
              padding: '4px 8px',
              border: '1px solid var(--wood-3)',
              fontFamily: 'var(--f-pixel)',
            }}
          >
            ← 返回首页
          </Link>
          <div className="t-eyebrow" style={{ fontSize: 10 }}>
            MAPS · v3.0
          </div>
        </div>

        <h1
          className="t-display"
          style={{
            fontSize: 22,
            margin: 0,
            color: 'var(--wood-3)',
            textShadow: '2px 2px 0 var(--paper-3)',
          }}
        >
          世界地图
        </h1>

        <nav style={{ display: 'flex', gap: 4 }}>
          <Link
            to="/manual"
            style={{
              fontSize: 13,
              color: 'var(--ink-faint)',
              textDecoration: 'none',
              padding: '4px 12px',
              fontFamily: 'var(--f-pixel)',
            }}
          >
            手册
          </Link>
          <Link
            to="/codex"
            style={{
              fontSize: 13,
              color: 'var(--ink-faint)',
              textDecoration: 'none',
              padding: '4px 12px',
              fontFamily: 'var(--f-pixel)',
            }}
          >
            图鉴
          </Link>
          <Link
            to="/play"
            style={{
              fontSize: 13,
              color: 'var(--wood-4)',
              textDecoration: 'none',
              padding: '4px 12px',
              background: 'var(--gold)',
              fontFamily: 'var(--f-pixel)',
              fontWeight: 600,
            }}
          >
            进入游戏 ▶
          </Link>
        </nav>
      </header>

      {/* Body · 双栏（地图 + 详情） */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '24px 32px',
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* 左：大地图 */}
        <div
          style={{
            background: 'var(--paper-1)',
            border: '4px solid var(--wood-3)',
            boxShadow: '6px 6px 0 var(--wood-4)',
            padding: 12,
            position: 'relative',
          }}
        >
          <div
            className="t-eyebrow"
            style={{
              fontSize: 10,
              padding: '0 4px 8px',
              borderBottom: '1px dashed var(--wood-2)',
              marginBottom: 12,
            }}
          >
            CUA · 全境地图
          </div>
          <BigMap
            selected={selected}
            hovered={hovered}
            onSelect={setSelected}
            onHover={setHovered}
            onEnter={handleEnter}
          />
        </div>

        {/* 右：详情 + minimap */}
        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            position: 'sticky',
            top: 24,
          }}
        >
          {/* 详情面板 */}
          {selected && <DetailsPanel location={selected} onEnter={handleEnter} />}

          {/* Minimap */}
          <div
            style={{
              background: 'var(--paper-1)',
              border: '3px solid var(--wood-3)',
              boxShadow: '3px 3px 0 var(--wood-4)',
              padding: 10,
            }}
          >
            <div
              className="t-eyebrow"
              style={{ fontSize: 9, marginBottom: 6 }}
            >
              MINIMAP
            </div>
            <MiniMap
              selected={selected}
              hovered={hovered}
              onSelect={setSelected}
            />
          </div>

          {/* 图例 */}
          <div
            style={{
              background: 'var(--paper-1)',
              border: '2px solid var(--wood-3)',
              padding: '10px 12px',
              fontSize: 11,
              lineHeight: 1.7,
              color: 'var(--ink-faint)',
            }}
          >
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>
              图例
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--gold)', fontSize: 14 }}>●</span>
              <span>已开放 · 可进入</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ color: 'var(--ink-faint)', fontSize: 14 }}>○</span>
              <span>敬请期待</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer
        style={{
          marginTop: 40,
          padding: '16px 32px',
          background: 'var(--paper-1)',
          borderTop: '2px solid var(--wood-3)',
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--ink-faint)',
        }}
      >
        CUA 基地 · WebAgentLab Pixel MMO · 世界地图
      </footer>
    </div>
  );
}

export default MapsPage;

// ============================================================
// 大地图 · SVG 像素风
// ============================================================

function BigMap({
  selected,
  hovered,
  onSelect,
  onHover,
  onEnter,
}: {
  selected: MapLocation | null;
  hovered: string | null;
  onSelect: (loc: MapLocation) => void;
  onHover: (id: string | null) => void;
  onEnter: (loc: MapLocation) => void;
}) {
  return (
    <div style={{ position: 'relative', aspectRatio: '16 / 10', width: '100%' }}>
      <svg
        viewBox="0 0 1600 1000"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          imageRendering: 'pixelated',
        }}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="var(--paper-3)"
              strokeWidth="0.5"
              opacity="0.4"
            />
          </pattern>

          <linearGradient id="land-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8dba8" />
            <stop offset="100%" stopColor="#d4c490" />
          </linearGradient>

          <linearGradient id="water-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a8c4d8" />
            <stop offset="100%" stopColor="#7ba2bc" />
          </linearGradient>
        </defs>

        {/* 背景：水域 */}
        <rect width="1600" height="1000" fill="url(#water-grad)" />

        {/* 主大陆 · 像素化锯齿边缘 */}
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
          fill="url(#land-grad)"
          stroke="var(--wood-3)"
          strokeWidth="3"
        />

        {/* 网格 */}
        <rect width="1600" height="1000" fill="url(#grid)" />

        {/* 装饰：小山 */}
        <DecorMountain x={1200} y={180} />
        <DecorMountain x={1280} y={250} />
        <DecorMountain x={1240} y={140} />

        {/* 装饰：小树 */}
        <DecorTree x={400} y={400} />
        <DecorTree x={460} y={420} />
        <DecorTree x={380} y={460} />
        <DecorTree x={1100} y={500} />
        <DecorTree x={1150} y={530} />
        <DecorTree x={760} y={620} />
        <DecorTree x={820} y={650} />

        {/* 装饰：路径连线（虚线） */}
        <path
          d="M 448 600 Q 700 480, 928 350 Q 1100 270, 1280 200"
          fill="none"
          stroke="var(--wood-3)"
          strokeWidth="2"
          strokeDasharray="6 4"
          opacity="0.5"
        />
        <path
          d="M 928 350 Q 850 500, 800 780"
          fill="none"
          stroke="var(--wood-3)"
          strokeWidth="2"
          strokeDasharray="6 4"
          opacity="0.5"
        />

        {/* Location markers */}
        {LOCATIONS.map((loc) => (
          <LocationMarker
            key={loc.id}
            loc={loc}
            isSelected={selected?.id === loc.id}
            isHovered={hovered === loc.id}
            onSelect={() => onSelect(loc)}
            onHover={() => onHover(loc.id)}
            onLeave={() => onHover(null)}
            onDblClick={() => onEnter(loc)}
          />
        ))}

        {/* 标题水印 */}
        <text
          x="800"
          y="60"
          textAnchor="middle"
          fontFamily="var(--f-pixel)"
          fontSize="36"
          fill="var(--wood-3)"
          opacity="0.4"
          style={{ letterSpacing: '0.3em' }}
        >
          CUA 基地 · 全境
        </text>
      </svg>

      {/* 操作提示 */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          fontSize: 10,
          color: 'var(--ink-faint)',
          background: 'var(--paper-2)',
          border: '1px solid var(--wood-3)',
          padding: '4px 8px',
        }}
        className="mono"
      >
        点击选中 · 双击进入
      </div>
    </div>
  );
}

// ============================================================
// 装饰元素
// ============================================================

function DecorMountain({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <polygon
        points="-30,40 0,-20 30,40"
        fill="var(--wood-2)"
        opacity="0.5"
      />
      <polygon
        points="-15,30 0,-10 15,30"
        fill="var(--wood-3)"
        opacity="0.7"
      />
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

// ============================================================
// Location Marker（大地图上）
// ============================================================

function LocationMarker({
  loc,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onLeave,
  onDblClick,
}: {
  loc: MapLocation;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
  onDblClick: () => void;
}) {
  const x = (loc.xPct / 100) * 1600;
  const y = (loc.yPct / 100) * 1000;
  const ringColor = loc.available ? 'var(--gold)' : 'var(--ink-faint)';
  const fillColor = loc.available ? 'var(--paper-0)' : 'var(--paper-3)';

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: loc.available ? 'pointer' : 'help' }}
      onClick={onSelect}
      onDoubleClick={onDblClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* 高亮圈（hover/selected）*/}
      {(isSelected || isHovered) && (
        <circle
          r="48"
          fill="none"
          stroke={ringColor}
          strokeWidth="3"
          opacity={isSelected ? 0.9 : 0.5}
          style={{
            animation: isHovered ? 'mapPulse 1.5s ease-in-out infinite' : 'none',
          }}
        />
      )}

      {/* 阴影 */}
      <ellipse cx="3" cy="32" rx="20" ry="4" fill="rgba(0,0,0,0.3)" />

      {/* 主标记圆 */}
      <circle
        r="28"
        fill={fillColor}
        stroke={ringColor}
        strokeWidth="4"
      />

      {/* 内圈（小圆）*/}
      <circle r="20" fill={loc.available ? 'var(--paper-1)' : 'var(--paper-2)'} />

      {/* 图标 */}
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="22"
        y="2"
      >
        {loc.icon}
      </text>

      {/* 标签 */}
      <g transform="translate(0, 50)">
        <rect
          x="-50"
          y="-10"
          width="100"
          height="22"
          fill="var(--paper-0)"
          stroke="var(--wood-3)"
          strokeWidth="2"
        />
        <text
          textAnchor="middle"
          y="6"
          fontFamily="var(--f-pixel)"
          fontSize="14"
          fill="var(--wood-3)"
          fontWeight="600"
        >
          {loc.name}
        </text>
      </g>

      {/* 等级 chip */}
      <g transform="translate(38, -22)">
        <rect
          x="-2"
          y="-8"
          width="36"
          height="16"
          fill={loc.available ? 'var(--gold)' : 'var(--paper-3)'}
          stroke="var(--wood-4)"
          strokeWidth="1.5"
        />
        <text
          x="16"
          y="3"
          textAnchor="middle"
          fontFamily="var(--f-num)"
          fontSize="9"
          fill="var(--wood-4)"
          fontWeight="700"
        >
          {loc.level}
        </text>
      </g>
    </g>
  );
}

// ============================================================
// Minimap · 缩略全景
// ============================================================

function MiniMap({
  selected,
  hovered,
  onSelect,
}: {
  selected: MapLocation | null;
  hovered: string | null;
  onSelect: (loc: MapLocation) => void;
}) {
  return (
    <div style={{ position: 'relative', aspectRatio: '16 / 10', width: '100%' }}>
      <svg
        viewBox="0 0 1600 1000"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {/* 背景：水域 */}
        <rect width="1600" height="1000" fill="#9bb8cb" />

        {/* 主大陆（简化版）*/}
        <path
          d="M 200 200 L 320 160 L 600 120 L 960 120 L 1280 180 L 1380 360
             L 1380 480 L 1280 720 L 1200 840 L 720 900 L 320 780 L 180 460 Z"
          fill="#d4c490"
          stroke="var(--wood-3)"
          strokeWidth="6"
        />

        {/* Location 小点 */}
        {LOCATIONS.map((loc) => {
          const isSel = selected?.id === loc.id;
          const isHov = hovered === loc.id;
          const x = (loc.xPct / 100) * 1600;
          const y = (loc.yPct / 100) * 1000;
          return (
            <g
              key={loc.id}
              transform={`translate(${x}, ${y})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelect(loc)}
            >
              {(isSel || isHov) && (
                <circle
                  r="80"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="6"
                  opacity={isSel ? 0.8 : 0.4}
                />
              )}
              <circle
                r={isSel ? 50 : 32}
                fill={loc.available ? 'var(--gold)' : 'var(--ink-faint)'}
                stroke="var(--wood-4)"
                strokeWidth="6"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================
// 详情面板
// ============================================================

function DetailsPanel({
  location,
  onEnter,
}: {
  location: MapLocation;
  onEnter: (loc: MapLocation) => void;
}) {
  return (
    <div
      style={{
        background: 'var(--paper-1)',
        border: '3px solid var(--wood-3)',
        boxShadow: '4px 4px 0 var(--wood-4)',
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
          paddingBottom: 10,
          borderBottom: '1px dashed var(--wood-2)',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            background: 'var(--paper-0)',
            border: '3px solid var(--wood-4)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 26,
            flexShrink: 0,
          }}
        >
          {location.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="t-title"
            style={{
              fontSize: 16,
              color: 'var(--wood-3)',
              marginBottom: 2,
            }}
          >
            {location.name}
          </div>
          <Chip tone={location.tone}>{location.region}</Chip>
        </div>
      </div>

      <div
        className="t-soft"
        style={{
          fontSize: 12,
          lineHeight: 1.8,
          marginBottom: 12,
          color: 'var(--ink)',
        }}
      >
        {location.longDesc}
      </div>

      <div
        className="t-eyebrow"
        style={{ fontSize: 9, marginBottom: 6 }}
      >
        重要设施 / NPC
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
        {location.highlights.map((h) => (
          <Chip key={h}>{h}</Chip>
        ))}
      </div>

      {location.available ? (
        <button
          onClick={() => onEnter(location)}
          style={{
            width: '100%',
            padding: '10px',
            background: 'var(--gold)',
            border: '3px solid var(--wood-4)',
            boxShadow: '3px 3px 0 var(--wood-4)',
            fontFamily: 'var(--f-pixel)',
            fontSize: 14,
            color: 'var(--wood-4)',
            cursor: 'pointer',
            fontWeight: 600,
            letterSpacing: '0.1em',
          }}
        >
          进入 {location.name} ▶
        </button>
      ) : (
        <div
          style={{
            padding: 10,
            background: 'rgba(166, 70, 52, 0.08)',
            borderLeft: '3px solid var(--ink-faint)',
            fontSize: 11,
            lineHeight: 1.7,
            color: 'var(--ink-faint)',
            fontStyle: 'italic',
          }}
        >
          此区域暂未开放 · 敬请期待
        </div>
      )}
    </div>
  );
}

// CSS 注入（一次性）
let stylesInjected = false;
if (typeof document !== 'undefined' && !stylesInjected) {
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
@keyframes mapPulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.08); }
}
`;
  document.head.appendChild(style);
}
