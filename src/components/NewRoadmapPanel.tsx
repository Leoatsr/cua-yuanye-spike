import { useEffect } from 'react';
import {
  STAGES,
  STATUS_LABELS,
  STATUS_TONES,
  type RoadmapStage,
} from '../lib/roadmapData';
import { useOpenViaEventBus } from '../hooks/useOpenViaEventBus';
import { Chip, Divider } from '../ui';

const PANEL_WIDTH = 600;
const PANEL_HEIGHT = 620;

/**
 * NewRoadmapPanel · 像素风远见塔路线图
 *
 * Wave 2.5.C
 *
 * 触发: EventBus 'open-roadmap' (远见塔 [E])
 *
 * 5 阶段路线: 萌芽镇 / 共创之都 / 议政高地 / 真任务源 / 多人在场
 * 数据从 lib/roadmapData.ts 抽出
 */
export function NewRoadmapPanel() {
  const [open, setOpen] = useOpenViaEventBus('roadmap', 'open-roadmap');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const doneCount = STAGES.filter((s) => s.status === 'done').length;
  const progressCount = STAGES.filter((s) => s.status === 'progress').length;
  const todoCount = STAGES.filter((s) => s.status === 'todo').length;

  return (
    <div
      className="bg-paper"
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: PANEL_WIDTH,
        maxWidth: 'calc(100vw - 24px)',
        height: PANEL_HEIGHT,
        maxHeight: 'calc(100vh - 120px)',
        background: 'var(--paper-0)',
        border: '4px solid var(--wood-3)',
        boxShadow: '0 0 0 4px var(--wood-4), 8px 8px 0 rgba(0,0,0,0.2)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--f-sans)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '3px solid var(--wood-3)',
          background: 'var(--paper-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🗺</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="t-title" style={{ fontSize: 17 }}>
              远见塔 · 五阶路线图
            </span>
            <span
              className="t-faint"
              style={{ fontSize: 10, marginTop: 2 }}
            >
              从萌芽镇起 · 到议政高地止
            </span>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: 'var(--wood-3)',
            padding: 4,
            lineHeight: 1,
          }}
          title="关闭 (Esc)"
        >
          ✕
        </button>
      </div>

      {/* 总览统计 */}
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--paper-2)',
          borderBottom: '2px solid var(--wood-2)',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Chip tone="spring">已完成 {doneCount}</Chip>
        <Chip tone="gold">进行中 {progressCount}</Chip>
        <Chip>待开始 {todoCount}</Chip>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 14,
          background: 'var(--paper-0)',
        }}
      >
        {STAGES.map((stage, idx) => (
          <div key={stage.id}>
            <StageCard stage={stage} index={idx} />
            {idx < STAGES.length - 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  margin: '4px 0',
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    color: 'var(--wood-3)',
                    userSelect: 'none',
                  }}
                >
                  ↓
                </span>
              </div>
            )}
          </div>
        ))}

        <Divider sm />

        <div
          className="t-soft"
          style={{
            fontSize: 11,
            lineHeight: 1.7,
            textAlign: 'center',
            color: 'var(--ink-faint)',
            padding: '8px 12px',
            fontStyle: 'italic',
          }}
        >
          "五个阶段，按真实进展更新。"
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 单个阶段卡
// ============================================================

function StageCard({ stage }: { stage: RoadmapStage; index: number }) {
  const tone = STATUS_TONES[stage.status];
  const isDone = stage.status === 'done';
  const isInProgress = stage.status === 'progress';

  return (
    <div
      style={{
        background: 'var(--paper-1)',
        border: `2px solid ${
          isDone
            ? '#6da37b'
            : isInProgress
            ? 'var(--gold)'
            : 'var(--wood-2)'
        }`,
        boxShadow: '2px 2px 0 var(--wood-4)',
        marginBottom: 4,
        opacity: stage.status === 'todo' ? 0.85 : 1,
      }}
    >
      {/* Stage header */}
      <div
        style={{
          padding: '10px 12px',
          background: isDone
            ? 'rgba(127, 192, 144, 0.1)'
            : isInProgress
            ? 'rgba(218, 165, 32, 0.08)'
            : 'transparent',
          borderBottom: '1px solid var(--wood-2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
            gap: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              minWidth: 0,
            }}
          >
            <span
              className="t-eyebrow mono"
              style={{
                fontSize: 9,
                color: 'var(--wood-3)',
                flexShrink: 0,
              }}
            >
              {stage.phaseLabel}
            </span>
            <span
              className="t-title"
              style={{ fontSize: 15 }}
            >
              {stage.name}
            </span>
          </div>
          <Chip tone={tone}>{STATUS_LABELS[stage.status]}</Chip>
        </div>
        <p
          className="t-soft"
          style={{
            fontSize: 11,
            lineHeight: 1.6,
            margin: 0,
            color: 'var(--ink-faint)',
          }}
        >
          {stage.description}
        </p>

        {/* Progress bar */}
        {(stage.status === 'progress' || stage.status === 'done') && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                width: '100%',
                height: 8,
                border: '1px solid var(--wood-4)',
                background: 'var(--paper-0)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${stage.progress}%`,
                  height: '100%',
                  background: isDone ? '#6da37b' : 'var(--gold)',
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <div
              className="mono t-faint"
              style={{
                fontSize: 10,
                marginTop: 3,
                textAlign: 'right',
              }}
            >
              {stage.progress}%
            </div>
          </div>
        )}
      </div>

      {/* Highlights 列表 */}
      <div style={{ padding: '8px 12px' }}>
        {stage.highlights.map((h, i) => (
          <div
            key={i}
            className="t-soft"
            style={{
              fontSize: 11,
              lineHeight: 1.7,
              padding: '2px 0',
            }}
          >
            {h}
          </div>
        ))}
      </div>
    </div>
  );
}

export default NewRoadmapPanel;
