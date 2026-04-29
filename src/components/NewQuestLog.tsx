import { useEffect, useState, useMemo } from 'react';
import { EventBus } from '../game/EventBus';
import { QUESTS } from '../lib/questDefinitions';
import type { QuestStatus } from '../lib/questStore';
import {
  acceptQuest as storeAcceptQuest,
  withdrawSubmissionState as storeWithdrawSubmission,
} from '../lib/questStore';
import { cancelScheduledVotes } from '../lib/reviewers';
import { useQuestStates } from '../hooks/useQuestStates';
import { useOpenViaEventBus } from '../hooks/useOpenViaEventBus';
import { PixelButton, Chip } from '../ui';
import { QuestCard } from './QuestCard';
import { SubmissionForm } from './SubmissionForm';

/**
 * NewQuestLog · 像素古籍风任务日志
 *
 * Wave 2.5.A.2 · 80% 视觉重写
 *
 * 范围:
 *   ✅ 任务列表 + 4 status tab（可接 / 进行中 / 审核中 / 已完成）
 *   ✅ 任务卡片（标题 / 工坊 / CP / 难度 / 详情展开）
 *   ✅ 接受任务 → acceptQuest API
 *   ✅ 提交表单（URL + 自评）→ confirmSubmit API
 *   ✅ 撤回（reviewing 状态 + 倒计时未到）→ withdrawSubmission API
 *   ✅ 监听 questStore 实时更新（useSyncExternalStore）
 *
 * 沿用旧版逻辑:
 *   ⏳ 审核员投票动画 → 静态显示进度
 *   ⏳ 申诉流 → 不做（按钮显示但触发旧逻辑或简提示）
 *   ⏳ CV 入账动画 → 静态显示金额
 *
 * 后续 Wave 2.5.A.3 重写
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
  const states = useQuestStates();

  // ESC 关闭（如果在提交表单则先关表单）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (submittingId) {
          setSubmittingId(null);
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen, submittingId]);

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

  return (
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

            // 提交表单替代普通卡
            if (isSubmitting) {
              return (
                <SubmissionForm
                  key={quest.id}
                  quest={quest}
                  initialLink={state?.draftLink ?? state?.submissionLink ?? ''}
                  initialSelfRated={state?.draftSelfRated ?? state?.selfRated ?? 1.0}
                  onSubmitted={() => {
                    setSubmittingId(null);
                    setTab('reviewing');
                  }}
                  onCancel={() => setSubmittingId(null)}
                />
              );
            }

            // 状态 chip
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

            // Actions 按钮组
            const actions = renderActions({
              quest,
              status,
              onAccept: () => storeAcceptQuest(quest.id),
              onSubmit: () => setSubmittingId(quest.id),
              onWithdraw: () => {
                if (!state?.submissionId) return;
                if (
                  !state.withdrawDeadline ||
                  state.withdrawDeadline <= Date.now()
                ) {
                  EventBus.emit('show-toast', {
                    text: '⚠ 撤回窗口已过',
                  });
                  return;
                }
                cancelScheduledVotes(state.submissionId);
                storeWithdrawSubmission(quest.id);
                EventBus.emit('show-toast', {
                  text: '✓ 已撤回 · 可重新提交',
                });
                setTab('inProgress');
              },
            });

            // Extra · 状态特定显示
            const extra = renderExtra({ status, state });

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
  );
}

// ============================================================
// Action 按钮组
// ============================================================

function renderActions({
  status,
  onAccept,
  onSubmit,
  onWithdraw,
}: {
  quest: { id: string };
  status: QuestStatus;
  onAccept: () => void;
  onSubmit: () => void;
  onWithdraw: () => void;
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
  return null;
}

// ============================================================
// Extra 区域
// ============================================================

function renderExtra({
  status,
  state,
}: {
  status: QuestStatus;
  state: import('../lib/questStore').QuestState | undefined;
}) {
  if (!state) return null;

  if (status === 'reviewing' && state.submissionLink) {
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
          style={{ fontSize: 10, marginTop: 6, display: 'flex', gap: 10 }}
        >
          <span>自评 x{state.selfRated}</span>
          <span>已收到 {voteCount}/3 票</span>
          {remainingSec > 0 && (
            <span style={{ color: 'var(--gold)' }}>可撤回 {remainingSec}s</span>
          )}
        </div>
      </>
    );
  }

  if (status === 'submitted' && state.cpEarned !== undefined) {
    return (
      <div
        className="t-soft"
        style={{
          fontSize: 11,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <Chip tone="gold">+{state.cpEarned} CV</Chip>
        <span>最终系数 x{state.finalCoeff}</span>
        <span className="t-faint">
          ·{' '}
          {state.finalizedAt
            ? new Date(state.finalizedAt).toLocaleDateString('zh-CN')
            : ''}
        </span>
      </div>
    );
  }

  if (status === 'appealing') {
    return (
      <div className="t-soft" style={{ fontSize: 11 }}>
        申诉处理中 · 等待审核员复议
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
