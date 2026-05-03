interface ReviewProgressBarProps {
  current: number; // 0-3
  total: number; // 通常 3
}

/**
 * 审核进度条 · 弹性曲线 + shine 光带
 *
 * Wave 2.5.A.4
 * 替代纯文字 N/3
 */
export function ReviewProgressBar({ current, total }: ReviewProgressBarProps) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          width: '100%',
          height: 12,
          border: '2px solid var(--wood-4)',
          background: 'var(--paper-0)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background:
              'linear-gradient(90deg, var(--gold) 0%, #f0c75e 100%)',
            transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            position: 'relative',
          }}
        >
          {/* Shine 光带（loop） */}
          {pct > 0 && pct < 100 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: 12,
                background:
                  'linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)',
                opacity: 0.4,
                animation: 'progressShine 2s ease-in-out infinite',
              }}
            />
          )}
        </div>
      </div>
      <div
        className="mono t-faint"
        style={{
          fontSize: 9,
          marginTop: 2,
          textAlign: 'right',
          letterSpacing: '0.1em',
        }}
      >
        {current}/{total} 票
      </div>
    </div>
  );
}

// CSS 注入（一次性）
let stylesInjected = false;
if (typeof document !== 'undefined' && !stylesInjected) {
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
@keyframes progressShine {
  0% { transform: translateX(0); opacity: 0; }
  50% { opacity: 0.6; }
  100% { transform: translateX(0); opacity: 0; }
}
`;
  document.head.appendChild(style);
}
