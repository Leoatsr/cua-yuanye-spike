import { useEffect, useState, useCallback, useRef } from 'react';
import { EventBus } from '../game/EventBus';
import {
  listOpenProposals,
  listClosedProposals,
  finalizeOverdueProposals,
  subscribeProposalChanges,
  getProposalById,
  castVote,
  withdrawVote,
  getMyVote,
  CATEGORY_LABELS,
  VOTE_LABELS,
  VOTE_COLORS,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
  type Proposal,
  type ProposalCategory,
  type ProposalVote,
  type VoteValue,
} from '../lib/proposalStore';
import { RequiresLevel, checkLevelRequirement } from './RequiresLevel';

const VOTE_REQUIRED_LEVEL = 1;  // F5.1: 投票需 L1 活跃贡献者

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';
type CategoryFilter = ProposalCategory | 'all';
type TabKey = 'open' | 'closed';

/**
 * Council Hall · Proposals list (open + archived).
 * Triggered via EventBus 'open-proposal-list'.
 *
 * C6.3d adds:
 *  - "公示中" / "已决议" tabs
 *  - Lazy finalization (calls finalize_overdue_proposals on open)
 *  - Realtime subscription to proposal_votes changes
 *  - Outcome badges on closed proposals
 */
export function ProposalListPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('open');
  const [openProposals, setOpenProposals] = useState<Proposal[]>([]);
  const [closedProposals, setClosedProposals] = useState<Proposal[]>([]);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [finalizedCount, setFinalizedCount] = useState(0);

  // Use ref so the realtime callback always has fresh values
  const openRef = useRef(open);
  openRef.current = open;

  const reload = useCallback(async () => {
    setStatus('loading');
    const [openList, closedList] = await Promise.all([
      listOpenProposals(50),
      listClosedProposals(50),
    ]);
    setOpenProposals(openList);
    setClosedProposals(closedList);
    setStatus('loaded');
  }, []);

  useEffect(() => {
    const onOpen = async () => {
      setOpen(true);
      setSelected(null);
      setFilter('all');

      // Lazy finalize first — close any expired proposals
      const count = await finalizeOverdueProposals();
      setFinalizedCount(count);

      // Then load both lists
      await reload();
    };
    EventBus.on('open-proposal-list', onOpen);

    const onProposalCreated = () => {
      if (openRef.current) reload();
    };
    EventBus.on('proposal-created', onProposalCreated);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selected) {
          setSelected(null);
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      EventBus.off('open-proposal-list', onOpen);
      EventBus.off('proposal-created', onProposalCreated);
      window.removeEventListener('keydown', onKey);
    };
  }, [selected, reload]);

  // Realtime subscription — only active while panel is open
  useEffect(() => {
    if (!open) return;

    // Debounce reloads — multiple rapid changes coalesce into one fetch
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        reload();
      }, 400);
    };

    const unsub = subscribeProposalChanges(debouncedReload);

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [open, reload]);

  if (!open) return null;

  const currentList = tab === 'open' ? openProposals : closedProposals;
  const filtered = filter === 'all'
    ? currentList
    : currentList.filter((p) => p.category === filter);

  const handleNew = () => {
    EventBus.emit('open-create-proposal');
  };

  return (
    <div
      onClick={() => {
        if (!selected) setOpen(false);
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(8, 12, 18, 0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-start', overflowY: 'auto',
        padding: '40px 24px',
        backdropFilter: 'blur(3px)',
        animation: 'proposalListFadeIn 0.3s ease-out',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 760, width: '100%',
          background: 'linear-gradient(180deg, #1a1812 0%, #0f0d08 100%)',
          border: '1px solid rgba(184, 137, 58, 0.4)',
          borderRadius: 6,
          padding: '32px 36px 36px',
          boxShadow: '0 12px 50px rgba(0, 0, 0, 0.7)',
          color: '#f5f0e0',
          minHeight: 480,
        }}
      >
        {/* Header */}
        <div style={{
          borderBottom: '1px solid rgba(184, 137, 58, 0.25)',
          paddingBottom: 18, marginBottom: 16,
          display: 'flex', alignItems: 'flex-end', gap: 16,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11, letterSpacing: '0.25em',
              color: '#b8893a', textTransform: 'uppercase', marginBottom: 6,
            }}>
              COUNCIL HALL · PROPOSALS
            </div>
            <div style={{
              fontFamily: 'serif', fontSize: 24, fontWeight: 600,
              color: '#f5f0e0', letterSpacing: '0.06em',
            }}>
              提案公示板
            </div>
            <div style={{
              fontSize: 12, color: '#8a8576', marginTop: 6, lineHeight: 1.7,
            }}>
              {finalizedCount > 0
                ? `刚刚归档 ${finalizedCount} 件已截止提案 · 公示中 ${openProposals.length} · 已决议 ${closedProposals.length}`
                : `公示中 ${openProposals.length} · 已决议 ${closedProposals.length}`}
            </div>
          </div>
          {tab === 'open' && (
            <button
              onClick={handleNew}
              style={{
                padding: '8px 18px', fontSize: 12, fontWeight: 600,
                background: 'rgba(184, 137, 58, 0.2)',
                color: '#e0b060',
                border: '1px solid rgba(184, 137, 58, 0.6)',
                borderRadius: 3, cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
              }}
            >
              ＋ 新建提案
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0, marginBottom: 16,
          borderBottom: '1px solid rgba(184, 137, 58, 0.15)',
        }}>
          <TabButton
            label="📋 公示中"
            count={openProposals.length}
            active={tab === 'open'}
            onClick={() => { setTab('open'); setFilter('all'); }}
          />
          <TabButton
            label="📜 已决议"
            count={closedProposals.length}
            active={tab === 'closed'}
            onClick={() => { setTab('closed'); setFilter('all'); }}
          />
        </div>

        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap',
        }}>
          <FilterChip
            label="全部"
            active={filter === 'all'}
            count={currentList.length}
            onClick={() => setFilter('all')}
          />
          {(Object.keys(CATEGORY_LABELS) as ProposalCategory[]).map((cat) => {
            const count = currentList.filter((p) => p.category === cat).length;
            return (
              <FilterChip
                key={cat}
                label={CATEGORY_LABELS[cat]}
                active={filter === cat}
                count={count}
                onClick={() => setFilter(cat)}
              />
            );
          })}
        </div>

        {/* Body */}
        {status === 'loading' && (
          <div style={emptyStateStyle}>读取中...</div>
        )}

        {status === 'loaded' && filtered.length === 0 && (
          <div style={emptyStateStyle}>
            {tab === 'open'
              ? `（案桌空空——尚无${filter === 'all' ? '' : CATEGORY_LABELS[filter as ProposalCategory]}公示中提案）`
              : `（尚无${filter === 'all' ? '' : CATEGORY_LABELS[filter as ProposalCategory]}已决议提案）`}
            {tab === 'open' && (
              <div style={{ fontSize: 11, color: '#4a463e', marginTop: 8 }}>
                点 "新建提案" 写下第一条
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div style={emptyStateStyle}>读取失败 · 请重试</div>
        )}

        {status === 'loaded' && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((p) => (
              <ProposalRow key={p.id} proposal={p} onClick={() => setSelected(p)} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 28, paddingTop: 16,
          borderTop: '1px solid rgba(184, 137, 58, 0.15)',
          textAlign: 'center',
          fontSize: 11, color: '#4a463e',
        }}>
          点击空白或按 Esc 关闭
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <ProposalDetailModal
          proposal={selected}
          onClose={() => setSelected(null)}
          onVoted={(updated) => {
            setSelected(updated);
            // Update both lists in case status changes (rare in voting flow)
            setOpenProposals((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            );
            setClosedProposals((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            );
          }}
        />
      )}

      <style>{`
        @keyframes proposalListFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ===== Sub-components =====

function TabButton({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 18px', fontSize: 13,
        background: 'transparent',
        color: active ? '#e0b060' : '#8a8576',
        border: 'none',
        borderBottom: `2px solid ${active ? '#b8893a' : 'transparent'}`,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: active ? 600 : 400,
        marginBottom: -1,
        transition: 'all 0.15s',
      }}
    >
      {label}
      <span style={{
        marginLeft: 8,
        fontSize: 11,
        opacity: 0.75,
        fontFamily: 'monospace',
      }}>
        {count}
      </span>
    </button>
  );
}

function FilterChip({ label, active, count, onClick }: {
  label: string; active: boolean; count: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', fontSize: 11,
        background: active ? 'rgba(184, 137, 58, 0.2)' : 'transparent',
        color: active ? '#e0b060' : '#a8a08e',
        border: `1px solid ${active ? 'rgba(184, 137, 58, 0.5)' : 'rgba(168, 179, 160, 0.2)'}`,
        borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          marginLeft: 5,
          fontSize: 10,
          opacity: 0.7,
          fontFamily: 'monospace',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function ProposalRow({ proposal, onClick }: { proposal: Proposal; onClick: () => void }) {
  const closesIn = formatTimeRemaining(proposal.closes_at);
  const isExpired = new Date(proposal.closes_at).getTime() <= Date.now();
  const isClosed = proposal.status === 'closed';
  const totalVotes = proposal.yes_count + proposal.no_count + proposal.abstain_count;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 16px',
        background: isClosed
          ? 'rgba(168, 179, 160, 0.04)'
          : 'rgba(184, 137, 58, 0.05)',
        border: isClosed
          ? '1px solid rgba(168, 179, 160, 0.15)'
          : '1px solid rgba(184, 137, 58, 0.2)',
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isClosed
          ? 'rgba(168, 179, 160, 0.08)'
          : 'rgba(184, 137, 58, 0.1)';
        e.currentTarget.style.borderColor = isClosed
          ? 'rgba(168, 179, 160, 0.3)'
          : 'rgba(184, 137, 58, 0.45)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isClosed
          ? 'rgba(168, 179, 160, 0.04)'
          : 'rgba(184, 137, 58, 0.05)';
        e.currentTarget.style.borderColor = isClosed
          ? 'rgba(168, 179, 160, 0.15)'
          : 'rgba(184, 137, 58, 0.2)';
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 12, marginBottom: 6, flexWrap: 'wrap',
      }}>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: isClosed ? '#c8c0a8' : '#f5f0e0',
          flex: 1, minWidth: 200,
        }}>
          {proposal.title}
        </div>
        {/* Outcome badge for closed, category badge for open */}
        {isClosed && proposal.outcome ? (
          <span style={{
            fontSize: 10, fontFamily: 'monospace',
            color: OUTCOME_COLORS[proposal.outcome],
            letterSpacing: '0.08em',
            background: `${OUTCOME_COLORS[proposal.outcome]}1a`,
            padding: '2px 8px', borderRadius: 2,
            border: `1px solid ${OUTCOME_COLORS[proposal.outcome]}55`,
            fontWeight: 600,
          }}>
            {OUTCOME_LABELS[proposal.outcome]}
          </span>
        ) : (
          <span style={{
            fontSize: 10, fontFamily: 'monospace',
            color: '#b8893a', letterSpacing: '0.08em',
            background: 'rgba(184, 137, 58, 0.1)',
            padding: '1px 6px', borderRadius: 2,
          }}>
            {CATEGORY_LABELS[proposal.category]}
          </span>
        )}
      </div>
      <div style={{
        fontSize: 12, color: '#a8a08e', lineHeight: 1.55,
        marginBottom: 8,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {proposal.description}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 11, color: '#6e6856', flexWrap: 'wrap', gap: 8,
      }}>
        <span>提案人：{proposal.author_name}</span>
        <span style={{
          fontFamily: 'monospace',
          color: isClosed ? '#8a8576' : (isExpired ? '#c08070' : '#a8a08e'),
        }}>
          {isClosed
            ? `共 ${totalVotes} 票 · ${proposal.yes_count}赞/${proposal.no_count}反/${proposal.abstain_count}弃`
            : isExpired
              ? '已截止（待归档）'
              : `剩 ${closesIn}`}
        </span>
      </div>
    </div>
  );
}

function ProposalDetailModal({ proposal, onClose, onVoted }: {
  proposal: Proposal;
  onClose: () => void;
  onVoted: (updated: Proposal) => void;
}) {
  const [myVote, setMyVote] = useState<ProposalVote | null>(null);
  const [loadingVote, setLoadingVote] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Load my existing vote when modal opens
  useEffect(() => {
    let active = true;
    setLoadingVote(true);
    getMyVote(proposal.id).then((v) => {
      if (!active) return;
      setMyVote(v);
      setComment(v?.comment ?? '');
      setLoadingVote(false);
    });
    return () => { active = false; };
  }, [proposal.id]);

  const isExpired = new Date(proposal.closes_at).getTime() <= Date.now();
  const isClosed = proposal.status === 'closed' || isExpired;
  const totalVotes = proposal.yes_count + proposal.no_count + proposal.abstain_count;

  const handleVote = async (value: VoteValue) => {
    if (submitting || isClosed) return;

    // F5.1: server-side level check (defense in depth)
    const levelCheck = await checkLevelRequirement(VOTE_REQUIRED_LEVEL);
    if (!levelCheck.ok) {
      setErrorMsg(levelCheck.reason ?? '等级不足');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const result = await castVote(proposal.id, value, comment);
    if (!result.ok) {
      setErrorMsg(result.error);
      setSubmitting(false);
      return;
    }

    // Refresh proposal to get updated counts (trigger ran)
    // Small delay to ensure trigger has propagated
    await new Promise((r) => setTimeout(r, 200));
    const updated = await getProposalById(proposal.id);
    if (updated) {
      onVoted(updated);
    }
    setMyVote(result.vote);
    EventBus.emit('show-toast', {
      text: `🗳️ 已${VOTE_LABELS[value]}「${proposal.title.slice(0, 12)}${proposal.title.length > 12 ? '...' : ''}」`,
    });
    setSubmitting(false);
  };

  const handleWithdraw = async () => {
    if (submitting || isClosed || !myVote) return;
    setSubmitting(true);
    setErrorMsg('');

    const result = await withdrawVote(proposal.id);
    if (!result.ok) {
      setErrorMsg(result.error);
      setSubmitting(false);
      return;
    }

    await new Promise((r) => setTimeout(r, 200));
    const updated = await getProposalById(proposal.id);
    if (updated) {
      onVoted(updated);
    }
    setMyVote(null);
    setComment('');
    EventBus.emit('show-toast', { text: '↩️ 已撤回投票' });
    setSubmitting(false);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 700,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 600, width: '100%', maxHeight: '85vh', overflowY: 'auto',
          background: '#1a1812',
          border: '1px solid rgba(184, 137, 58, 0.5)',
          borderRadius: 4,
          padding: '28px 32px',
          color: '#f5f0e0',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
        }}
      >
        <div style={{
          fontSize: 10, letterSpacing: '0.2em', color: '#b8893a',
          textTransform: 'uppercase', marginBottom: 8,
        }}>
          {CATEGORY_LABELS[proposal.category]} · 提案 #{proposal.id.slice(0, 8)}
        </div>
        <div style={{
          fontFamily: 'serif', fontSize: 22, fontWeight: 600,
          marginBottom: 12, lineHeight: 1.3,
        }}>
          {proposal.title}
        </div>
        <div style={{
          fontSize: 12, color: '#8a8576', marginBottom: 18,
          display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          <span>提案人：{proposal.author_name}</span>
          <span>创建：{formatDate(proposal.created_at)}</span>
          <span style={{
            color: isExpired ? '#c08070' : '#a8a08e',
            fontFamily: 'monospace',
          }}>
            {isExpired ? '已截止' : `截止：${formatDate(proposal.closes_at)}`}
          </span>
        </div>
        <div style={{
          fontSize: 13, color: '#c8c0a8', lineHeight: 1.8,
          padding: '16px 18px',
          background: 'rgba(168, 179, 160, 0.04)',
          borderLeft: '2px solid rgba(184, 137, 58, 0.4)',
          marginBottom: 24,
          whiteSpace: 'pre-wrap',
        }}>
          {proposal.description}
        </div>

        {/* Vote summary with bar */}
        <div style={{
          padding: '14px 16px',
          background: 'rgba(184, 137, 58, 0.06)',
          border: '1px solid rgba(184, 137, 58, 0.2)',
          borderRadius: 3,
          marginBottom: 18,
        }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.15em',
            color: '#b8893a', marginBottom: 10, fontFamily: 'monospace',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>投票汇总</span>
            <span>共 {totalVotes} 票</span>
          </div>
          <VoteBar
            yes={proposal.yes_count}
            no={proposal.no_count}
            abstain={proposal.abstain_count}
          />
          <div style={{
            display: 'flex', gap: 18, fontSize: 13, color: '#a8a08e',
            marginTop: 10, justifyContent: 'space-around',
          }}>
            <span>赞成 <strong style={{ color: VOTE_COLORS.yes }}>{proposal.yes_count}</strong></span>
            <span>反对 <strong style={{ color: VOTE_COLORS.no }}>{proposal.no_count}</strong></span>
            <span>弃权 <strong style={{ color: VOTE_COLORS.abstain }}>{proposal.abstain_count}</strong></span>
          </div>
        </div>

        {/* Voting area */}
        {loadingVote ? (
          <div style={{
            padding: 16, textAlign: 'center',
            fontSize: 12, color: '#6e6856',
          }}>
            读取你的投票状态...
          </div>
        ) : isClosed ? (
          <div style={{
            padding: '16px 18px',
            background: proposal.outcome
              ? `${OUTCOME_COLORS[proposal.outcome]}10`
              : 'rgba(168, 179, 160, 0.06)',
            border: proposal.outcome
              ? `1px solid ${OUTCOME_COLORS[proposal.outcome]}55`
              : '1px solid rgba(168, 179, 160, 0.2)',
            borderRadius: 3,
            textAlign: 'center',
            fontSize: 13,
            lineHeight: 1.7,
          }}>
            {proposal.outcome ? (
              <>
                <div style={{
                  fontSize: 11, letterSpacing: '0.2em',
                  color: '#8a8576', textTransform: 'uppercase',
                  marginBottom: 8,
                }}>
                  Decision
                </div>
                <div style={{
                  fontFamily: 'serif', fontSize: 20, fontWeight: 600,
                  color: OUTCOME_COLORS[proposal.outcome],
                  marginBottom: 6,
                }}>
                  📜 {OUTCOME_LABELS[proposal.outcome]}
                </div>
                <div style={{ fontSize: 11, color: '#8a8576' }}>
                  {proposal.outcome === 'no_quorum'
                    ? '总投票数不足 3 票，未达法定人数'
                    : proposal.outcome === 'tied'
                      ? '赞成与反对票数相等，提案搁置'
                      : proposal.outcome === 'passed'
                        ? `赞成 ${proposal.yes_count} > 反对 ${proposal.no_count}，提案通过`
                        : `反对 ${proposal.no_count} > 赞成 ${proposal.yes_count}，提案驳回`}
                </div>
              </>
            ) : (
              <div style={{ color: '#8a8576' }}>
                🔒 投票已截止 · 等待下次访问时归档
                {myVote && (
                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    你曾投：<strong style={{ color: VOTE_COLORS[myVote.vote] }}>
                      {VOTE_LABELS[myVote.vote]}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <RequiresLevel min={VOTE_REQUIRED_LEVEL} action="投票" blockMode="replace">
          <div>
            <div style={{
              fontSize: 11, letterSpacing: '0.15em',
              color: '#b8893a', marginBottom: 10, fontFamily: 'monospace',
            }}>
              {myVote ? '你的投票（点击改投）' : '投出一票'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['yes', 'no', 'abstain'] as VoteValue[]).map((v) => (
                <button
                  key={v}
                  onClick={() => handleVote(v)}
                  disabled={submitting}
                  style={{
                    flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 600,
                    background: myVote?.vote === v
                      ? `${VOTE_COLORS[v]}33`
                      : 'transparent',
                    color: myVote?.vote === v ? VOTE_COLORS[v] : '#a8a08e',
                    border: `1px solid ${myVote?.vote === v ? VOTE_COLORS[v] + '99' : 'rgba(168, 179, 160, 0.25)'}`,
                    borderRadius: 3,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                    opacity: submitting ? 0.5 : 1,
                  }}
                >
                  {v === 'yes' ? '✓ 赞成'
                    : v === 'no' ? '✗ 反对'
                    : '— 弃权'}
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              placeholder={myVote ? '改一下备注...' : '可附言（可选 · 最多 500 字）'}
              rows={2}
              disabled={submitting}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 10px',
                background: 'rgba(168, 179, 160, 0.04)',
                border: '1px solid rgba(168, 179, 160, 0.2)',
                borderRadius: 3,
                color: '#f5f0e0',
                fontSize: 12,
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
              }}
            />

            {myVote && (
              <button
                onClick={handleWithdraw}
                disabled={submitting}
                style={{
                  marginTop: 10,
                  padding: '6px 14px', fontSize: 11,
                  background: 'transparent',
                  color: '#8a8576',
                  border: '1px solid rgba(168, 179, 160, 0.2)',
                  borderRadius: 3,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ↩️ 撤回投票
              </button>
            )}

            {errorMsg && (
              <div style={{
                marginTop: 12, padding: '8px 12px',
                background: 'rgba(192, 128, 112, 0.1)',
                border: '1px solid rgba(192, 128, 112, 0.3)',
                borderRadius: 3,
                fontSize: 12, color: '#e0a090',
              }}>
                ⚠️ {errorMsg}
              </div>
            )}
          </div>
          </RequiresLevel>
        )}

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', fontSize: 12,
              background: 'transparent',
              color: '#a8a08e',
              border: '1px solid rgba(168, 179, 160, 0.3)',
              borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function VoteBar({ yes, no, abstain }: { yes: number; no: number; abstain: number }) {
  const total = yes + no + abstain;
  if (total === 0) {
    return (
      <div style={{
        height: 8, background: 'rgba(168, 179, 160, 0.08)',
        borderRadius: 2,
      }} />
    );
  }
  return (
    <div style={{
      height: 8, display: 'flex', borderRadius: 2, overflow: 'hidden',
      background: 'rgba(168, 179, 160, 0.08)',
    }}>
      {yes > 0 && (
        <div style={{
          width: `${(yes / total) * 100}%`,
          background: VOTE_COLORS.yes,
        }} />
      )}
      {no > 0 && (
        <div style={{
          width: `${(no / total) * 100}%`,
          background: VOTE_COLORS.no,
        }} />
      )}
      {abstain > 0 && (
        <div style={{
          width: `${(abstain / total) * 100}%`,
          background: VOTE_COLORS.abstain,
        }} />
      )}
    </div>
  );
}

// ===== Helpers =====

function formatTimeRemaining(closesAt: string): string {
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return '0';
  const hours = Math.floor(ms / (3600 * 1000));
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h`;
  const minutes = Math.floor(ms / 60000);
  return `${minutes}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ===== Styles =====

const emptyStateStyle: React.CSSProperties = {
  padding: '60px 0', textAlign: 'center',
  color: '#6e6856', fontSize: 13, lineHeight: 1.8,
};
