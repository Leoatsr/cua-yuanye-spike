import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import {
  createProposal,
  validateProposalInput,
  CATEGORY_LABELS,
  VALIDATION_LIMITS,
  type ProposalCategory,
} from '../lib/proposalStore';
import { RequiresLevel, checkLevelRequirement } from './RequiresLevel';

const REQUIRED_LEVEL = 2;  // F5.1: 创建提案需 L2 mentor

const DURATION_OPTIONS: Array<{ hours: number; label: string }> = [
  { hours: 24, label: '24 小时' },
  { hours: 72, label: '3 天（推荐）' },
  { hours: 168, label: '7 天' },
  { hours: 336, label: '14 天' },
];

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Council Hall · Create proposal panel.
 * Triggered via EventBus 'open-create-proposal'.
 *
 * In C6.3a, no UI entry point yet — test by:
 *   F12 Console → window.dispatchEvent(new Event('open-create-proposal'))
 * (or via React DevTools).
 *
 * C6.3b will add the [E] button on Council Hall's podium.
 */
export function CreateProposalPanel() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProposalCategory>('feature');
  const [durationHours, setDurationHours] = useState(72);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const onOpen = () => {
      // Reset form on each open
      setTitle('');
      setDescription('');
      setCategory('feature');
      setDurationHours(72);
      setStatus('idle');
      setErrorMsg('');
      setOpen(true);
    };
    EventBus.on('open-create-proposal', onOpen);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'submitting') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      EventBus.off('open-create-proposal', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, [status]);

  if (!open) return null;

  const validation = validateProposalInput({ title, description, category, durationHours });
  const canSubmit = validation.ok && status !== 'submitting';

  const handleSubmit = async () => {
    if (!canSubmit) return;

    // F5.1: server-side level check (defense in depth)
    const levelCheck = await checkLevelRequirement(REQUIRED_LEVEL);
    if (!levelCheck.ok) {
      setStatus('error');
      setErrorMsg(levelCheck.reason ?? '等级不足');
      return;
    }

    setStatus('submitting');
    setErrorMsg('');

    const result = await createProposal({ title, description, category, durationHours });

    if (result.ok) {
      setStatus('success');
      EventBus.emit('show-toast', {
        text: `📜 提案「${result.proposal.title}」已提交 · 公示中`,
      });
      // Notify open lists to refresh
      EventBus.emit('proposal-created', { proposal: result.proposal });
      // Auto-close after a beat so user sees success state
      setTimeout(() => setOpen(false), 800);
    } else {
      setStatus('error');
      setErrorMsg(result.error);
    }
  };

  return (
    <div
      onClick={() => {
        if (status !== 'submitting') setOpen(false);
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(8, 12, 18, 0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-start', overflowY: 'auto',
        padding: '40px 24px',
        backdropFilter: 'blur(3px)',
        animation: 'proposalFadeIn 0.3s ease-out',
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
        {/* Header */}
        <div style={{ borderBottom: '1px solid rgba(184, 137, 58, 0.25)', paddingBottom: 18, marginBottom: 24 }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.25em',
            color: '#b8893a', textTransform: 'uppercase', marginBottom: 6,
          }}>
            COUNCIL HALL · NEW PROPOSAL
          </div>
          <div style={{
            fontFamily: 'serif', fontSize: 24, fontWeight: 600,
            color: '#f5f0e0', letterSpacing: '0.06em',
          }}>
            登台陈词 · 创建提案
          </div>
          <div style={{
            fontSize: 12, color: '#8a8576', marginTop: 8, lineHeight: 1.7,
          }}>
            提案 → 公示 → 投票 → 决议归档。每一步都被看见。
          </div>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Title */}
          <div>
            <label style={fieldLabelStyle}>
              标题 <span style={hintStyle}>{title.length} / {VALIDATION_LIMITS.TITLE_MAX}</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={VALIDATION_LIMITS.TITLE_MAX + 10}
              placeholder="一句话说清楚提案内容"
              disabled={status === 'submitting'}
              style={inputStyle}
            />
          </div>

          {/* Category */}
          <div>
            <label style={fieldLabelStyle}>分类</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(Object.keys(CATEGORY_LABELS) as ProposalCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  disabled={status === 'submitting'}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    background: category === cat
                      ? 'rgba(184, 137, 58, 0.2)'
                      : 'transparent',
                    color: category === cat ? '#e0b060' : '#a8a08e',
                    border: `1px solid ${category === cat ? 'rgba(184, 137, 58, 0.6)' : 'rgba(168, 179, 160, 0.25)'}`,
                    borderRadius: 3,
                    cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: '0.05em',
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={fieldLabelStyle}>
              描述 <span style={hintStyle}>{description.length} / {VALIDATION_LIMITS.DESC_MAX}</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={VALIDATION_LIMITS.DESC_MAX + 100}
              placeholder="详细说明提案的内容、背景、为什么需要、预期影响等。可分段。"
              rows={8}
              disabled={status === 'submitting'}
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.6,
              }}
            />
          </div>

          {/* Duration */}
          <div>
            <label style={fieldLabelStyle}>投票期限</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.hours}
                  onClick={() => setDurationHours(opt.hours)}
                  disabled={status === 'submitting'}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    background: durationHours === opt.hours
                      ? 'rgba(184, 137, 58, 0.2)'
                      : 'transparent',
                    color: durationHours === opt.hours ? '#e0b060' : '#a8a08e',
                    border: `1px solid ${durationHours === opt.hours ? 'rgba(184, 137, 58, 0.6)' : 'rgba(168, 179, 160, 0.25)'}`,
                    borderRadius: 3,
                    cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Validation hint */}
        {!validation.ok && status !== 'submitting' && (title.length > 0 || description.length > 0) && (
          <div style={{
            marginTop: 18,
            padding: '10px 14px',
            background: 'rgba(192, 128, 112, 0.08)',
            border: '1px solid rgba(192, 128, 112, 0.3)',
            borderRadius: 3,
            fontSize: 12,
            color: '#e0a090',
          }}>
            ⚠️ {validation.error}
          </div>
        )}

        {/* Error from server */}
        {status === 'error' && (
          <div style={{
            marginTop: 18,
            padding: '10px 14px',
            background: 'rgba(192, 128, 112, 0.12)',
            border: '1px solid rgba(192, 128, 112, 0.4)',
            borderRadius: 3,
            fontSize: 12,
            color: '#e0a090',
          }}>
            ✗ {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div style={{
          marginTop: 24, paddingTop: 20,
          borderTop: '1px solid rgba(184, 137, 58, 0.2)',
          display: 'flex', gap: 12, alignItems: 'center',
        }}>
          <div style={{ flex: 1, fontSize: 11, color: '#6e6856' }}>
            {status === 'submitting' ? '提交中...' :
              status === 'success' ? '✓ 提案已公示' :
              '点击外部或按 Esc 取消'}
          </div>
          <button
            onClick={() => setOpen(false)}
            disabled={status === 'submitting'}
            style={{
              padding: '8px 18px', fontSize: 13,
              background: 'transparent',
              color: '#a8a08e',
              border: '1px solid rgba(168, 179, 160, 0.3)',
              borderRadius: 3,
              cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            取消
          </button>
          <RequiresLevel min={REQUIRED_LEVEL} action="创建提案">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                padding: '8px 22px', fontSize: 13, fontWeight: 600,
                background: canSubmit ? 'rgba(184, 137, 58, 0.2)' : 'rgba(168, 179, 160, 0.05)',
                color: canSubmit ? '#e0b060' : '#6e6856',
                border: `1px solid ${canSubmit ? 'rgba(184, 137, 58, 0.6)' : 'rgba(168, 179, 160, 0.15)'}`,
                borderRadius: 3,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                letterSpacing: '0.08em',
              }}
            >
              📜 提交提案
            </button>
          </RequiresLevel>
        </div>
      </div>

      <style>{`
        @keyframes proposalFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ===== Styles =====

const fieldLabelStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 11,
  letterSpacing: '0.15em',
  color: '#b8893a',
  textTransform: 'uppercase',
  fontFamily: 'monospace',
  marginBottom: 8,
};

const hintStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#6e6856',
  fontWeight: 400,
  letterSpacing: 0,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'rgba(168, 179, 160, 0.04)',
  border: '1px solid rgba(168, 179, 160, 0.2)',
  borderRadius: 3,
  color: '#f5f0e0',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};
