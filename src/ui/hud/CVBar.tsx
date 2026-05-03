import { PixelPanel } from '../index';

interface CVBarProps {
  current: number;
  threshold: number;
  nextLevelLabel?: string;  // e.g. "L2"
}

/**
 * CV 进度条 — 显示当前 CV / 升级所需 + 进度条
 *
 * 用法：
 *   <CVBar current={1247} threshold={1500} nextLevelLabel="L2" />
 */
export function CVBar({ current, threshold, nextLevelLabel = 'L?' }: CVBarProps) {
  const pct = Math.min(100, Math.max(0, (current / threshold) * 100));
  const remaining = Math.max(0, threshold - current);

  return (
    <PixelPanel className="pp-tight" style={{ padding: '10px 14px', minWidth: 220 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          gap: 8,
          whiteSpace: 'nowrap',
        }}
      >
        <span className="t-eyebrow" style={{ fontSize: 10 }}>
          CV 贡献价值
        </span>
        <span
          className="t-num"
          style={{ fontSize: 14, color: 'var(--wood-3)' }}
        >
          {current} / {threshold}
        </span>
      </div>
      <div
        style={{
          height: 10,
          background: 'var(--paper-3)',
          border: '2px solid var(--wood-4)',
          marginTop: 4,
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--gold), #f0c14a)',
          }}
        />
      </div>
      <div className="t-faint" style={{ fontSize: 10, marginTop: 4 }}>
        距 {nextLevelLabel} · 还差 {remaining} CV
      </div>
    </PixelPanel>
  );
}
