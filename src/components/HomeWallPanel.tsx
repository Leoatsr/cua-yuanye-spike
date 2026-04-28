import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EventBus } from '../game/EventBus';
import { getTotalCV, getCVEntries, type CVEntry } from '../lib/cv';
import { getSupabase } from '../lib/supabase';
import { fetchUserLevel, LEVEL_COLORS, type LevelInfo } from '../lib/levelStore';
import { fetchMyProfile, type UserProfile } from '../lib/profileStore';
import {
  CATEGORY_LABELS,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
  type Proposal,
} from '../lib/proposalStore';

/**
 * 自家小屋 · 纪念展示墙
 * Triggered by [E] on the wall in HomeScene.
 *
 * Shows player's personal achievements timeline:
 *   - GitHub avatar + name (if logged in)
 *   - Total CV
 *   - Completed quests (from cv.ts entries)
 *   - Created proposals (from Supabase, filtered by author_id)
 *   - Sentinel level (placeholder L0 for now)
 */

interface AuthInfo {
  username: string;
  avatarUrl: string | null;
  userId: string | null;
}

export function HomeWallPanel() {
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [totalCV, setTotalCV] = useState(0);
  const [cvEntries, setCvEntries] = useState<CVEntry[]>([]);
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onOpen = async () => {
      setOpen(true);
      setLoading(true);

      // 1. Local data — sync, fast
      setTotalCV(getTotalCV());
      setCvEntries(getCVEntries());

      // 2. Auth info from supabase session
      const supabase = getSupabase();
      if (!supabase) {
        setAuth(null);
        setMyProposals([]);
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setAuth(null);
        setMyProposals([]);
        setLoading(false);
        return;
      }

      const meta = user.user_metadata ?? {};
      setAuth({
        username: (meta.user_name ?? meta.preferred_username ?? meta.full_name ?? user.email ?? 'unknown') as string,
        avatarUrl: (meta.avatar_url ?? null) as string | null,
        userId: user.id,
      });

      // 3. Fetch own proposals (both open & closed)
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMyProposals(data as Proposal[]);
      }

      // 4. Fetch level info
      const lvl = await fetchUserLevel();
      setLevelInfo(lvl);

      // 5. Fetch profile (for username link)
      const prof = await fetchMyProfile();
      setProfile(prof);

      setLoading(false);
    };
    EventBus.on('open-home-wall', onOpen);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      EventBus.off('open-home-wall', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) return null;

  // Sort cv entries newest first
  const sortedEntries = [...cvEntries].sort((a, b) => b.earnedAt - a.earnedAt);

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(8, 12, 18, 0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-start', overflowY: 'auto',
        padding: '40px 24px',
        backdropFilter: 'blur(3px)',
        animation: 'homeWallFadeIn 0.3s ease-out',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 680, width: '100%',
          background: 'linear-gradient(180deg, #2a1e10 0%, #1a120a 100%)',
          border: '1px solid rgba(184, 137, 58, 0.4)',
          borderRadius: 6,
          padding: '32px 36px 36px',
          boxShadow: '0 12px 50px rgba(0, 0, 0, 0.7)',
          color: '#f5f0e0',
        }}
      >
        {/* Header */}
        <div style={{
          borderBottom: '1px solid rgba(184, 137, 58, 0.25)',
          paddingBottom: 20, marginBottom: 24,
        }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.25em',
            color: '#b8893a', textTransform: 'uppercase', marginBottom: 6,
          }}>
            HOME · MEMORIAL WALL
          </div>
          <div style={{
            fontFamily: 'serif', fontSize: 24, fontWeight: 600,
            color: '#f5f0e0', letterSpacing: '0.06em',
          }}>
            纪念展示墙
          </div>
          <div style={{
            fontSize: 12, color: '#a8a08e', marginTop: 8, lineHeight: 1.7,
          }}>
            "凡所贡献，皆将留痕于此。"
          </div>
        </div>

        {/* Player profile card */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(184, 137, 58, 0.08)',
          border: '1px solid rgba(184, 137, 58, 0.3)',
          borderRadius: 4,
          marginBottom: 24,
          display: 'flex', gap: 16, alignItems: 'center',
        }}>
          {auth?.avatarUrl ? (
            <img
              src={auth.avatarUrl}
              alt={auth.username}
              style={{
                width: 60, height: 60, borderRadius: '50%',
                border: '2px solid rgba(184, 137, 58, 0.5)',
              }}
            />
          ) : (
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(168, 179, 160, 0.2)',
              border: '2px solid rgba(184, 137, 58, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, color: '#a8a08e',
            }}>
              ?
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 18, fontWeight: 600, color: '#f5f0e0',
              marginBottom: 4, fontFamily: 'serif',
            }}>
              {profile ? (
                <Link
                  to={`/u/${profile.username}`}
                  onClick={() => setOpen(false)}
                  style={{
                    color: '#f5f0e0',
                    textDecoration: 'none',
                    borderBottom: '1px dashed rgba(96, 165, 250, 0.5)',
                  }}
                  title={`查看公开页 /u/${profile.username}`}
                >
                  {profile.display_name}
                </Link>
              ) : (
                auth?.username ?? '未登录访客'
              )}
            </div>
            {profile && (
              <div style={{
                fontSize: 11, color: '#8a8576',
                fontFamily: 'monospace', marginBottom: 4,
              }}>
                @{profile.username}
              </div>
            )}
            <div style={{
              fontSize: 11, color: '#a8a08e', display: 'flex', gap: 14,
              flexWrap: 'wrap',
            }}>
              <span>
                等级：
                {levelInfo ? (
                  <strong style={{ color: LEVEL_COLORS[levelInfo.level] }}>
                    L{levelInfo.level} {levelInfo.level_name}
                  </strong>
                ) : (
                  <strong style={{ color: '#9ca3af' }}>L0 新人</strong>
                )}
              </span>
              <span style={{ color: '#6e6856' }}>·</span>
              <span>贡献值：<strong style={{ color: '#e0b060' }}>{totalCV} CV</strong></span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
          marginBottom: 24,
        }}>
          <StatCard
            label="完成任务"
            value={cvEntries.length}
            color="#7fc090"
          />
          <StatCard
            label="发起提案"
            value={myProposals.length}
            color="#b8a472"
          />
          <StatCard
            label="累计 CP"
            value={totalCV}
            color="#e0b060"
          />
        </div>

        {/* Quests section */}
        <SectionTitle text="✦ 已完成任务" />
        {sortedEntries.length === 0 ? (
          <EmptyText text="（尚无已完成任务 · 去共创之都接活吧）" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
            {sortedEntries.slice(0, 10).map((e) => (
              <QuestRow key={e.id} entry={e} />
            ))}
            {sortedEntries.length > 10 && (
              <div style={{
                fontSize: 11, color: '#6e6856', textAlign: 'center',
                marginTop: 6,
              }}>
                ⋯ 还有 {sortedEntries.length - 10} 件未列出
              </div>
            )}
          </div>
        )}

        {/* Proposals section */}
        <SectionTitle text="✦ 已发提案" />
        {loading ? (
          <EmptyText text="（读取中...）" />
        ) : !auth ? (
          <EmptyText text="（请先登录 GitHub）" />
        ) : myProposals.length === 0 ? (
          <EmptyText text="（尚未发起提案 · 去执政厅讲台 [E] 创建一条）" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
            {myProposals.slice(0, 10).map((p) => (
              <ProposalRow key={p.id} proposal={p} />
            ))}
            {myProposals.length > 10 && (
              <div style={{
                fontSize: 11, color: '#6e6856', textAlign: 'center',
                marginTop: 6,
              }}>
                ⋯ 还有 {myProposals.length - 10} 件未列出
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 16, paddingTop: 16,
          borderTop: '1px solid rgba(184, 137, 58, 0.15)',
          textAlign: 'center',
          fontSize: 11, color: '#6e6856',
        }}>
          点击空白或按 Esc 关闭 · 这屋子小，但是属于你的
        </div>
      </div>

      <style>{`
        @keyframes homeWallFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ===== Sub-components =====

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'rgba(168, 179, 160, 0.04)',
      border: '1px solid rgba(168, 179, 160, 0.18)',
      borderRadius: 4,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 22, fontWeight: 600, color, marginBottom: 4,
        fontFamily: 'serif',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 11, color: '#8a8576',
        letterSpacing: '0.08em',
      }}>
        {label}
      </div>
    </div>
  );
}

function SectionTitle({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 12, letterSpacing: '0.15em',
      color: '#b8893a', marginBottom: 10,
      fontFamily: 'serif',
    }}>
      {text}
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 12, color: '#6e6856', fontStyle: 'italic',
      textAlign: 'center', padding: '12px 0', marginBottom: 16,
    }}>
      {text}
    </div>
  );
}

function QuestRow({ entry }: { entry: CVEntry }) {
  return (
    <div style={{
      padding: '8px 12px',
      background: 'rgba(127, 192, 144, 0.05)',
      border: '1px solid rgba(127, 192, 144, 0.18)',
      borderRadius: 3,
      display: 'flex', alignItems: 'center', gap: 12,
      fontSize: 12,
    }}>
      <span style={{ flex: 1, color: '#f5f0e0' }}>
        ✓ {entry.taskTitle}
      </span>
      <span style={{ color: '#a8a08e', fontSize: 11 }}>
        {entry.workshop}
      </span>
      <span style={{
        color: '#7fc090', fontFamily: 'monospace',
        minWidth: 60, textAlign: 'right',
      }}>
        +{entry.cpEarned} CP
      </span>
      <span style={{
        color: '#6e6856', fontSize: 10, fontFamily: 'monospace',
      }}>
        x{entry.coefficient}
      </span>
    </div>
  );
}

function ProposalRow({ proposal }: { proposal: Proposal }) {
  const isClosed = proposal.status === 'closed';
  return (
    <div style={{
      padding: '8px 12px',
      background: 'rgba(184, 137, 58, 0.05)',
      border: '1px solid rgba(184, 137, 58, 0.18)',
      borderRadius: 3,
      display: 'flex', alignItems: 'center', gap: 12,
      fontSize: 12,
    }}>
      <span style={{ flex: 1, color: '#f5f0e0' }}>
        📜 {proposal.title}
      </span>
      <span style={{
        fontSize: 10, color: '#b8893a', fontFamily: 'monospace',
      }}>
        {CATEGORY_LABELS[proposal.category]}
      </span>
      {isClosed && proposal.outcome ? (
        <span style={{
          fontSize: 10, fontFamily: 'monospace',
          color: OUTCOME_COLORS[proposal.outcome],
          background: `${OUTCOME_COLORS[proposal.outcome]}1a`,
          padding: '1px 6px', borderRadius: 2,
          border: `1px solid ${OUTCOME_COLORS[proposal.outcome]}55`,
          minWidth: 56, textAlign: 'center',
        }}>
          {OUTCOME_LABELS[proposal.outcome]}
        </span>
      ) : (
        <span style={{
          fontSize: 10, color: '#a8a08e',
          fontFamily: 'monospace',
          minWidth: 56, textAlign: 'center',
        }}>
          公示中
        </span>
      )}
    </div>
  );
}
