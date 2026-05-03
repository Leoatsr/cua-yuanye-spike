import { PixelPanel } from '../index';

interface Landmark {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  label?: string;
}

interface MinimapProps {
  sceneName?: string;
  /** 世界宽度 px (与玩家 x 同坐标系) · 用于自动计算 % */
  worldWidth?: number;
  worldHeight?: number;
  /** 玩家世界坐标 px (Wave 7.K · 真实 player.x/y) */
  player?: { x: number; y: number };
  /** Landmarks 接受**世界 px 坐标** · 自动转 % (Wave 7.K 升级) */
  landmarks?: Landmark[];
  /** 路径 y 是世界 px (Wave 7.K 升级) */
  road?: { y: number; color?: string };
}

/**
 * Wave 7.K · 真实化小地图
 * 接收来自 Phaser scene 的真实坐标 (世界 px) · 自动转换为 minimap %。
 *
 * 旧版兼容：如果 worldWidth 没传 · 会假设 landmarks/player 已经是 % (向后兼容旧 prop)。
 *
 * 用法：
 *   const [data, setData] = useState<MinimapPayload | null>(null);
 *   useEffect(() => {
 *     EventBus.on('minimap-update', setData);
 *     return () => EventBus.off('minimap-update', setData);
 *   }, []);
 *   <Minimap {...data} />
 */
export function Minimap({
  sceneName = '...',
  worldWidth,
  worldHeight,
  player,
  landmarks = [],
  road,
}: MinimapProps) {
  // 自动转 %：如果传了 worldWidth · 视坐标为世界 px
  const toPctX = (x: number) => worldWidth ? (x / worldWidth) * 100 : x;
  const toPctY = (y: number) => worldHeight ? (y / worldHeight) * 100 : y;
  const toPctW = (w: number) => worldWidth ? (w / worldWidth) * 100 : w;
  const toPctH = (h: number) => worldHeight ? (h / worldHeight) * 100 : h;

  const playerPctX = player ? toPctX(player.x) : 50;
  const playerPctY = player ? toPctY(player.y) : 50;

  return (
    <PixelPanel className="pp-tight" style={{ padding: 8, width: 160 }}>
      <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>
        {sceneName}
      </div>
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          background: '#8fbc5c',
          border: '2px solid var(--wood-4)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 路径 */}
        {road && (
          <div
            style={{
              position: 'absolute',
              top: `${toPctY(road.y)}%`,
              left: '5%',
              right: '5%',
              height: 2,
              background: road.color || '#a89070',
            }}
          />
        )}
        {/* 地标 */}
        {landmarks.map((m, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${toPctY(m.y)}%`,
              left: `${toPctX(m.x)}%`,
              width: `${toPctW(m.w)}%`,
              height: `${toPctH(m.h)}%`,
              background: m.color,
              fontSize: 7,
              color: 'rgba(255,255,255,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'monospace',
              lineHeight: 1,
              textAlign: 'center',
              overflow: 'hidden',
            }}
          >
            {m.label || ''}
          </div>
        ))}
        {/* 玩家位置 (跟随移动) */}
        <div
          style={{
            position: 'absolute',
            top: `${playerPctY}%`,
            left: `${playerPctX}%`,
            transform: 'translate(-50%, -50%)',
            width: 6,
            height: 6,
            background: 'var(--danger, #c0392b)',
            border: '1px solid var(--paper-0, #fff)',
            boxShadow: '0 0 0 2px rgba(0,0,0,0.3)',
            borderRadius: 1,
            zIndex: 10,
          }}
        />
      </div>
    </PixelPanel>
  );
}
