import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import {
  fetchUserLevel,
  broadcastLevelInfo,
  LEVEL_COLORS,
  type LevelInfo,
} from '../lib/levelStore';

/**
 * F5.0 · Level badge in top-right corner.
 * Shows: L? + name + progress to next level.
 * Hover/click → show progress tooltip.
 */
export function LevelBadge() {
  const [info, setInfo] = useState<LevelInfo | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    let pollHandle: number | null = null;

    const load = async () => {
      const data = await fetchUserLevel();
      if (mounted) setInfo(data);
    };

    // Initial load
    load();

    // Listen for level-updated events
    const onUpdate = (data: LevelInfo | null) => setInfo(data);
    EventBus.on('level-updated', onUpdate);

    // Poll every 60s — keeps badge fresh
    pollHandle = window.setInterval(() => {
      void broadcastLevelInfo();
    }, 60_000);

    return () => {
      mounted = false;
      EventBus.off('level-updated', onUpdate);
      if (pollHandle !== null) window.clearInterval(pollHandle);
    };
  }, []);

  if (!info) return null;

  const color = LEVEL_COLORS[info.level] ?? '#9ca3af';
  const nextCv = info.next_cv_required;
  const nextTasks = info.next_tasks_required;
  const nextProposals = info.next_proposals_required;

  // Progress percentages (toward next level)
  const cvProgress = nextCv ? Math.min(100, (info.total_cv / nextCv) * 100) : 0;
  const taskProgress = nextTasks ? Math.min(100, (info.task_count / nextTasks) * 100) : 0;

  return (
    <>
      <div
        onClick={() => setTooltipOpen((v) => !v)}
        style={{
          position: 'fixed', top: 16, right: 16, zIndex: 50,
          padding: '6px 12px',
          background: `linear-gradient(135deg, ${color}33 0%, ${color}1a 100%)`,
          border: `1px solid ${color}cc`,
          borderRadius: 4,
          cursor: 'pointer',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif',
          color: '#f5f0e0',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, fontWeight: 500,
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          userSelect: 'none',
        }}
      >
        <span style={{
          fontFamily: 'monospace', fontSize: 11,
          color, fontWeight: 700, letterSpacing: '0.05em',
        }}>
          L{info.level}
        </span>
        <span style={{ color: '#f5f0e0' }}>{info.level_name}</span>
      </div>

      {tooltipOpen && (
        <div
          onClick={() => setTooltipOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 56, right: 16,
              minWidth: 280, maxWidth: 340,
              padding: '16px 18px',
              background: 'linear-gradient(180deg, #1f2230 0%, #15171f 100%)',
              border: `1.5px solid ${color}99`,
              borderRadius: 6,
              color: '#f5f0e0', fontSize: 12,
              fontFamily: 'inherit',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              animation: 'levelTooltipFadeIn 0.2s ease-out',
            }}
          >
            <div style={{
              fontSize: 11, letterSpacing: '0.18em',
              color, textTransform: 'uppercase', marginBottom: 6,
            }}>
              当前等级
            </div>
            <div style={{
              fontFamily: 'serif', fontSize: 18, fontWeight: 600,
              color: '#f5f0e0', marginBottom: 14,
            }}>
              <span style={{ color, fontFamily: 'monospace', marginRight: 8 }}>
                L{info.level}
              </span>
              {info.level_name}
            </div>

            {/* Stats */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8, marginBottom: 14,
            }}>
              <Stat label="CV" value={info.total_cv} />
              <Stat label="任务" value={info.task_count} />
              <Stat label="提案" value={info.proposal_count} />
            </div>

            {/* Next level progress */}
            {info.next_level !== null ? (
              <>
                <div style={{
                  fontSize: 11, color: '#a8a08e',
                  borderTop: '1px solid rgba(168, 179, 160, 0.15)',
                  paddingTop: 12, marginBottom: 8,
                  letterSpacing: '0.1em',
                }}>
                  晋升 L{info.next_level} {info.next_level_name} 还需：
                </div>
                {nextCv && nextCv > info.total_cv && (
                  <ProgressRow
                    label="CV"
                    current={info.total_cv}
                    target={nextCv}
                    pct={cvProgress}
                    color={color}
                  />
                )}
                {nextTasks && nextTasks > info.task_count && (
                  <ProgressRow
                    label="任务"
                    current={info.task_count}
                    target={nextTasks}
                    pct={taskProgress}
                    color={color}
                  />
                )}
                {nextProposals !== null && nextProposals > info.proposal_count && (
                  <div style={{
                    fontSize: 11, color: '#a8a08e', marginTop: 6,
                    fontStyle: 'italic',
                  }}>
                    + 至少 {nextProposals} 次提案
                    （当前 {info.proposal_count}）
                  </div>
                )}
                {/* Already meets all numeric — waiting for sync */}
                {(!nextCv || nextCv <= info.total_cv) &&
                 (!nextTasks || nextTasks <= info.task_count) &&
                 (nextProposals === null || nextProposals <= info.proposal_count) && (
                  <div style={{
                    fontSize: 11, color: '#7fc090', marginTop: 4,
                    fontStyle: 'italic',
                  }}>
                    ✦ 条件已达——刷新即可晋升
                  </div>
                )}
              </>
            ) : (
              <div style={{
                fontSize: 11, color: '#dc2626',
                borderTop: '1px solid rgba(220, 38, 38, 0.3)',
                paddingTop: 12,
                fontStyle: 'italic',
                textAlign: 'center',
              }}>
                ✦ 已达顶级 · 联席主席 ✦
              </div>
            )}

            <div style={{
              marginTop: 12, paddingTop: 10,
              borderTop: '1px solid rgba(168, 179, 160, 0.1)',
              fontSize: 10, color: '#6e6856',
              textAlign: 'center',
            }}>
              点击空白关闭
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes levelTooltipFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      padding: '8px 4px',
      background: 'rgba(168, 179, 160, 0.05)',
      border: '1px solid rgba(168, 179, 160, 0.15)',
      borderRadius: 3,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 16, fontWeight: 600, color: '#f5f0e0',
        fontFamily: 'monospace',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, color: '#8a8576',
        letterSpacing: '0.08em',
      }}>
        {label}
      </div>
    </div>
  );
}

function ProgressRow({
  label, current, target, pct, color,
}: {
  label: string; current: number; target: number; pct: number; color: string;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: '#a8a08e', marginBottom: 3,
      }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'monospace' }}>
          {current} / {target}
        </span>
      </div>
      <div style={{
        height: 4,
        background: 'rgba(168, 179, 160, 0.15)',
        borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}
