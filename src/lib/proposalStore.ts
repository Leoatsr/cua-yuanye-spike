/**
 * proposalStore — Council Hall proposals & votes data layer.
 *
 * Unlike CV/Mail/Quest/Review (which are per-user with localStorage mirror),
 * proposals are PUBLIC community data — no local cache needed. Every read
 * goes to Supabase directly.
 *
 * C6.3a covers: types + create + list (queryOpenProposals).
 * C6.3b/c/d will add: vote, finalize, realtime subscription.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { reportError } from './sentry';
import { refreshLevelAfterEvent } from './levelStore';

// ===== Types =====

export type ProposalCategory = 'rule' | 'feature' | 'event' | 'budget' | 'other';
export type ProposalStatus = 'open' | 'closed' | 'archived';
export type ProposalOutcome = 'passed' | 'rejected' | 'tied' | 'no_quorum';

export interface Proposal {
  id: string;
  author_id: string;
  author_name: string;
  title: string;
  description: string;
  category: ProposalCategory;
  status: ProposalStatus;
  closes_at: string;       // ISO timestamp
  created_at: string;
  yes_count: number;
  no_count: number;
  abstain_count: number;
  outcome: ProposalOutcome | null;
}

export interface CreateProposalInput {
  title: string;
  description: string;
  category: ProposalCategory;
  /** Voting duration in hours (defaults to 72 = 3 days) */
  durationHours?: number;
}

export type CreateProposalResult =
  | { ok: true; proposal: Proposal }
  | { ok: false; error: string };

// ===== Validation =====

const TITLE_MIN = 4;
const TITLE_MAX = 80;
const DESC_MIN = 10;
const DESC_MAX = 2000;
const DEFAULT_DURATION_HOURS = 72;
const MIN_DURATION_HOURS = 1;
const MAX_DURATION_HOURS = 24 * 30; // 30 days

export function validateProposalInput(input: CreateProposalInput): { ok: true } | { ok: false; error: string } {
  const title = input.title?.trim() ?? '';
  const description = input.description?.trim() ?? '';
  const duration = input.durationHours ?? DEFAULT_DURATION_HOURS;

  if (title.length < TITLE_MIN) return { ok: false, error: `标题太短（至少 ${TITLE_MIN} 字）` };
  if (title.length > TITLE_MAX) return { ok: false, error: `标题太长（不超过 ${TITLE_MAX} 字）` };
  if (description.length < DESC_MIN) return { ok: false, error: `描述太短（至少 ${DESC_MIN} 字）` };
  if (description.length > DESC_MAX) return { ok: false, error: `描述太长（不超过 ${DESC_MAX} 字）` };
  if (!['rule', 'feature', 'event', 'budget', 'other'].includes(input.category)) {
    return { ok: false, error: '分类无效' };
  }
  if (duration < MIN_DURATION_HOURS || duration > MAX_DURATION_HOURS) {
    return { ok: false, error: `投票期限应在 ${MIN_DURATION_HOURS} - ${MAX_DURATION_HOURS} 小时之间` };
  }

  return { ok: true };
}

// ===== Helpers =====

async function getCurrentAuth(): Promise<{ supabase: SupabaseClient; userId: string; userName: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const meta = user.user_metadata ?? {};
  const userName = (meta.user_name ?? meta.preferred_username ?? meta.full_name ?? user.email ?? 'unknown') as string;

  return { supabase, userId: user.id, userName };
}

// ===== Operations =====

/**
 * Create a new proposal. Returns the created row on success.
 * Caller must already be logged in.
 */
export async function createProposal(input: CreateProposalInput): Promise<CreateProposalResult> {
  // Validate first
  const v = validateProposalInput(input);
  if (!v.ok) return { ok: false, error: v.error };

  const auth = await getCurrentAuth();
  if (!auth) return { ok: false, error: '请先登录 GitHub' };

  const duration = input.durationHours ?? DEFAULT_DURATION_HOURS;
  const closesAt = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();

  const { data, error } = await auth.supabase
    .from('proposals')
    .insert({
      author_id: auth.userId,
      author_name: auth.userName,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      status: 'open',
      closes_at: closesAt,
    })
    .select()
    .single();

  if (error) {
    reportError('proposal-create', error, { userId: auth.userId });
    return { ok: false, error: `创建失败：${error.message}` };
  }

  // F5.0: refresh level after proposal creation — may trigger level-up
  void refreshLevelAfterEvent();

  return { ok: true, proposal: data as Proposal };
}

/**
 * List open proposals, sorted by creation time desc.
 * Returns empty array on error (with Sentry report).
 */
export async function listOpenProposals(limit = 50): Promise<Proposal[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    reportError('proposals-list', error);
    return [];
  }
  return (data ?? []) as Proposal[];
}

/**
 * Fetch a single proposal by id.
 */
export async function getProposalById(id: string): Promise<Proposal | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    reportError('proposal-get', error, { id });
    return null;
  }
  return (data as Proposal | null) ?? null;
}

// ===== Constants exposed for UI =====

export const CATEGORY_LABELS: Record<ProposalCategory, string> = {
  rule: '章程修订',
  feature: '功能提案',
  event: '活动议程',
  budget: '预算分配',
  other: '其他',
};

export const VALIDATION_LIMITS = {
  TITLE_MIN, TITLE_MAX, DESC_MIN, DESC_MAX,
  DEFAULT_DURATION_HOURS, MIN_DURATION_HOURS, MAX_DURATION_HOURS,
};

// ============================================================================
// C6.3c · 投票相关
// ============================================================================

export type VoteValue = 'yes' | 'no' | 'abstain';

export interface ProposalVote {
  proposal_id: string;
  voter_id: string;
  voter_name: string;
  vote: VoteValue;
  comment: string | null;
  voted_at: string;
}

export type CastVoteResult =
  | { ok: true; vote: ProposalVote }
  | { ok: false; error: string };

const COMMENT_MAX = 500;

/**
 * Cast or change a vote on a proposal. Uses upsert — if the user already
 * voted, this overwrites (changing their vote). DB-side PK constraint on
 * (proposal_id, voter_id) enforces "one vote per person".
 *
 * Caller must ensure the proposal is still 'open' (closed proposals reject via RLS).
 */
export async function castVote(
  proposalId: string,
  vote: VoteValue,
  comment?: string,
): Promise<CastVoteResult> {
  const auth = await getCurrentAuth();
  if (!auth) return { ok: false, error: '请先登录 GitHub' };

  const trimmedComment = (comment ?? '').trim();
  if (trimmedComment.length > COMMENT_MAX) {
    return { ok: false, error: `备注太长（不超过 ${COMMENT_MAX} 字）` };
  }

  // First check the proposal is still open
  const { data: proposal, error: pErr } = await auth.supabase
    .from('proposals')
    .select('status, closes_at')
    .eq('id', proposalId)
    .maybeSingle();

  if (pErr) {
    reportError('vote-precheck', pErr, { proposalId });
    return { ok: false, error: `查询提案失败：${pErr.message}` };
  }
  if (!proposal) return { ok: false, error: '提案不存在' };
  if (proposal.status !== 'open') return { ok: false, error: '提案已关闭，不能投票' };
  if (new Date(proposal.closes_at).getTime() <= Date.now()) {
    return { ok: false, error: '投票期限已过' };
  }

  const { data, error } = await auth.supabase
    .from('proposal_votes')
    .upsert({
      proposal_id: proposalId,
      voter_id: auth.userId,
      voter_name: auth.userName,
      vote,
      comment: trimmedComment || null,
      voted_at: new Date().toISOString(),
    }, { onConflict: 'proposal_id,voter_id' })
    .select()
    .single();

  if (error) {
    reportError('cast-vote', error, { proposalId, vote });
    return { ok: false, error: `投票失败：${error.message}` };
  }

  return { ok: true, vote: data as ProposalVote };
}

/**
 * Withdraw the current user's vote on a proposal (delete the row).
 * If they haven't voted, no-op (returns ok).
 */
export async function withdrawVote(proposalId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getCurrentAuth();
  if (!auth) return { ok: false, error: '请先登录 GitHub' };

  const { error } = await auth.supabase
    .from('proposal_votes')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('voter_id', auth.userId);

  if (error) {
    reportError('withdraw-vote', error, { proposalId });
    return { ok: false, error: `撤回失败：${error.message}` };
  }
  return { ok: true };
}

/**
 * Get the current user's vote on a proposal, if any.
 * Returns null if not logged in or hasn't voted.
 */
export async function getMyVote(proposalId: string): Promise<ProposalVote | null> {
  const auth = await getCurrentAuth();
  if (!auth) return null;

  const { data, error } = await auth.supabase
    .from('proposal_votes')
    .select('*')
    .eq('proposal_id', proposalId)
    .eq('voter_id', auth.userId)
    .maybeSingle();

  if (error) {
    reportError('get-my-vote', error, { proposalId });
    return null;
  }
  return (data as ProposalVote | null) ?? null;
}

/**
 * List all votes on a proposal (for displaying who voted what).
 * Returns sorted by voted_at desc.
 */
export async function listVotes(proposalId: string): Promise<ProposalVote[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('proposal_votes')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('voted_at', { ascending: false });

  if (error) {
    reportError('list-votes', error, { proposalId });
    return [];
  }
  return (data ?? []) as ProposalVote[];
}

export const VOTE_LABELS: Record<VoteValue, string> = {
  yes: '赞成',
  no: '反对',
  abstain: '弃权',
};

export const VOTE_COLORS: Record<VoteValue, string> = {
  yes: '#7fc090',
  no: '#c08070',
  abstain: '#a8a08e',
};

// ============================================================================
// C6.3d · 决议归档 + Realtime 订阅
// ============================================================================

export const OUTCOME_LABELS: Record<NonNullable<ProposalOutcome>, string> = {
  passed: '通过',
  rejected: '驳回',
  tied: '平票',
  no_quorum: '不达法定人数',
};

export const OUTCOME_COLORS: Record<NonNullable<ProposalOutcome>, string> = {
  passed: '#7fc090',
  rejected: '#c08070',
  tied: '#b8a472',
  no_quorum: '#8a8576',
};

/**
 * Find all expired open proposals and finalize them (compute outcome + close).
 * Lazy approach — called when the player opens the proposal list.
 * Returns number of proposals finalized this call.
 */
export async function finalizeOverdueProposals(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const { data, error } = await supabase.rpc('finalize_overdue_proposals');
  if (error) {
    reportError('finalize-overdue', error);
    return 0;
  }
  return (data as number) ?? 0;
}

/**
 * List closed (archived) proposals, most recently closed first.
 */
export async function listClosedProposals(limit = 50): Promise<Proposal[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('status', 'closed')
    .order('closes_at', { ascending: false })
    .limit(limit);

  if (error) {
    reportError('proposals-list-closed', error);
    return [];
  }
  return (data ?? []) as Proposal[];
}

/**
 * Subscribe to changes on proposal_votes (any vote change anywhere) AND
 * proposals (status / count updates). Calls onChange whenever something
 * happens. Returns unsubscribe function.
 *
 * Filtering is up to the caller — the callback is fired for ALL changes.
 */
export function subscribeProposalChanges(onChange: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const channel = supabase
    .channel('proposals-realtime')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'proposal_votes' },
      () => onChange(),
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'proposals' },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
