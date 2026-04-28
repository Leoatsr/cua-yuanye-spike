/**
 * questStore — single source of truth for quest progression state.
 *
 * Before F2.2: state lived inside QuestLog.tsx (useState + saveStates → localStorage).
 * After F2.2: this module owns the state. QuestLog subscribes via useSyncExternalStore.
 *
 * Each mutation (acceptQuest, submitQuest, etc.) does THREE things:
 *   1. update module state
 *   2. write localStorage (always — source of truth for offline)
 *   3. fire async cloud upsert (best-effort if logged in)
 *
 * Logic is moved verbatim from the original setStates(prev => ...) callbacks
 * — just relocated, not rewritten. UI behaviour unchanged.
 */

import type { QualityCoeff, ReviewerVote, ScheduledVote } from './reviewers';
import type { AppealReviewerVote, AppealScheduledVote } from './appealReviewers';
import { fireCloudWrite } from './cloudStore';

// ===== Types (mirrors what QuestLog.tsx had inline) =====

export type QuestStatus = 'available' | 'accepted' | 'reviewing' | 'submitted' | 'appealing';

export interface QuestState {
  status: QuestStatus;
  acceptedAt?: number;
  submittedAt?: number;
  submissionLink?: string;
  selfRated?: QualityCoeff;
  submissionId?: string;
  scheduledVotes?: ScheduledVote[];
  votes?: ReviewerVote[];
  // C-7
  finalCoeff?: number;
  cpEarned?: number;
  finalizedAt?: number;
  // C-9 appeal
  appealed?: boolean;
  appealId?: string;
  appealScheduledVotes?: AppealScheduledVote[];
  appealVotes?: AppealReviewerVote[];
  appealOutcome?: 'upgrade' | 'maintain' | 'declined';
  appealCoeff?: number;
  appealedAt?: number;
  appealResolvedAt?: number;
  // D5 draft + withdraw
  draftLink?: string;
  draftSelfRated?: QualityCoeff;
  withdrawDeadline?: number;
}

export type QuestStates = Record<string, QuestState>;

// ===== Storage =====

const STORAGE_KEY = 'cua-yuanye-quests-workshop-v2';

function loadFromLocalStorage(): QuestStates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as QuestStates;
    // Migration from v1
    const v1 = localStorage.getItem('cua-yuanye-quests-workshop-v1');
    if (v1) {
      const parsed = JSON.parse(v1) as Record<string, { status: string; submittedAt?: number; submissionLink?: string }>;
      const migrated: QuestStates = {};
      Object.entries(parsed).forEach(([id, s]) => {
        migrated[id] = {
          status: s.status === 'submitted' ? 'submitted' : (s.status as QuestStatus),
          submittedAt: s.submittedAt,
          submissionLink: s.submissionLink,
        };
      });
      return migrated;
    }
  } catch { /* ignore */ }
  return {};
}

function saveToLocalStorage(states: QuestStates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
}

// ===== Module-level state =====

let currentStates: QuestStates = loadFromLocalStorage();

// ===== Subscriber pattern =====

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function getQuestStatesSnapshot(): QuestStates {
  return currentStates;
}

export function subscribeQuestStates(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ===== Cloud write helper =====

function cloudUpsertQuest(questId: string, state: QuestState) {
  fireCloudWrite(`questUpsert:${questId}`, async (supabase, userId) => {
    return await supabase.from('quest_states').upsert({
      user_id: userId,
      quest_id: questId,
      state: state as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,quest_id' });
  });
}

// Internal: replace state for a single quest, persist + notify
function applyQuestState(questId: string, newState: QuestState | null) {
  // Create new top-level object (immutable update for React)
  const next = { ...currentStates };
  if (newState === null) {
    delete next[questId];
  } else {
    next[questId] = newState;
  }
  currentStates = next;
  saveToLocalStorage(currentStates);
  notify();
  if (newState !== null) {
    cloudUpsertQuest(questId, newState);
  }
}

// Initialize quests that don't exist yet (called from QuestLog mount).
// Mutates currentStates if any are missing; notifies if so.
export function ensureQuestStates(questIds: string[]) {
  let changed = false;
  const next = { ...currentStates };
  questIds.forEach((id) => {
    if (!next[id]) {
      next[id] = { status: 'available' };
      changed = true;
    }
  });
  if (changed) {
    currentStates = next;
    saveToLocalStorage(currentStates);
    notify();
  }
}

// ===== Mutations =====

export function acceptQuest(id: string) {
  applyQuestState(id, { status: 'accepted', acceptedAt: Date.now() });
}

export function saveDraft(id: string, link: string, selfRated: QualityCoeff) {
  const target = currentStates[id];
  if (!target || target.status !== 'accepted') return;
  applyQuestState(id, { ...target, draftLink: link, draftSelfRated: selfRated });
}

export function confirmSubmit(id: string, link: string, selfRated: QualityCoeff,
                              submissionId: string, scheduled: ScheduledVote[],
                              withdrawDeadline: number) {
  const target = currentStates[id];
  if (!target) return;
  applyQuestState(id, {
    ...target,
    status: 'reviewing',
    submittedAt: Date.now(),
    submissionLink: link.trim(),
    selfRated,
    submissionId,
    scheduledVotes: scheduled,
    votes: [],
    withdrawDeadline,
    draftLink: undefined,
    draftSelfRated: undefined,
  });
}

export function withdrawSubmissionState(id: string) {
  const target = currentStates[id];
  if (!target || target.status !== 'reviewing') return;
  applyQuestState(id, {
    status: 'accepted',
    acceptedAt: target.acceptedAt ?? Date.now(),
    draftLink: target.submissionLink,
    draftSelfRated: target.selfRated,
    submittedAt: undefined,
    submissionLink: undefined,
    selfRated: undefined,
    submissionId: undefined,
    scheduledVotes: undefined,
    votes: undefined,
    withdrawDeadline: undefined,
  });
}

/**
 * Add a reviewer vote. Returns the updated state if a vote was added.
 * Returns null if duplicate / not in reviewing state — caller should not emit toast.
 */
export function addReviewerVote(submissionId: string, vote: ReviewerVote): {
  questId: string;
  state: QuestState;
  isQuorum: boolean;
} | null {
  for (const [qid, s] of Object.entries(currentStates)) {
    if (s.submissionId === submissionId && s.status === 'reviewing') {
      const votes = [...(s.votes ?? [])];
      if (votes.some((v) => v.reviewerId === vote.reviewerId)) return null;
      votes.push(vote);
      const newState = { ...s, votes };
      applyQuestState(qid, newState);
      return { questId: qid, state: newState, isQuorum: votes.length >= 3 };
    }
  }
  return null;
}

export function finalizeQuest(taskId: string, submissionId: string, finalCoeff: number, cpEarned: number) {
  const target = currentStates[taskId];
  if (!target || target.submissionId !== submissionId) return;
  applyQuestState(taskId, {
    ...target,
    status: 'submitted',
    finalCoeff,
    cpEarned,
    finalizedAt: Date.now(),
  });
}

export function startAppealState(id: string, appealId: string, scheduled: AppealScheduledVote[]) {
  const target = currentStates[id];
  if (!target || target.appealed) return;
  applyQuestState(id, {
    ...target,
    status: 'appealing',
    appealed: true,
    appealId,
    appealScheduledVotes: scheduled,
    appealVotes: [],
    appealedAt: Date.now(),
  });
}

/**
 * Add an appeal reviewer vote. Returns updated state + quorum payload data.
 */
export function addAppealVote(appealId: string, vote: AppealReviewerVote): {
  questId: string;
  state: QuestState;
  isQuorum: boolean;
} | null {
  for (const [qid, s] of Object.entries(currentStates)) {
    if (s.appealId === appealId && s.status === 'appealing') {
      const votes = [...(s.appealVotes ?? [])];
      if (votes.some((v) => v.reviewerId === vote.reviewerId)) return null;
      votes.push(vote);
      const newState = { ...s, appealVotes: votes };
      applyQuestState(qid, newState);
      return { questId: qid, state: newState, isQuorum: votes.length >= 3 };
    }
  }
  return null;
}

export function finalizeAppeal(taskId: string, appealId: string, params: {
  outcome: 'upgrade' | 'maintain' | 'declined';
  appealCoeff: number;
  finalCoeff: number;
  newCp: number;
}) {
  const target = currentStates[taskId];
  if (!target || target.appealId !== appealId) return;
  applyQuestState(taskId, {
    ...target,
    status: 'submitted',
    appealOutcome: params.outcome,
    appealCoeff: params.appealCoeff,
    finalCoeff: params.outcome === 'upgrade' ? params.finalCoeff : target.finalCoeff,
    cpEarned: params.outcome === 'upgrade' ? params.newCp : target.cpEarned,
    appealResolvedAt: Date.now(),
  });
}

// ===== Bulk upload helper for CloudSyncButton =====

export function getAllQuestStatesAsRows(userId: string) {
  return Object.entries(currentStates).map(([questId, state]) => ({
    user_id: userId,
    quest_id: questId,
    state: state as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  }));
}

// ===== F2.3: pull-from-cloud helper =====

/**
 * Replace all local quest states with the given map (used by pull button).
 * Persists to localStorage AND notifies subscribers so React re-renders.
 */
export function replaceQuestStatesFromCloud(rows: Array<{ quest_id: string; state: QuestState }>) {
  const next: QuestStates = {};
  rows.forEach((row) => {
    next[row.quest_id] = row.state;
  });
  currentStates = next;
  saveToLocalStorage(currentStates);
  notify();
}
