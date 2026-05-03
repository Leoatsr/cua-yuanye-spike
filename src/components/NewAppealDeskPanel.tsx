import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  type QuestState,
  type QuestStates,
  getQuestStatesSnapshot,
  subscribeQuestStates,
  startAppealState,
} from '../lib/questStore';
import type { QualityCoeff } from '../lib/reviewers';
import { scheduleAppealVotes } from '../lib/appealReviewers';
import { QUESTS } from '../lib/questDefinitions';
import { useOpenViaEventBus } from '../hooks/useOpenViaEventBus';
import { EventBus } from '../game/EventBus';
import { PixelButton, Chip, Divider } from '../ui';

const PANEL_WIDTH = 540;
const PANEL_HEIGHT = 600;

interface AppealableQuest {
  id: string;
  title: string;
  workshop: string;
  state: QuestState;
}

const COEFF_LABEL: Record<number, string> = {
  0.5: 'x0.5（不达标）',
  1.0: 'x1.0（达标）',
  2.0: 'x2.0（卓越）',
};

/**
 * NewAppealDeskPanel · 像素风申诉案桌
 *
 * Wave 2.5.B
 *
 * 触发: EventBus 'open-appeal-desk' (明镜阁 [E])
 *
 * 列出可申诉任务（status='submitted' + !appealed + 有 finalCoeff/cpEarned）
 * + 已申诉历史
 * 用 startAppealState + scheduleAppealVotes 发起申诉
 *
 * 跟旧版 AppealDeskPanel 数据 100% 兼容
 */
export function NewAppealDeskPanel() {
  const [open, setOpen] = useOpenViaEventBus(
    'appeal-desk',
    'open-appeal-desk',
  );
  const states: QuestStates = useSyncExternalStore(
    subscribeQuestStates,
    getQuestStatesSnapshot,
    getQuestStatesSnapshot,
  );
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // ESC
  useEffect(() => {
    if (!open) return;
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
    return () => window.removeEventListener('keydown', onKey);
  }, [open, confirmingId, setOpen]);

  if (!open) return null;

  // 可申诉
  const appealable: AppealableQuest[] = Object.entries(states)
    .filter(
      ([, s]) =>
        s.status === 'submitted' &&
        !s.appealed &&
        s.finalCoeff !== undefined &&
        s.cpEarned !== undefined,
    )
    .map(([id, s]) => {
      const def = QUESTS.find((q) => q.id === id);
      return {
        id,
        title: def?.title ?? id,
        workshop: def?.workshop ?? '?',
        state: s,
      };
    });

  // 已申诉
  const alreadyAppealed: AppealableQuest[] = Object.entries(states)
    .filter(([, s]) => s.appealed === true)
    .map(([id, s]) => {
      const def = QUESTS.find((q) => q.id === id);
      return {
        id,
        title: def?.title ?? id,
        workshop: def?.workshop ?? '?',
        state: s,
      };
    });

  const startAppealFor = (q: AppealableQuest) => {
    if (q.state.finalCoeff === undefined) return;
    const appealId = `appeal-${q.id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
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
          padding: '10px 14px',
          borderBottom: '3px solid var(--wood-3)',
          background: 'var(--paper-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚖</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="t-title" style={{ fontSize: 16 }}>
              明镜阁 · 申诉案桌
            </span>
            <span
              className="t-faint"
              style={{ fontSize: 10, marginTop: 2 }}
            >
              凡评审存疑 · 皆可申诉
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

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 14,
          background: 'var(--paper-0)',
        }}
      >
        {confirmingQuest ? (
          <ConfirmAppealForm
            quest={confirmingQuest}
            onConfirm={() => startAppealFor(confirmingQuest)}
            onCancel={() => setConfirmingId(null)}
          />
        ) : (
          <>
            {/* 可申诉列表 */}
            <SectionHeader
              title="待申诉"
              count={appealable.length}
              hint="3 位复审员独立评议 · 只上调不下调"
            />
            {appealable.length === 0 ? (
              <div
                style={{
                  padding: 18,
                  textAlign: 'center',
                  color: 'var(--ink-faint)',
                  fontSize: 12,
                  background: 'var(--paper-1)',
                  border: '2px dashed var(--wood-2)',
                  marginBottom: 14,
                }}
              >
                （案桌上无待申诉之卷）
                <br />
                <span style={{ fontSize: 10 }}>
                  完成任务后 · 若对评分有异议可前来申诉
                </span>
              </div>
            ) : (
              appealable.map((q) => (
                <AppealableQuestCard
                  key={q.id}
                  quest={q}
                  onAppeal={() => setConfirmingId(q.id)}
                />
              ))
            )}

            {/* 已申诉历史 */}
            {alreadyAppealed.length > 0 && (
              <>
                <Divider sm />
                <SectionHeader
                  title="申诉记录"
                  count={alreadyAppealed.length}
                />
                {alreadyAppealed.map((q) => (
                  <AppealedQuestCard key={q.id} quest={q} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 子组件
// ============================================================

function SectionHeader({
  title,
  count,
  hint,
}: {
  title: string;
  count: number;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span className="t-eyebrow" style={{ fontSize: 10 }}>
          {title}
        </span>
        {count > 0 && <Chip>{count}</Chip>}
      </div>
      {hint && (
        <div className="t-faint" style={{ fontSize: 10, marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function AppealableQuestCard({
  quest,
  onAppeal,
}: {
  quest: AppealableQuest;
  onAppeal: () => void;
}) {
  const s = quest.state;
  return (
    <div
      style={{
        background: 'var(--paper-1)',
        border: '2px solid var(--wood-3)',
        marginBottom: 8,
        boxShadow: '2px 2px 0 var(--wood-4)',
      }}
    >
      <div style={{ padding: '10px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            marginBottom: 6,
          }}
        >
          <span className="t-title" style={{ fontSize: 13 }}>
            {quest.title}
          </span>
          <span className="t-faint" style={{ fontSize: 10 }}>
            · {quest.workshop}
          </span>
        </div>
        <div
          className="t-soft"
          style={{ fontSize: 11, lineHeight: 1.7, marginBottom: 4 }}
        >
          自评 <span className="mono">{COEFF_LABEL[s.selfRated ?? 1]}</span>
        </div>
        <div
          className="t-soft"
          style={{ fontSize: 11, lineHeight: 1.7 }}
        >
          评审 <span className="mono">{COEFF_LABEL[s.finalCoeff ?? 1]}</span>
          {' · 入账 '}
          <span className="mono">{s.cpEarned} CV</span>
        </div>
      </div>
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--wood-2)',
          background: 'var(--paper-2)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <PixelButton variant="pb-primary" size="pb-sm" onClick={onAppeal}>
          发起申诉
        </PixelButton>
      </div>
    </div>
  );
}

function AppealedQuestCard({ quest }: { quest: AppealableQuest }) {
  const s = quest.state;
  const outcome = s.appealOutcome;
  let outcomeLabel = '审议中';
  let outcomeTone: 'spring' | 'gold' | 'danger' | '' = 'gold';
  if (outcome === 'upgrade') {
    outcomeLabel = '上调';
    outcomeTone = 'spring';
  } else if (outcome === 'maintain') {
    outcomeLabel = '维持';
    outcomeTone = '';
  } else if (outcome === 'declined') {
    outcomeLabel = '驳回';
    outcomeTone = 'danger';
  }
  const voteCount = s.appealVotes?.length ?? 0;
  return (
    <div
      style={{
        background: 'var(--paper-1)',
        border: '1px solid var(--wood-3)',
        marginBottom: 6,
        padding: '8px 10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <Chip tone={outcomeTone}>{outcomeLabel}</Chip>
        <span className="t-title" style={{ fontSize: 12 }}>
          {quest.title}
        </span>
      </div>
      <div
        className="t-faint"
        style={{ fontSize: 10, marginLeft: 4 }}
      >
        {!outcome && `复审 ${voteCount}/3`}
        {outcome === 'upgrade' &&
          `x${s.finalCoeff} → x${s.appealCoeff} · +${(s.appealCoeff ?? 0) - (s.finalCoeff ?? 0)} 系数`}
        {outcome === 'maintain' && `维持 x${s.finalCoeff}`}
        {outcome === 'declined' && '复审驳回 · 维持原判'}
      </div>
    </div>
  );
}

function ConfirmAppealForm({
  quest,
  onConfirm,
  onCancel,
}: {
  quest: AppealableQuest;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <div
        style={{
          padding: 14,
          background: 'var(--paper-1)',
          border: '2px solid var(--wood-3)',
          marginBottom: 10,
        }}
      >
        <div
          className="t-eyebrow"
          style={{ fontSize: 10, marginBottom: 6 }}
        >
          确认申诉
        </div>
        <h4
          className="t-title"
          style={{ fontSize: 14, margin: '0 0 8px' }}
        >
          {quest.title}
        </h4>
        <div
          className="t-soft"
          style={{ fontSize: 11, lineHeight: 1.8 }}
        >
          自评 <span className="mono">{COEFF_LABEL[quest.state.selfRated ?? 1]}</span>
          <br />
          评审 <span className="mono">{COEFF_LABEL[quest.state.finalCoeff ?? 1]}</span>
          {' → 入账 '}
          <span className="mono">{quest.state.cpEarned} CV</span>
        </div>

        <Divider sm />

        <div
          className="t-soft"
          style={{
            fontSize: 11,
            lineHeight: 1.8,
            marginTop: 10,
          }}
        >
          申诉提交后：
          <br />
          · 3 位复审员将在 30-90 秒内独立给出意见
          <br />
          · 复审只可上调，不可下调系数
          <br />· 已入账 CV 不会扣除
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          justifyContent: 'flex-end',
        }}
      >
        <PixelButton size="pb-sm" onClick={onCancel}>
          再想想
        </PixelButton>
        <PixelButton variant="pb-primary" size="pb-sm" onClick={onConfirm}>
          确认申诉
        </PixelButton>
      </div>
    </div>
  );
}

export default NewAppealDeskPanel;
