import type { ReactNode } from 'react';

export interface IconBarItem {
  icon: ReactNode;     // emoji or sprite or any react node
  label: string;
  badge?: number;      // 红点数字（不显示如果 0/undefined）
  onClick?: () => void;
}

interface IconBarProps {
  items: IconBarItem[];
}

/**
 * 左下 — 5 图标功能按钮（公告 / 任务 / 邮件 / 聊天 / 好友）
 *
 * 用法：
 *   <IconBar items={[
 *     { icon: '📜', label: '公告', onClick: () => ... },
 *     { icon: '✉', label: '邮件', badge: 3, onClick: () => ... },
 *   ]} />
 */
export function IconBar({ items }: IconBarProps) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {items.map((item) => (
        <IconButton key={item.label} {...item} />
      ))}
    </div>
  );
}

function IconButton({ icon, label, badge, onClick }: IconBarItem) {
  return (
    <button
      onClick={onClick}
      className="pb pb-sm"
      style={{
        width: 56,
        height: 56,
        padding: 0,
        flexDirection: 'column',
        gap: 2,
        position: 'relative',
      }}
    >
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--f-pixel)', fontSize: 9 }}>{label}</div>
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: 'var(--danger)',
            color: '#fff',
            fontSize: 10,
            padding: '1px 5px',
            border: '2px solid var(--wood-4)',
            fontFamily: 'var(--f-num)',
            minWidth: 18,
            textAlign: 'center',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
