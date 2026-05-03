import { PixelPanel, Sprite } from '../index';

interface AvatarPanelProps {
  name: string;
  level: string;        // e.g. "L1 · 活跃贡献者"
  spriteScale?: number;
}

/**
 * 左上 — 玩家头像 + 名字 + 等级
 *
 * Wave 7.K · 加 minWidth: 220 跟右侧 CVBar 一致
 *
 * 用法：
 *   <AvatarPanel name="Gaoliang" level="L1 · 活跃贡献者" />
 */
export function AvatarPanel({ name, level, spriteScale = 2 }: AvatarPanelProps) {
  return (
    <PixelPanel
      className="pp-tight"
      style={{
        padding: 10,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        minWidth: 220,
      }}
    >
      <div
        style={{
          background: 'var(--paper-3)',
          border: '2px solid var(--wood-4)',
          padding: 2,
        }}
      >
        <Sprite name="char" scale={spriteScale} />
      </div>
      <div>
        <div className="t-title" style={{ fontSize: 14, lineHeight: 1.1 }}>
          {name}
        </div>
        <div className="t-eyebrow" style={{ fontSize: 9 }}>
          {level}
        </div>
      </div>
    </PixelPanel>
  );
}
