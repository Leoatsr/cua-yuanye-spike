import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { PixelButton, Chip, Sprite, Banner } from '../ui';

interface TitleScreenProps {
  onStart: () => void;
}

/**
 * TitleScreen — 启动页 · Wave 9 重构
 *
 * Wave 9.titlescreen · 风格对齐 Claude Design 落地页
 *   米黄羊皮纸 + 暖木褐 + 像素字 + Banner / PixelButton / Chip / Sprite
 *
 * Wave 9.titlebutton · 修登录按钮不可见 bug
 *   原版用 {authEnabled && !loading && (...)} 包整块 · 任一为 falsy 就整块隐藏。
 *   现版总是渲染登录区 · 状态由 user 决定 (null = 按钮 / 否 = Chip)。
 *   即使 supabase 不可用 · 按钮也会显示 (signIn 调用会自然失败)。
 */
export function TitleScreen({ onStart }: TitleScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const { user, signIn } = useAuth();

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
      className="bg-paper"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--paper-0)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.6s ease-out',
        padding: '40px 24px',
        overflow: 'hidden',
      }}
    >
      {/* Phase banner —— 跟官网 Hero 同款 */}
      <div style={{ marginBottom: 28, animation: 'tsFadeIn 1.0s ease-out' }}>
        <Banner tone="gold">PHASE 3 · 多人在场 · 已开放</Banner>
      </div>

      {/* 主标题 —— t-display 大宋体 + 5px 阴影 (跟官网 fontSize 64 一致) */}
      <h1
        className="t-display t-display-wrap"
        style={{
          fontSize: 'clamp(56px, 9vw, 96px)',
          margin: 0,
          lineHeight: 1.05,
          textShadow: '5px 5px 0 var(--paper-3)',
          animation: 'tsFadeIn 1.3s ease-out',
          textAlign: 'center',
        }}
      >
        CUA 基地
      </h1>

      {/* 副标题 —— t-eyebrow 像素字大间距 */}
      <div
        className="t-eyebrow"
        style={{
          fontSize: 'clamp(11px, 1.2vw, 14px)',
          marginTop: 16,
          letterSpacing: '0.4em',
          animation: 'tsFadeIn 1.6s ease-out',
        }}
      >
        降噪 · 链接 · 共创
      </div>

      {/* 装饰条 —— 4px 暖木褐 */}
      <div
        style={{
          width: 'clamp(80px, 12vw, 160px)',
          height: 4,
          background: 'var(--wood-3)',
          margin: '28px 0 24px',
          animation: 'tsLineFadeIn 1.8s ease-out',
        }}
      />

      {/* 项目副标题 —— t-body t-soft */}
      <p
        className="t-body t-soft"
        style={{
          fontSize: 'clamp(13px, 1.4vw, 17px)',
          margin: 0,
          textAlign: 'center',
          maxWidth: 520,
          lineHeight: 1.7,
          animation: 'tsFadeIn 2.0s ease-out',
        }}
      >
        一个为 CUA 开源社区做的像素 MMO 雏形
      </p>

      {/* 版本号 —— t-eyebrow 小像素字 */}
      <div
        className="t-eyebrow"
        style={{
          fontSize: 10,
          marginTop: 10,
          opacity: 0.7,
          animation: 'tsFadeIn 2.2s ease-out',
        }}
      >
        v1.1 · 共创之都 · 审核闭环
      </div>

      {/* GitHub 登录区 —— Wave 9.titlebutton 总是渲染 · 不依赖 authEnabled/loading */}
      <div
        style={{
          marginTop: 36,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          animation: 'tsFadeIn 2.4s ease-out',
        }}
      >
        {user ? (
          <Chip tone="spring">
            ✓ 已以 {user.displayName} 登录
          </Chip>
        ) : (
          <PixelButton
            variant="pb-primary"
            size="pb-lg"
            onClick={(e?: React.MouseEvent) => {
              e?.stopPropagation();
              signIn();
            }}
          >
            <Sprite name="leaf" scale={3} />
            &nbsp;&nbsp;GitHub 登录进入
          </PixelButton>
        )}
        <div
          className="t-eyebrow"
          style={{
            fontSize: 9,
            textAlign: 'center',
            maxWidth: 300,
            lineHeight: 1.8,
            opacity: 0.65,
          }}
        >
          {user
            ? '登录信息会用于未来的多人 / 跨设备同步'
            : '登录是可选的 — 不登录也能完整玩'}
        </div>
      </div>

      {/* 按任意键提示 —— 暖木褐呼吸 */}
      <div
        onClick={handleStart}
        className="t-eyebrow"
        style={{
          marginTop: 36,
          fontSize: 'clamp(11px, 1.3vw, 14px)',
          color: 'var(--wood-3)',
          letterSpacing: '0.3em',
          animation: 'tsBreathe 2.4s ease-in-out infinite',
          cursor: 'pointer',
          padding: '10px 28px',
        }}
      >
        按任意键进入 · PRESS ANY KEY TO START
      </div>

      {/* 角落版本签名 */}
      <div
        className="t-eyebrow"
        style={{
          position: 'absolute',
          bottom: 20,
          right: 28,
          fontSize: 9,
          opacity: 0.45,
        }}
      >
        Built by the CUA Community · 2026
      </div>

      <style>{`
        @keyframes tsFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tsLineFadeIn {
          from { opacity: 0; width: 0; }
          to { opacity: 1; }
        }
        @keyframes tsBreathe {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
