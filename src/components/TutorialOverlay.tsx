import { useEffect, useState, useSyncExternalStore } from 'react';
import { tutorialManager } from '../lib/tutorialStore';
import type { HighlightTarget } from '../lib/tutorialSteps';

/**
 * 教程 Overlay
 *
 * - 顶部进度条（X / Y 完成）
 * - 中下方 toast（当前 step 提示）
 * - 高亮发光圈（指向 announcement / help / emote 按钮）
 */

export function TutorialOverlay() {
  // 订阅 tutorial state
  const tick = useSyncExternalStore(
    (l) => tutorialManager.subscribe(l),
    () => `${tutorialManager.isActive()}-${tutorialManager.getCurrentStep()?.id ?? 'none'}-${tutorialManager.getCompletedCount()}`,
    () => `init`
  );

  // 当 tick 变 = state 变了
  void tick;

  const active = tutorialManager.isActive();
  const step = tutorialManager.getCurrentStep();
  const progress = tutorialManager.getProgress();

  if (!active || !step) return null;

  return (
    <>
      <ProgressBar progress={progress} />
      <HighlightRing target={step.highlight} />
      <StepToast
        step={step}
        onAdvance={() => tutorialManager.manualAdvance()}
        onSkip={() => tutorialManager.skip()}
        onPause={() => tutorialManager.pause()}
      />
    </>
  );
}

// ============================================================================
// 顶部进度条
// ============================================================================
function ProgressBar({
  progress,
}: {
  progress: { completed: number; total: number; percent: number };
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(20, 24, 30, 0.92)',
        border: '1px solid rgba(167, 139, 250, 0.4)',
        borderRadius: 4,
        padding: '6px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        zIndex: 80,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
        fontSize: 11,
        color: '#a8a08e',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 200,
      }}
    >
      <span style={{ color: '#a78bfa', letterSpacing: '0.1em', fontWeight: 600 }}>
        🎓 教程
      </span>
      <span style={{ color: '#6e6856' }}>·</span>
      <span style={{ fontFamily: 'monospace' }}>
        <strong style={{ color: '#a78bfa' }}>{progress.completed}</strong> /{' '}
        {progress.total}
      </span>
      <div
        style={{
          flex: 1,
          height: 4,
          background: 'rgba(167, 139, 250, 0.1)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress.percent}%`,
            background: 'linear-gradient(90deg, #a78bfa, #f4a8c0)',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
      <span style={{ color: '#6e6856', fontFamily: 'monospace', fontSize: 10 }}>
        {progress.percent}%
      </span>
    </div>
  );
}

// ============================================================================
// 高亮发光圈
// ============================================================================
function HighlightRing({ target }: { target: HighlightTarget }) {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (target === 'none') {
      setCoords(null);
      return;
    }

    const updateCoords = () => {
      // 各按钮位置直接 hardcode（与 AnnouncementButton / HelpButton / EmotePanel 对齐）
      if (target === 'announcement-button') {
        setCoords({ x: 16 + 22, y: window.innerHeight - 16 - 22 });
      } else if (target === 'help-button') {
        setCoords({ x: window.innerWidth - 70 - 22, y: window.innerHeight - 16 - 22 });
      } else if (target === 'emote-button') {
        setCoords({ x: window.innerWidth - 16 - 22, y: window.innerHeight - 16 - 22 });
      } else if (target === 'top-hud') {
        setCoords({ x: window.innerWidth / 2, y: 30 });
      } else if (target === 'chat-button') {
        // 聊天 toggle 按钮位置（顶部中央偏右，与 HUD 一致）
        setCoords({ x: window.innerWidth / 2 + 100, y: 30 });
      }
    };
    updateCoords();
    window.addEventListener('resize', updateCoords);
    return () => window.removeEventListener('resize', updateCoords);
  }, [target]);

  if (!coords) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          left: coords.x - 30,
          top: coords.y - 30,
          width: 60,
          height: 60,
          borderRadius: '50%',
          border: '2px solid rgba(247, 200, 80, 0.85)',
          boxShadow: '0 0 20px rgba(247, 200, 80, 0.6), inset 0 0 12px rgba(247, 200, 80, 0.3)',
          pointerEvents: 'none',
          zIndex: 60,
          animation: 'tutorial-pulse 1.5s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes tutorial-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.7;
          }
        }
      `}</style>
    </>
  );
}

// ============================================================================
// Step Toast（中下方）
// ============================================================================
function StepToast({
  step,
  onAdvance,
  onSkip,
  onPause,
}: {
  step: { id: number; chapter: number; chapterName: string; title: string; hint: string; completion: string };
  onAdvance: () => void;
  onSkip: () => void;
  onPause: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(440px, 90vw)',
        background: 'linear-gradient(180deg, rgba(31, 34, 48, 0.96), rgba(21, 23, 31, 0.96))',
        border: '1px solid rgba(167, 139, 250, 0.5)',
        borderLeft: '3px solid #a78bfa',
        borderRadius: 6,
        padding: '14px 16px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 16px rgba(167, 139, 250, 0.25)',
        color: '#f5f0e0',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
        zIndex: 70,
        animation: 'tutorial-toast-in 0.3s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: '#8a8576',
            letterSpacing: '0.15em',
          }}
        >
          第 {step.chapter} 章 · {step.chapterName}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onPause}
            title="暂停教程（不会跳过，可重启）"
            style={{
              padding: '2px 8px',
              fontSize: 10,
              background: 'transparent',
              border: '1px solid rgba(168, 179, 160, 0.25)',
              borderRadius: 3,
              color: '#a8a08e',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            暂停
          </button>
          <button
            onClick={() => {
              if (confirm('确定跳过整个教程？后续可在帮助里重启')) {
                onSkip();
              }
            }}
            title="跳过教程"
            style={{
              padding: '2px 8px',
              fontSize: 10,
              background: 'transparent',
              border: '1px solid rgba(168, 179, 160, 0.25)',
              borderRadius: 3,
              color: '#a8a08e',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            跳过
          </button>
        </div>
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#f5f0e0',
          marginBottom: 4,
        }}
      >
        {step.title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: '#a8a08e',
          lineHeight: 1.6,
          marginBottom: step.completion === 'manual' ? 10 : 0,
        }}
      >
        {step.hint}
      </div>

      {step.completion === 'manual' && (
        <button
          onClick={onAdvance}
          style={{
            marginTop: 8,
            padding: '5px 14px',
            fontSize: 12,
            background: 'rgba(167, 139, 250, 0.18)',
            color: '#a78bfa',
            border: '1px solid rgba(167, 139, 250, 0.5)',
            borderRadius: 3,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}
        >
          ✓ 我已完成
        </button>
      )}

      <style>{`
        @keyframes tutorial-toast-in {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
