import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import { LEVEL_COLORS } from '../lib/levelStore';

/**
 * F5.0 · Level-up animation.
 * Triggered by EventBus 'level-up' { from, to, newName }.
 *
 * Style: classical Chinese — paper scroll unfurling, brush calligraphy
 * writing the new rank name. Triumphant but restrained — fits CUA's
 * scholarly aesthetic.
 */

interface LevelUpData {
  from: number;
  to: number;
  newName: string;
}

export function LevelUpAnimation() {
  const [data, setData] = useState<LevelUpData | null>(null);
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit' | null>(null);

  useEffect(() => {
    const onUp = (d: LevelUpData) => {
      setData(d);
      setPhase('enter');
      // 0.6s scroll unfurl → 3.5s show → 0.6s fade out
      window.setTimeout(() => setPhase('show'), 600);
      window.setTimeout(() => setPhase('exit'), 600 + 3500);
      window.setTimeout(() => {
        setPhase(null);
        setData(null);
      }, 600 + 3500 + 600);
    };
    EventBus.on('level-up', onUp);
    return () => {
      EventBus.off('level-up', onUp);
    };
  }, []);

  if (!data || !phase) return null;

  const newColor = LEVEL_COLORS[data.to] ?? '#fbbf24';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: phase === 'enter' || phase === 'exit'
          ? 'rgba(0, 0, 0, 0.5)'
          : 'rgba(0, 0, 0, 0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.4s ease',
        pointerEvents: phase === 'show' ? 'auto' : 'none',
        fontFamily:
          '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "STSong", "SimSun", serif',
      }}
    >
      {/* Paper scroll */}
      <div style={{
        position: 'relative',
        width: phase === 'enter' ? 400 : 480,
        height: phase === 'enter' ? 60 : 360,
        transition: 'all 0.6s cubic-bezier(0.5, 0, 0.2, 1)',
        opacity: phase === 'exit' ? 0 : 1,
      }}>
        {/* Top scroll rod */}
        <div style={{
          position: 'absolute',
          top: 0, left: -20, right: -20, height: 16,
          background: 'linear-gradient(180deg, #b8a472 0%, #6b5230 100%)',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }} />

        {/* Bottom scroll rod */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: -20, right: -20, height: 16,
          background: 'linear-gradient(180deg, #6b5230 0%, #b8a472 100%)',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }} />

        {/* Paper body */}
        <div style={{
          position: 'absolute',
          top: 16, bottom: 16, left: 0, right: 0,
          background: `linear-gradient(180deg,
            #f8efd9 0%, #ede5cf 50%, #f8efd9 100%)`,
          borderLeft: '1px solid rgba(184, 137, 58, 0.3)',
          borderRight: '1px solid rgba(184, 137, 58, 0.3)',
          boxShadow: 'inset 0 0 40px rgba(184, 137, 58, 0.15)',
          padding: '40px 60px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {/* Subtle paper texture overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `repeating-linear-gradient(
              90deg,
              rgba(184, 137, 58, 0.03) 0px,
              rgba(184, 137, 58, 0.03) 1px,
              transparent 1px,
              transparent 32px
            )`,
            pointerEvents: 'none',
          }} />

          {phase !== 'enter' && (
            <>
              {/* Top decorative seal */}
              <div style={{
                fontSize: 12, letterSpacing: '0.4em',
                color: '#8a4a18', fontWeight: 600,
                marginBottom: 8,
                opacity: phase === 'show' ? 1 : 0,
                transition: 'opacity 0.4s ease 0.2s',
              }}>
                ✦ 晋 阶 ✦
              </div>

              {/* From → To */}
              <div style={{
                fontSize: 13, color: '#9a8d6c',
                fontFamily: 'monospace',
                marginBottom: 18,
                opacity: phase === 'show' ? 1 : 0,
                transition: 'opacity 0.4s ease 0.4s',
              }}>
                L{data.from} ── 升 ── L{data.to}
              </div>

              {/* Big new rank name (brush style) */}
              <div style={{
                fontFamily: '"STKaiti", "Kaiti SC", "AR PL UKai CN", serif',
                fontSize: 52,
                fontWeight: 600,
                color: newColor,
                letterSpacing: '0.15em',
                textShadow: `
                  0 2px 4px rgba(0,0,0,0.15),
                  0 0 24px ${newColor}40
                `,
                marginBottom: 12,
                opacity: phase === 'show' ? 1 : 0,
                transform: phase === 'show' ? 'scale(1)' : 'scale(0.85)',
                transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s',
                position: 'relative',
                zIndex: 1,
              }}>
                {data.newName}
              </div>

              {/* Underline brush stroke */}
              <div style={{
                width: phase === 'show' ? '60%' : 0,
                height: 3,
                background: `linear-gradient(90deg, transparent 0%, ${newColor} 30%, ${newColor} 70%, transparent 100%)`,
                marginBottom: 18,
                transition: 'width 0.5s cubic-bezier(0.5, 0, 0.2, 1) 0.9s',
                borderRadius: 2,
              }} />

              {/* Subtitle */}
              <div style={{
                fontSize: 13, color: '#6b5230',
                lineHeight: 1.8,
                textAlign: 'center',
                fontStyle: 'italic',
                opacity: phase === 'show' ? 1 : 0,
                transition: 'opacity 0.4s ease 1.2s',
              }}>
                {getSubtitle(data.to)}
              </div>

              {/* Red seal stamp */}
              <div style={{
                position: 'absolute',
                bottom: 28, right: 50,
                width: 44, height: 44,
                background: '#a02828',
                color: '#ffe0a0',
                fontFamily: 'serif',
                fontSize: 16, fontWeight: 700,
                letterSpacing: '0.1em',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                lineHeight: 1.1,
                border: '2px solid #6b1a1a',
                borderRadius: 4,
                transform: phase === 'show'
                  ? 'rotate(-8deg) scale(1)'
                  : 'rotate(-8deg) scale(0)',
                transition: 'transform 0.5s cubic-bezier(0.5, 1.4, 0.3, 1) 1.6s',
                opacity: 0.92,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}>
                <span style={{ fontSize: 11 }}>授</span>
                <span style={{ fontSize: 11 }}>印</span>
              </div>
            </>
          )}
        </div>

        {/* Top fold shadow */}
        <div style={{
          position: 'absolute',
          top: 16, left: -10, right: -10, height: 4,
          background: 'rgba(0,0,0,0.15)',
          filter: 'blur(2px)',
        }} />
      </div>

      {/* Floating particles (gold sparkles around scroll) */}
      {phase === 'show' && (
        <div style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
        }}>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${30 + Math.sin(i * 1.3) * 25}%`,
                left: `${30 + Math.cos(i * 1.7) * 30}%`,
                width: 4, height: 4,
                background: newColor,
                borderRadius: '50%',
                boxShadow: `0 0 8px ${newColor}`,
                animation: `levelUpSparkle 2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes levelUpSparkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0.5) translateY(0);
          }
          50% {
            opacity: 1;
            transform: scale(1.2) translateY(-12px);
          }
        }
      `}</style>
    </div>
  );
}

function getSubtitle(level: number): string {
  switch (level) {
    case 1: return '"始入其门 · 见其堂奥"';
    case 2: return '"传道授业 · 提携后学"';
    case 3: return '"独当一面 · 担纲一方"';
    case 4: return '"群伦所托 · 共主社事"';
    default: return '';
  }
}
