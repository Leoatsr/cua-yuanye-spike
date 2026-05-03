import type { QuestState } from '../lib/questStore';
import type { QualityCoeff } from '../lib/reviewers';
import { startAppealState } from '../lib/questStore';
import { scheduleAppealVotes } from '../lib/appealReviewers';
import { EventBus } from '../game/EventBus';
import type { QuestDef } from '../lib/questDefinitions';
import { PixelButton, Chip, Divider } from '../ui';

const COEFF_LABEL: Record<number, string> = {
  0.5: 'x0.5（不达标）',
  1.0: 'x1.0（达标）',
  2.0: 'x2.0（卓越）',
};

interface AppealConfirmModalProps {
  quest: QuestDef;
  state: QuestState;
  onClose: () => void;
}

/**
 * 申诉确认 modal · 复刻 NewAppealDeskPanel 的确认页
 *
 * 显示 self-rated vs final coeff + 入账 CV + 申诉规则
 * 用户点确认后 · 调 startAppealState + scheduleAppealVotes
 */
export function AppealConfirmModal({
  quest,
  state,
  onClose,
}: AppealConfirmModalProps) {
  const handleConfirm = () => {
    if (state.finalCoeff === undefined) return;
    const appealId = `appeal-${quest.id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const scheduled = scheduleAppealVotes(
      appealId,
      (state.selfRated ?? 1.0) as QualityCoeff,
      state.finalCoeff as QualityCoeff,
    );
    startAppealState(quest.id, appealId, scheduled);
    EventBus.emit('show-toast', {
      text: `📜 已发起申诉 · 3 位复审员陆续给出意见（约 30-90 秒）`,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8, 12, 18, 0.6)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--paper-0)',
          border: '4px solid var(--wood-3)',
          boxShadow: '0 0 0 4px var(--wood-4), 8px 8px 0 rgba(0,0,0,0.3)',
          fontFamily: 'var(--f-sans)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '3px solid var(--wood-3)',
            background: 'var(--paper-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚖</span>
            <span className="t-title" style={{ fontSize: 14 }}>
              发起申诉
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--wood-3)',
              padding: 4,
              lineHeight: 1,
            }}
            title="关闭"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 16 }}>
          <div
            className="t-eyebrow"
            style={{ fontSize: 10, marginBottom: 6 }}
          >
            任务
          </div>
          <h4
            className="t-title"
            style={{ fontSize: 14, margin: '0 0 12px' }}
          >
            {quest.title}
          </h4>

          <div
            className="t-soft"
            style={{
              fontSize: 12,
              lineHeight: 1.9,
              padding: 10,
              background: 'var(--paper-1)',
              border: '1px solid var(--wood-2)',
            }}
          >
            <div>
              自评 ·{' '}
              <span className="mono" style={{ color: 'var(--wood-3)' }}>
                {COEFF_LABEL[state.selfRated ?? 1]}
              </span>
            </div>
            <div>
              评审 ·{' '}
              <span className="mono" style={{ color: 'var(--wood-3)' }}>
                {COEFF_LABEL[state.finalCoeff ?? 1]}
              </span>
            </div>
            <div>
              入账 ·{' '}
              <Chip tone="gold">{state.cpEarned} CV</Chip>
            </div>
          </div>

          <Divider sm />

          <div
            className="t-soft"
            style={{
              fontSize: 11,
              lineHeight: 1.8,
              marginTop: 12,
              color: 'var(--ink-faint)',
            }}
          >
            申诉提交后：
            <br />
            · 3 位复审员将在 30-90 秒内独立给出意见
            <br />
            · 复审只可上调 · 不可下调系数
            <br />· 已入账 CV 不会扣除
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 10,
            borderTop: '2px solid var(--wood-3)',
            background: 'var(--paper-1)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 6,
          }}
        >
          <PixelButton size="pb-sm" onClick={onClose}>
            再想想
          </PixelButton>
          <PixelButton
            variant="pb-primary"
            size="pb-sm"
            onClick={handleConfirm}
          >
            确认申诉
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
