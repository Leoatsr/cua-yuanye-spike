import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface TitleScreenProps {
  onStart: () => void;
}

export function TitleScreen({ onStart }: TitleScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const { user, loading, authEnabled, signIn } = useAuth();

  const handleStart = () => {
    if (fadeOut) return;
    setFadeOut(true);
    setTimeout(onStart, 600);
  };

  // Any key to continue (no longer click — to avoid login button conflict)
  useEffect(() => {
    const onKey = () => handleStart();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
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
        CUA 基地
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
        v1.1 · 共创之都 · 审核闭环
      </p>

      {/* GitHub 登录区 (only if authEnabled) */}
      {authEnabled && !loading && (
        <div
          style={{
            marginTop: 48,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            animation: 'titleFadeIn 2.4s ease-out',
          }}
        >
          {user ? (
            <div
              style={{
                fontSize: 12,
                color: '#7fc090',
                letterSpacing: '0.1em',
              }}
            >
              ✓ 已以 {user.displayName} 登录
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                signIn();
              }}
              style={{
                padding: '10px 20px',
                fontSize: 13,
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#f5f0e0',
                border: '1px solid rgba(245, 240, 224, 0.3)',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(245, 240, 224, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(245, 240, 224, 0.3)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-1.97c-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.97 10.97 0 015.74 0c2.18-1.48 3.14-1.17 3.14-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
              </svg>
              用 GitHub 登录
            </button>
          )}
          <div
            style={{
              fontSize: 10,
              color: '#5a5650',
              letterSpacing: '0.05em',
              textAlign: 'center',
              maxWidth: 280,
              lineHeight: 1.6,
            }}
          >
            {user
              ? '登录信息会用于未来的多人 / 跨设备同步'
              : '登录是可选的——不登录也能完整玩'}
          </div>
        </div>
      )}

      {/* 进入提示（呼吸动画） */}
      <div
        onClick={handleStart}
        style={{
          marginTop: authEnabled ? 40 : 80,
          fontSize: 'clamp(13px, 1.4vw, 17px)',
          color: '#f5f0e0',
          letterSpacing: '0.2em',
          animation: 'breathe 2.4s ease-in-out infinite',
          cursor: 'pointer',
          padding: '8px 24px',
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
