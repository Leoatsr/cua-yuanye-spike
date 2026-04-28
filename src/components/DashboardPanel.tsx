import { useEffect, useState, useMemo } from 'react';
import { EventBus } from '../game/EventBus';
import {
  fetchUserActivity,
  fetchLevelDistribution,
  fetchQuestVolume,
  fetchQuestQuality,
  fetchCVFlow,
  fetchChatHealth,
  fetchFriendsHealth,
  fetchFollowsHealth,
  fetchErrorHealth,
  fetchRetention,
  fetchOnlineDuration,
  fetchSceneDistribution,
  type UserActivity,
  type LevelDist,
  type QuestVolume,
  type QuestQuality,
  type CVFlow,
  type ChatHealth,
  type FriendsHealth,
  type FollowsHealth,
  type ErrorHealth,
  type RetentionData,
  type OnlineDuration,
  type SceneDistribution,
  type SeriesPoint,
  type TimeWindow,
} from '../lib/dashboardStore';

/**
 * J2-A · 数据看板（Y 键打开）
 *
 * 4 tab：
 *   - 👥 用户
 *   - 📋 任务
 *   - 💰 CV
 *   - 🏛️ 工坊
 *
 * 时间窗口：7d / 30d / 90d
 */

type Tab = 'users' | 'quests' | 'cv' | 'workshops' | 'social' | 'errors' | 'retention';

export function DashboardPanel() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(30);
  const [loading, setLoading] = useState(false);
  const [userActivity, setUserActivity] = useState<UserActivity | null>(null);
  const [levelDist, setLevelDist] = useState<LevelDist | null>(null);
  const [questVolume, setQuestVolume] = useState<QuestVolume | null>(null);
  const [questQuality, setQuestQuality] = useState<QuestQuality | null>(null);
  const [cvFlow, setCvFlow] = useState<CVFlow | null>(null);
  // J2-B
  const [chatHealth, setChatHealth] = useState<ChatHealth | null>(null);
  const [friendsHealth, setFriendsHealth] = useState<FriendsHealth | null>(null);
  const [followsHealth, setFollowsHealth] = useState<FollowsHealth | null>(null);
  const [errorHealth, setErrorHealth] = useState<ErrorHealth | null>(null);
  // J2-C
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [onlineDuration, setOnlineDuration] = useState<OnlineDuration | null>(null);
  const [sceneDist, setSceneDist] = useState<SceneDistribution | null>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    EventBus.on('open-dashboard', onOpen);
    return () => {
      EventBus.off('open-dashboard', onOpen);
    };
  }, []);

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

  // Load on open + tab change + window change
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      const [ua, ld, qv, qq, cv, ch, fh, foh, eh, rt, od, sd] = await Promise.all([
        fetchUserActivity(timeWindow),
        fetchLevelDistribution(),
        fetchQuestVolume(timeWindow),
        fetchQuestQuality(),
        fetchCVFlow(timeWindow),
        fetchChatHealth(timeWindow),
        fetchFriendsHealth(timeWindow),
        fetchFollowsHealth(timeWindow),
        fetchErrorHealth(7),
        fetchRetention(),
        fetchOnlineDuration(timeWindow),
        fetchSceneDistribution(),
      ]);
      if (cancelled) return;
      setUserActivity(ua);
      setLevelDist(ld);
      setQuestVolume(qv);
      setQuestQuality(qq);
      setCvFlow(cv);
      setChatHealth(ch);
      setFriendsHealth(fh);
      setFollowsHealth(foh);
      setErrorHealth(eh);
      setRetention(rt);
      setOnlineDuration(od);
      setSceneDist(sd);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, timeWindow]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          zIndex: 99,
          backdropFilter: 'blur(2px)',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(880px, 95vw)',
          maxHeight: '88vh',
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
            padding: '14px 18px 10px',
            borderBottom: '1px solid rgba(184, 137, 58, 0.25)',
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#8a8576', letterSpacing: '0.15em', marginBottom: 2 }}>
              DASHBOARD · J2-A
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#e0b060' }}>
              数据看板
              <span style={{ marginLeft: 8, fontSize: 10, color: '#6e6856', fontWeight: 400 }}>
                · 仅供运营观察
              </span>
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

        {/* Toolbar: tabs + time window */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'stretch',
            background: 'rgba(0,0,0,0.15)',
            borderBottom: '1px solid rgba(184, 137, 58, 0.2)',
          }}
        >
          <div style={{ display: 'flex' }}>
            <TabButton label="👥 用户" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
            <TabButton label="📋 任务" active={activeTab === 'quests'} onClick={() => setActiveTab('quests')} />
            <TabButton label="💰 CV" active={activeTab === 'cv'} onClick={() => setActiveTab('cv')} />
            <TabButton label="🏛 工坊" active={activeTab === 'workshops'} onClick={() => setActiveTab('workshops')} />
            <TabButton label="💬 社交" active={activeTab === 'social'} onClick={() => setActiveTab('social')} />
            <TabButton label="⚠️ 错误" active={activeTab === 'errors'} onClick={() => setActiveTab('errors')} />
            <TabButton label="📊 留存" active={activeTab === 'retention'} onClick={() => setActiveTab('retention')} />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 14px',
              fontSize: 11,
            }}
          >
            <span style={{ color: '#6e6856', letterSpacing: '0.05em' }}>窗口</span>
            <WindowChip value={7} active={timeWindow === 7} onClick={() => setTimeWindow(7)} />
            <WindowChip value={30} active={timeWindow === 30} onClick={() => setTimeWindow(30)} />
            <WindowChip value={90} active={timeWindow === 90} onClick={() => setTimeWindow(90)} />
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 20px 24px',
          }}
        >
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#8a8576', fontStyle: 'italic' }}>
              载入中...
            </div>
          ) : activeTab === 'users' ? (
            <UsersView userActivity={userActivity} levelDist={levelDist} window={timeWindow} />
          ) : activeTab === 'quests' ? (
            <QuestsView questVolume={questVolume} questQuality={questQuality} window={timeWindow} />
          ) : activeTab === 'cv' ? (
            <CVView cvFlow={cvFlow} window={timeWindow} />
          ) : activeTab === 'workshops' ? (
            <WorkshopsView questQuality={questQuality} />
          ) : activeTab === 'social' ? (
            <SocialView
              chatHealth={chatHealth}
              friendsHealth={friendsHealth}
              followsHealth={followsHealth}
              window={timeWindow}
            />
          ) : activeTab === 'errors' ? (
            <ErrorsView errorHealth={errorHealth} />
          ) : (
            <RetentionView
              retention={retention}
              onlineDuration={onlineDuration}
              sceneDist={sceneDist}
              window={timeWindow}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Tab + Window chips
// ============================================================================
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
    <div
      onClick={onClick}
      style={{
        padding: '10px 18px',
        cursor: 'pointer',
        fontSize: 13,
        color: active ? '#e0b060' : '#a8a08e',
        borderBottom: `2px solid ${active ? '#b8893a' : 'transparent'}`,
        background: active ? 'rgba(184, 137, 58, 0.1)' : 'transparent',
        userSelect: 'none',
      }}
    >
      {label}
    </div>
  );
}

function WindowChip({
  value,
  active,
  onClick,
}: {
  value: number;
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
        userSelect: 'none',
        fontFamily: 'monospace',
        letterSpacing: '0.05em',
      }}
    >
      {value}d
    </div>
  );
}


// ============================================================================
// Users view
// ============================================================================
function UsersView({
  userActivity,
  levelDist,
  window: windowDays,
}: {
  userActivity: UserActivity | null;
  levelDist: LevelDist | null;
  window: TimeWindow;
}) {
  if (!userActivity) {
    return <EmptyView msg="无用户数据" />;
  }
  const ua = userActivity;

  return (
    <div>
      {/* Top stat cards */}
      <SectionTitle>用户活跃度</SectionTitle>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'rgba(184, 137, 58, 0.15)',
          padding: 1,
          marginBottom: 24,
        }}
      >
        <StatCard label="总用户" value={ua.total_users} color="#a78bfa" />
        <StatCard label="今日活跃" value={ua.active_today} color="#7fc090" sub={`+${ua.new_today} 新`} />
        <StatCard label="本周活跃" value={ua.active_week} color="#e0b060" sub={`+${ua.new_week} 新`} />
        <StatCard label="本月活跃" value={ua.active_month} color="#f4a8c0" sub={`+${ua.new_month} 新`} />
      </div>

      {/* DAU 折线图 */}
      <SectionTitle>{windowDays} 日 DAU 趋势</SectionTitle>
      <LineChart
        data={ua.dau_series}
        color="#7fc090"
        height={140}
        valueLabel="活跃用户"
      />

      {/* 新增用户折线图 */}
      <div style={{ marginTop: 24 }}>
        <SectionTitle>{windowDays} 日新增用户</SectionTitle>
        <LineChart
          data={ua.new_users_series}
          color="#e0b060"
          height={120}
          valueLabel="新增"
        />
      </div>

      {/* Level distribution */}
      {levelDist && levelDist.levels.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <SectionTitle>等级分布</SectionTitle>
          <div>
            {levelDist.levels.map((lv) => {
              const total = levelDist.levels.reduce((s, l) => s + l.count, 0);
              const pct = total > 0 ? (lv.count / total) * 100 : 0;
              const color = lv.level === 0 ? '#6e6856'
                : lv.level === 1 ? '#7fc090'
                : lv.level === 2 ? '#e0b060'
                : '#a78bfa';
              return (
                <div
                  key={lv.level}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr 60px',
                    gap: 10,
                    padding: '6px 0',
                    fontSize: 12,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ color, fontFamily: 'monospace', fontWeight: 700 }}>L{lv.level}</span>
                    <span style={{ marginLeft: 6, color: '#a8a08e' }}>{lv.level_name}</span>
                  </div>
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
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                  <div style={{ color: '#f5f0e0', fontFamily: 'monospace', fontSize: 11, textAlign: 'right' }}>
                    {lv.count} <span style={{ color: '#6e6856' }}>({pct.toFixed(0)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================================
// Quests view
// ============================================================================
function QuestsView({
  questVolume,
  questQuality,
  window: windowDays,
}: {
  questVolume: QuestVolume | null;
  questQuality: QuestQuality | null;
  window: TimeWindow;
}) {
  if (!questVolume) return <EmptyView msg="无任务数据" />;
  const qv = questVolume;
  const qq = questQuality;

  return (
    <div>
      <SectionTitle>任务提交量</SectionTitle>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'rgba(184, 137, 58, 0.15)',
          padding: 1,
          marginBottom: 24,
        }}
      >
        <StatCard label="今日" value={qv.total_today} color="#7fc090" />
        <StatCard label="本周" value={qv.total_week} color="#e0b060" />
        <StatCard label="本月" value={qv.total_month} color="#f4a8c0" />
        <StatCard label="累计" value={qv.total_all} color="#a78bfa" />
      </div>

      <SectionTitle>{windowDays} 日提交趋势</SectionTitle>
      <LineChart
        data={qv.volume_series}
        color="#e0b060"
        height={150}
        valueLabel="任务"
      />

      {qq && (
        <div style={{ marginTop: 24 }}>
          <SectionTitle>任务质量</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              background: 'rgba(184, 137, 58, 0.15)',
              padding: 1,
            }}
          >
            <StatCard label="✓ 已通过" value={qq.approved} color="#7fc090" />
            <StatCard label="⏳ 待审核" value={qq.pending} color="#e0b060" />
            <StatCard label="✗ 已否决" value={qq.rejected} color="#e07a6e" />
          </div>
          {(qq.approved + qq.rejected) > 0 && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: '#a8a08e',
                textAlign: 'center',
              }}
            >
              通过率:{' '}
              <strong style={{ color: '#7fc090', fontFamily: 'monospace' }}>
                {((qq.approved / (qq.approved + qq.rejected)) * 100).toFixed(1)}%
              </strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ============================================================================
// CV view
// ============================================================================
function CVView({ cvFlow, window: windowDays }: { cvFlow: CVFlow | null; window: TimeWindow }) {
  if (!cvFlow) return <EmptyView msg="无 CV 数据" />;

  return (
    <div>
      <SectionTitle>CV 流转</SectionTitle>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'rgba(184, 137, 58, 0.15)',
          padding: 1,
          marginBottom: 24,
        }}
      >
        <StatCard label="今日 CV" value={Math.round(cvFlow.today_cv)} color="#7fc090" />
        <StatCard label="本周 CV" value={Math.round(cvFlow.week_cv)} color="#e0b060" />
        <StatCard label="本月 CV" value={Math.round(cvFlow.month_cv)} color="#f4a8c0" />
        <StatCard label="累计 CV" value={Math.round(cvFlow.total_cv)} color="#a78bfa" />
      </div>

      <SectionTitle>{windowDays} 日发出 CV</SectionTitle>
      <LineChart
        data={cvFlow.cv_series.map((p) => ({ date: p.date, count: p.cv ?? 0 }))}
        color="#7fc090"
        height={140}
        valueLabel="CV"
      />

      <div
        style={{
          marginTop: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1,
          background: 'rgba(184, 137, 58, 0.15)',
          padding: 1,
        }}
      >
        <StatCard label="平均 CV / 用户" value={cvFlow.avg_cv_per_user} color="#a5c8ff" />
        <StatCard label="平均 CV / 任务" value={cvFlow.avg_cv_per_task} color="#a78bfa" />
      </div>

      {cvFlow.top_earners.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <SectionTitle>{windowDays} 日 Top 5 贡献者</SectionTitle>
          <div>
            {cvFlow.top_earners.map((e, i) => (
              <div
                key={(e.username || e.name) + i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px auto 1fr auto auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    color: i === 0 ? '#e0b060' : i === 1 ? '#a8a08e' : i === 2 ? '#b8893a' : '#6e6856',
                    fontWeight: 700,
                    fontSize: 14,
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
                    background: e.avatar_url
                      ? `url(${e.avatar_url}) center/cover`
                      : 'linear-gradient(135deg, #b8893a, #6e6856)',
                    border: '1px solid rgba(184, 137, 58, 0.3)',
                  }}
                />
                <div style={{ color: '#f5f0e0' }}>{e.name}</div>
                <div style={{ color: '#8a8576', fontFamily: 'monospace', fontSize: 10 }}>
                  {e.tasks} 任务
                </div>
                <div
                  style={{
                    color: '#7fc090',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                  }}
                >
                  +{e.cv.toFixed(0)} CV
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================================
// Workshops view
// ============================================================================
function WorkshopsView({ questQuality }: { questQuality: QuestQuality | null }) {
  if (!questQuality || questQuality.workshop_breakdown.length === 0) {
    return <EmptyView msg="无工坊数据" />;
  }
  const items = questQuality.workshop_breakdown;
  const maxCv = Math.max(...items.map((w) => w.cv));

  return (
    <div>
      <SectionTitle>9 工坊对比（按 CV 排序）</SectionTitle>
      <div>
        {items.map((w, i) => {
          const pct = maxCv > 0 ? (w.cv / maxCv) * 100 : 0;
          const color = i === 0 ? '#e0b060' : i === 1 ? '#a78bfa' : i === 2 ? '#7fc090' : '#a5c8ff';
          return (
            <div
              key={w.workshop}
              style={{
                display: 'grid',
                gridTemplateColumns: '20px 140px 1fr auto auto auto',
                gap: 10,
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
                fontSize: 12,
              }}
            >
              <div
                style={{
                  color: i === 0 ? '#e0b060' : i === 1 ? '#a8a08e' : i === 2 ? '#b8893a' : '#6e6856',
                  fontWeight: 700,
                  fontSize: 14,
                  textAlign: 'center',
                }}
              >
                {i + 1}
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
              <div style={{ color: '#8a8576', fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>
                {w.count} 任务
              </div>
              <div style={{ color: '#8a8576', fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>
                {w.unique_users} 人
              </div>
              <div
                style={{
                  color: '#7fc090',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  minWidth: 70,
                  textAlign: 'right',
                }}
              >
                {w.cv.toFixed(0)} CV
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ============================================================================
// Helper: SectionTitle, StatCard, EmptyView
// ============================================================================
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

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  color: string;
  sub?: string;
}) {
  return (
    <div style={{ background: '#15171f', padding: '14px 12px', textAlign: 'center' }}>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color,
          marginBottom: 4,
          letterSpacing: '-0.02em',
          fontFamily: 'serif',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10, color: '#8a8576', letterSpacing: '0.1em' }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 9, color: color, marginTop: 3, opacity: 0.7 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function EmptyView({ msg }: { msg: string }) {
  return (
    <div
      style={{
        padding: 60,
        textAlign: 'center',
        color: '#8a8576',
        fontStyle: 'italic',
      }}
    >
      — {msg} —
    </div>
  );
}


// ============================================================================
// Line chart (pure SVG)
// ============================================================================
function LineChart({
  data,
  color,
  height,
  valueLabel,
}: {
  data: SeriesPoint[];
  color: string;
  height: number;
  valueLabel: string;
}) {
  const W = 800;
  const H = height;
  const PAD_L = 40;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 28;

  // Normalize: each point has count or cv
  const points = useMemo(() => {
    return data.map((p) => ({
      date: p.date,
      value: (p.count ?? p.cv ?? 0) as number,
    }));
  }, [data]);

  if (points.length === 0) {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: '#8a8576', fontSize: 11, fontStyle: 'italic' }}>
        — 暂无数据 —
      </div>
    );
  }

  const maxV = Math.max(...points.map((p) => p.value), 1);
  const minV = 0;

  const xScale = (i: number) =>
    PAD_L + (i / Math.max(points.length - 1, 1)) * (W - PAD_L - PAD_R);
  const yScale = (v: number) =>
    PAD_T + (1 - (v - minV) / (maxV - minV)) * (H - PAD_T - PAD_B);

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.value)}`)
    .join(' ');

  // Area under line
  const areaD =
    pathD +
    ` L ${xScale(points.length - 1)} ${H - PAD_B}` +
    ` L ${xScale(0)} ${H - PAD_B} Z`;

  // Y axis ticks (3 levels)
  const ticks = [0, 0.5, 1].map((t) => ({
    value: Math.round(minV + t * (maxV - minV)),
    y: yScale(minV + t * (maxV - minV)),
  }));

  // X axis date labels (start, mid, end)
  const xLabels = [0, Math.floor(points.length / 2), points.length - 1]
    .filter((i, idx, arr) => arr.indexOf(i) === idx)
    .map((i) => {
      const d = new Date(points[i].date);
      return {
        x: xScale(i),
        label: `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`,
      };
    });

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%' }}>
        {/* Grid */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={t.y}
            y2={t.y}
            stroke="rgba(184, 137, 58, 0.1)"
            strokeWidth={1}
          />
        ))}
        {/* Y labels */}
        {ticks.map((t, i) => (
          <text
            key={i}
            x={PAD_L - 6}
            y={t.y + 4}
            textAnchor="end"
            fontSize={10}
            fill="#6e6856"
            fontFamily="monospace"
          >
            {t.value}
          </text>
        ))}
        {/* Area */}
        <path d={areaD} fill={color} fillOpacity={0.12} />
        {/* Line */}
        <path d={pathD} stroke={color} strokeWidth={2} fill="none" />
        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(p.value)}
            r={2.5}
            fill={color}
          >
            <title>{`${p.date}: ${p.value} ${valueLabel}`}</title>
          </circle>
        ))}
        {/* X labels */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#6e6856"
            fontFamily="monospace"
          >
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  );
}


// ============================================================================
// J2-B · 社交健康
// ============================================================================
function SocialView({
  chatHealth,
  friendsHealth,
  followsHealth,
  window: windowDays,
}: {
  chatHealth: ChatHealth | null;
  friendsHealth: FriendsHealth | null;
  followsHealth: FollowsHealth | null;
  window: TimeWindow;
}) {
  return (
    <div>
      {/* Chat */}
      <SectionTitle>💬 聊天活跃度</SectionTitle>
      {!chatHealth || chatHealth.note ? (
        <EmptyView msg={chatHealth?.note ?? '无聊天数据'} />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
              background: 'rgba(184, 137, 58, 0.15)',
              padding: 1,
              marginBottom: 16,
            }}
          >
            <StatCard label="今日消息" value={chatHealth.today_messages} color="#7fc090" />
            <StatCard label="本周消息" value={chatHealth.week_messages} color="#e0b060" />
            <StatCard
              label="活跃发言人"
              value={chatHealth.unique_senders_month}
              color="#a78bfa"
              sub="近 30 日"
            />
            <StatCard
              label="人均消息"
              value={chatHealth.avg_per_user_week}
              color="#f4a8c0"
              sub="本周"
            />
          </div>

          {/* Channel breakdown */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              background: 'rgba(184, 137, 58, 0.15)',
              padding: 1,
              marginBottom: 16,
            }}
          >
            <StatCard label="🌍 世界" value={chatHealth.world_count} color="#7fc090" />
            <StatCard label="🏠 工坊" value={chatHealth.scene_count} color="#a5c8ff" />
            <StatCard label="💌 私聊" value={chatHealth.private_count} color="#f4a8c0" />
          </div>

          <div style={{ marginBottom: 24 }}>
            <SectionTitle>{windowDays} 日聊天量趋势</SectionTitle>
            <LineChart
              data={chatHealth.message_series}
              color="#a5c8ff"
              height={140}
              valueLabel="消息"
            />
          </div>
        </>
      )}

      {/* Friends */}
      <SectionTitle>🤝 好友关系</SectionTitle>
      {!friendsHealth || friendsHealth.note ? (
        <EmptyView msg={friendsHealth?.note ?? '无好友数据'} />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              background: 'rgba(184, 137, 58, 0.15)',
              padding: 1,
              marginBottom: 16,
            }}
          >
            <StatCard label="好友对" value={friendsHealth.total_pairs} color="#7fc090" />
            <StatCard label="待处理" value={friendsHealth.pending_count} color="#e0b060" />
            <StatCard label="本周新增" value={friendsHealth.new_friendships_week} color="#a78bfa" />
          </div>

          {friendsHealth.friendships_series.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionTitle>{windowDays} 日新成立好友</SectionTitle>
              <LineChart
                data={friendsHealth.friendships_series}
                color="#7fc090"
                height={100}
                valueLabel="对好友"
              />
            </div>
          )}

          {friendsHealth.top_socializers.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionTitle>Top 5 朋友最多</SectionTitle>
              <div>
                {friendsHealth.top_socializers.map((s, i) => (
                  <SocialRankRow
                    key={(s.username || s.name) + i}
                    rank={i + 1}
                    name={s.name}
                    avatar={s.avatar_url}
                    count={s.friend_count}
                    countLabel="朋友"
                    color="#7fc090"
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Follows */}
      <SectionTitle>⭐ 关注关系</SectionTitle>
      {!followsHealth || followsHealth.note ? (
        <EmptyView msg={followsHealth?.note ?? '无关注数据'} />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
              background: 'rgba(184, 137, 58, 0.15)',
              padding: 1,
              marginBottom: 16,
            }}
          >
            <StatCard label="总关注" value={followsHealth.total_follows} color="#f4a8c0" />
            <StatCard label="今日新增" value={followsHealth.today_follows} color="#7fc090" />
            <StatCard label="本周新增" value={followsHealth.week_follows} color="#e0b060" />
            <StatCard
              label="参与用户"
              value={followsHealth.unique_followers}
              color="#a78bfa"
              sub={`${followsHealth.unique_followees} 被关注`}
            />
          </div>

          {followsHealth.follow_series.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionTitle>{windowDays} 日关注趋势</SectionTitle>
              <LineChart
                data={followsHealth.follow_series}
                color="#f4a8c0"
                height={100}
                valueLabel="新关注"
              />
            </div>
          )}

          {followsHealth.top_followed.length > 0 && (
            <div>
              <SectionTitle>Top 5 被关注最多</SectionTitle>
              <div>
                {followsHealth.top_followed.map((s, i) => (
                  <SocialRankRow
                    key={(s.username || s.name) + i}
                    rank={i + 1}
                    name={s.name}
                    avatar={s.avatar_url}
                    count={s.followers_count}
                    countLabel="粉丝"
                    color="#f4a8c0"
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SocialRankRow({
  rank,
  name,
  avatar,
  count,
  countLabel,
  color,
}: {
  rank: number;
  name: string;
  avatar: string;
  count: number;
  countLabel: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '24px auto 1fr auto',
        gap: 10,
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
        fontSize: 12,
      }}
    >
      <div
        style={{
          color: rank === 1 ? '#e0b060' : rank === 2 ? '#a8a08e' : rank === 3 ? '#b8893a' : '#6e6856',
          fontWeight: 700,
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        {rank}
      </div>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: avatar
            ? `url(${avatar}) center/cover`
            : 'linear-gradient(135deg, #b8893a, #6e6856)',
          border: '1px solid rgba(184, 137, 58, 0.3)',
        }}
      />
      <div style={{ color: '#f5f0e0' }}>{name}</div>
      <div
        style={{
          color,
          fontWeight: 600,
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
        }}
      >
        {count} {countLabel}
      </div>
    </div>
  );
}


// ============================================================================
// J2-B · 错误埋点
// ============================================================================
function ErrorsView({ errorHealth }: { errorHealth: ErrorHealth | null }) {
  if (!errorHealth) return <EmptyView msg="无错误数据" />;

  const eh = errorHealth;
  return (
    <div>
      <SectionTitle>错误概况（近 7 日）</SectionTitle>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'rgba(184, 137, 58, 0.15)',
          padding: 1,
          marginBottom: 24,
        }}
      >
        <StatCard label="今日" value={eh.today_errors} color={eh.today_errors > 5 ? '#e07a6e' : '#7fc090'} />
        <StatCard label="本周" value={eh.week_errors} color={eh.week_errors > 30 ? '#e07a6e' : '#e0b060'} />
        <StatCard label="累计" value={eh.total_errors} color="#a78bfa" />
        <StatCard label="受影响用户" value={eh.unique_users_affected} color="#f4a8c0" sub="本周" />
      </div>

      {eh.error_series.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionTitle>错误趋势（近 7 日）</SectionTitle>
          <LineChart
            data={eh.error_series}
            color="#e07a6e"
            height={120}
            valueLabel="错误"
          />
        </div>
      )}

      {eh.top_contexts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionTitle>Top 错误位置</SectionTitle>
          <div>
            {eh.top_contexts.map((c, i) => {
              const max = Math.max(...eh.top_contexts.map((x) => x.cnt));
              const pct = (c.cnt / max) * 100;
              const lastSeenAgo = (() => {
                const ms = Date.now() - new Date(c.last_seen).getTime();
                if (ms < 60_000) return '刚刚';
                if (ms < 3600_000) return `${Math.floor(ms / 60000)}分钟前`;
                if (ms < 86400_000) return `${Math.floor(ms / 3600000)}小时前`;
                return `${Math.floor(ms / 86400000)}天前`;
              })();
              return (
                <div
                  key={c.context + i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '180px 1fr 90px 60px',
                    gap: 10,
                    padding: '7px 0',
                    fontSize: 12,
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
                  }}
                >
                  <div style={{ color: '#a8a08e', fontFamily: 'monospace', fontSize: 11 }}>
                    {c.context}
                  </div>
                  <div
                    style={{
                      height: 12,
                      background: 'rgba(224, 122, 110, 0.08)',
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
                        background: 'linear-gradient(90deg, #e07a6ecc, #e07a6e66)',
                      }}
                    />
                  </div>
                  <div style={{ color: '#6e6856', fontFamily: 'monospace', fontSize: 10, textAlign: 'right' }}>
                    {lastSeenAgo}
                  </div>
                  <div
                    style={{
                      color: '#e07a6e',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      textAlign: 'right',
                    }}
                  >
                    {c.cnt}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {eh.recent_errors.length > 0 && (
        <div>
          <SectionTitle>最近错误（10 条）</SectionTitle>
          <div>
            {eh.recent_errors.map((e) => {
              const t = new Date(e.created_at);
              const dateStr = `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
              return (
                <div
                  key={e.id}
                  style={{
                    padding: '8px 12px',
                    marginBottom: 4,
                    background: 'rgba(224, 122, 110, 0.04)',
                    borderLeft: '2px solid rgba(224, 122, 110, 0.4)',
                    borderRadius: 2,
                    fontSize: 11,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'baseline',
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        color: '#e07a6e',
                        fontWeight: 600,
                      }}
                    >
                      {e.context}
                    </span>
                    <span style={{ color: '#6e6856', fontFamily: 'monospace', fontSize: 10 }}>
                      {dateStr}
                    </span>
                  </div>
                  <div style={{ color: '#a8a08e', wordBreak: 'break-word' }}>
                    {e.message}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================================
// J2-C · 留存 + 在线时长 + scene 分布
// ============================================================================
function RetentionView({
  retention,
  onlineDuration,
  sceneDist,
  window: windowDays,
}: {
  retention: RetentionData | null;
  onlineDuration: OnlineDuration | null;
  sceneDist: SceneDistribution | null;
  window: TimeWindow;
}) {
  const fmtDuration = (sec: number): string => {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.round(sec / 60)}m`;
    return `${(sec / 3600).toFixed(1)}h`;
  };

  return (
    <div>
      {/* === 留存 === */}
      <SectionTitle>📊 留存曲线</SectionTitle>
      {!retention ? (
        <EmptyView msg="无留存数据" />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              background: 'rgba(184, 137, 58, 0.15)',
              padding: 1,
              marginBottom: 16,
            }}
          >
            <RetentionCard
              label="D1 留存"
              rate={retention.d1}
              cohort={retention.d1_cohort_size}
              returned={retention.d1_returned}
              color="#7fc090"
            />
            <RetentionCard
              label="D7 留存"
              rate={retention.d7}
              cohort={retention.d7_cohort_size}
              returned={retention.d7_returned}
              color="#e0b060"
            />
            <RetentionCard
              label="D30 留存"
              rate={retention.d30}
              cohort={retention.d30_cohort_size}
              returned={retention.d30_returned}
              color="#a78bfa"
            />
          </div>

          {retention.retention_curve.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionTitle>D0 - D30 留存曲线</SectionTitle>
              <RetentionCurveChart data={retention.retention_curve} />
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  color: '#6e6856',
                  fontStyle: 'italic',
                  textAlign: 'center',
                }}
              >
                注：基于 60 天内注册的用户 cohort
              </div>
            </div>
          )}
        </>
      )}

      {/* === 在线时长 === */}
      <SectionTitle>⏱️ 在线时长</SectionTitle>
      {!onlineDuration ? (
        <EmptyView msg="无在线数据" />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
              background: 'rgba(184, 137, 58, 0.15)',
              padding: 1,
              marginBottom: 16,
            }}
          >
            <StatCard
              label="当前在线"
              value={onlineDuration.active_now}
              color="#7fc090"
            />
            <StatCard
              label="今日 sessions"
              value={onlineDuration.today_sessions}
              color="#e0b060"
            />
            <StatCard
              label="本周 sessions"
              value={onlineDuration.week_sessions}
              color="#f4a8c0"
            />
            <StatCard
              label="累计在线"
              value={onlineDuration.total_hours}
              color="#a78bfa"
              sub="小时"
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              background: 'rgba(184, 137, 58, 0.15)',
              padding: 1,
              marginBottom: 16,
            }}
          >
            <StatCard
              label="平均时长"
              value={fmtDuration(onlineDuration.avg_duration_seconds)}
              color="#a5c8ff"
            />
            <StatCard
              label="中位时长"
              value={fmtDuration(onlineDuration.median_duration_seconds)}
              color="#a5c8ff"
            />
            <StatCard
              label="P90 时长"
              value={fmtDuration(onlineDuration.p90_duration_seconds)}
              color="#a5c8ff"
            />
          </div>

          {onlineDuration.duration_by_day.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionTitle>{windowDays} 日累计在线时长（小时）</SectionTitle>
              <LineChart
                data={onlineDuration.duration_by_day}
                color="#7fc090"
                height={120}
                valueLabel="小时"
              />
            </div>
          )}

          {onlineDuration.top_users.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionTitle>Top 5 在线时长</SectionTitle>
              <div>
                {onlineDuration.top_users.map((u, i) => (
                  <div
                    key={(u.username || u.name) + i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '24px 22px 1fr auto auto',
                      gap: 10,
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        color: i === 0 ? '#e0b060' : i === 1 ? '#a8a08e' : i === 2 ? '#b8893a' : '#6e6856',
                        fontWeight: 700,
                        fontSize: 14,
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
                        background: u.avatar_url
                          ? `url(${u.avatar_url}) center/cover`
                          : 'linear-gradient(135deg, #b8893a, #6e6856)',
                        border: '1px solid rgba(184, 137, 58, 0.3)',
                      }}
                    />
                    <div style={{ color: '#f5f0e0' }}>{u.name}</div>
                    <div style={{ color: '#8a8576', fontFamily: 'monospace', fontSize: 10 }}>
                      {u.session_count} sessions
                    </div>
                    <div
                      style={{
                        color: '#7fc090',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    >
                      {u.total_hours}h
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* === Scene 分布 === */}
      <SectionTitle>🗺️ Scene 分布</SectionTitle>
      {!sceneDist ? (
        <EmptyView msg="无场景数据" />
      ) : (
        <>
          {sceneDist.scenes_now.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <SectionTitle>当前在线 ({sceneDist.active_now} 人)</SectionTitle>
              <div>
                {sceneDist.scenes_now.map((s) => {
                  const pct = (s.count / Math.max(sceneDist.active_now, 1)) * 100;
                  return (
                    <div
                      key={s.scene}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr 60px',
                        gap: 10,
                        padding: '6px 0',
                        fontSize: 12,
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ color: '#a8a08e', fontFamily: 'monospace', fontSize: 11 }}>
                        {SCENE_NAMES[s.scene] ?? s.scene}
                      </div>
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
                            background: 'linear-gradient(90deg, #7fc090cc, #7fc09066)',
                          }}
                        />
                      </div>
                      <div style={{ color: '#7fc090', fontFamily: 'monospace', textAlign: 'right' }}>
                        {s.count} 人
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: '#8a8576', fontSize: 11, fontStyle: 'italic' }}>
              当前没有人在线
            </div>
          )}

          {sceneDist.scenes_30d.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionTitle>30 日 Scene 累计访问（按总时长）</SectionTitle>
              <div>
                {sceneDist.scenes_30d.map((s, i) => {
                  const max = Math.max(...sceneDist.scenes_30d.map((x) => x.total_seconds));
                  const pct = (s.total_seconds / Math.max(max, 1)) * 100;
                  return (
                    <div
                      key={s.scene + i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr 70px 70px',
                        gap: 10,
                        padding: '6px 0',
                        fontSize: 12,
                        alignItems: 'center',
                        borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
                      }}
                    >
                      <div style={{ color: '#a8a08e', fontFamily: 'monospace', fontSize: 11 }}>
                        {SCENE_NAMES[s.scene] ?? s.scene}
                      </div>
                      <div
                        style={{
                          height: 12,
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
                            background: 'linear-gradient(90deg, #a78bfacc, #a78bfa66)',
                          }}
                        />
                      </div>
                      <div style={{ color: '#6e6856', fontFamily: 'monospace', fontSize: 10, textAlign: 'right' }}>
                        {s.visit_count} 访问
                      </div>
                      <div
                        style={{
                          color: '#a78bfa',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          textAlign: 'right',
                        }}
                      >
                        {s.total_minutes}m
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


function RetentionCard({
  label,
  rate,
  cohort,
  returned,
  color,
}: {
  label: string;
  rate: number;
  cohort: number;
  returned: number;
  color: string;
}) {
  return (
    <div style={{ background: '#15171f', padding: '14px 12px', textAlign: 'center' }}>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color,
          marginBottom: 4,
          letterSpacing: '-0.02em',
          fontFamily: 'serif',
        }}
      >
        {rate}%
      </div>
      <div style={{ fontSize: 10, color: '#8a8576', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontSize: 9, color: '#6e6856', marginTop: 3, fontFamily: 'monospace' }}>
        {returned} / {cohort}
      </div>
    </div>
  );
}


function RetentionCurveChart({ data }: { data: Array<{ day: number; rate: number }> }) {
  const W = 800;
  const H = 160;
  const PAD_L = 40;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 28;

  if (data.length === 0) return null;

  const maxRate = Math.max(...data.map((p) => p.rate), 100);
  const xScale = (i: number) =>
    PAD_L + (i / Math.max(data.length - 1, 1)) * (W - PAD_L - PAD_R);
  const yScale = (v: number) =>
    PAD_T + (1 - v / maxRate) * (H - PAD_T - PAD_B);

  const pathD = data
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.rate)}`)
    .join(' ');
  const areaD =
    pathD +
    ` L ${xScale(data.length - 1)} ${H - PAD_B}` +
    ` L ${xScale(0)} ${H - PAD_B} Z`;

  const ticks = [0, 0.5, 1].map((t) => ({
    value: Math.round(t * maxRate),
    y: yScale(t * maxRate),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%' }}>
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={PAD_L}
          x2={W - PAD_R}
          y1={t.y}
          y2={t.y}
          stroke="rgba(184, 137, 58, 0.1)"
          strokeWidth={1}
        />
      ))}
      {ticks.map((t, i) => (
        <text
          key={i}
          x={PAD_L - 6}
          y={t.y + 4}
          textAnchor="end"
          fontSize={10}
          fill="#6e6856"
          fontFamily="monospace"
        >
          {t.value}%
        </text>
      ))}
      <path d={areaD} fill="#a78bfa" fillOpacity={0.12} />
      <path d={pathD} stroke="#a78bfa" strokeWidth={2} fill="none" />
      {data.map((p, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(p.rate)} r={2.5} fill="#a78bfa">
          <title>{`D${p.day}: ${p.rate}%`}</title>
        </circle>
      ))}
      {[0, 7, 14, 21, 30].map((d) => {
        if (d >= data.length) return null;
        return (
          <text
            key={d}
            x={xScale(d)}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#6e6856"
            fontFamily="monospace"
          >
            D{d}
          </text>
        );
      })}
    </svg>
  );
}


// Scene 名字映射（中文显示）
const SCENE_NAMES: Record<string, string> = {
  Main: '萌芽镇主城',
  Boot: 'Boot',
  Home: '自家小屋',
  Interior: '室内',
  SproutCity: '萌芽镇',
  GovHill: '议政高地',
  VisionTower: '远见塔',
  CouncilHall: '议政殿',
  MirrorPavilion: '明镜阁',
  GrandPlaza: '大集会广场',
  KaiyuanLou: '开元楼',
  ShengwenTai: '声闻台',
  DuliangGe: '度量阁',
  YincaiFang: '引才坊',
  SisuanSuo: '司算所',
  YishiTing: '议事亭',
  WangqiLou: '望器楼',
  GongdeTang: '功德堂',
  Unknown: '未知',
};
