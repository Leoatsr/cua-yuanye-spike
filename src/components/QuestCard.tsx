import type { ReactNode } from 'react';
import type { QuestDef } from '../lib/questDefinitions';
import {
  DIFFICULTY_LABEL,
  DIFFICULTY_TONE,
} from '../lib/questDefinitions';
import { Chip, Divider } from '../ui';

interface QuestCardProps {
  quest: QuestDef;
  /** 状态标签（如 "可接受" / "进行中" / "审核中" / "已完成" / "申诉中"）*/
  statusLabel?: string;
  statusTone?: 'spring' | 'gold' | 'jade' | 'danger' | '';
  /** 右侧 actions（按钮组）*/
  actions?: ReactNode;
  /** 是否展开详情（quality criteria + accept criteria）*/
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** 额外内容（如审核进度 / 提交链接 / CV 入账金额等）*/
  extra?: ReactNode;
}

/**
 * 任务卡片 · 像素古籍风
 *
 * 紧凑版（默认折叠）：标题 + 工坊 + chip + actions
 * 展开版：+ 描述 + 验收标准 + 质量评分细则
 */
export function QuestCard({
  quest,
  statusLabel,
  statusTone = '',
  actions,
  expanded = false,
  onToggleExpand,
  extra,
}: QuestCardProps) {
  return (
    <div
      style={{
        background: 'var(--paper-1)',
        border: '2px solid var(--wood-3)',
        marginBottom: 8,
        boxShadow: '2px 2px 0 var(--wood-4)',
      }}
    >
      {/* Header · 标题 + 状态 */}
      <div
        onClick={onToggleExpand}
        style={{
          padding: '10px 12px',
          cursor: onToggleExpand ? 'pointer' : 'default',
          background: expanded ? 'var(--paper-2)' : 'transparent',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                marginBottom: 4,
                flexWrap: 'wrap',
              }}
            >
              <span className="t-title" style={{ fontSize: 14 }}>
                {quest.title}
              </span>
              <span className="t-faint" style={{ fontSize: 10 }}>
                · {quest.workshop}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Chip tone={DIFFICULTY_TONE[quest.difficulty]}>
                {DIFFICULTY_LABEL[quest.difficulty]}
              </Chip>
              <Chip tone="gold">{quest.cpRange}</Chip>
              <Chip>{quest.estimatedTime}</Chip>
              {statusLabel && <Chip tone={statusTone}>{statusLabel}</Chip>}
            </div>
          </div>
          {onToggleExpand && (
            <span
              style={{
                fontSize: 16,
                color: 'var(--wood-3)',
                userSelect: 'none',
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
              }}
            >
              ▶
            </span>
          )}
        </div>
      </div>

      {/* 详情（展开）*/}
      {expanded && (
        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--wood-2)',
          }}
        >
          <p
            className="t-soft"
            style={{
              fontSize: 12,
              lineHeight: 1.7,
              margin: '0 0 10px',
            }}
          >
            {quest.description}
          </p>

          <Divider sm />

          <div className="t-eyebrow" style={{ fontSize: 9, marginTop: 10, marginBottom: 4 }}>
            质量评分
          </div>
          <p
            className="t-soft"
            style={{ fontSize: 11, lineHeight: 1.7, margin: '0 0 10px' }}
          >
            {quest.qualityCriteria}
          </p>

          <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>
            验收标准
          </div>
          <p
            className="t-soft"
            style={{ fontSize: 11, lineHeight: 1.7, margin: 0 }}
          >
            {quest.acceptCriteria}
          </p>
        </div>
      )}

      {/* 额外内容（如提交链接 / 审核进度 / CV 入账） */}
      {extra && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--wood-2)',
            background: 'var(--paper-0)',
          }}
        >
          {extra}
        </div>
      )}

      {/* Actions */}
      {actions && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--wood-2)',
            background: 'var(--paper-2)',
            display: 'flex',
            gap: 6,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
