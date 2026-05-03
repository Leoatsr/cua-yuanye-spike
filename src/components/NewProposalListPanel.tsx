import { useEffect, useState } from 'react';
import {
  castVote,
  withdrawVote,
  getMyVote,
  CATEGORY_LABELS,
  VOTE_LABELS,
  OUTCOME_LABELS,
  type Proposal,
  type ProposalCategory,
  type ProposalVote,
  type VoteValue,
} from '../lib/proposalStore';
import { checkLevelRequirement } from './RequiresLevel';
import { useProposals } from '../hooks/useProposals';
import { useOpenViaEventBus } from '../hooks/useOpenViaEventBus';
import { EventBus } from '../game/EventBus';
import { PixelButton, Chip, Divider } from '../ui';

const VOTE_REQUIRED_LEVEL = 1;
const PANEL_WIDTH = 600;
const PANEL_HEIGHT = 620;
const SIDEBAR_WIDTH = 220;

type TabKey = 'open' | 'closed';
type CategoryFilter = ProposalCategory | 'all';

const VOTE_TONE: Record<VoteValue, 'spring' | 'danger' | ''> = {
  yes: 'spring',
  no: 'danger',
  abstain: '',
};

const OUTCOME_TONE: Record<string, 'spring' | 'danger' | 'gold' | ''> = {
  passed: 'spring',
  rejected: 'danger',
  tied: 'gold',
  no_quorum: '',
};

/**
 * NewProposalListPanel · 像素风提案列表
 *
 * Wave 2.5.B
 *
 * 触发: EventBus 'open-proposal-list'
 *
 * 布局: 左 sidebar 列表（220px） + 右详情区（带投票）
 * 2 tab: 公示中 / 已决议
 * 类别筛选: 全部 / 章程修订 / 功能提案 / 活动议程 / 预算分配 / 其他
 */
export function NewProposalListPanel() {
  const [open, setOpen] = useOpenViaEventBus(
    'proposal-list',
    'open-proposal-list',
  );
  const [tab, setTab] = useState<TabKey>('open');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    openProposals,
    closedProposals,
    loading,
    finalizedCount,
  } = useProposals(open);

  // ESC 关
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // 提案列表筛选
  const allProposals = tab === 'open' ? openProposals : closedProposals;
  const filteredProposals =
    filter === 'all'
      ? allProposals
      : allProposals.filter((p) => p.category === filter);

  const selected = selectedId
    ? allProposals.find((p) => p.id === selectedId) ?? null
    : null;

  if (!open) return null;

  return (
    <div
      className="bg-paper"
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: PANEL_WIDTH,
        maxWidth: 'calc(100vw - 24px)',
        height: PANEL_HEIGHT,
        maxHeight: 'calc(100vh - 120px)',
        background: 'var(--paper-0)',
        border: '4px solid var(--wood-3)',
        boxShadow: '0 0 0 4px var(--wood-4), 8px 8px 0 rgba(0,0,0,0.2)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--f-sans)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '3px solid var(--wood-3)',
          background: 'var(--paper-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🏛</span>
          <span className="t-title" style={{ fontSize: 16 }}>
            议政厅 · 提案
          </span>
          {finalizedCount > 0 && (
            <Chip tone="gold">已结案 {finalizedCount}</Chip>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <PixelButton
            size="pb-sm"
            onClick={() => EventBus.emit('open-create-proposal')}
          >
            + 新提案
          </PixelButton>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--wood-3)',
              padding: 4,
              lineHeight: 1,
            }}
            title="关闭 (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs · 公示中 / 已决议 */}
      <div
        style={{
          display: 'flex',
          background: 'var(--paper-2)',
          borderBottom: '2px solid var(--wood-3)',
        }}
      >
        <TabButton
          label={`公示中${openProposals.length > 0 ? ` (${openProposals.length})` : ''}`}
          active={tab === 'open'}
          onClick={() => {
            setTab('open');
            setSelectedId(null);
          }}
        />
        <TabButton
          label={`已决议${closedProposals.length > 0 ? ` (${closedProposals.length})` : ''}`}
          active={tab === 'closed'}
          onClick={() => {
            setTab('closed');
            setSelectedId(null);
          }}
        />
      </div>

      {/* 类别筛选条 */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 10px',
          background: 'var(--paper-1)',
          borderBottom: '2px solid var(--wood-2)',
          overflowX: 'auto',
        }}
      >
        <CategoryButton
          label="全部"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        {(Object.keys(CATEGORY_LABELS) as ProposalCategory[]).map((cat) => (
          <CategoryButton
            key={cat}
            label={CATEGORY_LABELS[cat]}
            active={filter === cat}
            onClick={() => setFilter(cat)}
          />
        ))}
      </div>

      {/* 主体 · sidebar + 详情 */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar */}
        <div
          style={{
            width: SIDEBAR_WIDTH,
            borderRight: '2px solid var(--wood-3)',
            background: 'var(--paper-1)',
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <LoadingState />
          ) : filteredProposals.length === 0 ? (
            <EmptyState tab={tab} filter={filter} />
          ) : (
            filteredProposals.map((p) => (
              <ProposalListItem
                key={p.id}
                proposal={p}
                active={selectedId === p.id}
                onClick={() => setSelectedId(p.id)}
              />
            ))
          )}
        </div>

        {/* 详情 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            background: 'var(--paper-0)',
          }}
        >
          {selected ? (
            <ProposalDetail proposal={selected} canVote={tab === 'open'} />
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ink-faint)',
                fontSize: 13,
                padding: 24,
                textAlign: 'center',
              }}
            >
              {filteredProposals.length === 0
                ? ''
                : '← 选择一个提案查看详情'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sidebar 单项
// ============================================================

function ProposalListItem({
  proposal,
  active,
  onClick,
}: {
  proposal: Proposal;
  active: boolean;
  onClick: () => void;
}) {
  const total =
    proposal.yes_count + proposal.no_count + proposal.abstain_count;
  const yesPct = total > 0 ? Math.round((proposal.yes_count / total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '10px 12px',
        background: active ? 'var(--paper-2)' : 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--paper-3)',
        borderLeft: active ? '3px solid var(--gold)' : '3px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--f-sans)',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <Chip>{CATEGORY_LABELS[proposal.category]}</Chip>
        {proposal.outcome && (
          <Chip tone={OUTCOME_TONE[proposal.outcome] ?? ''}>
            {OUTCOME_LABELS[proposal.outcome]}
          </Chip>
        )}
      </div>
      <div
        className="t-title"
        style={{
          fontSize: 12,
          color: 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: 4,
        }}
      >
        {proposal.title}
      </div>
      <div
        className="t-faint"
        style={{
          fontSize: 10,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{proposal.author_name}</span>
        <span className="mono">
          {total > 0 ? `${total} 票 · ${yesPct}% 赞` : '暂无投票'}
        </span>
      </div>
    </button>
  );
}

// ============================================================
// 详情 + 投票
// ============================================================

interface ProposalDetailProps {
  proposal: Proposal;
  canVote: boolean;
}

function ProposalDetail({ proposal, canVote }: ProposalDetailProps) {
  const [myVote, setMyVote] = useState<ProposalVote | null>(null);
  const [voting, setVoting] = useState<VoteValue | null>(null);
  const [comment, setComment] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);

  // 加载我的投票
  useEffect(() => {
    let cancelled = false;
    setMyVote(null);
    setComment('');
    setShowCommentBox(false);
    setErrorMsg('');
    void getMyVote(proposal.id).then((vote) => {
      if (!cancelled) {
        setMyVote(vote);
        if (vote?.comment) setComment(vote.comment);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [proposal.id]);

  const handleVote = async (vote: VoteValue) => {
    setErrorMsg('');
    // 等级守门
    const levelCheck = await checkLevelRequirement(VOTE_REQUIRED_LEVEL);
    if (!levelCheck.ok) {
      setErrorMsg(levelCheck.reason ?? '等级不足');
      return;
    }
    setVoting(vote);
    const result = await castVote(proposal.id, vote, comment);
    if (result.ok) {
      setMyVote(result.vote);
    } else {
      setErrorMsg(result.error);
    }
    setVoting(null);
  };

  const handleWithdraw = async () => {
    setErrorMsg('');
    setVoting('yes' as VoteValue);  // 借用 voting 状态显示 loading
    const result = await withdrawVote(proposal.id);
    if (result.ok) {
      setMyVote(null);
      setComment('');
      setShowCommentBox(false);
    } else {
      setErrorMsg(result.error);
    }
    setVoting(null);
  };

  const closesAt = new Date(proposal.closes_at);
  const remaining = Math.max(0, closesAt.getTime() - Date.now());
  const remainingHours = Math.floor(remaining / 3600_000);
  const total =
    proposal.yes_count + proposal.no_count + proposal.abstain_count;

  return (
    <>
      {/* Title + meta */}
      <div
        style={{
          padding: 14,
          borderBottom: '2px solid var(--wood-2)',
          background: 'var(--paper-1)',
        }}
      >
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <Chip>{CATEGORY_LABELS[proposal.category]}</Chip>
          {proposal.outcome && (
            <Chip tone={OUTCOME_TONE[proposal.outcome] ?? ''}>
              {OUTCOME_LABELS[proposal.outcome]}
            </Chip>
          )}
        </div>
        <h3
          className="t-title"
          style={{ fontSize: 16, margin: 0, marginBottom: 6 }}
        >
          {proposal.title}
        </h3>
        <div
          className="t-faint"
          style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between' }}
        >
          <span>由 {proposal.author_name} 发起</span>
          {proposal.status === 'open' ? (
            <span className="mono">
              {remainingHours > 24
                ? `${Math.floor(remainingHours / 24)} 天后截止`
                : `${remainingHours} 小时后截止`}
            </span>
          ) : (
            <span className="mono">已闭票</span>
          )}
        </div>
      </div>

      {/* Body · 描述 + 投票统计 */}
      <div
        style={{
          flex: 1,
          padding: 14,
          overflowY: 'auto',
          fontSize: 13,
          lineHeight: 1.8,
        }}
      >
        <p style={{ whiteSpace: 'pre-wrap', margin: '0 0 14px' }}>
          {proposal.description}
        </p>

        <Divider sm />

        {/* 投票统计 */}
        <div
          className="t-eyebrow"
          style={{ fontSize: 9, marginTop: 12, marginBottom: 6 }}
        >
          投票统计 · 共 {total} 票
        </div>
        <VoteBar
          yes={proposal.yes_count}
          no={proposal.no_count}
          abstain={proposal.abstain_count}
        />

        {/* 我的投票 */}
        {myVote && (
          <div
            style={{
              marginTop: 14,
              padding: 8,
              background: 'var(--paper-2)',
              border: '1px solid var(--wood-2)',
              fontSize: 11,
            }}
          >
            <span className="t-eyebrow" style={{ fontSize: 9 }}>
              我的票
            </span>
            <span style={{ marginLeft: 8 }}>
              <Chip tone={VOTE_TONE[myVote.vote]}>{VOTE_LABELS[myVote.vote]}</Chip>
            </span>
            {myVote.comment && (
              <div
                className="t-soft"
                style={{ fontSize: 11, marginTop: 6, fontStyle: 'italic' }}
              >
                "{myVote.comment}"
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              marginTop: 10,
              padding: '6px 8px',
              background: 'rgba(166, 70, 52, 0.1)',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              fontSize: 11,
            }}
          >
            ⚠ {errorMsg}
          </div>
        )}
      </div>

      {/* Footer · 投票按钮 */}
      {canVote && (
        <div
          style={{
            padding: 10,
            borderTop: '2px solid var(--wood-3)',
            background: 'var(--paper-1)',
          }}
        >
          {showCommentBox ? (
            <>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="备注（可选 · 不超过 500 字）"
                maxLength={500}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '2px solid var(--wood-4)',
                  background: 'var(--paper-0)',
                  fontSize: 12,
                  fontFamily: 'var(--f-sans)',
                  outline: 'none',
                  marginBottom: 6,
                  boxSizing: 'border-box',
                }}
              />
            </>
          ) : (
            <div
              style={{
                marginBottom: 6,
                fontSize: 10,
                color: 'var(--ink-faint)',
                textAlign: 'right',
              }}
            >
              <button
                onClick={() => setShowCommentBox(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--wood-3)',
                  fontSize: 10,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                + 加备注
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <PixelButton
              variant="pb-primary"
              size="pb-sm"
              onClick={() => void handleVote('yes')}
              disabled={voting !== null}
            >
              {voting === 'yes' ? '...' : '✓ 赞成'}
            </PixelButton>
            <PixelButton
              size="pb-sm"
              onClick={() => void handleVote('no')}
              disabled={voting !== null}
            >
              {voting === 'no' ? '...' : '✗ 反对'}
            </PixelButton>
            <PixelButton
              size="pb-sm"
              onClick={() => void handleVote('abstain')}
              disabled={voting !== null}
            >
              ⊘ 弃权
            </PixelButton>
            {myVote && (
              <PixelButton
                size="pb-sm"
                onClick={() => void handleWithdraw()}
                disabled={voting !== null}
              >
                撤票
              </PixelButton>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// 投票条
// ============================================================

function VoteBar({
  yes,
  no,
  abstain,
}: {
  yes: number;
  no: number;
  abstain: number;
}) {
  const total = yes + no + abstain;
  if (total === 0) {
    return (
      <div
        className="t-faint"
        style={{ fontSize: 11, padding: 6 }}
      >
        暂无投票
      </div>
    );
  }

  const yesPct = (yes / total) * 100;
  const noPct = (no / total) * 100;
  const abstainPct = (abstain / total) * 100;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          height: 20,
          border: '2px solid var(--wood-4)',
          background: 'var(--paper-0)',
        }}
      >
        {yes > 0 && (
          <div
            style={{
              width: `${yesPct}%`,
              background: '#7fc090',
              transition: 'width 0.3s',
            }}
            title={`赞成 ${yes}`}
          />
        )}
        {no > 0 && (
          <div
            style={{
              width: `${noPct}%`,
              background: '#c08070',
              transition: 'width 0.3s',
            }}
            title={`反对 ${no}`}
          />
        )}
        {abstain > 0 && (
          <div
            style={{
              width: `${abstainPct}%`,
              background: '#a8a08e',
              transition: 'width 0.3s',
            }}
            title={`弃权 ${abstain}`}
          />
        )}
      </div>
      <div
        style={{
          marginTop: 6,
          display: 'flex',
          gap: 12,
          fontSize: 11,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: '#5d8c69' }}>
          ✓ 赞成 <strong className="mono">{yes}</strong> ({Math.round(yesPct)}%)
        </span>
        <span style={{ color: '#a06650' }}>
          ✗ 反对 <strong className="mono">{no}</strong> ({Math.round(noPct)}%)
        </span>
        <span style={{ color: '#7a7468' }}>
          ⊘ 弃权 <strong className="mono">{abstain}</strong> ({Math.round(abstainPct)}%)
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Tab + Category 按钮
// ============================================================

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 12px',
        fontSize: 12,
        fontFamily: 'var(--f-pixel)',
        cursor: 'pointer',
        background: active ? 'var(--paper-0)' : 'transparent',
        border: 'none',
        borderBottom: active ? '3px solid var(--gold)' : '3px solid transparent',
        color: active ? 'var(--wood-3)' : 'var(--ink)',
      }}
    >
      {label}
    </button>
  );
}

function CategoryButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        border: '1px solid var(--wood-4)',
        background: active ? 'var(--gold)' : 'var(--paper-0)',
        color: active ? 'var(--wood-4)' : 'var(--ink)',
        fontFamily: 'var(--f-pixel)',
        fontSize: 10,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        padding: 24,
        textAlign: 'center',
        color: 'var(--ink-faint)',
        fontSize: 12,
      }}
    >
      加载中...
    </div>
  );
}

function EmptyState({
  tab,
  filter,
}: {
  tab: TabKey;
  filter: CategoryFilter;
}) {
  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        color: 'var(--ink-faint)',
        fontSize: 12,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 32 }}>📜</div>
      <div>
        {filter !== 'all'
          ? `没有该类别的${tab === 'open' ? '公示' : '已决议'}提案`
          : tab === 'open'
          ? '当前没有公示中的提案'
          : '还没有已决议的提案'}
      </div>
      {tab === 'open' && filter === 'all' && (
        <div className="t-faint" style={{ fontSize: 10 }}>
          点上方 "+ 新提案"
        </div>
      )}
    </div>
  );
}

export default NewProposalListPanel;
