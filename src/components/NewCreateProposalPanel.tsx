import { useEffect, useState } from 'react';
import {
  createProposal,
  validateProposalInput,
  CATEGORY_LABELS,
  VALIDATION_LIMITS,
  type ProposalCategory,
} from '../lib/proposalStore';
import { checkLevelRequirement } from './RequiresLevel';
import { useOpenViaEventBus } from '../hooks/useOpenViaEventBus';
import { PixelButton, Chip } from '../ui';

const REQUIRED_LEVEL = 2;
const PANEL_WIDTH = 540;
const PANEL_HEIGHT = 600;

const DURATION_OPTIONS: Array<{ hours: number; label: string }> = [
  { hours: 24, label: '24 小时' },
  { hours: 72, label: '3 天（推荐）' },
  { hours: 168, label: '7 天' },
  { hours: 336, label: '14 天' },
];

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * NewCreateProposalPanel · 像素风创建提案
 *
 * Wave 2.5.B
 *
 * 触发: EventBus 'open-create-proposal'
 * 等级要求: L2 mentor (服务端 + 客户端双重验证)
 * 字段: 标题 / 描述 / 类别（5）/ 投票时长（4 选项）
 */
export function NewCreateProposalPanel() {
  const [open, setOpen] = useOpenViaEventBus(
    'create-proposal',
    'open-create-proposal',
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProposalCategory>('feature');
  const [durationHours, setDurationHours] = useState(72);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // 重置表单
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setCategory('feature');
    setDurationHours(72);
    setStatus('idle');
    setErrorMsg('');
  }, [open]);

  // ESC 关（提交中不能关）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'submitting') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, status, setOpen]);

  if (!open) return null;

  const validation = validateProposalInput({
    title,
    description,
    category,
    durationHours,
  });
  const canSubmit = validation.ok && status !== 'submitting';

  const handleSubmit = async () => {
    if (!canSubmit) return;

    // 服务端等级守门
    const levelCheck = await checkLevelRequirement(REQUIRED_LEVEL);
    if (!levelCheck.ok) {
      setStatus('error');
      setErrorMsg(levelCheck.reason ?? '等级不足');
      return;
    }

    setStatus('submitting');
    const result = await createProposal({ title, description, category, durationHours });
    if (result.ok) {
      setStatus('success');
      setTimeout(() => setOpen(false), 1500);
    } else {
      setStatus('error');
      setErrorMsg(result.error);
    }
  };

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
          <span style={{ fontSize: 18 }}>📝</span>
          <span className="t-title" style={{ fontSize: 16 }}>
            新建提案
          </span>
          <Chip tone="gold">需 L{REQUIRED_LEVEL} mentor</Chip>
        </div>
        <button
          onClick={() => status !== 'submitting' && setOpen(false)}
          disabled={status === 'submitting'}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
            fontSize: 18,
            color: 'var(--wood-3)',
            padding: 4,
            lineHeight: 1,
            opacity: status === 'submitting' ? 0.4 : 1,
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
        {status === 'success' ? (
          <SuccessState />
        ) : (
          <>
            {/* 标题 */}
            <FormField
              label="标题"
              required
              hint={`${title.length} / ${VALIDATION_LIMITS.TITLE_MAX}`}
            >
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="提案标题（清晰、具体）"
                maxLength={VALIDATION_LIMITS.TITLE_MAX}
                disabled={status === 'submitting'}
                style={inputStyle}
              />
            </FormField>

            {/* 类别 */}
            <FormField label="类别" required>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(Object.keys(CATEGORY_LABELS) as ProposalCategory[]).map(
                  (cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      disabled={status === 'submitting'}
                      style={{
                        padding: '6px 10px',
                        border: '2px solid var(--wood-4)',
                        background:
                          category === cat ? 'var(--gold)' : 'var(--paper-0)',
                        color:
                          category === cat ? 'var(--wood-4)' : 'var(--ink)',
                        fontFamily: 'var(--f-pixel)',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ),
                )}
              </div>
            </FormField>

            {/* 描述 */}
            <FormField
              label="描述"
              required
              hint={`${description.length} / ${VALIDATION_LIMITS.DESC_MAX}`}
            >
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`详细说明背景、目的、预期效果（至少 ${VALIDATION_LIMITS.DESC_MIN} 字）`}
                maxLength={VALIDATION_LIMITS.DESC_MAX}
                disabled={status === 'submitting'}
                rows={6}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: 100,
                  fontFamily: 'var(--f-sans)',
                }}
              />
            </FormField>

            {/* 投票时长 */}
            <FormField label="投票时长" required>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.hours}
                    onClick={() => setDurationHours(opt.hours)}
                    disabled={status === 'submitting'}
                    style={{
                      padding: '6px 10px',
                      border: '2px solid var(--wood-4)',
                      background:
                        durationHours === opt.hours
                          ? 'var(--gold)'
                          : 'var(--paper-0)',
                      color:
                        durationHours === opt.hours
                          ? 'var(--wood-4)'
                          : 'var(--ink)',
                      fontFamily: 'var(--f-pixel)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </FormField>

            {/* Validation 错误 */}
            {!validation.ok && (title || description) && (
              <div
                style={{
                  marginTop: 10,
                  padding: '6px 8px',
                  background: 'var(--paper-2)',
                  border: '1px dashed var(--wood-3)',
                  fontSize: 11,
                  color: 'var(--wood-3)',
                }}
              >
                ⚠ {validation.error}
              </div>
            )}

            {/* 错误提示 */}
            {status === 'error' && errorMsg && (
              <div
                style={{
                  marginTop: 10,
                  padding: '6px 8px',
                  background: 'rgba(166, 70, 52, 0.1)',
                  border: '1px solid var(--danger)',
                  color: 'var(--danger)',
                  fontSize: 11,
                }}
              >
                ⚠ {errorMsg}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer · actions */}
      {status !== 'success' && (
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
          <PixelButton
            size="pb-sm"
            onClick={() => setOpen(false)}
            disabled={status === 'submitting'}
          >
            取消
          </PixelButton>
          <PixelButton
            variant="pb-primary"
            size="pb-sm"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {status === 'submitting' ? '提交中...' : '发起提案'}
          </PixelButton>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 复用小组件
// ============================================================

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '2px solid var(--wood-4)',
  background: 'var(--paper-0)',
  fontSize: 12,
  fontFamily: 'var(--f-sans)',
  color: 'var(--ink)',
  outline: 'none',
  boxSizing: 'border-box',
};

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

function FormField({ label, required, hint, children }: FormFieldProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <label
          className="t-eyebrow"
          style={{ fontSize: 10, color: 'var(--wood-3)' }}
        >
          {label}
          {required && <span style={{ color: 'var(--danger)' }}> *</span>}
        </label>
        {hint && (
          <span
            className="t-faint mono"
            style={{ fontSize: 10 }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function SuccessState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        gap: 16,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48 }}>✓</div>
      <div className="t-title" style={{ fontSize: 16 }}>
        提案发起成功
      </div>
      <div className="t-faint" style={{ fontSize: 12 }}>
        现在已进入投票阶段
      </div>
    </div>
  );
}

export default NewCreateProposalPanel;
