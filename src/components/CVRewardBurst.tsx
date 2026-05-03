import { useEffect, useState } from 'react';
import { Chip } from '../ui';

interface CVRewardBurstProps {
  /** 入账金额 */
  cpEarned: number;
  /** 完成时间戳 · 用于判断是否在动画窗口内 */
  finalizedAt: number;
  /** 是否卓越（x2.0）· 影响动画夸张程度 */
  isExcellent?: boolean;
  /** 最终系数 · 用于退化时显示 */
  finalCoeff?: number;
}

const ANIMATION_DURATION_MS = 2400;
const FLOAT_COUNT_NORMAL = 3;
const FLOAT_COUNT_EXCELLENT = 5;

/**
 * CV 入账金光动画 · 完整版（Q4）
 *
 * Wave 2.5.A.3 修复版：
 *   ✅ active 状态：金光环 + 数字滚动 + 浮动 +N + 背景闪光
 *   ✅ done 状态：退化成简单 chip 行（跟旧版静态一致）
 *
 * 触发: 用 finalizedAt 判断是否在 ANIMATION_DURATION_MS 内
 */
export function CVRewardBurst({
  cpEarned,
  finalizedAt,
  isExcellent = false,
  finalCoeff,
}: CVRewardBurstProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'active' | 'done'>(
    'idle',
  );
  const [floatingNumbers, setFloatingNumbers] = useState<
    Array<{ id: number; delay: number; left: string }>
  >([]);

  useEffect(() => {
    const elapsed = Date.now() - finalizedAt;
    if (elapsed > ANIMATION_DURATION_MS) {
      // 错过动画窗口 · 退化为静态 chip
      setDisplayValue(cpEarned);
      setAnimationPhase('done');
      return;
    }

    setAnimationPhase('active');
    setDisplayValue(0);

    // 1. 数字滚动 0 → cpEarned (800ms · ease-out cubic)
    const start = performance.now();
    const duration = 800;
    let rafId: number;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(Math.round(cpEarned * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(cpEarned);
      }
    };
    rafId = requestAnimationFrame(tick);

    // 2. 浮动 +N CV
    const count = isExcellent ? FLOAT_COUNT_EXCELLENT : FLOAT_COUNT_NORMAL;
    const floats = Array.from({ length: count }, (_, i) => ({
      id: i,
      delay: i * 180,
      left: 30 + Math.random() * 40 + '%',
    }));
    setFloatingNumbers(floats);

    // 3. 动画结束
    const doneTimer = setTimeout(() => {
      setAnimationPhase('done');
      setFloatingNumbers([]);
    }, ANIMATION_DURATION_MS);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(doneTimer);
    };
  }, [cpEarned, finalizedAt, isExcellent]);

  // ============================================================
  // done 状态：退化成简单 chip（跟之前 NewQuestLog 静态版一致）
  // ============================================================
  if (animationPhase === 'done') {
    const date = finalizedAt
      ? new Date(finalizedAt).toLocaleDateString('zh-CN')
      : '';
    return (
      <div
        className="t-soft"
        style={{
          fontSize: 11,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Chip tone="gold">+{cpEarned} CV</Chip>
        {finalCoeff !== undefined && (
          <span>最终系数 x{finalCoeff}</span>
        )}
        {date && <span className="t-faint">· {date}</span>}
      </div>
    );
  }

  // ============================================================
  // active 状态：完整动画
  // ============================================================
  return (
    <div
      style={{
        position: 'relative',
        padding: '14px 12px',
        background: 'var(--paper-1)',
        border: '2px solid var(--gold)',
        boxShadow: '2px 2px 0 var(--wood-4), 0 0 30px var(--gold)',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {/* 背景径向闪光 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at center, var(--gold) 0%, transparent 60%)',
          opacity: 0,
          animation: 'cvFlashBg 0.6s ease-out',
          pointerEvents: 'none',
        }}
      />

      {/* 金光环扩散 */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 80,
          height: 80,
          marginLeft: -40,
          marginTop: -40,
          border: '4px solid var(--gold)',
          borderRadius: '50%',
          opacity: 0,
          animation: 'cvRingExpand 1.5s ease-out',
          pointerEvents: 'none',
        }}
      />

      {/* 浮动 +N CV */}
      {floatingNumbers.map((f) => (
        <div
          key={f.id}
          style={{
            position: 'absolute',
            left: f.left,
            top: '60%',
            fontFamily: 'var(--f-num)',
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--gold)',
            textShadow: '1px 1px 0 var(--wood-4), 0 0 8px var(--gold)',
            pointerEvents: 'none',
            opacity: 0,
            animation: `cvFloatUp 1.6s ease-out forwards`,
            animationDelay: `${f.delay}ms`,
            transform: 'translateX(-50%)',
            zIndex: 5,
          }}
        >
          +{Math.round(cpEarned / floatingNumbers.length)}
        </div>
      ))}

      {/* 主显示 · 数字 + label */}
      <div style={{ position: 'relative', zIndex: 3 }}>
        <div
          className="t-eyebrow"
          style={{
            fontSize: 9,
            color: 'var(--wood-3)',
            letterSpacing: '0.2em',
            marginBottom: 4,
          }}
        >
          ★ CV 入 账 ★
        </div>
        <div
          className="mono"
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: 'var(--gold)',
            textShadow: '2px 2px 0 var(--wood-4), 0 0 18px var(--gold)',
            lineHeight: 1.2,
          }}
        >
          +{displayValue}
        </div>
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
@keyframes cvFlashBg {
  0%   { opacity: 0; }
  30%  { opacity: 0.6; }
  100% { opacity: 0; }
}

@keyframes cvRingExpand {
  0%   { transform: scale(0.5); opacity: 0.8; border-width: 6px; }
  100% { transform: scale(4); opacity: 0; border-width: 1px; }
}

@keyframes cvFloatUp {
  0%   { opacity: 0; transform: translateX(-50%) translateY(0) scale(0.5); }
  20%  { opacity: 1; transform: translateX(-50%) translateY(-20px) scale(1.2); }
  80%  { opacity: 1; transform: translateX(-50%) translateY(-80px) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-110px) scale(0.8); }
}
`;
  document.head.appendChild(style);
}
