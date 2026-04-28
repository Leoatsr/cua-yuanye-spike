import { useEffect, useState, useMemo } from 'react';
import { EventBus } from '../game/EventBus';
import {
  fetchMyQuestHistory,
  fetchMyQuestStats,
  fetchGlobalTimeline,
  fetchWorkshopStats,
  fetchGlobalStats,
  filterByTimeRange,
  filterByWorkshop,
  sourceLabel,
  sourceColor,
  workshopColor,
  type QuestHistoryEntry,
  type QuestStats,
  type GlobalTimelineEntry,
  type WorkshopStat,
  type GlobalStats,
  type TimeRangeFilter,
} from '../lib/questHistoryStore';

/**
 * D9-A + D9-B · 任务历史 + 个人统计 + 全社区时间线 + 工坊/全局统计
 *
 * 触发：H 键 / EventBus 'open-quest-history'
 *
 * 4 tab:
 *   - 📜 历史（个人）
 *   - 📊 统计（个人）
 *   - 🌐 全社区（全社区时间线）
 *   - 🏛 全局（看板 + 工坊排名）
 */

type Tab = 'history' | 'stats' | 'global' | 'workshops';

export function QuestHistoryPanel() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [loading, setLoading] = useState(false);
  // Pack 1
  const [history, setHistory] = useState<QuestHistoryEntry[]>([]);
  const [stats, setStats] = useState<QuestStats | null>(null);
  // Pack 2
  const [globalTimeline, setGlobalTimeline] = useState<GlobalTimelineEntry[]>([]);
  const [workshopStats, setWorkshopStats] = useState<WorkshopStat[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  // Pack 3: 时间 + 工坊筛选
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all');
  const [workshopFilter, setWorkshopFilter] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  // Pack 3: 客户端筛选数据
  const filteredHistory = useMemo(
    () => filterByWorkshop(filterByTimeRange(history, timeRange), workshopFilter),
    [history, timeRange, workshopFilter]
  );
  const filteredGlobalTimeline = useMemo(
    () => filterByWorkshop(filterByTimeRange(globalTimeline, timeRange), workshopFilter),
    [globalTimeline, timeRange, workshopFilter]
  );

  // 收集所有出现过的工坊名（用于工坊筛选下拉）
  const availableWorkshops = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => set.add(h.workshop));
    globalTimeline.forEach((h) => set.add(h.workshop));
    return Array.from(set).sort();
  }, [history, globalTimeline]);

  // Open via EventBus
  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
    };
    EventBus.on('open-quest-history', onOpen);
    return () => {
      EventBus.off('open-quest-history', onOpen);
    };
  }, []);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Load on open / tab change
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    const loadByTab = async () => {
      if (activeTab === 'history' || activeTab === 'stats') {
        // Pack 1: load both if either tab visited (cheap)
        if (history.length === 0 && !stats) {
          const [h, s] = await Promise.all([
            fetchMyQuestHistory(200),
            fetchMyQuestStats(),
          ]);
          if (cancelled) return;
          setHistory(h);
          setStats(s);
          if (h.length === 0 && !s) {
            setError('暂无数据 · 完成任务后再来看');
          }
        }
      } else if (activeTab === 'global') {
        if (globalTimeline.length === 0) {
          const t = await fetchGlobalTimeline(80);
          if (cancelled) return;
          setGlobalTimeline(t);
          if (t.length === 0) setError('暂无社区记录');
        }
      } else if (activeTab === 'workshops') {
        if (workshopStats.length === 0 || !globalStats) {
          const [ws, gs] = await Promise.all([
            fetchWorkshopStats(),
            fetchGlobalStats(),
          ]);
          if (cancelled) return;
          setWorkshopStats(ws);
          setGlobalStats(gs);
          if (ws.length === 0 && !gs) setError('暂无全局数据');
        }
      }
      if (!cancelled) setLoading(false);
    };

    void loadByTab();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 99,
          backdropFilter: 'blur(2px)',
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(720px, 92vw)',
          maxHeight: '85vh',
          background: 'linear-gradient(180deg, #1f2230 0%, #15171f 100%)',
          border: '1px solid rgba(184, 137, 58, 0.5)',
          borderRadius: 8,
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          color: '#f5f0e0',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px 12px',
            borderBottom: '1px solid rgba(184, 137, 58, 0.25)',
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: '#8a8576',
                letterSpacing: '0.15em',
                marginBottom: 2,
              }}
            >
              QUEST HISTORY · D9
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#e0b060' }}>
              我的任务史
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              padding: '4px 12px',
              fontSize: 11,
              background: 'transparent',
              border: '1px solid rgba(168, 179, 160, 0.3)',
              borderRadius: 3,
              color: '#a8a08e',
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '0.05em',
            }}
          >
            关闭 ESC
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(184, 137, 58, 0.2)',
            background: 'rgba(0,0,0,0.15)',
            overflowX: 'auto',
          }}
        >
          <TabButton
            label="📜 历史"
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            count={history.length}
          />
          <TabButton
            label="📊 统计"
            active={activeTab === 'stats'}
            onClick={() => setActiveTab('stats')}
          />
          <TabButton
            label="🌐 全社区"
            active={activeTab === 'global'}
            onClick={() => setActiveTab('global')}
          />
          <TabButton
            label="🏛 全局"
            active={activeTab === 'workshops'}
            onClick={() => setActiveTab('workshops')}
          />
        </div>

        {/* Pack 3: Filter Bar (history / global 标签页才显示) */}
        {(activeTab === 'history' || activeTab === 'global') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 18px',
              background: 'rgba(0,0,0,0.18)',
              borderBottom: '1px solid rgba(184, 137, 58, 0.15)',
              fontSize: 11,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ color: '#8a8576', letterSpacing: '0.05em' }}>筛选</span>
            {/* Time range chips */}
            <div style={{ display: 'flex', gap: 4 }}>
              <FilterChip
                label="全部"
                active={timeRange === 'all'}
                onClick={() => setTimeRange('all')}
              />
              <FilterChip
                label="本季"
                active={timeRange === 'quarter'}
                onClick={() => setTimeRange('quarter')}
              />
              <FilterChip
                label="本月"
                active={timeRange === 'month'}
                onClick={() => setTimeRange('month')}
              />
              <FilterChip
                label="本周"
                active={timeRange === 'week'}
                onClick={() => setTimeRange('week')}
              />
            </div>
            {/* Workshop dropdown */}
            <span style={{ marginLeft: 8, color: '#6e6856' }}>·</span>
            <select
              value={workshopFilter ?? ''}
              onChange={(e) => setWorkshopFilter(e.target.value || null)}
              style={{
                padding: '3px 6px',
                background: 'rgba(168, 179, 160, 0.08)',
                border: '1px solid rgba(168, 179, 160, 0.25)',
                borderRadius: 3,
                color: '#f5f0e0',
                fontSize: 11,
                fontFamily: 'inherit',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">全部工坊</option>
              {availableWorkshops.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            {/* Reset */}
            {(timeRange !== 'all' || workshopFilter !== null) && (
              <button
                onClick={() => {
                  setTimeRange('all');
                  setWorkshopFilter(null);
                }}
                style={{
                  marginLeft: 'auto',
                  padding: '3px 10px',
                  background: 'rgba(224, 122, 110, 0.12)',
                  border: '1px solid rgba(224, 122, 110, 0.35)',
                  borderRadius: 3,
                  color: '#e07a6e',
                  fontSize: 10,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.05em',
                }}
              >
                清除筛选
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 20px',
          }}
        >
          {loading ? (
            <div
              style={{
                textAlign: 'center',
                color: '#8a8576',
                padding: 40,
                fontStyle: 'italic',
              }}
            >
              载入中...
            </div>
          ) : error ? (
            <div
              style={{
                textAlign: 'center',
                color: '#8a8576',
                padding: 40,
                fontStyle: 'italic',
              }}
            >
              {error}
            </div>
          ) : activeTab === 'history' ? (
            <HistoryView entries={filteredHistory} />
          ) : activeTab === 'stats' ? (
            <StatsView stats={stats} />
          ) : activeTab === 'global' ? (
            <GlobalTimelineView entries={filteredGlobalTimeline} />
          ) : (
            <WorkshopsView workshopStats={workshopStats} globalStats={globalStats} />
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Tab button
// ============================================================================
function TabButton({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 18px',
        cursor: 'pointer',
        fontSize: 13,
        color: active ? '#e0b060' : '#a8a08e',
        borderBottom: `2px solid ${active ? '#b8893a' : 'transparent'}`,
        background: active ? 'rgba(184, 137, 58, 0.1)' : 'transparent',
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      {label}
      {typeof count === 'number' && (
        <span
          style={{
            marginLeft: 6,
            fontSize: 10,
            color: active ? '#e0b060' : '#6e6856',
            fontFamily: 'monospace',
          }}
        >
          ({count})
        </span>
      )}
    </div>
  );
}

// Pack 3: filter chip
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '3px 10px',
        cursor: 'pointer',
        borderRadius: 3,
        background: active ? 'rgba(224, 176, 96, 0.18)' : 'rgba(168, 179, 160, 0.05)',
        color: active ? '#e0b060' : '#a8a08e',
        border: `1px solid ${active ? 'rgba(224, 176, 96, 0.5)' : 'rgba(168, 179, 160, 0.15)'}`,
        fontSize: 11,
        userSelect: 'none',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </div>
  );
}

// ============================================================================
// History tab
// ============================================================================
function HistoryView({ entries }: { entries: QuestHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          color: '#8a8576',
          padding: 40,
          fontStyle: 'italic',
        }}
      >
        — 还没有任务记录 —
        <br />
        <span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
          完成任意工坊任务、提案投票、审核后会出现在这里
        </span>
      </div>
    );
  }

  return (
    <div style={{ fontSize: 12 }}>
      {entries.map((e) => {
        const t = new Date(e.submitted_at);
        const dateStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(
          2,
          '0'
        )}-${String(t.getDate()).padStart(2, '0')} ${String(
          t.getHours()
        ).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
        const sLabel = sourceLabel(e.source);
        const sColor = sourceColor(e.source);
        return (
          <div
            key={e.submission_id}
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr auto',
              gap: 12,
              padding: '10px 0',
              borderBottom: '1px solid rgba(184, 137, 58, 0.1)',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: '#6e6856',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
              }}
            >
              {dateStr}
            </div>
            <div>
              <div
                style={{
                  color: '#f5f0e0',
                  fontWeight: 500,
                  marginBottom: 2,
                }}
              >
                {e.quest_title}
              </div>
              <div style={{ fontSize: 10, color: '#8a8576' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0 5px',
                    background: `${sColor}22`,
                    color: sColor,
                    borderRadius: 2,
                    border: `1px solid ${sColor}55`,
                    marginRight: 6,
                  }}
                >
                  {sLabel}
                </span>
                {e.workshop && e.workshop !== '其他' && (
                  <span style={{ color: '#8a8576' }}>· {e.workshop}</span>
                )}
              </div>
            </div>
            <div
              style={{
                color: '#7fc090',
                fontWeight: 600,
                fontSize: 13,
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
              }}
            >
              +{e.cv_amount.toFixed(0)} CV
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Stats tab
// ============================================================================
function StatsView({ stats }: { stats: QuestStats | null }) {
  if (!stats || stats.total_tasks === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          color: '#8a8576',
          padding: 40,
          fontStyle: 'italic',
        }}
      >
        — 暂无数据 —
        <br />
        <span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
          完成任务后会自动统计
        </span>
      </div>
    );
  }

  const firstAt = stats.first_submission_at
    ? new Date(stats.first_submission_at)
    : null;
  const lastAt = stats.last_submission_at
    ? new Date(stats.last_submission_at)
    : null;
  const daysActive =
    firstAt && lastAt
      ? Math.max(
          1,
          Math.ceil(
            (lastAt.getTime() - firstAt.getTime()) / (1000 * 60 * 60 * 24)
          )
        )
      : 1;

  // Workshop distribution → array sorted by count
  const workshops = Object.entries(stats.workshop_distribution).sort(
    (a, b) => b[1] - a[1]
  );
  const sources = Object.entries(stats.source_distribution).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div>
      {/* Top stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 1,
          marginBottom: 24,
          background: 'rgba(184, 137, 58, 0.15)',
          padding: 1,
        }}
      >
        <StatCell value={stats.total_tasks} label="总任务" color="#7fc090" />
        <StatCell
          value={stats.total_cv.toFixed(0)}
          label="总 CV"
          color="#e0b060"
        />
        <StatCell value={daysActive} label="活跃天数" color="#a78bfa" />
        <StatCell
          value={(stats.total_cv / Math.max(stats.total_tasks, 1)).toFixed(1)}
          label="平均 CV/任务"
          color="#a5c8ff"
        />
      </div>

      {/* Source distribution (pie) */}
      <SectionTitle>来源分布</SectionTitle>
      <PieChart
        data={sources.map(([k, v]) => ({
          label: sourceLabel(k),
          value: v,
          color: sourceColor(k),
        }))}
      />

      {/* Workshop distribution (bars) */}
      <div style={{ marginTop: 32 }}>
        <SectionTitle>工坊分布</SectionTitle>
        {workshops.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: '#8a8576',
              fontSize: 12,
              fontStyle: 'italic',
            }}
          >
            — 暂无工坊任务 —
          </div>
        ) : (
          <div>
            {workshops.map(([w, count]) => {
              const max = Math.max(...workshops.map(([, c]) => c));
              const pct = (count / max) * 100;
              const color = workshopColor(w);
              return (
                <div
                  key={w}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr 40px',
                    gap: 10,
                    alignItems: 'center',
                    padding: '6px 0',
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: '#a8a08e' }}>{w}</div>
                  <div
                    style={{
                      height: 16,
                      background: 'rgba(184, 137, 58, 0.1)',
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${color}cc, ${color}66)`,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      color: '#f5f0e0',
                      fontFamily: 'monospace',
                      fontSize: 11,
                      textAlign: 'right',
                    }}
                  >
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* First/last */}
      {firstAt && lastAt && (
        <div
          style={{
            marginTop: 32,
            padding: '12px 14px',
            background: 'rgba(0,0,0,0.2)',
            border: '1px dashed rgba(184, 137, 58, 0.2)',
            fontSize: 11,
            color: '#8a8576',
            lineHeight: 1.7,
          }}
        >
          <div>
            <strong style={{ color: '#a8a08e' }}>初次提交</strong> ·{' '}
            {firstAt.toLocaleDateString('zh-CN')}
          </div>
          <div>
            <strong style={{ color: '#a8a08e' }}>最近提交</strong> ·{' '}
            {lastAt.toLocaleDateString('zh-CN')}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: '#a8a08e',
        letterSpacing: '0.15em',
        marginBottom: 10,
        paddingBottom: 4,
        borderBottom: '1px dashed rgba(184, 137, 58, 0.2)',
      }}
    >
      {children}
    </div>
  );
}

function StatCell({
  value,
  label,
  color,
}: {
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: '#15171f',
        padding: '14px 12px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color,
          marginBottom: 2,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: '#8a8576',
          letterSpacing: '0.1em',
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ============================================================================
// Pie chart (pure SVG)
// ============================================================================
function PieChart({
  data,
}: {
  data: { label: string; value: number; color: string }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const radius = 70;
  const cx = 80;
  const cy = 80;
  let acc = 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
      }}
    >
      <svg width={160} height={160} viewBox="0 0 160 160">
        {data.map((d) => {
          const startAngle = (acc / total) * Math.PI * 2 - Math.PI / 2;
          acc += d.value;
          const endAngle = (acc / total) * Math.PI * 2 - Math.PI / 2;
          const x1 = cx + radius * Math.cos(startAngle);
          const y1 = cy + radius * Math.sin(startAngle);
          const x2 = cx + radius * Math.cos(endAngle);
          const y2 = cy + radius * Math.sin(endAngle);
          const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
          // Special case: only one slice (full circle) — draw a circle instead
          if (data.length === 1) {
            return (
              <circle
                key={d.label}
                cx={cx}
                cy={cy}
                r={radius}
                fill={d.color}
                stroke="#15171f"
                strokeWidth={2}
              />
            );
          }
          const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          return (
            <path
              key={d.label}
              d={path}
              fill={d.color}
              stroke="#15171f"
              strokeWidth={2}
            />
          );
        })}
        {/* Center hole for donut effect */}
        <circle cx={cx} cy={cy} r={28} fill="#1a1d28" />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill="#e0b060"
          fontSize="18"
          fontWeight="700"
          fontFamily="serif"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          fill="#8a8576"
          fontSize="9"
          letterSpacing="2"
        >
          TOTAL
        </text>
      </svg>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 12,
        }}
      >
        {data.map((d) => {
          const pct = ((d.value / total) * 100).toFixed(1);
          return (
            <div
              key={d.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  background: d.color,
                  borderRadius: 2,
                }}
              />
              <span style={{ color: '#a8a08e', minWidth: 60 }}>{d.label}</span>
              <span
                style={{
                  color: '#f5f0e0',
                  fontFamily: 'monospace',
                  fontSize: 11,
                }}
              >
                {d.value}
              </span>
              <span
                style={{
                  color: '#6e6856',
                  fontFamily: 'monospace',
                  fontSize: 10,
                }}
              >
                ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ============================================================================
// D9-B · Pack 2 · Global timeline view
// ============================================================================
function GlobalTimelineView({ entries }: { entries: GlobalTimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#8a8576', padding: 40, fontStyle: 'italic' }}>
        — 全社区暂无任务记录 —
      </div>
    );
  }

  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ fontSize: 10, color: '#6e6856', marginBottom: 12, letterSpacing: '0.05em' }}>
        最近 {entries.length} 条公开提交 · 仅显示已通过审核的
      </div>
      {entries.map((e) => {
        const t = new Date(e.submitted_at);
        const dateStr = `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(
          2, '0'
        )} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
        const sLabel = sourceLabel(e.source);
        const sColor = sourceColor(e.source);

        return (
          <div
            key={e.submission_id + e.user_id}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 80px 1fr auto',
              gap: 10,
              padding: '8px 0',
              borderBottom: '1px solid rgba(184, 137, 58, 0.1)',
              alignItems: 'center',
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: e.avatar_url
                  ? `url(${e.avatar_url}) center/cover`
                  : 'linear-gradient(135deg, #b8893a, #6e6856)',
                border: '1px solid rgba(184, 137, 58, 0.3)',
                flexShrink: 0,
              }}
              title={e.display_name}
            />
            {/* Time */}
            <div
              style={{
                fontSize: 10,
                color: '#6e6856',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
              }}
            >
              {dateStr}
            </div>
            {/* Body */}
            <div>
              <div style={{ color: '#f5f0e0', fontWeight: 500, marginBottom: 2 }}>
                <span style={{ color: '#a5c8ff', marginRight: 6 }}>{e.display_name}</span>
                <span style={{ color: '#8a8576', fontSize: 11 }}>· {e.quest_title}</span>
              </div>
              <div style={{ fontSize: 10, color: '#8a8576' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0 5px',
                    background: `${sColor}22`,
                    color: sColor,
                    borderRadius: 2,
                    border: `1px solid ${sColor}55`,
                    marginRight: 6,
                  }}
                >
                  {sLabel}
                </span>
                {e.workshop && e.workshop !== '其他' && (
                  <span style={{ color: '#8a8576' }}>{e.workshop}</span>
                )}
              </div>
            </div>
            {/* CV */}
            <div
              style={{
                color: '#7fc090',
                fontWeight: 600,
                fontSize: 12,
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
              }}
            >
              +{e.cv_amount.toFixed(0)}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ============================================================================
// D9-B · Pack 2 · Workshops + Global stats view
// ============================================================================
function WorkshopsView({
  workshopStats,
  globalStats,
}: {
  workshopStats: WorkshopStat[];
  globalStats: GlobalStats | null;
}) {
  if (!globalStats && workshopStats.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#8a8576', padding: 40, fontStyle: 'italic' }}>
        — 暂无全局数据 —
      </div>
    );
  }

  return (
    <div>
      {/* Global stats banner */}
      {globalStats && (
        <>
          <SectionTitle>全局活跃度</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              background: 'rgba(184, 137, 58, 0.15)',
              padding: 1,
              marginBottom: 24,
            }}
          >
            <PeriodCard
              title="本周"
              completions={globalStats.past_week.completions}
              cv={globalStats.past_week.total_cv}
              players={globalStats.past_week.active_players}
              color="#7fc090"
            />
            <PeriodCard
              title="本月"
              completions={globalStats.past_month.completions}
              cv={globalStats.past_month.total_cv}
              players={globalStats.past_month.active_players}
              color="#e0b060"
            />
            <PeriodCard
              title="全部"
              completions={globalStats.all_time.completions}
              cv={globalStats.all_time.total_cv}
              players={globalStats.all_time.total_players}
              color="#a78bfa"
            />
          </div>

          {/* Top contributors this month */}
          {globalStats.top_contributors_month.length > 0 && (
            <>
              <SectionTitle>本月贡献榜（前 5）</SectionTitle>
              <div style={{ marginBottom: 24 }}>
                {globalStats.top_contributors_month.map((c, i) => (
                  <div
                    key={c.username || c.name + i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '24px auto 1fr auto auto',
                      gap: 10,
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(184, 137, 58, 0.1)',
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        color: i === 0 ? '#e0b060' : i === 1 ? '#a8a08e' : i === 2 ? '#b8893a' : '#6e6856',
                        fontWeight: 700,
                        fontSize: 14,
                        fontFamily: 'serif',
                        textAlign: 'center',
                      }}
                    >
                      {i + 1}
                    </div>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: c.avatar_url
                          ? `url(${c.avatar_url}) center/cover`
                          : 'linear-gradient(135deg, #b8893a, #6e6856)',
                        border: '1px solid rgba(184, 137, 58, 0.3)',
                      }}
                    />
                    <div style={{ color: '#f5f0e0' }}>{c.name}</div>
                    <div
                      style={{
                        color: '#8a8576',
                        fontFamily: 'monospace',
                        fontSize: 10,
                      }}
                    >
                      {c.tasks} 任务
                    </div>
                    <div
                      style={{
                        color: '#7fc090',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      +{c.cv.toFixed(0)} CV
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Workshop ranking */}
      {workshopStats.length > 0 && (
        <>
          <SectionTitle>工坊排名（按总 CV）</SectionTitle>
          <div>
            {workshopStats.map((w) => {
              const max = Math.max(...workshopStats.map((s) => Number(s.total_cv)));
              const pct = (Number(w.total_cv) / max) * 100;
              const color = workshopColor(w.workshop);
              return (
                <div
                  key={w.workshop + w.rank}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '20px 130px 1fr auto auto',
                    gap: 10,
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      color: w.rank === 1 ? '#e0b060' : w.rank === 2 ? '#a8a08e' : w.rank === 3 ? '#b8893a' : '#6e6856',
                      fontWeight: 700,
                      fontSize: 13,
                      fontFamily: 'serif',
                      textAlign: 'center',
                    }}
                  >
                    {w.rank}
                  </div>
                  <div style={{ color: '#a8a08e' }}>{w.workshop}</div>
                  <div
                    style={{
                      height: 14,
                      background: 'rgba(184, 137, 58, 0.08)',
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${color}cc, ${color}66)`,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      color: '#8a8576',
                      fontFamily: 'monospace',
                      fontSize: 10,
                      whiteSpace: 'nowrap',
                    }}
                    title={`${w.unique_contributors} 贡献者 · 平均 ${w.avg_cv_per_task} CV/任务`}
                  >
                    {w.total_completions} · {w.unique_contributors}人
                  </div>
                  <div
                    style={{
                      color: '#7fc090',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                      textAlign: 'right',
                      minWidth: 60,
                    }}
                  >
                    {Number(w.total_cv).toFixed(0)} CV
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 10,
              color: '#6e6856',
              letterSpacing: '0.05em',
            }}
          >
            ▮ 列表 = 任务数 · 唯一贡献者数 · 总 CV
          </div>
        </>
      )}
    </div>
  );
}

function PeriodCard({
  title,
  completions,
  cv,
  players,
  color,
}: {
  title: string;
  completions: number;
  cv: number;
  players: number;
  color: string;
}) {
  return (
    <div style={{ background: '#15171f', padding: '14px 12px' }}>
      <div
        style={{
          fontSize: 10,
          color: '#8a8576',
          letterSpacing: '0.15em',
          marginBottom: 8,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color,
          marginBottom: 4,
          letterSpacing: '-0.02em',
        }}
      >
        {completions}
      </div>
      <div style={{ fontSize: 10, color: '#a8a08e', lineHeight: 1.6 }}>
        <div>{Number(cv).toFixed(0)} CV 入账</div>
        <div>{players} 玩家活跃</div>
      </div>
    </div>
  );
}
