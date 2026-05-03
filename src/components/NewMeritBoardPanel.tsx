import { useEffect } from 'react';
import { LEVEL_NAMES } from '../lib/levelStore';
import { useLeaderboard, estimateLevel } from '../hooks/useLeaderboard';
import { useOpenViaEventBus } from '../hooks/useOpenViaEventBus';
import { Chip, Sprite, Divider } from '../ui';

const PANEL_WIDTH = 540;
const PANEL_HEIGHT = 620;

/**
 * NewMeritBoardPanel · 像素风功德堂排行榜
 *
 * Wave 2.5.C
 *
 * 触发: EventBus 'open-merit-board' (功德堂中央碑石 [E])
 *
 * 显示 get_cv_leaderboard RPC 返回的 Top 20
 * 自己的行高亮
 */
export function NewMeritBoardPanel() {
  const [open, setOpen] = useOpenViaEventBus(
    'merit-board',
    'open-merit-board',
  );
  const { rows, myUserId, status, reload } = useLeaderboard(open);

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

  const myRowIndex = rows.findIndex((r) => r.user_id === myUserId);

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
          padding: '12px 14px',
          borderBottom: '3px solid var(--wood-3)',
          background: 'var(--paper-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🏆</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="t-title" style={{ fontSize: 17 }}>
              功德堂 · 贡献者排行
            </span>
            <span
              className="t-faint"
              style={{ fontSize: 10, marginTop: 2, fontStyle: 'italic' }}
            >
              碑上无虚名 · 上石必有功
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => void reload()}
            style={{
              background: 'transparent',
              border: '1px solid var(--wood-3)',
              padding: '2px 8px',
              fontSize: 11,
              fontFamily: 'var(--f-pixel)',
              color: 'var(--wood-3)',
              cursor: 'pointer',
            }}
            title="刷新"
          >
            ↻
          </button>
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

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          background: 'var(--paper-0)',
        }}
      >
        {status === 'loading' && (
          <LoadingState text="正在录入功德......" />
        )}

        {status === 'error' && (
          <LoadingState text="读取失败 · 请稍后再试" />
        )}

        {status === 'loaded' && rows.length === 0 && (
          <LoadingState text="碑上尚无名讳" />
        )}

        {status === 'loaded' && rows.length > 0 && (
          <>
            {/* 前 3 名 · top 排版 */}
            {rows.slice(0, 3).map((row, idx) => (
              <TopRow
                key={row.user_id}
                row={row}
                rank={idx + 1}
                isMe={row.user_id === myUserId}
              />
            ))}

            {rows.length > 3 && (
              <>
                <Divider sm />
                {/* 第 4 名以后 */}
                {rows.slice(3).map((row, idx) => (
                  <NormalRow
                    key={row.user_id}
                    row={row}
                    rank={idx + 4}
                    isMe={row.user_id === myUserId}
                  />
                ))}
              </>
            )}

            {/* 自己不在前 20 的提示 */}
            {myUserId && myRowIndex === -1 && (
              <div
                style={{
                  padding: 12,
                  marginTop: 12,
                  textAlign: 'center',
                  background: 'var(--paper-1)',
                  border: '1px dashed var(--wood-3)',
                  fontSize: 11,
                  color: 'var(--ink-faint)',
                }}
              >
                你不在前 20 · 努力提交任务可登榜
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '6px 14px',
          borderTop: '2px solid var(--wood-3)',
          background: 'var(--paper-1)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--ink-faint)',
        }}
      >
        <span className="t-eyebrow">前 {rows.length} 名 · 周期累计</span>
        <span>Esc 关闭</span>
      </div>
    </div>
  );
}

// ============================================================
// Top 3 大行（金/银/铜）
// ============================================================

const RANK_ICONS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['#d4af37', '#c0c0c0', '#cd7f32'];

function TopRow({
  row,
  rank,
  isMe,
}: {
  row: { user_id: string; user_name: string; total_cv: number; task_count: number };
  rank: 1 | 2 | 3 | number;
  isMe: boolean;
}) {
  const level = estimateLevel(row.total_cv, row.task_count);
  const rankIdx = (rank - 1) as 0 | 1 | 2;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        marginBottom: 6,
        background: isMe ? 'rgba(218, 165, 32, 0.12)' : 'var(--paper-1)',
        border: `2px solid ${RANK_COLORS[rankIdx]}`,
        boxShadow: isMe ? '2px 2px 0 var(--gold)' : '2px 2px 0 var(--wood-4)',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          display: 'grid',
          placeItems: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {RANK_ICONS[rankIdx]}
      </div>
      <div
        style={{
          width: 36,
          height: 36,
          background: 'var(--paper-3)',
          border: '2px solid var(--wood-4)',
          padding: 1,
          flexShrink: 0,
        }}
      >
        <Sprite name="char" scale={1} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            marginBottom: 2,
            flexWrap: 'wrap',
          }}
        >
          <span
            className="t-title"
            style={{
              fontSize: 13,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.user_name}
          </span>
          {isMe && <Chip tone="gold">我</Chip>}
        </div>
        <div
          className="t-faint"
          style={{ fontSize: 10 }}
        >
          L{level} · {LEVEL_NAMES[level]} · {row.task_count} 任务
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 18,
            color: RANK_COLORS[rankIdx],
            fontWeight: 700,
          }}
        >
          {row.total_cv}
        </span>
        <span className="t-faint mono" style={{ fontSize: 9 }}>
          CV
        </span>
      </div>
    </div>
  );
}

// ============================================================
// 第 4 名以后 · 普通行
// ============================================================

function NormalRow({
  row,
  rank,
  isMe,
}: {
  row: { user_id: string; user_name: string; total_cv: number; task_count: number };
  rank: number;
  isMe: boolean;
}) {
  const level = estimateLevel(row.total_cv, row.task_count);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 10px',
        marginBottom: 3,
        background: isMe ? 'rgba(218, 165, 32, 0.12)' : 'transparent',
        border: isMe ? '1px solid var(--gold)' : '1px solid var(--paper-3)',
      }}
    >
      <div
        className="mono"
        style={{
          width: 28,
          fontSize: 14,
          color: 'var(--ink-faint)',
          textAlign: 'center',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <span
            className="t-title"
            style={{
              fontSize: 12,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.user_name}
          </span>
          {isMe && <Chip tone="gold">我</Chip>}
        </div>
        <div className="t-faint" style={{ fontSize: 9, marginTop: 1 }}>
          L{level} · {row.task_count} 任务
        </div>
      </div>
      <div
        className="mono"
        style={{
          fontSize: 13,
          color: 'var(--wood-3)',
          fontWeight: 600,
        }}
      >
        {row.total_cv}
      </div>
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 40,
        textAlign: 'center',
        color: 'var(--ink-faint)',
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}

export default NewMeritBoardPanel;
