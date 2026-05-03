import { useEffect, useState } from 'react';

interface QuorumToastProps {
  questTitle: string;
  finalCoeff: number;
  cpEarned: number;
  /** 触发时间戳 · 用于关键 useEffect dep */
  triggerKey: number;
  onComplete: () => void;
}

const TOAST_DURATION_MS = 2500;
const PARTICLE_COUNT = 12;

interface Particle {
  id: number;
  angle: number;
  distance: number;
  duration: number;
  color: 'gold' | 'gold-bright';
}

/**
 * 审核完成 quorum toast · 全屏（在 NewQuestLog 内 540×600）
 *
 * Wave 2.5.A.4
 *
 * 范围：
 *   ✅ 全屏金色卡片旋转弹出（cubic-bezier 弹性）
 *   ✅ 12 烟花粒子径向飞散 + 旋转
 *   ✅ 2.5s 自动消失（onComplete 回调）
 */
export function QuorumToast({
  questTitle,
  finalCoeff,
  cpEarned,
  triggerKey,
  onComplete,
}: QuorumToastProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // 生成粒子
    const ps: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      angle: (i / PARTICLE_COUNT) * Math.PI * 2,
      distance: 80 + Math.random() * 40,
      duration: 0.8 + Math.random() * 0.6,
      color: i % 2 ? 'gold-bright' : 'gold',
    }));
    setParticles(ps);

    const timer = setTimeout(() => {
      setParticles([]);
      onComplete();
    }, TOAST_DURATION_MS);

    return () => clearTimeout(timer);
  }, [triggerKey, onComplete]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--f-sans)',
      }}
    >
      {/* 主 toast 卡片 */}
      <div
        style={{
          background:
            'linear-gradient(135deg, var(--gold) 0%, #f0c75e 100%)',
          border: '4px solid var(--wood-4)',
          padding: '16px 22px',
          textAlign: 'center',
          boxShadow:
            '0 0 0 4px var(--paper-0), 6px 6px 0 var(--wood-4), 0 0 60px 12px var(--gold)',
          animation: 'quorumPop 2.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          opacity: 0,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--f-pixel)',
            fontSize: 11,
            color: 'var(--wood-4)',
            letterSpacing: '0.25em',
            marginBottom: 4,
          }}
        >
          ★ 审 核 完 成 ★
        </div>
        <div
          className="t-title"
          style={{
            fontSize: 14,
            color: 'var(--wood-4)',
            marginBottom: 8,
            opacity: 0.9,
          }}
        >
          {questTitle}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 32,
            color: 'var(--wood-4)',
            fontWeight: 800,
            margin: '4px 0',
          }}
        >
          x{finalCoeff.toFixed(1)}
        </div>
        <div
          style={{
            fontFamily: 'var(--f-pixel)',
            fontSize: 13,
            color: 'var(--wood-4)',
            letterSpacing: '0.1em',
          }}
        >
          +{cpEarned} CV 入账
        </div>
      </div>

      {/* 烟花粒子 */}
      {particles.map((p) => {
        const dx = Math.cos(p.angle) * p.distance;
        const dy = Math.sin(p.angle) * p.distance;
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 6,
              height: 6,
              background:
                p.color === 'gold-bright' ? '#f0c75e' : 'var(--gold)',
              border: '1px solid var(--wood-4)',
              animation: `particleFly ${p.duration}s ease-out forwards`,
              ['--dx' as never]: `${dx}px`,
              ['--dy' as never]: `${dy}px`,
              zIndex: 49,
            }}
          />
        );
      })}
    </div>
  );
}

// CSS 注入（一次性）
let stylesInjected = false;
if (typeof document !== 'undefined' && !stylesInjected) {
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
@keyframes quorumPop {
  0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
  20%  { transform: scale(1.1) rotate(2deg); opacity: 1; }
  30%  { transform: scale(1) rotate(0); }
  80%  { transform: scale(1) rotate(0); opacity: 1; }
  100% { transform: scale(0.95) rotate(0); opacity: 0; }
}

@keyframes particleFly {
  0%   { transform: translate(0, 0) rotate(0); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) rotate(360deg); opacity: 0; }
}
`;
  document.head.appendChild(style);
}
