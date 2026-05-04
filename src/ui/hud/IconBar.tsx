import type { ReactNode } from 'react';

export interface IconBarItem {
  icon: ReactNode;     // emoji or sprite or any react node
  label: string;
  /**
   * 红点数字
   *   - undefined / 0: 不显示
   *   - >0: 显示数字 (1-99 · 100+ 显示 99+)
   *   - -1: 显示小红点 · 不带数字 (用于公告这种 boolean 未读)
   */
  badge?: number;
  onClick?: () => void;
}

interface IconBarProps {
  items: IconBarItem[];
}

/**
 * 左下 — 5 图标功能按钮 (公告 / 任务 / 邮件 / 聊天 / 好友)
 *
 * 微信风红点:
 *   - 数字 1-99 显示数字 · 100+ 显示 99+
 *   - badge=-1 显示小红点不带数字 (boolean 未读类)
 *   - 红色 #ff3b30 (iOS 标准 · 比 var(--danger) 更鲜)
 *   - 右上偏移 -4 -4 · 圆形 / 椭圆 (单数字 18×18 圆 · 多数字自适应)
 *
 * 用法:
 *   <IconBar items={[
 *     { icon: '📜', label: '公告', badge: -1, onClick: () => ... },  // 小红点无数字
 *     { icon: '✉', label: '邮件', badge: 3, onClick: () => ... },     // 数字 3
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
  const showNumberBadge = badge !== undefined && badge > 0;
  const showDotBadge = badge === -1;

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

      {/* 数字红点 */}
      {showNumberBadge && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: '#ff3b30',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            padding: '1px 5px',
            border: '2px solid var(--paper-0, #fdf0cf)',
            borderRadius: 999,
            fontFamily: 'var(--f-num)',
            minWidth: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            lineHeight: 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        >
          {(badge as number) > 99 ? '99+' : badge}
        </span>
      )}

      {/* 小红点 (无数字) */}
      {showDotBadge && (
        <span
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 12,
            height: 12,
            background: '#ff3b30',
            border: '2px solid var(--paper-0, #fdf0cf)',
            borderRadius: '50%',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      )}
    </button>
  );
}
