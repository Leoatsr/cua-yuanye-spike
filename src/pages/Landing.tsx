import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PixelPanel,
  PixelButton,
  Chip,
  Sprite,
  Banner,
} from '../ui';
import { REGIONS, WORKSHOPS } from '../lib/gameMeta';

/**
 * Landing 落地页 — / 路由
 *
 * 设计来自 Claude Design 设计稿
 * 古籍像素风格 · 金棕羊皮纸 + VT323 像素字体
 */

export function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-0)' }} className="bg-paper">
      <Header navigate={navigate} />
      <Hero navigate={navigate} />
      <RegionsSection />
      <WorkshopsSection />
      <CoreLoopSection />
      <FeaturesSection />
      <RoadmapSection />
      <CTASection navigate={navigate} />
      <Footer />
    </div>
  );
}

// ============================================================
// Header
// ============================================================

function Header({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 48px',
        borderBottom: '4px solid var(--wood-3)',
        background: 'var(--paper-1)',
        boxShadow: '0 4px 0 var(--paper-3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            background: 'var(--wood-3)',
            display: 'grid',
            placeItems: 'center',
            border: '3px solid var(--wood-4)',
            boxShadow: 'inset 2px 2px 0 var(--wood-1)',
          }}
        >
          <Sprite name="leaf" scale={4} />
        </div>
        <div>
          <div
            className="t-display"
            style={{ fontSize: 22, lineHeight: 1, textShadow: '2px 2px 0 var(--paper-3)' }}
          >
            CUA 基地
          </div>
          <div className="t-eyebrow" style={{ fontSize: 10 }}>
            WEBAGENTLAB · PIXEL MMO
          </div>
        </div>
      </div>
      <nav style={{ display: 'flex', gap: 4 }}>
        <PixelButton variant="pb-ghost" size="pb-sm" onClick={() => navigate('/')}>
          首页
        </PixelButton>
        <PixelButton variant="pb-ghost" size="pb-sm" onClick={() => navigate('/manual')}>
          手册
        </PixelButton>
        <PixelButton variant="pb-ghost" size="pb-sm" onClick={() => navigate('/codex')}>
          图鉴
        </PixelButton>
        <PixelButton variant="pb-ghost" size="pb-sm" onClick={() => navigate('/maps')}>
          地图
        </PixelButton>
        <PixelButton variant="pb-primary" size="pb-sm" onClick={() => navigate('/play')}>
          进入游戏 ▶
        </PixelButton>
      </nav>
    </header>
  );
}

// ============================================================
// Hero
// ============================================================

function Hero({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <section style={{ padding: '72px 48px 48px', maxWidth: 1280, margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: 56,
          alignItems: 'center',
        }}
      >
        <div className="stack-lg">
          <Banner tone="gold">PHASE 3 · 多人在场 · 已开放</Banner>
          <h1
            className="t-display t-display-wrap"
            style={{
              fontSize: 64,
              lineHeight: 1.05,
              margin: 0,
              textShadow: '5px 5px 0 var(--paper-3)',
            }}
          >
            把开源贡献，<br />
            变成一座有人的镇。
          </h1>
          <p
            className="t-body t-soft"
            style={{ fontSize: 19, maxWidth: 540, margin: 0, lineHeight: 1.7 }}
          >
            GitHub 上的 issue / PR / review —— 在这里对应走进工坊接任务、提交作品等审核、攒满
            CV 解锁议政。一个有空间、有人、有节奏、有反馈的虚拟基地。
          </p>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            <PixelButton
              variant="pb-primary"
              size="pb-lg"
              onClick={() => navigate('/play')}
            >
              <Sprite name="leaf" scale={3} />
              &nbsp;&nbsp; GitHub 登录进入
            </PixelButton>
            <PixelButton size="pb-lg" onClick={() => navigate('/manual')}>
              玩家手册
            </PixelButton>
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
            {[
              ['14', 'PHASER 场景'],
              ['9', '工坊'],
              ['24', '节气循环'],
              ['5', '新手任务'],
            ].map(([n, l]) => (
              <div key={l}>
                <div
                  className="t-num"
                  style={{ fontSize: 36, color: 'var(--wood-3)', lineHeight: 1 }}
                >
                  {n}
                </div>
                <div className="t-eyebrow" style={{ fontSize: 10 }}>
                  {l}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <PixelPanel className="pp-flush" style={{ padding: 0, background: '#000' }}>
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                background:
                  'linear-gradient(180deg, #fce5b4 0%, #f5deb3 35%, #d8e8be 60%, #8fbc5c 100%)',
                aspectRatio: '4 / 3',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 28,
                  left: 40,
                  fontFamily: 'var(--f-pixel)',
                  color: 'rgba(0,0,0,0.15)',
                  fontSize: 12,
                }}
              >
                云·云
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: 60,
                  right: 60,
                  width: 56,
                  height: 56,
                  background: '#fff5cc',
                  border: '4px solid #daa520',
                  borderRadius: '50%',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '32%',
                  left: '5%',
                  display: 'flex',
                  gap: 30,
                }}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <Sprite key={i} name="tree" scale={5 + (i % 2)} />
                ))}
              </div>
              <div style={{ position: 'absolute', bottom: '16%', left: '12%' }}>
                <div
                  style={{
                    width: 80,
                    height: 60,
                    background: '#cd853f',
                    border: '3px solid #5d3a1a',
                  }}
                >
                  <div style={{ width: '100%', height: 18, background: '#a0522d' }} />
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: '16%', left: '60%' }}>
                <div
                  style={{
                    width: 100,
                    height: 80,
                    background: '#daa520',
                    border: '3px solid #5d3a1a',
                  }}
                >
                  <div style={{ width: '100%', height: 22, background: '#a07515' }} />
                  <div
                    style={{
                      width: 24,
                      height: 36,
                      background: '#3a2a1a',
                      margin: '8px auto 0',
                    }}
                  />
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 36, left: '42%' }}>
                <Sprite name="char" scale={6} />
              </div>
              <div style={{ position: 'absolute', bottom: 44, left: '30%' }}>
                <Sprite
                  name="char"
                  scale={5}
                  palette={{
                    '1': '#fce5c4',
                    '2': '#3a2a1a',
                    '3': '#2f6b5d',
                    '4': '#1f4a40',
                  }}
                />
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  display: 'flex',
                  gap: 8,
                }}
              >
                <Chip tone="gold">CV · 1,247</Chip>
                <Chip tone="spring">L1 活跃贡献者</Chip>
              </div>
              <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
                <Chip>谷雨 · 黄昏</Chip>
              </div>
            </div>
          </PixelPanel>
          <div
            style={{
              position: 'absolute',
              top: -16,
              right: -12,
              transform: 'rotate(8deg)',
            }}
          >
            <Banner tone="spring">每 48 分钟 = 1 游戏日</Banner>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Three regions
// ============================================================

function RegionsSection() {
  return (
    <section style={{ padding: '32px 48px', maxWidth: 1280, margin: '0 auto' }}>
      <div className="stack" style={{ marginBottom: 24 }}>
        <div className="t-eyebrow">三大区域 · THREE REGIONS</div>
        <h2 className="t-title" style={{ fontSize: 36, margin: 0 }}>
          从新手村，到议政台
        </h2>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
        }}
      >
        {REGIONS.map((r) => {
          const tones = {
            spring: { c1: '#d8e8be', c2: '#8fbc5c', deep: '#1f4a40' },
            gold: { c1: '#f7e4a3', c2: '#daa520', deep: '#5d3a1a' },
            jade: { c1: '#b8d6cc', c2: '#2f6b5d', deep: '#0e2a25' },
          }[r.tone];
          return (
            <PixelPanel key={r.id}>
              <div
                style={{
                  height: 120,
                  background: `linear-gradient(180deg, ${tones.c1}, ${tones.c2})`,
                  border: `3px solid ${tones.deep}`,
                  marginBottom: 16,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 56,
                }}
              >
                {r.tile}
              </div>
              <Chip tone={r.tone}>{r.level}</Chip>
              <h3 className="t-title" style={{ margin: '12px 0 8px', fontSize: 24 }}>
                {r.name}
              </h3>
              <p
                className="t-body t-soft"
                style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}
              >
                {r.summary}
              </p>
            </PixelPanel>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================
// 9 workshops
// ============================================================

function WorkshopsSection() {
  return (
    <section style={{ padding: '48px', maxWidth: 1280, margin: '0 auto' }}>
      <div className="stack" style={{ marginBottom: 24 }}>
        <div className="t-eyebrow">贡献者中心 · 9 工坊</div>
        <h2 className="t-title" style={{ fontSize: 36, margin: 0 }}>
          降噪 · 链接 · 共创
        </h2>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
        }}
      >
        {WORKSHOPS.map((w) => (
          <PixelPanel key={w.name} className="pp-tight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  background: w.color,
                  border: '3px solid var(--wood-4)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 26,
                  color: '#fff8dc',
                  flexShrink: 0,
                }}
              >
                {w.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="t-title" style={{ fontSize: 18 }}>
                    {w.name}
                  </span>
                  <Chip>{w.group}</Chip>
                </div>
                <div className="t-soft" style={{ fontSize: 12, marginTop: 2 }}>
                  {w.desc}
                </div>
              </div>
            </div>
          </PixelPanel>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// Core Loop
// ============================================================

function CoreLoopSection() {
  const steps: [string, string][] = [
    ['GitHub 登录', '🔑'],
    ['进入萌芽镇', '🌱'],
    ['走进工坊', '🏛'],
    ['接任务', '📋'],
    ['完成提交', '✓'],
    ['审核投票', '⚖'],
    ['CV 入账', '💰'],
  ];

  return (
    <section
      style={{
        padding: '48px',
        background: 'var(--paper-2)',
        borderTop: '4px solid var(--wood-3)',
        borderBottom: '4px solid var(--wood-3)',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="t-eyebrow" style={{ marginBottom: 6 }}>
          核心循环 · CORE LOOP
        </div>
        <h2 className="t-title" style={{ fontSize: 32, margin: '0 0 28px' }}>
          真闭环：从 GitHub 到游戏内
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr) auto',
            gap: 8,
            alignItems: 'center',
          }}
        >
          {steps.map(([label, icon], i, arr) => (
            <Step key={label} label={label} icon={icon} isLast={i === arr.length - 1} />
          ))}
          <div style={{ alignSelf: 'stretch', display: 'grid', placeItems: 'center' }}>
            <Banner tone="spring">升级解锁</Banner>
          </div>
        </div>
      </div>
    </section>
  );
}

function Step({ label, icon, isLast }: { label: string; icon: string; isLast: boolean }) {
  return (
    <>
      <PixelPanel className="pp-tight" style={{ textAlign: 'center', padding: '12px 8px' }}>
        <div style={{ fontSize: 28 }}>{icon}</div>
        <div className="t-eyebrow" style={{ fontSize: 9, marginTop: 4 }}>
          {label}
        </div>
      </PixelPanel>
      {!isLast && (
        <div
          style={{
            fontFamily: 'var(--f-pixel)',
            color: 'var(--wood-3)',
            fontSize: 18,
            textAlign: 'center',
          }}
        >
          ▶
        </div>
      )}
    </>
  );
}

// ============================================================
// Features
// ============================================================

function FeaturesSection() {
  const features = [
    {
      t: '多人在场',
      d: 'Supabase Realtime · 14 场景实时同步 · 世界/工坊/私聊',
      chip: 'Phase 3',
    },
    {
      t: '时间引擎',
      d: '48 分钟 = 1 游戏日 · 24 节气循环 · NPC 时段问候',
      chip: 'S2-A',
    },
    {
      t: '等级权限',
      d: 'L0–L4 · 24 像素捏脸 · 公开主页 /u/{username}',
      chip: '已上线',
    },
    {
      t: '数据看板',
      d: '7 tab 运营看板 · 留存/Session/错误埋点',
      chip: '管理员',
    },
  ];

  return (
    <section style={{ padding: '56px 48px', maxWidth: 1280, margin: '0 auto' }}>
      <div className="t-eyebrow" style={{ marginBottom: 6 }}>
        已实现系统
      </div>
      <h2 className="t-title" style={{ fontSize: 32, margin: '0 0 28px' }}>
        不只是个 demo
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        {features.map((f) => (
          <PixelPanel key={f.t}>
            <Chip tone="gold">{f.chip}</Chip>
            <h3 className="t-title" style={{ fontSize: 20, margin: '10px 0 8px' }}>
              {f.t}
            </h3>
            <p
              className="t-soft"
              style={{ fontSize: 13, margin: 0, lineHeight: 1.7 }}
            >
              {f.d}
            </p>
          </PixelPanel>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// Roadmap (4 wave UI redesign progress)
// ============================================================

function RoadmapSection() {
  const waves: { wave: string; title: string; desc: string; status: string; tone: '' | 'gold' }[] = [
    { wave: 'Wave 1', title: '落地页 · 设计系统', desc: '全新像素古籍风首页 · React Router · 字体加载', status: '已上线', tone: 'gold' },
    { wave: 'Wave 2', title: '游戏内 HUD', desc: '顶部头像 · CV 进度条 · 任务面板 · 库存格 · 对话框', status: '排期中', tone: '' },
    { wave: 'Wave 3', title: '手册 + 图鉴', desc: 'ManualPanel 重构 · NPC/工坊/道具 Codex 图鉴', status: '排期中', tone: '' },
    { wave: 'Wave 4', title: '地图视图', desc: 'WorldMap → 三大区域 Maps View · 节气/天气彩蛋', status: '排期中', tone: '' },
  ];

  return (
    <section style={{ padding: '32px 48px 56px', maxWidth: 1280, margin: '0 auto' }}>
      <div className="t-eyebrow" style={{ marginBottom: 6 }}>
        UI 重构 · 4 波分批上线
      </div>
      <h2 className="t-title" style={{ fontSize: 28, margin: '0 0 20px' }}>
        正在做的事
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
        }}
      >
        {waves.map((w) => (
          <PixelPanel key={w.wave} className="pp-tight">
            <div
              className="t-eyebrow"
              style={{ fontSize: 9, marginBottom: 6, color: 'var(--wood-3)' }}
            >
              {w.wave}
            </div>
            <h3 className="t-title" style={{ fontSize: 16, margin: '0 0 6px' }}>
              {w.title}
            </h3>
            <p
              className="t-soft"
              style={{ fontSize: 11, margin: '0 0 10px', lineHeight: 1.6 }}
            >
              {w.desc}
            </p>
            <Chip tone={w.tone}>{w.status}</Chip>
          </PixelPanel>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// CTA
// ============================================================

function CTASection({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <section
      style={{
        padding: '48px',
        background: 'var(--wood-3)',
        color: 'var(--paper-0)',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
        <div
          className="t-display t-display-wrap"
          style={{
            color: 'var(--paper-0)',
            fontSize: 40,
            textShadow: '4px 4px 0 var(--wood-4)',
            marginBottom: 16,
          }}
        >
          走进基地，见到队友。
        </div>
        <p
          style={{
            color: 'var(--paper-2)',
            fontSize: 16,
            margin: '0 0 24px',
          }}
        >
          社区是放大器。游戏只是让"做完后"和"被看见"两个时刻有空间感。
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          <PixelButton
            variant="pb-primary"
            size="pb-lg"
            onClick={() => navigate('/play')}
          >
            立刻进入游戏
          </PixelButton>
          <PixelButton size="pb-lg" onClick={() => navigate('/manual')}>
            查看玩家手册
          </PixelButton>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Footer
// ============================================================

function Footer() {
  return (
    <footer
      style={{
        padding: '24px 48px',
        background: 'var(--wood-4)',
        color: 'var(--paper-2)',
        fontSize: 13,
        display: 'flex',
        justifyContent: 'space-between',
      }}
    >
      <div className="t-eyebrow" style={{ color: 'var(--paper-3)' }}>
        CUA 基地 · v3.0
      </div>
      <div className="mono">© WebAgentLab · MIT License</div>
    </footer>
  );
}
