import { PixelPanel, Chip, Divider } from '../index';

interface QuestCardProps {
  title: string;          // e.g. "修复 issue #123"
  description: string;
  rewardCV?: number;
  workshopName?: string;
}

/**
 * 左中 — 当前任务卡片
 *
 * 用法：
 *   <QuestCard
 *     title="修复 issue #123"
 *     description="前往开源工坊向萧敬接取..."
 *     rewardCV={120}
 *     workshopName="开源工坊"
 *   />
 */
export function QuestCard({
  title,
  description,
  rewardCV,
  workshopName,
}: QuestCardProps) {
  return (
    <PixelPanel className="pp-tight">
      <div className="t-eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>
        当前任务 · QUEST
      </div>
      <div className="t-title" style={{ fontSize: 16, marginBottom: 6 }}>
        {title}
      </div>
      <div
        className="t-soft"
        style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 10 }}
      >
        {description}
      </div>
      <Divider sm />
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {rewardCV !== undefined && (
          <Chip tone="gold">奖励 +{rewardCV} CV</Chip>
        )}
        {workshopName && <Chip>{workshopName}</Chip>}
      </div>
    </PixelPanel>
  );
}
