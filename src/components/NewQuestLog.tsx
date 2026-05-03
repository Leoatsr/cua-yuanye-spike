import { useEffect, useState, useMemo } from 'react';
import { EventBus } from '../game/EventBus';
import { QUESTS } from '../lib/questDefinitions';
import type { QuestStatus, QuestState } from '../lib/questStore';
import {
  acceptQuest as storeAcceptQuest,
  withdrawSubmissionState as storeWithdrawSubmission,
} from '../lib/questStore';
import { cancelScheduledVotes } from '../lib/reviewers';
import { useQuestStates } from '../hooks/useQuestStates';
import { useOpenViaEventBus } from '../hooks/useOpenViaEventBus';
import { useCountdownTick } from '../hooks/useCountdownTick';
import { PixelButton, Chip } from '../ui';
import { QuestCard } from './QuestCard';
import { SubmissionForm } from './SubmissionForm';
import { ReviewerVoteCard } from './ReviewerVoteCard';
import { CVRewardBurst } from './CVRewardBurst';
import { AppealConfirmModal } from './AppealConfirmModal';
import { ReviewProgressBar } from './ReviewProgressBar';
import { QuorumToast } from './QuorumToast';
import { useFreshVotes } from '../hooks/useFreshVotes';
import { useQuorumEvent } from '../hooks/useQuorumEvent';
import { QUESTS as ALL_QUESTS } from '../lib/questDefinitions';

/**
 * NewQuestLog · 像素古籍风任务日志
 *
 * Wave 2.5.A.3 · 加 Q2/Q3/Q4
 *   ✅ Q2 撤回倒计时 1s tick 实时刷新（useCountdownTick）
 *   ✅ Q3 申诉流入口（已完成 tab 显示"发起申诉"按钮 · AppealConfirmModal 弹窗）
 *   ✅ Q4 CV 完整版金光动画（CVRewardBurst · 数字滚 + 金光环 + 闪光 + 浮动 +N）
 *   ✅ ReviewerVoteCard 替代纯文字 N/3
 *
 * 沿用 Wave 2.5.A.2:
 *   ✅ 任务列表 + 4 status tab + 任务卡片
 *   ✅ acceptQuest / confirmSubmit / withdrawSubmission API
 *
 * 留给 Wave 2.5.A.4:
 *   ⏳ Q1 审核员投票动画完整版（chip 滑入 + 完成 toast + 烟花）
 */

const PANEL_WIDTH = 540;
const PANEL_HEIGHT = 600;

type Tab = 'available' | 'inProgress' | 'reviewing' | 'completed';

const TAB_CONFIG: Record<Tab, { label: string; statuses: QuestStatus[] }> = {
  available: { label: '可接', statuses: ['available'] },
  inProgress: { label: '进行中', statuses: ['accepted'] },
  reviewing: { label: '审核中', statuses: ['reviewing', 'appealing'] },
  completed: { label: '已完成', statuses: ['submitted'] },
};

export function NewQuestLog() {
  const [open, setOpen] = useOpenViaEventBus('questlog', 'open-quest-log');
  const [tab, setTab] = useState<Tab>('available');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [appealingQuestId, setAppealingQuestId] = useState<string | null>(null);
  const states = useQuestStates();

  // Q2 · 1s tick · 仅当有 reviewing 任务且未到撤回 deadline 时启用
  const hasActiveCountdown = useMemo(() => {
    return Object.values(states).some(
      (s) =>
        s.status === 'reviewing' &&
        s.withdrawDeadline !== undefined &&
        s.withdrawDeadline > Date.now(),
    );
  }, [states]);
  useCountdownTick(open && hasActiveCountdown);

  // Q1 · Wave 2.5.A.4 · 跟踪刚收到的投票（用于 fresh 动画）
  const freshVotes = useFreshVotes(open);

  // Q1 · Wave 2.5.A.4 · 监听 quest-finalized 触发 quorum toast
  const { quorumPayload, clearQuorum } = useQuorumEvent(open);

  // ESC 关闭（依次：申诉 modal → 提交表单 → 整个面板）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (appealingQuestId) {
          setAppealingQuestId(null);
        } else if (submittingId) {
          setSubmittingId(null);
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen, submittingId, appealingQuestId]);

  // 按 tab 筛选 quests
  const questsByTab = useMemo(() => {
    const result: Record<Tab, typeof QUESTS> = {
      available: [],
      inProgress: [],
      reviewing: [],
      completed: [],
    };
    QUESTS.forEach((q) => {
      const state = states[q.id];
      const status = state?.status ?? 'available';
      for (const tabKey of Object.keys(TAB_CONFIG) as Tab[]) {
        if (TAB_CONFIG[tabKey].statuses.includes(status)) {
          result[tabKey].push(q);
          break;
        }
      }
    });
    return result;
  }, [states]);

  if (!open) return null;

  const currentQuests = questsByTab[tab];
  const appealingQuest = appealingQuestId
    ? QUESTS.find((q) => q.id === appealingQuestId)
    : null;
  const appealingState = appealingQuestId ? states[appealingQuestId] : null;

  return (
    <>
      <div
        className="bg-paper"
        style={{
          position: 'fixed',
          bottom: 80,
          right: 12,
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
            padding: '10px 12px',
            borderBottom: '3px solid var(--wood-3)',
            background: 'var(--paper-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <span className="t-title" style={{ fontSize: 16 }}>
              任务日志
            </span>
            <Chip>{QUESTS.length}</Chip>
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

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            background: 'var(--paper-2)',
            borderBottom: '2px solid var(--wood-3)',
          }}
        >
          {(Object.keys(TAB_CONFIG) as Tab[]).map((tabKey) => {
            const count = questsByTab[tabKey].length;
            return (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                style={{
                  flex: 1,
                  padding: '8px 6px',
                  fontSize: 12,
                  fontFamily: 'var(--f-pixel)',
                  cursor: 'pointer',
                  background: tab === tabKey ? 'var(--paper-0)' : 'transparent',
                  border: 'none',
                  borderBottom:
                    tab === tabKey
                      ? '3px solid var(--gold)'
                      : '3px solid transparent',
                  color: tab === tabKey ? 'var(--wood-3)' : 'var(--ink)',
                }}
              >
                {TAB_CONFIG[tabKey].label}
                {count > 0 && (
                  <span
                    style={{
                      marginLeft: 4,
                      fontSize: 10,
                      color: 'var(--ink-faint)',
                      fontFamily: 'var(--f-num)',
                    }}
                  >
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 10,
            background: 'var(--paper-0)',
          }}
        >
          {currentQuests.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            currentQuests.map((quest) => {
              const state = states[quest.id];
              const isExpanded = expandedId === quest.id;
              const isSubmitting = submittingId === quest.id;

              if (isSubmitting) {
                return (
                  <SubmissionForm
                    key={quest.id}
                    quest={quest}
                    initialLink={state?.draftLink ?? state?.submissionLink ?? ''}
                    initialSelfRated={
                      state?.draftSelfRated ?? state?.selfRated ?? 1.0
                    }
                    onSubmitted={() => {
                      setSubmittingId(null);
                      setTab('reviewing');
                    }}
                    onCancel={() => setSubmittingId(null)}
                  />
                );
              }

              const status = state?.status ?? 'available';
              let statusLabel = '';
              let statusTone: 'spring' | 'gold' | 'jade' | 'danger' | '' = '';
              if (status === 'accepted') {
                statusLabel = '进行中';
                statusTone = 'gold';
              } else if (status === 'reviewing') {
                const voteCount = state?.votes?.length ?? 0;
                statusLabel = `审核中 ${voteCount}/3`;
                statusTone = 'gold';
              } else if (status === 'appealing') {
                statusLabel = '申诉中';
                statusTone = 'danger';
              } else if (status === 'submitted') {
                const cp = state?.cpEarned ?? 0;
                statusLabel = `已完成 +${cp} CV`;
                statusTone = 'spring';
              }

              const actions = renderActions({
                status,
                state,
                onAccept: () => storeAcceptQuest(quest.id),
                onSubmit: () => setSubmittingId(quest.id),
                onWithdraw: () => {
                  if (!state?.submissionId) return;
                  if (
                    !state.withdrawDeadline ||
                    state.withdrawDeadline <= Date.now()
                  ) {
                    EventBus.emit('show-toast', { text: '⚠ 撤回窗口已过' });
                    return;
                  }
                  cancelScheduledVotes(state.submissionId);
                  storeWithdrawSubmission(quest.id);
                  EventBus.emit('show-toast', {
                    text: '✓ 已撤回 · 可重新提交',
                  });
                  setTab('inProgress');
                },
                onAppeal: () => setAppealingQuestId(quest.id),
              });

              const extra = renderExtra({ status, state, freshVotes });

              return (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  statusLabel={statusLabel}
                  statusTone={statusTone}
                  actions={actions}
                  expanded={isExpanded}
                  onToggleExpand={() =>
                    setExpandedId(isExpanded ? null : quest.id)
                  }
                  extra={extra}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Q3 · 申诉确认 modal */}
      {appealingQuest && appealingState && (
        <AppealConfirmModal
          quest={appealingQuest}
          state={appealingState}
          onClose={() => setAppealingQuestId(null)}
        />
      )}

      {/* Q1 · Wave 2.5.A.4 · Quorum toast */}
      {quorumPayload && (
        <QuorumToast
          questTitle={
            ALL_QUESTS.find((q) => q.id === quorumPayload.taskId)?.title ??
            quorumPayload.questTitle
          }
          finalCoeff={quorumPayload.finalCoeff}
          cpEarned={quorumPayload.cpEarned}
          triggerKey={quorumPayload.triggerKey}
          onComplete={clearQuorum}
        />
      )}
    </>
  );
}

// ============================================================
// Action 按钮组
// ============================================================

function renderActions({
  status,
  state,
  onAccept,
  onSubmit,
  onWithdraw,
  onAppeal,
}: {
  status: QuestStatus;
  state: QuestState | undefined;
  onAccept: () => void;
  onSubmit: () => void;
  onWithdraw: () => void;
  onAppeal: () => void;
}) {
  if (status === 'available') {
    return (
      <PixelButton variant="pb-primary" size="pb-sm" onClick={onAccept}>
        接受
      </PixelButton>
    );
  }
  if (status === 'accepted') {
    return (
      <PixelButton variant="pb-primary" size="pb-sm" onClick={onSubmit}>
        提交作品
      </PixelButton>
    );
  }
  if (status === 'reviewing') {
    return (
      <PixelButton size="pb-sm" onClick={onWithdraw}>
        撤回
      </PixelButton>
    );
  }
  if (status === 'submitted' && state && !state.appealed) {
    return (
      <PixelButton size="pb-sm" onClick={onAppeal}>
        发起申诉
      </PixelButton>
    );
  }
  return null;
}

// ============================================================
// Extra 区域 · 状态特定信息显示
// ============================================================

function renderExtra({
  status,
  state,
  freshVotes,
}: {
  status: QuestStatus;
  state: QuestState | undefined;
  freshVotes: Set<number>;
}) {
  if (!state) return null;

  if (status === 'reviewing' && state.submissionLink) {
    // Q2 · 实时倒计时（依赖父组件 useCountdownTick · 父组件每秒触发重渲染）
    const remaining = state.withdrawDeadline
      ? Math.max(0, state.withdrawDeadline - Date.now())
      : 0;
    const remainingSec = Math.ceil(remaining / 1000);
    const voteCount = state.votes?.length ?? 0;

    return (
      <>
        <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>
          已提交链接
        </div>
        <a
          href={state.submissionLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mono t-soft"
          style={{
            fontSize: 11,
            color: 'var(--wood-3)',
            wordBreak: 'break-all',
            textDecoration: 'underline',
          }}
        >
          {state.submissionLink}
        </a>
        <div
          className="t-faint"
          style={{
            fontSize: 10,
            marginTop: 6,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span>自评 x{state.selfRated}</span>
          
          {remainingSec > 0 && (
            <span style={{ color: 'var(--gold)' }}>
              可撤回 <strong className="mono">{remainingSec}s</strong>
            </span>
          )}
          {remainingSec === 0 && state.withdrawDeadline && (
            <span style={{ color: 'var(--ink-faint)' }}>撤回窗口已过</span>
          )}
        </div>

                {/* 审核进度条 · Wave 2.5.A.4 */}
        <ReviewProgressBar current={voteCount} total={3} />

{/* 已收到的投票（紧凑列表） */}
        {voteCount > 0 && state.votes && (
          <div style={{ marginTop: 10 }}>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>
              审核员意见
            </div>
            {state.votes.map((vote) => (
              <ReviewerVoteCard
                key={vote.reviewerId + vote.votedAt}
                vote={vote}
                isFresh={freshVotes.has(vote.votedAt)}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  if (status === 'submitted' && state.cpEarned !== undefined) {
    // Q4 · 完整版 CV 金光动画
    const finalizedAt = state.finalizedAt ?? 0;
    const isExcellent = (state.finalCoeff ?? 1) >= 2.0;

    // CVRewardBurst 内部判断 elapsed 决定播动画或退化为 chip
    return (
      <CVRewardBurst
        cpEarned={state.cpEarned}
        finalizedAt={finalizedAt}
        isExcellent={isExcellent}
        finalCoeff={state.finalCoeff}
      />
    );
  }

  if (status === 'appealing') {
    const voteCount = state.appealVotes?.length ?? 0;
    return (
      <div className="t-soft" style={{ fontSize: 11, lineHeight: 1.7 }}>
        <div>申诉处理中 · 等待审核员复议</div>
        <div className="t-faint" style={{ fontSize: 10, marginTop: 4 }}>
          已收到 {voteCount}/3 复审票
        </div>
        {state.appealVotes && state.appealVotes.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {state.appealVotes.map((v, i) => (
              <div
                key={i}
                style={{
                  fontSize: 10,
                  padding: '4px 6px',
                  background: 'var(--paper-1)',
                  border: '1px solid var(--wood-2)',
                  marginBottom: 3,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{v.reviewerName}</span>
                <span className="mono" style={{ color: 'var(--wood-3)' }}>
                  x{v.coeff.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ============================================================
// Empty state
// ============================================================

function EmptyState({ tab }: { tab: Tab }) {
  const messages: Record<Tab, { icon: string; text: string; hint: string }> = {
    available: {
      icon: '✓',
      text: '所有任务已接受',
      hint: '完成进行中的任务后会出现新任务',
    },
    inProgress: {
      icon: '📝',
      text: '没有进行中任务',
      hint: '到 "可接" tab 接一个任务',
    },
    reviewing: {
      icon: '⌛',
      text: '没有审核中任务',
      hint: '提交作品后会进入此状态',
    },
    completed: {
      icon: '🏆',
      text: '还没完成任何任务',
      hint: '加油 · 第一份 CV 在等你',
    },
  };

  const m = messages[tab];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
        color: 'var(--ink-faint)',
        fontSize: 13,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 36 }}>{m.icon}</div>
      <div>{m.text}</div>
      <div className="t-faint" style={{ fontSize: 11 }}>
        {m.hint}
      </div>
    </div>
  );
}

export default NewQuestLog;
