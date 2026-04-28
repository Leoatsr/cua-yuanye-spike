import { getSupabase } from './supabase';

/**
 * J2-B Fix 1 · 检查当前登录用户是否数据看板管理员
 *
 * 通过 RPC `is_dashboard_admin()` 服务端判断（基于 GitHub username 白名单）
 * 客户端缓存 5 分钟避免反复查
 */

let cached: { result: boolean; at: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function isDashboardAdmin(): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.result;
  }

  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase.rpc('is_dashboard_admin');
    if (error) {
      // RPC 不存在或其他错误 — 默认 false
      // eslint-disable-next-line no-console
      console.warn('[admin-check]', error.message);
      cached = { result: false, at: Date.now() };
      return false;
    }
    const result = data === true;
    cached = { result, at: Date.now() };
    return result;
  } catch {
    cached = { result: false, at: Date.now() };
    return false;
  }
}

/** 清除缓存（登出时调用）*/
export function invalidateAdminCache(): void {
  cached = null;
}

if (typeof window !== 'undefined') {
  (window as unknown as { __isAdmin: () => Promise<boolean> }).__isAdmin = isDashboardAdmin;
}
