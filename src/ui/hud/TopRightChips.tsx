import { Chip } from '../index';

interface TopRightChipsProps {
  solarTerm?: string;     // 节气名 e.g. "谷雨"
  clockTime?: string;     // e.g. "15:42"
  daypart?: string;       // 时段 e.g. "黄昏"
  onlineCount?: number;
}

/**
 * 右上 — 节气 + 时间 + 在线人数 chips
 *
 * 用法：
 *   <TopRightChips solarTerm="谷雨" clockTime="15:42" daypart="黄昏" onlineCount={23} />
 */
export function TopRightChips({
  solarTerm,
  clockTime,
  daypart,
  onlineCount,
}: TopRightChipsProps) {
  return (
    <>
      {solarTerm && <Chip tone="spring">{solarTerm}</Chip>}
      {(clockTime || daypart) && (
        <Chip>
          {clockTime}
          {clockTime && daypart && ' · '}
          {daypart}
        </Chip>
      )}
      {onlineCount !== undefined && (
        <Chip tone="gold">在线 · {onlineCount}</Chip>
      )}
    </>
  );
}
