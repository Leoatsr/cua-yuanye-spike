import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LEVEL_NAMES } from '../lib/levelStore';
import {
  CATEGORY_LABELS,
  OUTCOME_LABELS,
} from '../lib/proposalStore';
import { useHomeWallData } from '../hooks/useHomeWallData';
import { useOpenViaEventBus } from '../hooks/useOpenViaEventBus';
import { Chip, Sprite, Divider } from '../ui';

const PANEL_WIDTH = 600;
const PANEL_HEIGHT = 620;

const OUTCOME_TONE: Record<string, 'spring' | 'danger' | 'gold' | ''> = {
  passed: 'spring',
  rejected: 'danger',
  tied: 'gold',
  no_quorum: '',
};

/**
 * NewHomeWallPanel · 像素风自家小屋纪念墙
 *
 * Wave 2.5.C
 *
 * 触发: EventBus 'open-home-wall' (HomeScene [E])
 *
 * 展示个人成就时间轴:
 *   - GitHub avatar + name + level
 *   - 总 CV
 *   - 完成任务列表（cvEntries）
 *   - 创建的提案（含 outcome）
 */
export function NewHomeWallPanel() {
  const [open, setOpen] = useOpenViaEventBus('home-wall', 'open-home-wall');
  const {
    auth,
    totalCV,
    cvEntries,
    myProposals,
    levelInfo,
    profile,
    loading,
  } = useHomeWallData(open);

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

  if (!open) return null;

  const sortedEntries = [...cvEntries].sort((a, b) => b.earnedAt - a.earnedAt);
  const totalTasks = sortedEntries.length;
  const totalProposals = myProposals.length;
  const passedProposals = myProposals.filter((p) => p.outcome === 'passed').length;

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
          <span style={{ fontSize: 18 }}>🏠</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="t-title" style={{ fontSize: 16 }}>
              自家小屋 · 纪念墙
            </span>
            <span
              className="t-faint"
              style={{ fontSize: 10, marginTop: 2 }}
            >
              我的成就时间轴
            </span>
          </div>
        </div>
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

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          background: 'var(--paper-0)',
        }}
      >
        {loading ? (
          <LoadingState />
        ) : !auth ? (
          <NotLoggedInState />
        ) : (
          <>
            {/* 个人卡片 */}
            <PersonalCard
              auth={auth}
              level={levelInfo?.level ?? 0}
              levelName={levelInfo?.level_name ?? '萌芽'}
              profile={profile}
              totalCV={totalCV}
              totalTasks={totalTasks}
              totalProposals={totalProposals}
              passedProposals={passedProposals}
            />

            <Divider sm />

            {/* 完成任务时间轴 */}
            <SectionHeader
              icon="🏆"
              title="完成任务"
              count={totalTasks}
            />
            {sortedEntries.length === 0 ? (
              <EmptyHint text="还没有完成的任务" hint="到工坊接一份吧" />
            ) : (
              <div style={{ marginBottom: 16 }}>
                {sortedEntries.slice(0, 10).map((entry) => (
                  <CVEntryCard key={entry.id} entry={entry} />
                ))}
                {sortedEntries.length > 10 && (
                  <div
                    className="t-faint"
                    style={{
                      fontSize: 10,
                      textAlign: 'center',
                      padding: '6px 0',
                    }}
                  >
                    显示最近 10 条 · 共 {sortedEntries.length}
                  </div>
                )}
              </div>
            )}

            <Divider sm />

            {/* 创建的提案 */}
            <SectionHeader
              icon="📝"
              title="创建的提案"
              count={totalProposals}
            />
            {myProposals.length === 0 ? (
              <EmptyHint
                text="还没有创建过提案"
                hint="L2 mentor 可去议政高地讲坛发起"
              />
            ) : (
              <div>
                {myProposals.map((p) => (
                  <ProposalCard key={p.id} proposal={p} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 个人卡片
// ============================================================

interface PersonalCardProps {
  auth: { username: string; avatarUrl: string | null; userId: string | null };
  level: number;
  levelName: string;
  profile: { username?: string } | null;
  totalCV: number;
  totalTasks: number;
  totalProposals: number;
  passedProposals: number;
}

function PersonalCard({
  auth,
  level,
  levelName,
  profile,
  totalCV,
  totalTasks,
  totalProposals,
  passedProposals,
}: PersonalCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        padding: 14,
        background: 'var(--paper-1)',
        border: '2px solid var(--wood-3)',
        boxShadow: '2px 2px 0 var(--wood-4)',
        marginBottom: 14,
      }}
    >
      {/* 头像 */}
      <div
        style={{
          width: 64,
          height: 64,
          background: 'var(--paper-3)',
          border: '3px solid var(--wood-4)',
          padding: 2,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {auth.avatarUrl ? (
          <img
            src={auth.avatarUrl}
            alt={auth.username}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              imageRendering: 'pixelated',
            }}
          />
        ) : (
          <Sprite name="char" scale={2} />
        )}
      </div>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            marginBottom: 4,
            flexWrap: 'wrap',
          }}
        >
          <span className="t-title" style={{ fontSize: 16 }}>
            {auth.username}
          </span>
          {profile?.username && (
            <Link
              to={`/u/${profile.username}`}
              className="t-faint mono"
              style={{
                fontSize: 11,
                color: 'var(--wood-3)',
                textDecoration: 'underline',
              }}
            >
              @{profile.username}
            </Link>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          <Chip tone="gold">
            L{level} · {levelName || LEVEL_NAMES[level]}
          </Chip>
          <Chip tone="spring">CV {totalCV}</Chip>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 14,
            fontSize: 11,
            color: 'var(--ink-faint)',
          }}
        >
          <Stat label="任务" value={totalTasks} />
          <Stat label="提案" value={totalProposals} />
          {totalProposals > 0 && (
            <Stat label="通过" value={passedProposals} />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span className="t-eyebrow" style={{ fontSize: 9 }}>
        {label}
      </span>
      <span
        className="mono"
        style={{ fontSize: 14, color: 'var(--wood-3)', fontWeight: 600 }}
      >
        {value}
      </span>
    </div>
  );
}

// ============================================================
// CV Entry 卡
// ============================================================

import type { CVEntry } from '../lib/cv';

function CVEntryCard({ entry }: { entry: CVEntry }) {
  const date = new Date(entry.earnedAt);
  const dateStr = `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')}`;
  return (
    <div
      style={{
        padding: '8px 10px',
        background: 'var(--paper-1)',
        borderLeft: '3px solid var(--gold)',
        marginBottom: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            marginBottom: 2,
          }}
        >
          <span
            className="t-title"
            style={{
              fontSize: 12,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.taskTitle}
          </span>
        </div>
        <div className="t-faint" style={{ fontSize: 10 }}>
          {entry.workshop} · {dateStr}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 14,
            color: 'var(--gold)',
            fontWeight: 600,
          }}
        >
          +{entry.cpEarned}
        </span>
        <span className="t-faint mono" style={{ fontSize: 9 }}>
          x{entry.coefficient}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// 提案卡
// ============================================================

import type { Proposal } from '../lib/proposalStore';

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const date = new Date(proposal.created_at);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const total =
    proposal.yes_count + proposal.no_count + proposal.abstain_count;
  return (
    <div
      style={{
        padding: '8px 10px',
        background: 'var(--paper-1)',
        border: '1px solid var(--wood-2)',
        marginBottom: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 4,
          flexWrap: 'wrap',
        }}
      >
        <Chip>{CATEGORY_LABELS[proposal.category]}</Chip>
        {proposal.outcome ? (
          <Chip tone={OUTCOME_TONE[proposal.outcome] ?? ''}>
            {OUTCOME_LABELS[proposal.outcome]}
          </Chip>
        ) : (
          <Chip tone="gold">公示中</Chip>
        )}
      </div>
      <div className="t-title" style={{ fontSize: 12, marginBottom: 2 }}>
        {proposal.title}
      </div>
      <div
        className="t-faint"
        style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}
      >
        <span>{dateStr}</span>
        <span className="mono">{total} 票</span>
      </div>
    </div>
  );
}

// ============================================================
// 通用组件
// ============================================================

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: string;
  title: string;
  count: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        marginTop: 12,
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span className="t-eyebrow" style={{ fontSize: 11 }}>
        {title}
      </span>
      {count > 0 && <Chip>{count}</Chip>}
    </div>
  );
}

function EmptyHint({ text, hint }: { text: string; hint?: string }) {
  return (
    <div
      style={{
        padding: 16,
        textAlign: 'center',
        color: 'var(--ink-faint)',
        fontSize: 12,
        background: 'var(--paper-1)',
        border: '2px dashed var(--wood-2)',
        marginBottom: 12,
      }}
    >
      {text}
      {hint && (
        <div style={{ fontSize: 10, marginTop: 4 }} className="t-faint">
          {hint}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        padding: 40,
        textAlign: 'center',
        color: 'var(--ink-faint)',
        fontSize: 13,
      }}
    >
      加载纪念墙...
    </div>
  );
}

function NotLoggedInState() {
  return (
    <div
      style={{
        padding: 40,
        textAlign: 'center',
        color: 'var(--ink-faint)',
        fontSize: 13,
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
      <div>请先用 GitHub 登录</div>
      <div className="t-faint" style={{ fontSize: 11, marginTop: 4 }}>
        登录后纪念墙会显示你的成就
      </div>
    </div>
  );
}

export default NewHomeWallPanel;
