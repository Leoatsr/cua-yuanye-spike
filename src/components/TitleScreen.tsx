import { useEffect, useState } from 'react';

interface TitleScreenProps {
  onStart: () => void;
}

export function TitleScreen({ onStart }: TitleScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  const handleStart = () => {
    if (fadeOut) return;
    setFadeOut(true);
    // Wait for fade animation to complete before unmounting
    setTimeout(onStart, 600);
  };

  // Any key or click to continue
  useEffect(() => {
    const onKey = () => handleStart();
    const onClick = () => handleStart();
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fadeOut]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background:
          'radial-gradient(ellipse at center, #2a3a2c 0%, #1a1f1c 70%, #0a0d0b 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.6s ease-out',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        color: '#f5f0e0',
      }}
    >
      {/* 主标题 */}
      <h1
        style={{
          fontSize: 'clamp(48px, 8vw, 96px)',
          margin: 0,
          letterSpacing: '0.15em',
          fontWeight: 300,
          textShadow: '0 0 30px rgba(255, 220, 130, 0.3)',
          animation: 'titleFadeIn 1.4s ease-out',
        }}
      >
        源野物语
      </h1>

      {/* 英文副标 */}
      <div
        style={{
          fontSize: 'clamp(14px, 1.6vw, 20px)',
          color: '#a8b3a0',
          marginTop: 12,
          letterSpacing: '0.3em',
          fontWeight: 300,
          animation: 'titleFadeIn 1.6s ease-out',
        }}
      >
        SOURCE · VALLEY
      </div>

      {/* 装饰线 */}
      <div
        style={{
          width: 'clamp(80px, 12vw, 160px)',
          height: 1,
          background: 'rgba(245, 240, 224, 0.3)',
          margin: '32px 0',
          animation: 'lineFadeIn 1.8s ease-out',
        }}
      />

      {/* 项目副标 */}
      <p
        style={{
          fontSize: 'clamp(13px, 1.4vw, 16px)',
          color: '#c8b890',
          margin: 0,
          letterSpacing: '0.1em',
          animation: 'titleFadeIn 2s ease-out',
        }}
      >
        一个为 CUA 开源社区做的像素 MMO 雏形
      </p>

      <p
        style={{
          fontSize: 'clamp(11px, 1.2vw, 14px)',
          color: '#8a8576',
          margin: '8px 0 0 0',
          letterSpacing: '0.05em',
          animation: 'titleFadeIn 2.2s ease-out',
        }}
      >
        v0.1 · Spike Demo · 萌芽镇 · 探索时长约 5 分钟
      </p>

      {/* 进入提示（呼吸动画） */}
      <div
        style={{
          marginTop: 80,
          fontSize: 'clamp(13px, 1.4vw, 17px)',
          color: '#f5f0e0',
          letterSpacing: '0.2em',
          animation: 'breathe 2.4s ease-in-out infinite',
        }}
      >
        按任意键进入 · Press any key to start
      </div>

      {/* 角落版本信息 */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          right: 32,
          fontSize: 11,
          color: '#5a5650',
          letterSpacing: '0.05em',
        }}
      >
        Built by the CUA Community · 2026
      </div>

      <style>{`
        @keyframes titleFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lineFadeIn {
          from { opacity: 0; width: 0; }
          to { opacity: 1; }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
