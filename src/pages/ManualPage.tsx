import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chip } from '../ui';

/**
 * 玩家手册 · 像素古籍风
 *
 * Wave 3.A · 重写 ManualPanel 为独立 React Router 页面
 *
 * 6 tab:
 *   1. 上手
 *   2. 键盘
 *   3. 工坊
 *   4. 等级
 *   5. 社交
 *   6. FAQ
 *
 * 文案 100% reuse 自旧 ManualPanel（cua-yuanye 时代）
 */

type Tab = 'quickstart' | 'keys' | 'workshops' | 'levels' | 'social' | 'faq';

const TAB_CONFIG: Array<{ key: Tab; icon: string; label: string }> = [
  { key: 'quickstart', icon: '🌱', label: '上手' },
  { key: 'keys', icon: '⌨', label: '键盘' },
  { key: 'workshops', icon: '🏛', label: '工坊' },
  { key: 'levels', icon: '🎖', label: '等级' },
  { key: 'social', icon: '🤝', label: '社交' },
  { key: 'faq', icon: '❓', label: 'FAQ' },
];

export function ManualPage() {
  const [activeTab, setActiveTab] = useState<Tab>('quickstart');
  const navigate = useNavigate();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    document.title = '玩家手册 · CUA 基地';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // ESC 返回首页
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
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
            MANUAL · v3.0
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
          玩家手册
        </h1>

        <nav style={{ display: 'flex', gap: 4 }}>
          <Link
            to="/codex"
            style={{
              fontSize: 13,
              color: 'var(--ink-faint)',
              textDecoration: 'none',
              padding: '4px 12px',
              fontFamily: 'var(--f-pixel)',
            }}
          >
            图鉴
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

      {/* 主体 · 双栏布局 */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '24px 32px',
          display: 'grid',
          gridTemplateColumns: '180px 1fr',
          gap: 24,
        }}
      >
        {/* Sidebar tab */}
        <aside
          style={{
            position: 'sticky',
            top: 24,
            alignSelf: 'start',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background:
                  activeTab === tab.key ? 'var(--paper-2)' : 'transparent',
                border:
                  activeTab === tab.key
                    ? '2px solid var(--wood-3)'
                    : '2px solid transparent',
                borderLeft:
                  activeTab === tab.key
                    ? '4px solid var(--gold)'
                    : '4px solid transparent',
                fontFamily: 'var(--f-pixel)',
                fontSize: 13,
                color: activeTab === tab.key ? 'var(--wood-3)' : 'var(--ink)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 14 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}

          <div style={{ borderTop: '1px dashed var(--wood-2)', margin: '12px 0' }} />

          <div
            className="t-faint"
            style={{
              fontSize: 10,
              padding: '0 12px',
              lineHeight: 1.7,
            }}
          >
            ESC 返回首页
            <br />
            J 任务 · K 邮件 · F 好友
          </div>
        </aside>

        {/* Content */}
        <main
          style={{
            background: 'var(--paper-1)',
            border: '3px solid var(--wood-3)',
            boxShadow: '4px 4px 0 var(--wood-4)',
            padding: '24px 28px',
            minHeight: 600,
          }}
        >
          {activeTab === 'quickstart' && <QuickstartTab />}
          {activeTab === 'keys' && <KeysTab />}
          {activeTab === 'workshops' && <WorkshopsTab />}
          {activeTab === 'levels' && <LevelsTab />}
          {activeTab === 'social' && <SocialTab />}
          {activeTab === 'faq' && <FaqTab />}
        </main>
      </div>

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
        CUA 基地 · WebAgentLab Pixel MMO · 玩家手册
      </footer>
    </div>
  );
}

export default ManualPage;

// ============================================================
// Tab 1 · 上手
// ============================================================

function QuickstartTab() {
  return (
    <div>
      <Section title="🌱 欢迎来到 CUA 基地">
        <P>
          CUA 基地是为 <Strong>WebAgentLab 开源社区</Strong> 构建的像素 MMO 雏形——
          一个把"开源贡献"游戏化的实验。
        </P>
        <P>
          每一份贡献都会被看见——做任务、参与议政、关注他人，所有行动都会沉淀为你的 CV（贡献价值）。
        </P>
      </Section>

      <Section title="🎯 第一次玩 · 按这个流程">
        <Step n={1} text="按 WASD 键走路（基本控制）" />
        <Step n={2} text="走到老村长 阿降 身边按 E 对话" />
        <Step n={3} text="按 J 看看初始任务" />
        <Step n={4} text="走出萌芽镇 · 进入共创之都" />
        <Step n={5} text="进入工坊找 NPC 接任务" />
        <Step n={6} text="完成任务，提交 · 等审核通过 → 获得 CV" />
        <Step n={7} text="累计 CV 升级 → 解锁更多功能" />
      </Section>

      <Section title="💡 小技巧">
        <Tip>5 图标按钮 · 公告 / 任务 / 邮件 / 聊天 / 好友</Tip>
        <Tip>右下 ? 随时打开本手册</Tip>
        <Tip>顶部 🔔 通知 · 别人邀请你 / 任务结果都会在这里</Tip>
        <Tip>提交任务后有 3 分钟撤回窗口</Tip>
      </Section>
    </div>
  );
}

// ============================================================
// Tab 2 · 键盘
// ============================================================

function KeysTab() {
  return (
    <div>
      <Section title="🎮 基本操作">
        <KeyRow k="WASD" v="移动玩家" />
        <KeyRow k="E" v="对话 / 互动（靠近 NPC 时）" />
        <KeyRow k="ESC" v="关闭当前面板 / 弹窗" />
      </Section>

      <Section title="📋 信息面板">
        <KeyRow k="J" v="任务日志（你接到的任务）" />
        <KeyRow k="K" v="邮箱（任务结果 / 审核通知）" />
        <KeyRow k="P" v="个人资料（捏脸 / 简介 / 用户名）" />
        <KeyRow k="M" v="世界地图（9 工坊 + 议政高地）" />
        <KeyRow k="N" v="通知（红点提醒）" />
      </Section>

      <Section title="🤝 社交">
        <KeyRow k="T" v="聊天（世界 / 工坊 / 私聊）" />
        <KeyRow k="F" v="社交面板（好友 / 关注 / 粉丝）" />
        <KeyRow k="😀" v="点击右下按钮 — 表情菜单" />
      </Section>

      <Section title="📌 提示">
        <Tip>
          <Strong>聊天 / 输入框聚焦时</Strong>按字母键不会触发上面的快捷键（让你输入字符）·
          先按 ESC 关闭聊天再按 J / K / F。
        </Tip>
      </Section>
    </div>
  );
}

// ============================================================
// Tab 3 · 工坊
// ============================================================

function WorkshopsTab() {
  return (
    <div>
      <Section title="🏛 9 工坊总览">
        <P>
          9 个工坊位于<Strong>共创之都</Strong>，每个对应一种贡献类型——
        </P>
      </Section>

      <Workshop name="百晓居" desc="📚 论文录入 / 项目卡片 / 数据抽查" badge="L0+" status="开放" />
      <Workshop name="开元楼" desc="🌱 新人引导 · 完成第一个任务" badge="L0+" status="筹建" />
      <Workshop name="声闻台" desc="📝 内容创作 · 文章 / 教程 / 翻译" badge="L0+" status="筹建" />
      <Workshop name="度量阁" desc="📊 度量与评估 · 数据分析 / 调研" badge="L1+" status="筹建" />
      <Workshop name="引才坊" desc="👥 引才与推荐 · 邀请新人 / 介绍专家" badge="L0+" status="筹建" />
      <Workshop name="司算所" desc="⚙ 算法与技术 · 代码 / 工具开发" badge="L1+" status="筹建" />
      <Workshop name="议事亭" desc="💬 议事与协调 · 跨工坊协作" badge="L1+" status="筹建" />
      <Workshop name="望器楼" desc="🔧 工具与基建 · 平台维护 / 自动化" badge="L2+" status="筹建" />
      <Workshop name="功德堂" desc="🎖 长期贡献认可 · 总结 / 复盘" badge="L2+" status="开放" />

      <Section title="💼 任务流程">
        <Step n={1} text="进入工坊找 NPC（绿点标识）" />
        <Step n={2} text="按 E 对话，接受任务" />
        <Step n={3} text="完成任务（按任务说明 · 可能需要外部完成）" />
        <Step n={4} text="按 J 在任务日志里提交链接 + 自评" />
        <Step n={5} text="3 位审核员独立评议（30-90 秒）" />
        <Step n={6} text="多数票决定最终系数 → CV 入账" />
        <Step n={7} text="不满意可去明镜阁发起申诉（只上调）" />
      </Section>
    </div>
  );
}

function Workshop({
  name,
  desc,
  badge,
  status,
}: {
  name: string;
  desc: string;
  badge: string;
  status: '开放' | '筹建';
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr 60px 60px',
        gap: 12,
        padding: '8px 0',
        borderBottom: '1px solid var(--paper-3)',
        fontSize: 12,
        alignItems: 'center',
      }}
    >
      <div style={{ color: 'var(--wood-3)', fontWeight: 600 }}>{name}</div>
      <div className="t-soft" style={{ color: 'var(--ink-faint)' }}>
        {desc}
      </div>
      <div
        style={{
          color: 'var(--wood-3)',
          fontFamily: 'var(--f-num)',
          fontSize: 10,
          textAlign: 'right',
        }}
      >
        {badge}
      </div>
      <Chip tone={status === '开放' ? 'spring' : ''}>{status}</Chip>
    </div>
  );
}

// ============================================================
// Tab 4 · 等级
// ============================================================

function LevelsTab() {
  return (
    <div>
      <Section title="🎖 等级体系（基于 CV）">
        <P>
          CV（Contribution Value · 贡献价值）是 CUA 基地的<Strong>核心货币</Strong>。
          完成任务、被审核通过即可获得 CV。
        </P>
      </Section>

      <Section title="📈 等级阈值">
        <LevelRow level="L0" name="萌芽" range="0 - 49 CV" />
        <LevelRow level="L1" name="活跃贡献者" range="50 - 199 CV" />
        <LevelRow level="L2" name="mentor" range="200 - 799 CV" />
        <LevelRow level="L3" name="核心贡献者" range="800 - 2999 CV" />
        <LevelRow level="L4" name="共建人" range="授予制（议政表决）" />
      </Section>

      <Section title="🔓 等级解锁">
        <Tip>
          <Strong>L1</Strong> · 解锁工坊任务审核投票权
        </Tip>
        <Tip>
          <Strong>L2</Strong> · 可去议政高地参与提案 + 投票
        </Tip>
        <Tip>
          <Strong>L3</Strong> · 可发起复议（推翻已决议提案）
        </Tip>
        <Tip>
          <Strong>L4</Strong> · 共建人 · 共同决定社区方向
        </Tip>
      </Section>

      <Section title="💰 CV 怎么算">
        <Tip>每个任务有自己的 CP 值（NPC 接任务时显示）</Tip>
        <Tip>3 位审核员独立给出系数（x0.5 / x1.0 / x2.0）· 取多数</Tip>
        <Tip>最终 CV = CP × 系数 · 全额入账</Tip>
        <Tip>邀请新人也可获得 CV（引才坊任务）</Tip>
      </Section>
    </div>
  );
}

function LevelRow({
  level,
  name,
  range,
}: {
  level: string;
  name: string;
  range: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '50px 130px 1fr',
        gap: 12,
        padding: '7px 0',
        fontSize: 12,
        borderBottom: '1px solid var(--paper-3)',
      }}
    >
      <div
        className="mono"
        style={{
          color: 'var(--gold)',
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {level}
      </div>
      <div className="t-title" style={{ fontSize: 12 }}>
        {name}
      </div>
      <div
        className="mono t-faint"
        style={{ fontSize: 11 }}
      >
        {range}
      </div>
    </div>
  );
}

// ============================================================
// Tab 5 · 社交
// ============================================================

function SocialTab() {
  return (
    <div>
      <Section title="💬 聊天（按 T）">
        <Tip>
          <Strong>世界</Strong> 频道 · 全服可见
        </Tip>
        <Tip>
          <Strong>工坊</Strong> 频道 · 仅当前 scene 玩家可见
        </Tip>
        <Tip>
          <Strong>私聊</Strong> · 点其他玩家头像 → 💌 私聊
        </Tip>
      </Section>

      <Section title="🤝 好友 vs ⭐ 关注（按 F）">
        <P>
          按 <Strong>F</Strong> 打开社交面板：
        </P>
        <KeyRow k="👥 好友" v="双向 · 必须互相同意" />
        <KeyRow k="📥 收到" v="别人发来的好友请求" />
        <KeyRow k="📤 发出" v="你发出的待处理请求" />
        <KeyRow k="⭐ 关注" v="单向 · 无需对方同意（像微博）" />
        <KeyRow k="💗 粉丝" v="关注你的人" />
      </Section>

      <Section title="🔔 通知（按 N）">
        <Tip>好友请求 / 关注 / 任务结果都在这里</Tip>
        <Tip>顶部 🔔 图标有红点 = 有未读</Tip>
      </Section>
    </div>
  );
}

// ============================================================
// Tab 6 · FAQ
// ============================================================

function FaqTab() {
  return (
    <div>
      <Faq q="找不到任务怎么办？">
        进入任意工坊（按 M 看世界地图）→ 找 NPC → 按 E 对话。**百晓居** 是最容易上手的（5 个真任务）。
      </Faq>

      <Faq q="我的 CV 没增加？">
        提交任务后需要等 3 位审核员投票（30-90 秒）· 审核完成后 CV 自动入账。结果会在邮箱（按 K）通知。
      </Faq>

      <Faq q="为什么按 J 没反应？">
        如果当前光标在聊天输入框里 · 字母键会作为字符输入。先按 ESC 关闭聊天再按 J。
      </Faq>

      <Faq q="可以撤回已提交的任务吗？">
        提交后 3 分钟内可以撤回（任务日志 J · 审核中 tab · 撤回按钮 + 倒计时）。3 分钟过后或已收到 quorum 不能撤回。
      </Faq>

      <Faq q="对审核结果不满意怎么办？">
        已完成任务可以在任务日志（按 J · 已完成 tab）点 "发起申诉"· 进入明镜阁流程 · 3 位复审员独立给出意见 · <Strong>只上调系数 · 不下调</Strong>。
      </Faq>

      <Faq q="加好友 vs 关注 有什么区别？">
        好友需要双方同意（像 LinkedIn）· 关注是单向的（像微博）· 你可以关注任何人不需对方同意。
      </Faq>

      <Faq q="议政高地怎么去？">
        L2 mentor 可解锁议政高地传送点 · 在共创之都地图右侧。三大设施：
        <br />
        · 远见塔 · 5 阶段路线图
        <br />
        · 执政厅 · 提案投票
        <br />
        · 明镜阁 · 申诉案桌
      </Faq>

      <Faq q="移动端可以玩吗？">
        v3.x 主要为桌面端设计（依赖键盘）· 移动端适配在路线图里。
      </Faq>

      <Faq q="我的数据存在哪？">
        Supabase 后端（云端 + 跨设备同步）+ localStorage（本地缓存）。
      </Faq>

      <Faq q="如何提交反馈 / bug？">
        GitHub Issues:{' '}
        <a
          href="https://github.com/Leoatsr/cua-base/issues"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--wood-3)', textDecoration: 'underline' }}
        >
          Leoatsr/cua-base
        </a>
      </Faq>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h3
        className="t-title"
        style={{
          fontSize: 16,
          margin: '0 0 12px',
          color: 'var(--wood-3)',
          padding: '4px 0 8px',
          borderBottom: '2px dashed var(--wood-2)',
        }}
      >
        {title}
      </h3>
      <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--ink)' }}>
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: '0 0 10px',
        lineHeight: 1.8,
        color: 'var(--ink)',
      }}
    >
      {children}
    </p>
  );
}

function Strong({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <strong style={{ color: 'var(--gold)', fontWeight: 600, ...style }}>
      {children}
    </strong>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr',
        gap: 10,
        padding: '6px 0',
        fontSize: 12,
        alignItems: 'baseline',
      }}
    >
      <div
        className="mono"
        style={{
          color: 'var(--gold)',
          fontWeight: 700,
          textAlign: 'center',
          background: 'var(--paper-2)',
          border: '1px solid var(--wood-3)',
          borderRadius: 999,
          width: 24,
          height: 24,
          lineHeight: '22px',
        }}
      >
        {n}
      </div>
      <div className="t-soft" style={{ color: 'var(--ink)' }}>
        {text}
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 1fr',
        gap: 8,
        padding: '5px 0',
        fontSize: 12,
        alignItems: 'baseline',
      }}
    >
      <div style={{ color: 'var(--gold)', fontFamily: 'var(--f-num)' }}>·</div>
      <div className="t-soft">{children}</div>
    </div>
  );
}

function KeyRow({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '90px 1fr',
        gap: 12,
        padding: '6px 0',
        fontSize: 12,
        borderBottom: '1px solid var(--paper-3)',
        alignItems: 'center',
      }}
    >
      <div
        className="mono"
        style={{
          background: 'var(--paper-2)',
          color: 'var(--wood-3)',
          padding: '3px 6px',
          border: '1px solid var(--wood-3)',
          fontSize: 11,
          textAlign: 'center',
          fontWeight: 600,
        }}
      >
        {k}
      </div>
      <div className="t-soft" style={{ color: 'var(--ink-faint)' }}>
        {v}
      </div>
    </div>
  );
}

function Faq({
  q,
  children,
}: {
  q: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderBottom: '1px solid var(--paper-3)',
        padding: '12px 0',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'left',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          className="t-title"
          style={{ fontSize: 13, color: 'var(--wood-3)' }}
        >
          {q}
        </span>
        <span
          className="mono"
          style={{
            color: 'var(--gold)',
            fontSize: 16,
            transform: open ? 'rotate(45deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
            display: 'inline-block',
          }}
        >
          +
        </span>
      </button>
      {open && (
        <div
          className="t-soft"
          style={{
            fontSize: 12,
            lineHeight: 1.8,
            paddingTop: 8,
            paddingLeft: 4,
            color: 'var(--ink)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
