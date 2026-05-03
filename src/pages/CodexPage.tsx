import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chip } from '../ui';
import { WORKSHOPS, NPCS, LEVELS } from '../lib/gameMeta';
import { QUESTS, DIFFICULTY_LABEL, type Difficulty } from '../lib/questDefinitions';
import {
  REVIEWER_PROFILES,
  APPEAL_REVIEWER_PROFILES,
  type ReviewerProfile,
} from '../lib/reviewerProfiles';
import {
  SOLAR_TERMS,
  SEASON_TONE,
  SEASON_BG,
  type Season,
  type SolarTermDef,
} from '../lib/solarTermsData';

/**
 * 图鉴 · 像素古籍风
 *
 * Wave 3.B
 *
 * 6 tab:
 *   1. 工坊（9 个 · 来自 gameMeta WORKSHOPS）
 *   2. NPC（6 个 · 来自 gameMeta NPCS · 含村长阿降 + 百晓居首席高粱）
 *   3. 等级（5 个 · 来自 gameMeta LEVELS）
 *   4. 任务（5 真任务 · 来自 questDefinitions QUESTS）
 *   5. 审核员（3 主审 + 3 申诉 · 来自 reviewerProfiles）
 *   6. 节气（24 个 · 来自 solarTermsData）
 */

type Tab = 'workshops' | 'npcs' | 'levels' | 'quests' | 'reviewers' | 'solar';

const TAB_CONFIG: Array<{ key: Tab; icon: string; label: string }> = [
  { key: 'workshops', icon: '🏛', label: '工坊' },
  { key: 'npcs', icon: '👥', label: 'NPC' },
  { key: 'levels', icon: '🎖', label: '等级' },
  { key: 'quests', icon: '📋', label: '任务' },
  { key: 'reviewers', icon: '⚖', label: '审核员' },
  { key: 'solar', icon: '🌱', label: '节气' },
];

export function CodexPage() {
  const [activeTab, setActiveTab] = useState<Tab>('workshops');
  const navigate = useNavigate();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    document.title = '图鉴 · CUA 基地';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div
      className="bg-paper"
      style={{
        minHeight: '100vh',
        background: 'var(--paper-0)',
        fontFamily: 'var(--f-sans)',
        color: 'var(--ink)',
      }}
    >
      {/* 顶栏 */}
      <header
        style={{
          padding: '14px 32px',
          background: 'var(--paper-1)',
          borderBottom: '3px solid var(--wood-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            to="/"
            style={{
              fontSize: 13,
              color: 'var(--wood-3)',
              textDecoration: 'none',
              padding: '4px 8px',
              border: '1px solid var(--wood-3)',
              fontFamily: 'var(--f-pixel)',
            }}
          >
            ← 返回首页
          </Link>
          <div className="t-eyebrow" style={{ fontSize: 10 }}>
            CODEX · v3.0
          </div>
        </div>

        <h1
          className="t-display"
          style={{
            fontSize: 22,
            margin: 0,
            color: 'var(--wood-3)',
            textShadow: '2px 2px 0 var(--paper-3)',
          }}
        >
          图鉴
        </h1>

        <nav style={{ display: 'flex', gap: 4 }}>
          <Link
            to="/manual"
            style={{
              fontSize: 13,
              color: 'var(--ink-faint)',
              textDecoration: 'none',
              padding: '4px 12px',
              fontFamily: 'var(--f-pixel)',
            }}
          >
            手册
          </Link>
          <Link
            to="/play"
            style={{
              fontSize: 13,
              color: 'var(--wood-4)',
              textDecoration: 'none',
              padding: '4px 12px',
              background: 'var(--gold)',
              fontFamily: 'var(--f-pixel)',
              fontWeight: 600,
            }}
          >
            进入游戏 ▶
          </Link>
        </nav>
      </header>

      {/* Tabs · 顶部横向 */}
      <div
        style={{
          background: 'var(--paper-2)',
          borderBottom: '2px solid var(--wood-3)',
          padding: '0 32px',
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
        }}
      >
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              background:
                activeTab === tab.key ? 'var(--paper-0)' : 'transparent',
              border: 'none',
              borderBottom:
                activeTab === tab.key
                  ? '3px solid var(--gold)'
                  : '3px solid transparent',
              fontFamily: 'var(--f-pixel)',
              fontSize: 13,
              color: activeTab === tab.key ? 'var(--wood-3)' : 'var(--ink)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <main
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '24px 32px',
        }}
      >
        {activeTab === 'workshops' && <WorkshopsTab />}
        {activeTab === 'npcs' && <NPCsTab />}
        {activeTab === 'levels' && <LevelsTab />}
        {activeTab === 'quests' && <QuestsTab />}
        {activeTab === 'reviewers' && <ReviewersTab />}
        {activeTab === 'solar' && <SolarTab />}
      </main>

      {/* Footer */}
      <footer
        style={{
          marginTop: 40,
          padding: '16px 32px',
          background: 'var(--paper-1)',
          borderTop: '2px solid var(--wood-3)',
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--ink-faint)',
        }}
      >
        CUA 基地 · WebAgentLab Pixel MMO · 图鉴
      </footer>
    </div>
  );
}

export default CodexPage;

// ============================================================
// Tab 1 · 工坊
// ============================================================

function WorkshopsTab() {
  return (
    <div>
      <SectionHeader
        title="9 工坊 · 共创之都"
        sub="按 降噪 / 链接 / 共创 三大板块组织 · 每工坊对应一类社区贡献"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
          marginTop: 16,
        }}
      >
        {WORKSHOPS.map((w) => (
          <div
            key={w.name}
            style={{
              background: 'var(--paper-1)',
              border: '2px solid var(--wood-3)',
              boxShadow: '3px 3px 0 var(--wood-4)',
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: 'var(--paper-0)',
                  border: '2px solid var(--wood-4)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {w.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="t-title"
                  style={{ fontSize: 14, color: 'var(--wood-3)' }}
                >
                  {w.name}
                </div>
                <Chip>{w.group}</Chip>
              </div>
            </div>
            <div
              className="t-soft"
              style={{
                fontSize: 11,
                lineHeight: 1.7,
                color: 'var(--ink-faint)',
              }}
            >
              {w.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Tab 2 · NPC
// ============================================================

function NPCsTab() {
  return (
    <div>
      <SectionHeader
        title="6 NPC · 居民档案"
        sub="散布于萌芽镇 / 共创之都 / 议政高地 三大区域"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 12,
          marginTop: 16,
        }}
      >
        {NPCS.map((npc) => (
          <div
            key={npc.name}
            style={{
              background: 'var(--paper-1)',
              border: '2px solid var(--wood-3)',
              boxShadow: '3px 3px 0 var(--wood-4)',
              padding: '14px',
              display: 'flex',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                background: 'var(--paper-3)',
                border: '3px solid var(--wood-4)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 28,
                flexShrink: 0,
              }}
            >
              {npc.role.includes('村长')
                ? '🧑‍🌾'
                : npc.role.includes('审核员')
                ? '⚖'
                : npc.role.includes('商')
                ? '🛍'
                : npc.role.includes('提案')
                ? '📜'
                : '👤'}
            </div>
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
                <span
                  className="t-title"
                  style={{ fontSize: 14, color: 'var(--wood-3)' }}
                >
                  {npc.name}
                </span>
                <Chip tone={npc.tone}>{npc.region}</Chip>
              </div>
              <div
                className="t-eyebrow"
                style={{ fontSize: 10, marginBottom: 6 }}
              >
                {npc.role}
              </div>
              <div
                className="t-soft"
                style={{
                  fontSize: 11,
                  lineHeight: 1.7,
                  color: 'var(--ink-faint)',
                  fontStyle: 'italic',
                }}
              >
                "{npc.line}"
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Tab 3 · 等级
// ============================================================

function LevelsTab() {
  return (
    <div>
      <SectionHeader
        title="5 等级 · L0 → L4"
        sub="基于 CV（贡献价值） · 完成任务 / 提案投票 / 申诉裁定均可累积"
      />
      <div style={{ marginTop: 16 }}>
        {LEVELS.map((lv, i) => (
          <div
            key={lv.lv}
            style={{
              background: 'var(--paper-1)',
              border: '2px solid var(--wood-3)',
              boxShadow: '3px 3px 0 var(--wood-4)',
              padding: '14px 18px',
              marginBottom: 8,
              display: 'grid',
              gridTemplateColumns: '60px 140px 1fr 140px',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: i === 0 ? 'var(--ink-faint)' : 'var(--gold)',
                textAlign: 'center',
              }}
            >
              {lv.lv}
            </div>
            <div>
              <div
                className="t-title"
                style={{ fontSize: 14, color: 'var(--wood-3)' }}
              >
                {lv.name}
              </div>
            </div>
            <div className="t-soft" style={{ fontSize: 12 }}>
              {lv.area}
            </div>
            <div
              className="mono t-faint"
              style={{
                fontSize: 11,
                textAlign: 'right',
                letterSpacing: '0.05em',
              }}
            >
              {lv.cv} CV
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          padding: 14,
          background: 'rgba(218, 165, 32, 0.1)',
          borderLeft: '3px solid var(--gold)',
          marginTop: 16,
          fontSize: 11,
          lineHeight: 1.8,
          color: 'var(--ink-faint)',
        }}
      >
        <strong style={{ color: 'var(--wood-3)' }}>升级解锁：</strong>
        <br />
        · L1 · 解锁工坊任务审核投票权
        <br />
        · L2 · 可去议政高地参与提案 + 投票 + 申诉
        <br />
        · L3 · 可发起复议（推翻已决议提案）
        <br />· L4 · 共建人 · 共同决定社区方向（议政表决产生）
      </div>
    </div>
  );
}

// ============================================================
// Tab 4 · 任务
// ============================================================

const DIFFICULTY_TONE: Record<Difficulty, 'spring' | 'gold' | 'danger' | ''> = {
  beginner: 'spring',
  medium: 'gold',
  advanced: 'danger',
};

function QuestsTab() {
  return (
    <div>
      <SectionHeader
        title="5 真任务 · 百晓居"
        sub="从入门到困难 · 完成任务赚 CV · 经 3 审核员独立评议"
      />
      <div style={{ marginTop: 16 }}>
        {QUESTS.map((q) => (
          <div
            key={q.id}
            style={{
              background: 'var(--paper-1)',
              border: '2px solid var(--wood-3)',
              boxShadow: '3px 3px 0 var(--wood-4)',
              padding: '14px 16px',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                marginBottom: 6,
                flexWrap: 'wrap',
              }}
            >
              <span
                className="t-title"
                style={{ fontSize: 15, color: 'var(--wood-3)' }}
              >
                {q.title}
              </span>
              <Chip tone={DIFFICULTY_TONE[q.difficulty]}>
                {DIFFICULTY_LABEL[q.difficulty]}
              </Chip>
              <Chip tone="gold">{q.cpRange}</Chip>
              <span className="t-faint mono" style={{ fontSize: 10 }}>
                {q.estimatedTime}
              </span>
            </div>

            <div
              className="t-soft"
              style={{
                fontSize: 12,
                lineHeight: 1.7,
                marginBottom: 10,
                color: 'var(--ink)',
              }}
            >
              {q.description}
            </div>

            <div
              style={{
                background: 'var(--paper-0)',
                border: '1px solid var(--wood-2)',
                padding: '8px 10px',
                marginBottom: 6,
              }}
            >
              <div
                className="t-eyebrow"
                style={{ fontSize: 9, marginBottom: 4 }}
              >
                质量评判
              </div>
              <div
                className="t-soft"
                style={{ fontSize: 11, lineHeight: 1.7 }}
              >
                {q.qualityCriteria}
              </div>
            </div>

            <div
              className="t-faint"
              style={{
                fontSize: 10,
                lineHeight: 1.7,
                fontStyle: 'italic',
              }}
            >
              ⚠ {q.acceptCriteria}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Tab 5 · 审核员
// ============================================================

function ReviewersTab() {
  return (
    <div>
      <SectionHeader
        title="6 审议者 · 3 审核员 + 3 申诉员"
        sub="3 主审独立评议 → 多数票决定系数 · 不满可去明镜阁申诉 · 3 复审给出新判"
      />

      <h3
        className="t-title"
        style={{
          fontSize: 15,
          marginTop: 20,
          marginBottom: 12,
          color: 'var(--wood-3)',
          paddingBottom: 6,
          borderBottom: '2px dashed var(--wood-2)',
        }}
      >
        ⚖ 主审核员（百晓居）
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 12,
        }}
      >
        {REVIEWER_PROFILES.map((r) => (
          <ReviewerCard key={r.id} reviewer={r} />
        ))}
      </div>

      <h3
        className="t-title"
        style={{
          fontSize: 15,
          marginTop: 28,
          marginBottom: 12,
          color: 'var(--wood-3)',
          paddingBottom: 6,
          borderBottom: '2px dashed var(--wood-2)',
        }}
      >
        📜 申诉员（明镜阁）
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 12,
        }}
      >
        {APPEAL_REVIEWER_PROFILES.map((r) => (
          <ReviewerCard key={r.id} reviewer={r} />
        ))}
      </div>

      <div
        style={{
          padding: 14,
          background: 'rgba(166, 70, 52, 0.08)',
          borderLeft: '3px solid var(--danger)',
          marginTop: 16,
          fontSize: 11,
          lineHeight: 1.8,
          color: 'var(--ink-faint)',
        }}
      >
        <strong style={{ color: 'var(--wood-3)' }}>申诉规则：</strong>
        <br />
        · 申诉只可上调系数 · 不可下调
        <br />
        · 已入账 CV 不会扣除
        <br />· 复审需 3 票全部完成 · 无 quorum 概念
      </div>
    </div>
  );
}

function ReviewerCard({ reviewer }: { reviewer: ReviewerProfile }) {
  return (
    <div
      style={{
        background: 'var(--paper-1)',
        border: '2px solid var(--wood-3)',
        boxShadow: '3px 3px 0 var(--wood-4)',
        padding: '14px',
        display: 'flex',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          background: 'var(--paper-3)',
          border: '3px solid var(--wood-4)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 26,
          flexShrink: 0,
        }}
      >
        {reviewer.avatar}
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
            style={{ fontSize: 14, color: 'var(--wood-3)' }}
          >
            {reviewer.name}
          </span>
          <Chip tone={reviewer.role === '审核员' ? 'gold' : 'jade'}>
            {reviewer.role}
          </Chip>
        </div>
        <div
          className="t-eyebrow"
          style={{ fontSize: 10, marginBottom: 6 }}
        >
          {reviewer.personality}
        </div>
        <div
          className="t-soft"
          style={{
            fontSize: 11,
            lineHeight: 1.7,
            color: 'var(--ink-faint)',
            marginBottom: 4,
          }}
        >
          {reviewer.style}
        </div>
        <div
          className="t-faint"
          style={{
            fontSize: 10,
            fontStyle: 'italic',
            marginBottom: 4,
          }}
        >
          偏好：{reviewer.preference}
        </div>
        <div
          className="mono t-faint"
          style={{ fontSize: 9, marginTop: 4 }}
        >
          投票延迟 {reviewer.delayRange}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Tab 6 · 节气
// ============================================================

function SolarTab() {
  return (
    <div>
      <SectionHeader
        title="24 节气 · 春夏秋冬"
        sub="48 分钟 = 1 游戏日 · 每天对应一个节气 · 24 天循环一年"
      />

      {(['春', '夏', '秋', '冬'] as Season[]).map((season) => {
        const terms = SOLAR_TERMS.filter((t) => t.season === season);
        return (
          <div key={season} style={{ marginTop: 24 }}>
            <h3
              className="t-title"
              style={{
                fontSize: 16,
                marginBottom: 10,
                color: 'var(--wood-3)',
                paddingBottom: 6,
                borderBottom: '2px dashed var(--wood-2)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{season}</span>
              <Chip tone={SEASON_TONE[season]}>{terms.length} 节气</Chip>
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 8,
              }}
            >
              {terms.map((term) => (
                <SolarTermCard key={term.name} term={term} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SolarTermCard({ term }: { term: SolarTermDef }) {
  return (
    <div
      style={{
        background: SEASON_BG[term.season],
        border: '2px solid var(--wood-3)',
        boxShadow: '2px 2px 0 var(--wood-4)',
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 16 }}>{term.icon}</span>
        <span
          className="t-title"
          style={{
            fontSize: 14,
            color: 'var(--wood-3)',
            letterSpacing: '0.05em',
          }}
        >
          {term.name}
        </span>
      </div>
      <div
        className="t-soft"
        style={{
          fontSize: 11,
          lineHeight: 1.6,
          marginBottom: 4,
          color: 'var(--ink)',
        }}
      >
        {term.desc}
      </div>
      <div
        className="t-faint"
        style={{
          fontSize: 9,
          fontStyle: 'italic',
          color: 'var(--ink-faint)',
        }}
      >
        {term.feature}
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2
        className="t-display"
        style={{
          fontSize: 20,
          margin: 0,
          color: 'var(--wood-3)',
          textShadow: '2px 2px 0 var(--paper-3)',
        }}
      >
        {title}
      </h2>
      <div
        className="t-faint"
        style={{
          fontSize: 11,
          marginTop: 4,
          fontStyle: 'italic',
        }}
      >
        {sub}
      </div>
    </div>
  );
}
