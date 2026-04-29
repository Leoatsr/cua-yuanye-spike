import { useState } from 'react';
import type { QualityCoeff } from '../lib/reviewers';
import { scheduleReviewerVotes } from '../lib/reviewers';
import { validateSubmissionUrl } from '../lib/urlValidation';
import {
  saveDraft as storeSaveDraft,
  confirmSubmit as storeConfirmSubmit,
} from '../lib/questStore';
import type { QuestDef } from '../lib/questDefinitions';
import { PixelButton, Chip, Divider } from '../ui';

const WITHDRAW_WINDOW_MS = 3 * 60_000;  // 3 分钟（跟旧版一致）

interface SubmissionFormProps {
  quest: QuestDef;
  initialLink?: string;
  initialSelfRated?: QualityCoeff;
  onSubmitted: () => void;
  onCancel: () => void;
}

/**
 * 任务提交表单 · 像素古籍风
 *
 * 用户填:
 *   - 提交链接（URL）
 *   - 自评 quality coefficient（x0.5 / x1.0 / x2.0）
 *
 * 调 questStore.confirmSubmit + 启动 reviewer 调度
 */
export function SubmissionForm({
  quest,
  initialLink = '',
  initialSelfRated = 1.0,
  onSubmitted,
  onCancel,
}: SubmissionFormProps) {
  const [link, setLink] = useState(initialLink);
  const [selfRated, setSelfRated] = useState<QualityCoeff>(initialSelfRated);
  const [error, setError] = useState('');

  const saveDraft = () => {
    storeSaveDraft(quest.id, link, selfRated);
  };

  const submit = () => {
    setError('');
    const validation = validateSubmissionUrl(link);
    if (!validation.ok) {
      setError(validation.reason || '链接无效');
      return;
    }

    // 生成 submission id + 调度 3 reviewer 投票
    const submissionId = `${quest.id}-${Date.now()}`;
    const scheduled = scheduleReviewerVotes(submissionId, selfRated);
    const withdrawDeadline = Date.now() + WITHDRAW_WINDOW_MS;
    storeConfirmSubmit(
      quest.id,
      link,
      selfRated,
      submissionId,
      scheduled,
      withdrawDeadline,
    );
    onSubmitted();
  };

  return (
    <div
      style={{
        padding: 14,
        background: 'var(--paper-1)',
        border: '2px solid var(--wood-3)',
        marginBottom: 8,
      }}
    >
      <div className="t-eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>
        提交 · {quest.title}
      </div>

      {/* URL 输入 */}
      <div style={{ marginBottom: 10 }}>
        <label
          className="t-soft"
          style={{ fontSize: 11, display: 'block', marginBottom: 4 }}
        >
          提交链接（必须 https:// 开头）
        </label>
        <input
          type="text"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            if (error) setError('');
          }}
          onBlur={saveDraft}
          placeholder="https://..."
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '2px solid var(--wood-4)',
            background: 'var(--paper-0)',
            fontSize: 12,
            fontFamily: 'var(--f-sans)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* 自评 */}
      <div style={{ marginBottom: 10 }}>
        <label
          className="t-soft"
          style={{ fontSize: 11, display: 'block', marginBottom: 4 }}
        >
          自评 · 你认为提交质量
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {([0.5, 1.0, 2.0] as QualityCoeff[]).map((c) => (
            <button
              key={c}
              onClick={() => {
                setSelfRated(c);
                saveDraft();
              }}
              style={{
                flex: 1,
                padding: '6px 8px',
                border: '2px solid var(--wood-4)',
                background:
                  selfRated === c ? 'var(--gold)' : 'var(--paper-0)',
                color: selfRated === c ? 'var(--wood-4)' : 'var(--ink)',
                fontFamily: 'var(--f-pixel)',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              x{c}
            </button>
          ))}
        </div>
        <div className="t-faint" style={{ fontSize: 10, marginTop: 4 }}>
          {selfRated === 0.5 && '低于预期 · 可获 50% CP'}
          {selfRated === 1.0 && '达标 · 100% CP'}
          {selfRated === 2.0 && '超出预期 · 200% CP（需经审核确认）'}
        </div>
      </div>

      <Divider sm />

      {/* 评分细则提示 */}
      <div
        style={{
          padding: 8,
          background: 'var(--paper-2)',
          border: '1px solid var(--wood-2)',
          marginTop: 10,
        }}
      >
        <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>
          质量评分细则
        </div>
        <div
          className="t-soft"
          style={{ fontSize: 10, lineHeight: 1.6 }}
        >
          {quest.qualityCriteria}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 8,
            padding: '6px 8px',
            background: 'rgba(166, 70, 52, 0.1)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            fontSize: 11,
          }}
        >
          ⚠ {error}
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Chip>提交后 3 分钟内可撤回</Chip>
      </div>

      <div
        style={{
          marginTop: 10,
          display: 'flex',
          gap: 6,
          justifyContent: 'flex-end',
        }}
      >
        <PixelButton size="pb-sm" onClick={onCancel}>
          取消
        </PixelButton>
        <PixelButton variant="pb-primary" size="pb-sm" onClick={submit}>
          确认提交
        </PixelButton>
      </div>
    </div>
  );
}
