import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EventBus } from '../game/EventBus';
import { getSupabase } from '../lib/supabase';
import { reportError } from '../lib/sentry';
import { LEVEL_COLORS, LEVEL_NAMES } from '../lib/levelStore';

interface LeaderboardRow {
  user_id: string;
  user_name: string;
  total_cv: number;
  task_count: number;
}

/**
 * Estimate level from cv + task_count (proposal_count not in RPC).
 * Underestimates L3 (which also requires proposals) — shows L2 max
 * for users we can't verify from leaderboard data alone.
 */
function estimateLevel(cv: number, tasks: number): number {
  if (cv >= 800 && tasks >= 10) return 2;
  if (cv >= 200 && tasks >= 3) return 1;
  return 0;
}

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * 功德堂 · 贡献者排行榜
 * Triggered by [E] on the central stele in GongdeTangScene.
 *
 * Calls the get_cv_leaderboard RPC (security definer) to aggregate
 * across all users — bypasses cv_entries' per-user RLS.
 */
export function MeritBoardPanel() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = async () => {
      setOpen(true);
      setStatus('loading');

      const supabase = getSupabase();
      if (!supabase) {
        setStatus('error');
        return;
      }

      // Get my own user id (for highlighting)
      const { data: { session } } = await supabase.auth.getSession();
      setMyUserId(session?.user?.id ?? null);

      // Fetch leaderboard
      const { data, error } = await supabase.rpc('get_cv_leaderboard', { p_limit: 20 });
      if (error) {
        reportError('merit-board', error);
        setStatus('error');
        return;
      }
      setRows((data ?? []) as LeaderboardRow[]);
      setStatus('loaded');
    };
    EventBus.on('open-merit-board', onOpen);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      EventBus.off('open-merit-board', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) return null;

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
        animation: 'meritFadeIn 0.3s ease-out',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 600, width: '100%',
          background: 'linear-gradient(180deg, #2a1410 0%, #1a0808 100%)',
          border: '2px solid rgba(251, 191, 36, 0.5)',
          borderRadius: 6,
          padding: '32px 36px 36px',
          boxShadow: '0 12px 50px rgba(0, 0, 0, 0.7)',
          color: '#f5f0e0',
        }}
      >
        {/* Header */}
        <div style={{
          textAlign: 'center', borderBottom: '1px solid rgba(251, 191, 36, 0.3)',
          paddingBottom: 18, marginBottom: 24,
        }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.3em',
            color: '#fbbf24', textTransform: 'uppercase', marginBottom: 6,
          }}>
            HALL OF MERIT · 功 德 录
          </div>
          <div style={{
            fontFamily: 'serif', fontSize: 28, fontWeight: 600,
            color: '#fbbf24', letterSpacing: '0.1em',
          }}>
            ✦ 功 德 堂 ✦
          </div>
          <div style={{
            fontSize: 12, color: '#c8a87a', marginTop: 8, lineHeight: 1.7,
            fontStyle: 'italic',
          }}>
            "碑上无虚名——上石必有功。"
          </div>
        </div>

        {/* Body */}
        {status === 'loading' && (
          <div style={emptyStyle}>正在录入功德......</div>
        )}

        {status === 'error' && (
          <div style={emptyStyle}>
            读取失败 · 请稍后再试
            <div style={{ fontSize: 11, marginTop: 8, color: '#8a4a18' }}>
              （或确认 SQL 008 已运行）
            </div>
          </div>
        )}

        {status === 'loaded' && rows.length === 0 && (
          <div style={emptyStyle}>
            （碑上空空——尚无入碑者）
            <div style={{ fontSize: 11, marginTop: 8, color: '#8a4a18' }}>
              完成第一个任务，便是开端
            </div>
          </div>
        )}

        {status === 'loaded' && rows.length > 0 && (
          <div>
            <div style={{
              fontSize: 11, letterSpacing: '0.15em',
              color: '#fbbf24', marginBottom: 14, fontFamily: 'monospace',
              textAlign: 'center',
            }}>
              当前共 {rows.length} 位贡献者上碑
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((row, idx) => (
                <MeritRow
                  key={row.user_id}
                  rank={idx + 1}
                  row={row}
                  isMe={row.user_id === myUserId}
                  onClose={() => setOpen(false)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 28, paddingTop: 16,
          borderTop: '1px solid rgba(251, 191, 36, 0.2)',
          textAlign: 'center',
          fontSize: 11, color: '#8a4a18',
          lineHeight: 1.8,
          fontStyle: 'italic',
        }}>
          点击空白或按 Esc 关闭
          <br />
          <span style={{ fontSize: 10, color: '#6a3a18' }}>
            "功德不朽——不是因为石碑长存，而是因为有人记得。"
          </span>
        </div>
      </div>

      <style>{`
        @keyframes meritFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function MeritRow({ rank, row, isMe, onClose }: { rank: number; row: LeaderboardRow; isMe: boolean; onClose: () => void }) {
  // Top-3 colors: gold, silver, bronze
  const rankColor =
    rank === 1 ? '#fbbf24' :
    rank === 2 ? '#c0c0c0' :
    rank === 3 ? '#cd7f32' :
    '#8a8576';

  const rankEmoji =
    rank === 1 ? '🥇' :
    rank === 2 ? '🥈' :
    rank === 3 ? '🥉' :
    null;

  return (
    <div style={{
      padding: '10px 14px',
      background: isMe
        ? 'rgba(251, 191, 36, 0.15)'
        : (rank <= 3 ? 'rgba(251, 191, 36, 0.05)' : 'rgba(168, 179, 160, 0.04)'),
      border: isMe
        ? '1.5px solid rgba(251, 191, 36, 0.7)'
        : (rank <= 3 ? '1px solid rgba(251, 191, 36, 0.3)' : '1px solid rgba(168, 179, 160, 0.2)'),
      borderRadius: 4,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* Rank badge */}
      <div style={{
        minWidth: 32, textAlign: 'center',
        fontSize: 16, fontWeight: 600,
        color: rankColor,
        fontFamily: 'serif',
      }}>
        {rankEmoji ?? `#${rank}`}
      </div>
      {/* Name */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: isMe ? '#fbbf24' : '#f5f0e0',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {/* Level badge */}
          {(() => {
            const lv = estimateLevel(row.total_cv, row.task_count);
            const lvColor = LEVEL_COLORS[lv];
            return (
              <span style={{
                fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                color: lvColor,
                background: `${lvColor}1a`,
                border: `1px solid ${lvColor}55`,
                padding: '1px 5px',
                borderRadius: 2,
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
              }}>
                L{lv}{lv >= 2 ? '+' : ''} {LEVEL_NAMES[lv]}
              </span>
            );
          })()}
          <Link
            to={`/u/${row.user_name}`}
            onClick={onClose}
            style={{
              color: 'inherit',
              textDecoration: 'none',
              borderBottom: '1px dashed rgba(96, 165, 250, 0.5)',
            }}
            title={`查看 /u/${row.user_name}`}
          >
            {row.user_name}
          </Link>
          {isMe && (
            <span style={{
              fontSize: 10,
              color: '#fbbf24', fontFamily: 'monospace',
              letterSpacing: '0.1em',
            }}>
              (你)
            </span>
          )}
        </div>
        <div style={{
          fontSize: 11, color: '#a8a08e', marginTop: 2,
        }}>
          完成 {row.task_count} 件任务
        </div>
      </div>
      {/* CV */}
      <div style={{
        textAlign: 'right',
        fontFamily: 'monospace',
      }}>
        <div style={{
          fontSize: 18, fontWeight: 600,
          color: rankColor,
        }}>
          {row.total_cv}
        </div>
        <div style={{
          fontSize: 9, color: '#8a8576',
          letterSpacing: '0.1em',
        }}>
          CV
        </div>
      </div>
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  padding: '60px 0', textAlign: 'center',
  color: '#8a4a18', fontSize: 13, lineHeight: 1.8,
};
