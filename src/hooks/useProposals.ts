import { useEffect, useState, useCallback } from 'react';
import {
  listOpenProposals,
  listClosedProposals,
  finalizeOverdueProposals,
  subscribeProposalChanges,
  type Proposal,
} from '../lib/proposalStore';

interface UseProposalsResult {
  openProposals: Proposal[];
  closedProposals: Proposal[];
  loading: boolean;
  error: string | null;
  /** 主动刷新 */
  reload: () => Promise<void>;
  /** 调过的 finalizeOverdueProposals 数量（开面板时自动调一次） */
  finalizedCount: number;
}

/**
 * 拉提案列表 + 监听 realtime 投票变更
 *
 * Mount 时:
 *   1. 先 finalizeOverdueProposals (关闭过期提案)
 *   2. 拉 open + closed 列表
 *   3. 订阅 proposal_votes realtime 变更 → 自动 reload
 *
 * Args:
 *   active: 是否激活订阅（关 panel 时省 realtime 订阅）
 */
export function useProposals(active: boolean): UseProposalsResult {
  const [openProposals, setOpenProposals] = useState<Proposal[]>([]);
  const [closedProposals, setClosedProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizedCount, setFinalizedCount] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [openList, closedList] = await Promise.all([
        listOpenProposals(50),
        listClosedProposals(50),
      ]);
      setOpenProposals(openList);
      setClosedProposals(closedList);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载提案失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const init = async () => {
      const count = await finalizeOverdueProposals();
      if (cancelled) return;
      setFinalizedCount(count);
      await reload();
    };
    void init();

    const unsub = subscribeProposalChanges(() => {
      if (!cancelled) void reload();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [active, reload]);

  return {
    openProposals,
    closedProposals,
    loading,
    error,
    reload,
    finalizedCount,
  };
}
