import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import { isDashboardAdmin } from '../lib/adminCheck';

/**
 * J2-A · Y 键打开数据看板
 *
 * Fix 2: 完全隐藏 — 非管理员根本不挂键盘监听
 *   1. 组件 mount 时 async 检查权限
 *   2. 权限 = false → 不挂 keydown listener，按 Y 完全没反应
 *   3. 权限 = true → 挂监听，按 Y 打开看板
 *
 * 这样非管理员**完全感知不到**有这个功能存在。
 */
export function DashboardKeyListener() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // 检查权限（只查一次，启动时）
  useEffect(() => {
    let cancelled = false;
    void isDashboardAdmin().then((v) => {
      if (!cancelled) setIsAdmin(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 只有管理员才挂键盘监听
  useEffect(() => {
    if (isAdmin !== true) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'y' && e.key !== 'Y') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable)
          return;
      }

      e.preventDefault();
      EventBus.emit('open-dashboard');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAdmin]);

  return null;
}
