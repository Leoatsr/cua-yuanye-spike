import { useEffect, useSyncExternalStore } from 'react';
import {
  type QuestStates,
  getQuestStatesSnapshot,
  subscribeQuestStates,
  ensureQuestStates,
} from '../lib/questStore';
import { QUESTS } from '../lib/questDefinitions';

/**
 * 监听 questStore 状态机
 *
 * Mount 时自动 ensureQuestStates(全部 5 任务)
 * 用 useSyncExternalStore 订阅 store 变化
 */
export function useQuestStates(): QuestStates {
  const states = useSyncExternalStore(
    subscribeQuestStates,
    getQuestStatesSnapshot,
    getQuestStatesSnapshot,
  );

  useEffect(() => {
    ensureQuestStates(QUESTS.map((q) => q.id));
  }, []);

  return states;
}
