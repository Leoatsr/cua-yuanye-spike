import { useEffect, useState, useCallback } from 'react';
import { getSupabase } from '../lib/supabase';
import { reportError } from '../lib/sentry';

export interface LeaderboardRow {
  user_id: string;
  user_name: string;
  total_cv: number;
  task_count: number;
}

/**
 * 拉 CV 排行榜（功德堂）
 *
 * 调 get_cv_leaderboard RPC（security definer · 跨用户聚合）
 * 同时拉自己的 user_id 用于高亮
 */
export function useLeaderboard(active: boolean): {
  rows: LeaderboardRow[];
  myUserId: string | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  reload: () => Promise<void>;
} {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>(
    'idle',
  );

  const reload = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setStatus('error');
      return;
    }
    setStatus('loading');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setMyUserId(session?.user?.id ?? null);

      const { data, error } = await supabase.rpc('get_cv_leaderboard', {
        p_limit: 20,
      });
      if (error) {
        reportError('merit-board', error);
        setStatus('error');
        return;
      }
      setRows((data ?? []) as LeaderboardRow[]);
      setStatus('loaded');
    } catch (err) {
      reportError('merit-board', err);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void reload();
  }, [active, reload]);

  return { rows, myUserId, status, reload };
}

/**
 * 估算等级（仅基于 cv + tasks · 不含 proposal_count）
 * Underestimates L3
 */
export function estimateLevel(cv: number, tasks: number): number {
  if (cv >= 800 && tasks >= 10) return 2;
  if (cv >= 200 && tasks >= 3) return 1;
  return 0;
}
