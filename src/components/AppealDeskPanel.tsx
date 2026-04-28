import { useEffect, useState, useSyncExternalStore } from 'react';
import { EventBus } from '../game/EventBus';
import {
  type QuestState,
  type QuestStates,
  getQuestStatesSnapshot,
  subscribeQuestStates,
  startAppealState,
} from '../lib/questStore';
import type { QualityCoeff } from '../lib/reviewers';
import { scheduleAppealVotes } from '../lib/appealReviewers';

/**
 * Quest definitions — duplicated from QuestLog to avoid coupling.
 * If you add new quests, add them here too. (Or refactor to a shared module — later.)
 */
const QUEST_TITLES: Record<string, { title: string; workshop: string; baseCp: number }> = {
  'paper-import': { title: '单篇论文入库', workshop: '百晓居', baseCp: 12 },
  'author-card': { title: '作者/机构卡片完善', workshop: '百晓居', baseCp: 5 },
  'qa-week': { title: '完成单周数据质量抽查（QA）', workshop: '百晓居', baseCp: 50 },
  'auto-script': { title: '开发/升级自动化抓取脚本', workshop: '百晓居', baseCp: 200 },
  'tech-quarterly': { title: '产出季度 CUA 技术版图研判', workshop: '百晓居', baseCp: 250 },
};

const COEFF_LABEL: Record<number, string> = {
  0.5: 'x0.5（不达标）',
  1.0: 'x1.0（达标）',
  2.0: 'x2.0（卓越）',
};

interface AppealableQuest {
  id: string;
  title: string;
  workshop: string;
  state: QuestState;
}

/**
 * Mirror Pavilion's appeal desk.
 * Triggered by [E] on the desk in MirrorPavilionScene.
 *
 * Lists all 'submitted' quests that haven't been appealed yet.
 * Player can pick one and start an appeal directly.
 *
 * The original "发起申诉" button in QuestLog still works — this is an
 * additional, more thematic entry point.
 */
export function AppealDeskPanel() {
  const [open, setOpen] = useState(false);
  const states: QuestStates = useSyncExternalStore(
    subscribeQuestStates,
    getQuestStatesSnapshot,
    getQuestStatesSnapshot,
  );
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    EventBus.on('open-appeal-desk', onOpen);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmingId) {
          setConfirmingId(null);
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      EventBus.off('open-appeal-desk', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, [confirmingId]);

  if (!open) return null;

  // Find appealable quests (status='submitted', not appealed, has finalCoeff/cpEarned)
  const appealable: AppealableQuest[] = Object.entries(states)
    .filter(([, s]) =>
      s.status === 'submitted' &&
      !s.appealed &&
      s.finalCoeff !== undefined &&
      s.cpEarned !== undefined
    )
    .map(([id, s]) => ({
      id,
      title: QUEST_TITLES[id]?.title ?? id,
      workshop: QUEST_TITLES[id]?.workshop ?? '?',
      state: s,
    }));

  // Also collect "already appealed" for reference (not actionable)
  const alreadyAppealed: AppealableQuest[] = Object.entries(states)
    .filter(([, s]) => s.appealed === true)
    .map(([id, s]) => ({
      id,
      title: QUEST_TITLES[id]?.title ?? id,
      workshop: QUEST_TITLES[id]?.workshop ?? '?',
      state: s,
    }));

  const startAppealFor = (q: AppealableQuest) => {
    if (q.state.finalCoeff === undefined) return;
    const appealId = `appeal-${q.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const scheduled = scheduleAppealVotes(
      appealId,
      (q.state.selfRated ?? 1.0) as QualityCoeff,
      q.state.finalCoeff as QualityCoeff,
    );
    startAppealState(q.id, appealId, scheduled);
    EventBus.emit('show-toast', {
      text: `📜 已发起申诉 · 3 位复审员陆续给出意见（约 30-90 秒）`,
    });
    setConfirmingId(null);
    setOpen(false);
  };

  const confirmingQuest = confirmingId
    ? appealable.find((q) => q.id === confirmingId) ?? null
    : null;

  return (
    <div
      onClick={() => {
        if (!confirmingId) setOpen(false);
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(8, 12, 18, 0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-start', overflowY: 'auto',
        padding: '40px 24px',
        backdropFilter: 'blur(3px)',
        animation: 'appealFadeIn 0.3s ease-out',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 640, width: '100%',
          background: 'linear-gradient(180deg, #1a1812 0%, #0f0d08 100%)',
          border: '1px solid rgba(184, 137, 58, 0.4)',
          borderRadius: 6,
          padding: '32px 36px 36px',
          boxShadow: '0 12px 50px rgba(0, 0, 0, 0.7)',
          color: '#f5f0e0',
        }}
      >
        {/* Title */}
        <div style={{ borderBottom: '1px solid rgba(184, 137, 58, 0.25)', paddingBottom: 18, marginBottom: 24 }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.25em',
            color: '#b8893a', textTransform: 'uppercase', marginBottom: 6,
          }}>
            MIRROR PAVILION · APPEAL DESK
          </div>
          <div style={{
            fontFamily: 'serif', fontSize: 24, fontWeight: 600,
            color: '#f5f0e0', letterSpacing: '0.06em',
          }}>
            明镜阁 · 申诉案桌
          </div>
          <div style={{
            fontSize: 12, color: '#8a8576', marginTop: 8, lineHeight: 1.7,
          }}>
            "凡评审结果存疑——皆可申诉。3 位复审员独立评议，只上调，不下调。"
          </div>
        </div>

        {/* Appealable list */}
        {appealable.length === 0 && alreadyAppealed.length === 0 && (
          <div style={{
            padding: '28px 0', textAlign: 'center',
            color: '#6e6856', fontSize: 13, lineHeight: 1.8,
          }}>
            （案桌上无待申诉之卷）
            <br />
            <span style={{ fontSize: 11, color: '#4a463e' }}>
              完成任务并经过审核后，若对评分有异议，可在此发起申诉。
            </span>
          </div>
        )}

        {appealable.length > 0 && (
          <>
            <div style={{
              fontSize: 11, letterSpacing: '0.15em',
              color: '#b8893a', marginBottom: 12, fontFamily: 'monospace',
            }}>
              可申诉案件 · {appealable.length} 件
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {appealable.map((q) => (
                <div
                  key={q.id}
                  style={{
                    padding: '14px 16px',
                    background: 'rgba(184, 137, 58, 0.06)',
                    border: '1px solid rgba(184, 137, 58, 0.3)',
                    borderRadius: 4,
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: '#f5f0e0',
                      marginBottom: 4,
                    }}>
                      {q.title}
                    </div>
                    <div style={{
                      fontSize: 11, color: '#a8a08e',
                      display: 'flex', gap: 12, flexWrap: 'wrap',
                    }}>
                      <span>工坊：{q.workshop}</span>
                      <span>自评：{COEFF_LABEL[q.state.selfRated ?? 1.0]}</span>
                      <span>评审：{COEFF_LABEL[q.state.finalCoeff ?? 1.0]}</span>
                      <span>CP：{q.state.cpEarned}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmingId(q.id)}
                    style={{
                      padding: '6px 16px', fontSize: 12,
                      background: 'rgba(192, 128, 112, 0.15)',
                      color: '#e0a090',
                      border: '1px solid rgba(192, 128, 112, 0.5)',
                      borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📜 申诉
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Already appealed list */}
        {alreadyAppealed.length > 0 && (
          <>
            <div style={{
              fontSize: 11, letterSpacing: '0.15em',
              color: '#6e6856', marginTop: 24, marginBottom: 12,
              fontFamily: 'monospace',
            }}>
              已申诉案件（仅供参考）· {alreadyAppealed.length} 件
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {alreadyAppealed.map((q) => {
                const outcome = q.state.appealOutcome;
                const outcomeLabel = outcome === 'upgrade' ? '上调'
                  : outcome === 'maintain' ? '维持'
                  : outcome === 'declined' ? '驳回'
                  : '审议中';
                const outcomeColor = outcome === 'upgrade' ? '#7fc090'
                  : outcome === 'declined' ? '#c08070'
                  : outcome === 'maintain' ? '#b8a472'
                  : '#a8a08e';
                return (
                  <div
                    key={q.id}
                    style={{
                      padding: '8px 14px',
                      background: 'rgba(168, 179, 160, 0.04)',
                      border: '1px solid rgba(168, 179, 160, 0.12)',
                      borderRadius: 3,
                      fontSize: 12, color: '#a8a08e',
                      display: 'flex', justifyContent: 'space-between', gap: 12,
                    }}
                  >
                    <span>{q.title}</span>
                    <span style={{ color: outcomeColor, fontFamily: 'monospace' }}>
                      {outcomeLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 28, paddingTop: 16,
          borderTop: '1px solid rgba(184, 137, 58, 0.15)',
          textAlign: 'center',
          fontSize: 11, color: '#4a463e',
        }}>
          点击空白或按 Esc 关闭
        </div>
      </div>

      {/* Confirm modal */}
      {confirmingQuest && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setConfirmingId(null);
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 700,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 460, width: '100%',
              background: '#1a1812',
              border: '1px solid rgba(192, 128, 112, 0.5)',
              borderRadius: 4,
              padding: '24px 28px',
              color: '#f5f0e0',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{
              fontSize: 16, fontWeight: 600, fontFamily: 'serif',
              marginBottom: 12,
            }}>
              确认发起申诉？
            </div>
            <div style={{
              fontSize: 13, color: '#a8a08e', lineHeight: 1.7, marginBottom: 18,
            }}>
              对「{confirmingQuest.title}」的评审结果发起申诉。
              <br />
              当前评分：<span style={{ color: '#e0b060' }}>
                {COEFF_LABEL[confirmingQuest.state.finalCoeff ?? 1.0]}
              </span>
              <br />
              获得 CP：<span style={{ color: '#e0b060' }}>
                {confirmingQuest.state.cpEarned}
              </span>
              <br />
              <br />
              <span style={{ fontSize: 12, color: '#8a8576' }}>
                "复审员只上调不下调——但驳回亦有可能。"
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => startAppealFor(confirmingQuest)}
                style={{
                  flex: 1, padding: '8px 16px', fontSize: 13,
                  background: 'rgba(192, 128, 112, 0.2)',
                  color: '#e0a090',
                  border: '1px solid rgba(192, 128, 112, 0.6)',
                  borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                确认申诉
              </button>
              <button
                onClick={() => setConfirmingId(null)}
                style={{
                  flex: 1, padding: '8px 16px', fontSize: 13,
                  background: 'transparent',
                  color: '#a8a08e',
                  border: '1px solid rgba(168, 179, 160, 0.3)',
                  borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes appealFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
