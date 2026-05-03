import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';

interface QuorumPayload {
  taskId: string;
  questTitle: string;
  finalCoeff: number;
  cpEarned: number;
  triggerKey: number; // Date.now() · 让 toast useEffect 重新触发
}

/**
 * 监听 quest-finalized 事件 · 触发 quorum toast
 *
 * Wave 2.5.A.4
 *
 * 当面板打开时 · 收到 quest-finalized → 弹 toast
 * 关闭面板时停止监听
 */
export function useQuorumEvent(enabled: boolean): {
  quorumPayload: QuorumPayload | null;
  clearQuorum: () => void;
} {
  const [quorumPayload, setQuorumPayload] = useState<QuorumPayload | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const onFinalized = (data: {
      taskId: string;
      questTitle?: string;
      finalCoeff?: number;
      cpEarned?: number;
    }) => {
      setQuorumPayload({
        taskId: data.taskId,
        questTitle: data.questTitle ?? '任务',
        finalCoeff: data.finalCoeff ?? 1.0,
        cpEarned: data.cpEarned ?? 0,
        triggerKey: Date.now(),
      });
    };

    EventBus.on('quest-finalized', onFinalized);
    return () => {
      EventBus.off('quest-finalized', onFinalized);
    };
  }, [enabled]);

  const clearQuorum = () => setQuorumPayload(null);

  return { quorumPayload, clearQuorum };
}
