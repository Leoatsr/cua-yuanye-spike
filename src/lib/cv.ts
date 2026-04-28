/**
 * CV (Contribution Value) ledger.
 *
 * F2.0: Dual-track storage —
 * - Always reads/writes localStorage (source of truth)
 * - If logged in, also writes to Supabase cloud (best-effort, async)
 * - On future device, cloud syncs back into localStorage at login (F2.3)
 *
 * Public API unchanged from C-7. Caller code (ReviewProcessor, CVDisplay,
 * ReviewPanel) keeps working without changes.
 */

import { fireCloudWrite } from './cloudStore';
import { refreshLevelAfterEvent } from './levelStore';

const STORAGE_KEY = 'cua-yuanye-cv-ledger-v1';

export interface CVEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  workshop: string;
  coefficient: number;
  baseCp: number;
  cpEarned: number;
  earnedAt: number;
}

interface CVLedger {
  totalCV: number;
  entries: CVEntry[];
}

function loadLedger(): CVLedger {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CVLedger;
  } catch { /* ignore */ }
  return { totalCV: 0, entries: [] };
}

function saveLedger(ledger: CVLedger) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
}

export function getTotalCV(): number {
  return loadLedger().totalCV;
}

export function getCVEntries(): CVEntry[] {
  return loadLedger().entries;
}

/**
 * Add a CV entry (idempotent on submissionId).
 * Writes to localStorage immediately, schedules a cloud write if logged in.
 */
export function addCVEntry(params: {
  submissionId: string;
  taskId: string;
  taskTitle: string;
  workshop: string;
  coefficient: number;
  baseCp: number;
}): CVEntry | null {
  const ledger = loadLedger();
  if (ledger.entries.some((e) => e.id === params.submissionId)) {
    return null;
  }

  const cpEarned = Math.round(params.baseCp * params.coefficient);
  const entry: CVEntry = {
    id: params.submissionId,
    taskId: params.taskId,
    taskTitle: params.taskTitle,
    workshop: params.workshop,
    coefficient: params.coefficient,
    baseCp: params.baseCp,
    cpEarned,
    earnedAt: Date.now(),
  };

  ledger.entries.unshift(entry);
  ledger.totalCV += cpEarned;
  saveLedger(ledger);

  // F2.0: also write to cloud if logged in (best-effort, async)
  fireCloudWrite('addCVEntry', async (supabase, userId) => {
    return await supabase.from('cv_entries').upsert({
      user_id: userId,
      submission_id: entry.id,
      task_id: entry.taskId,
      task_title: entry.taskTitle,
      workshop: entry.workshop,
      coefficient: entry.coefficient,
      base_cp: entry.baseCp,
      cp_earned: entry.cpEarned,
      earned_at: new Date(entry.earnedAt).toISOString(),
    });
  });

  // F5.0: refresh level after CV gain — may trigger level-up animation
  void refreshLevelAfterEvent();

  return entry;
}

export function computeFinalCoefficient(coeffs: number[]): number {
  if (coeffs.length === 0) return 1.0;
  const sorted = [...coeffs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// ===== F2.3: pull-from-cloud helper =====

/**
 * Replace local CV ledger with the given entries (used by pull button).
 * Recomputes totalCV from the entries.
 */
export function replaceCVLedgerFromCloud(entries: CVEntry[]) {
  const totalCV = entries.reduce((sum, e) => sum + e.cpEarned, 0);
  const ledger: CVLedger = { totalCV, entries };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
}
