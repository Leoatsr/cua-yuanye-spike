import { useEffect, useState } from 'react';
import { tutorialManager } from '../lib/tutorialStore';

/**
 * 玩家手册（完整分页式）
 *
 * 6 tab:
 *   1. 🎮 快速上手
 *   2. ⌨️ 键盘
 *   3. 🏛 9 工坊
 *   4. 🎖️ 等级与 CV
 *   5. 🤝 社交
 *   6. ❓ FAQ
 *
 * 顶部 banner: 显示教程进度 + "重启教程"按钮
 */

type Tab = 'quickstart' | 'keys' | 'workshops' | 'levels' | 'social' | 'faq';

interface ManualPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ManualPanel({ open, onClose }: ManualPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('quickstart');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
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
          width: 'min(720px, 95vw)',
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
            <div
              style={{
                fontSize: 11,
                color: '#8a8576',
                letterSpacing: '0.15em',
                marginBottom: 2,
              }}
            >
              MANUAL · v1.x
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#a5c8ff' }}>
              玩家手册
            </div>
          </div>
          <button
            onClick={onClose}
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

        {/* Tutorial banner */}
        <TutorialBanner />

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(0,0,0,0.15)',
            borderBottom: '1px solid rgba(184, 137, 58, 0.2)',
            overflowX: 'auto',
          }}
        >
          <TabButton label="🎮 上手" active={activeTab === 'quickstart'} onClick={() => setActiveTab('quickstart')} />
          <TabButton label="⌨️ 键盘" active={activeTab === 'keys'} onClick={() => setActiveTab('keys')} />
          <TabButton label="🏛 工坊" active={activeTab === 'workshops'} onClick={() => setActiveTab('workshops')} />
          <TabButton label="🎖️ 等级" active={activeTab === 'levels'} onClick={() => setActiveTab('levels')} />
          <TabButton label="🤝 社交" active={activeTab === 'social'} onClick={() => setActiveTab('social')} />
          <TabButton label="❓ FAQ" active={activeTab === 'faq'} onClick={() => setActiveTab('faq')} />
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '18px 22px 24px',
          }}
        >
          {activeTab === 'quickstart' && <QuickstartTab />}
          {activeTab === 'keys' && <KeysTab />}
          {activeTab === 'workshops' && <WorkshopsTab />}
          {activeTab === 'levels' && <LevelsTab />}
          {activeTab === 'social' && <SocialTab />}
          {activeTab === 'faq' && <FaqTab />}
        </div>
      </div>
    </>
  );
}

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
        padding: '10px 16px',
        cursor: 'pointer',
        fontSize: 13,
        color: active ? '#a5c8ff' : '#a8a08e',
        borderBottom: `2px solid ${active ? '#a5c8ff' : 'transparent'}`,
        background: active ? 'rgba(165, 200, 255, 0.08)' : 'transparent',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  );
}

// ============================================================================
// Tutorial banner
// ============================================================================
function TutorialBanner() {
  const [, force] = useState({});
  useEffect(() => {
    const unsub = tutorialManager.subscribe(() => force({}));
    return unsub;
  }, []);

  const progress = tutorialManager.getProgress();
  const isActive = tutorialManager.isActive();
  const isAllDone = tutorialManager.isAllActiveCompleted();
  const hasStarted = tutorialManager.hasEverStarted();

  if (isAllDone) {
    return (
      <div
        style={{
          padding: '8px 18px',
          background: 'rgba(127, 192, 144, 0.1)',
          borderBottom: '1px solid rgba(127, 192, 144, 0.25)',
          fontSize: 11,
          color: '#7fc090',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>🎉 你已完成所有教程</span>
        <button
          onClick={() => tutorialManager.reset()}
          style={{
            padding: '3px 10px',
            fontSize: 10,
            background: 'transparent',
            border: '1px solid rgba(127, 192, 144, 0.4)',
            borderRadius: 3,
            color: '#7fc090',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          重新开始教程
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '8px 18px',
        background: 'rgba(167, 139, 250, 0.08)',
        borderBottom: '1px solid rgba(167, 139, 250, 0.25)',
        fontSize: 11,
        color: '#a78bfa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <span>
        🎓 教程进度{' '}
        <strong style={{ fontFamily: 'monospace' }}>
          {progress.completed} / {progress.total}
        </strong>{' '}
        ({progress.percent}%)
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        {hasStarted && (
          <button
            onClick={() => tutorialManager.reset()}
            style={{
              padding: '3px 10px',
              fontSize: 10,
              background: 'transparent',
              border: '1px solid rgba(168, 179, 160, 0.3)',
              borderRadius: 3,
              color: '#a8a08e',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            重置
          </button>
        )}
        {!isActive && (
          <button
            onClick={() => tutorialManager.start()}
            style={{
              padding: '3px 10px',
              fontSize: 10,
              background: 'rgba(167, 139, 250, 0.2)',
              border: '1px solid rgba(167, 139, 250, 0.5)',
              borderRadius: 3,
              color: '#a78bfa',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 600,
            }}
          >
            {hasStarted ? '继续' : '开始'}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Tab content
// ============================================================================
function QuickstartTab() {
  return (
    <div>
      <Section title="🌱 欢迎来到CUA 基地">
        <P>
          CUA 基地是为 <Strong>WebAgentLab 开源社区</Strong> 构建的像素 MMO 雏形——
          一个把"开源贡献"游戏化的实验。
        </P>
        <P>
          每一份贡献都会被看见——做任务、参与议政、关注他人，所有行动都会沉淀为你的 CV（贡献价值）。
        </P>
      </Section>

      <Section title="🎯 第一次玩，按这个流程">
        <Step n={1} text="按 WASD 键走路（这是基本控制）" />
        <Step n={2} text="走到老村长 阿降 身边按 E 对话" />
        <Step n={3} text="按 J 看看初始任务" />
        <Step n={4} text="按 M 打开世界地图，选一个工坊" />
        <Step n={5} text="进入工坊找 NPC 接任务" />
        <Step n={6} text="完成任务，提交，等审核通过 → 获得 CV" />
        <Step n={7} text="累计 CV 升级 → 解锁更多功能" />
      </Section>

      <Section title="💡 小技巧">
        <Tip>左下 📜 看公告板（更新动态会有红点提示）</Tip>
        <Tip>右下 ? 随时打开本手册</Tip>
        <Tip>右下 😀 用古风表情和别人互动（拱手 / 鞠躬 / 击节 ...）</Tip>
        <Tip>顶部 🔔 通知 — 别人邀请你 / 任务结果都会在这里</Tip>
      </Section>
    </div>
  );
}

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
        <KeyRow k="H" v="任务历史（自己 + 全社区）" />
        <KeyRow k="N" v="通知（红点提醒）" />
      </Section>

      <Section title="🤝 社交">
        <KeyRow k="T" v="聊天（世界 / 工坊 / 私聊）" />
        <KeyRow k="F" v="社交面板（好友 / 关注 / 粉丝）" />
        <KeyRow k="😀" v="点击右下按钮 — 表情菜单" />
      </Section>

      <Section title="📌 提示">
        <Tip>
          按键不会响应：聊天 / 输入框聚焦时按字母键不会触发上面的快捷键（这是为了让你输入字符）
        </Tip>
      </Section>
    </div>
  );
}

function WorkshopsTab() {
  return (
    <div>
      <Section title="🏛 9 工坊总览">
        <P>
          9 个工坊位于<Strong>共创之都</Strong>，每个对应一种贡献类型——
        </P>
      </Section>

      <Workshop name="开元楼" desc="🌱 新人引导 · 完成第一个任务可得 +50 CV" badge="L0+" />
      <Workshop name="声闻台" desc="📝 内容创作 · 文章 / 教程 / 翻译" badge="L0+" />
      <Workshop name="度量阁" desc="📊 度量与评估 · 数据分析 / 调研" badge="L1+" />
      <Workshop name="引才坊" desc="👥 引才与推荐 · 邀请新人 / 介绍专家" badge="L0+" />
      <Workshop name="司算所" desc="⚙️ 算法与技术 · 代码 / 工具开发" badge="L1+" />
      <Workshop name="议事亭" desc="💬 议事与协调 · 跨工坊协作" badge="L1+" />
      <Workshop name="望器楼" desc="🔧 工具与基建 · 平台维护 / 自动化" badge="L2+" />
      <Workshop name="功德堂" desc="🎖️ 长期贡献认可 · 总结 / 复盘 / 沉淀" badge="L2+" />
      <Workshop name="议政高地" desc="🏛 提案与投票 · 决定社区方向" badge="L2+" />

      <Section title="💼 任务流程">
        <Step n={1} text="进入工坊找 NPC（绿点标识）" />
        <Step n={2} text="按 E 对话，接受任务" />
        <Step n={3} text="完成任务（按任务说明 — 可能需要在外部完成）" />
        <Step n={4} text="按 K 打开邮箱，发送提交邮件" />
        <Step n={5} text="等待审核（其他玩家投票通过 / 否决）" />
        <Step n={6} text="通过 → CV 入账，升级有望" />
      </Section>
    </div>
  );
}

function Workshop({ name, desc, badge }: { name: string; desc: string; badge: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr 50px',
        gap: 12,
        padding: '8px 0',
        borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
        fontSize: 12,
        alignItems: 'center',
      }}
    >
      <div style={{ color: '#e0b060', fontWeight: 600 }}>{name}</div>
      <div style={{ color: '#d8cfa8' }}>{desc}</div>
      <div
        style={{
          color: '#a78bfa',
          fontFamily: 'monospace',
          fontSize: 10,
          textAlign: 'right',
          letterSpacing: '0.05em',
        }}
      >
        {badge}
      </div>
    </div>
  );
}

function LevelsTab() {
  return (
    <div>
      <Section title="🎖️ 等级体系（基于 CV）">
        <P>
          CV（Contribution Value，贡献价值）是CUA 基地的<Strong>核心货币</Strong>。
          完成任务、被审核通过即可获得 CV。
        </P>
      </Section>

      <Section title="📈 等级阈值">
        <LevelRow level="L0" name="新人" range="0 - 49 CV" color="#6e6856" />
        <LevelRow level="L1" name="活跃贡献者" range="50 - 199 CV" color="#7fc090" />
        <LevelRow level="L2" name="mentor" range="200 - 499 CV" color="#e0b060" />
        <LevelRow level="L3" name="核心贡献者" range="500 - 1499 CV" color="#a78bfa" />
        <LevelRow level="L4" name="共建人" range="授予制（议政表决）" color="#f4a8c0" />
      </Section>

      <Section title="🔓 等级解锁">
        <Tip>
          <Strong style={{ color: '#7fc090' }}>L1</Strong> · 解锁工坊任务审核投票权
        </Tip>
        <Tip>
          <Strong style={{ color: '#e0b060' }}>L2</Strong> · 可去议政高地参与提案 + 投票
        </Tip>
        <Tip>
          <Strong style={{ color: '#a78bfa' }}>L3</Strong> · 可发起复议（推翻已决议提案）
        </Tip>
        <Tip>
          <Strong style={{ color: '#f4a8c0' }}>L4</Strong> · 共建人 — 共同决定社区方向
        </Tip>
      </Section>

      <Section title="💰 CV 怎么算">
        <Tip>每个任务有自己的 CV 值（NPC 接任务时显示）</Tip>
        <Tip>任务通过 → 全额入账</Tip>
        <Tip>任务被否决 → 0 CV，但任务可以重做</Tip>
        <Tip>邀请新人也可获得 CV（引才坊任务）</Tip>
      </Section>
    </div>
  );
}

function LevelRow({
  level,
  name,
  range,
  color,
}: {
  level: string;
  name: string;
  range: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '50px 130px 1fr',
        gap: 12,
        padding: '7px 0',
        fontSize: 12,
        borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
      }}
    >
      <div style={{ color, fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>
        {level}
      </div>
      <div style={{ color: '#d8cfa8' }}>{name}</div>
      <div style={{ color: '#8a8576', fontFamily: 'monospace', fontSize: 11 }}>{range}</div>
    </div>
  );
}

function SocialTab() {
  return (
    <div>
      <Section title="💬 聊天（按 T）">
        <Tip>
          <Strong style={{ color: '#7fc090' }}>世界</Strong> 频道 — 全服可见
        </Tip>
        <Tip>
          <Strong style={{ color: '#a5c8ff' }}>工坊</Strong> 频道 — 仅当前 scene 玩家可见
        </Tip>
        <Tip>
          <Strong style={{ color: '#f4a8c0' }}>私聊</Strong> — 点其他玩家头像菜单 → 💌 私聊
        </Tip>
      </Section>

      <Section title="🤝 好友 vs ⭐ 关注（按 F）">
        <P>
          按 <Strong>F</Strong> 打开社交面板，5 个 tab：
        </P>
        <KeyRow k="👥 好友" v="双向 · 必须互相同意" />
        <KeyRow k="📥 收到" v="别人发来的好友请求" />
        <KeyRow k="📤 发出" v="你发出的待处理请求" />
        <KeyRow k="⭐ 关注" v="单向 · 无需对方同意（像微博）" />
        <KeyRow k="💗 粉丝" v="关注你的人" />
      </Section>

      <Section title="😀 古风表情">
        <Tip>
          点屏幕右下 😀 按钮 → 8 个古风动作
        </Tip>
        <Tip>
          也可在聊天框输入命令：<code style={codeStyle}>/yi</code>{' '}
          <code style={codeStyle}>/bow</code>{' '}
          <code style={codeStyle}>/clap</code>{' '}
          <code style={codeStyle}>/cheer</code>{' '}
          <code style={codeStyle}>/dance</code>{' '}
          <code style={codeStyle}>/qin</code>{' '}
          <code style={codeStyle}>/think</code>{' '}
          <code style={codeStyle}>/sleep</code>
        </Tip>
        <Tip>触发后屏幕中下方会弹动作通知，全服可见</Tip>
      </Section>

      <Section title="🔔 通知（按 N）">
        <Tip>好友请求 / 关注 / 任务结果都在这里</Tip>
        <Tip>顶部 🔔 图标有红点 = 有未读</Tip>
      </Section>
    </div>
  );
}

function FaqTab() {
  return (
    <div>
      <Faq q="找不到任务怎么办？">
        进入任意工坊（萌芽镇里有传送点 / 按 M 看世界地图）→ 找绿点 NPC → 按 E 对话。开元楼是最容易上手的。
      </Faq>

      <Faq q="我的 CV 没增加？">
        提交任务后需要等其他玩家审核投票 — 通过率达标才入账。审核结果会在邮箱（按 K）通知。
      </Faq>

      <Faq q="为什么按 J 没反应？">
        如果当前光标在聊天输入框里，字母键会作为字符输入。先按 ESC 关闭聊天再按 J。
      </Faq>

      <Faq q="可以删除自己的任务吗？">
        已提交的任务在审核完成前可以撤回（任务日志里 J 操作）。已通过的任务不能删除。
      </Faq>

      <Faq q="教程能重新开始吗？">
        可以 — 在本手册顶部的紫色横条里点"重置"按钮。
      </Faq>

      <Faq q="加好友 vs 关注 有什么区别？">
        好友需要双方同意（像 LinkedIn）。关注是单向的（像微博）— 你可以关注任何人，不需要他同意。两套系统不耦合。
      </Faq>

      <Faq q="为什么聊天里看到 /yi 文本？">
        表情命令故意保留在聊天里，让其他玩家也能看到你"说了什么"。屏幕中下方同时会弹表情动画通知。
      </Faq>

      <Faq q="移动端可以玩吗？">
        v1.x 主要为桌面端设计（依赖键盘）。移动端适配在路线图里。
      </Faq>

      <Faq q="我的数据存在哪？">
        Supabase 后端（云端 + 跨设备同步）+ localStorage（本地缓存）。
      </Faq>

      <Faq q="如何提交反馈 / bug？">
        GitHub Issues:{' '}
        <a
          href="https://github.com/Leoatsr/cua-yuanye-spike/issues"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#a5c8ff', textDecoration: 'underline' }}
        >
          leoatsr/cua-yuanye-spike
        </a>
      </Faq>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================
const codeStyle: React.CSSProperties = {
  background: 'rgba(184, 137, 58, 0.15)',
  color: '#f4a8c0',
  padding: '1px 6px',
  borderRadius: 3,
  fontSize: 11,
  fontFamily: 'monospace',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 13,
          color: '#e0b060',
          letterSpacing: '0.05em',
          marginBottom: 10,
          paddingBottom: 4,
          borderBottom: '1px dashed rgba(184, 137, 58, 0.25)',
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: '6px 0',
        fontSize: 13,
        lineHeight: 1.7,
        color: '#d8cfa8',
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
    <strong style={{ color: '#f5f0e0', fontWeight: 600, ...style }}>
      {children}
    </strong>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr',
        gap: 10,
        padding: '5px 0',
        fontSize: 12,
        color: '#d8cfa8',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'rgba(167, 139, 250, 0.18)',
          color: '#a78bfa',
          textAlign: 'center',
          lineHeight: '20px',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {n}
      </div>
      <div style={{ lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '4px 0 4px 18px',
        fontSize: 12,
        lineHeight: 1.7,
        color: '#d8cfa8',
        position: 'relative',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 0,
          color: '#a78bfa',
        }}
      >
        ·
      </span>
      {children}
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
        padding: '4px 0',
        fontSize: 12,
        alignItems: 'center',
      }}
    >
      <kbd
        style={{
          background: 'rgba(184, 137, 58, 0.15)',
          color: '#f4a8c0',
          padding: '3px 8px',
          borderRadius: 3,
          fontSize: 11,
          fontFamily: 'monospace',
          textAlign: 'center',
          border: '1px solid rgba(244, 168, 192, 0.3)',
        }}
      >
        {k}
      </kbd>
      <div style={{ color: '#d8cfa8' }}>{v}</div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: '10px 12px',
        background: 'rgba(184, 137, 58, 0.05)',
        borderLeft: '3px solid rgba(184, 137, 58, 0.3)',
        borderRadius: 3,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#e0b060',
          marginBottom: 4,
        }}
      >
        Q: {q}
      </div>
      <div style={{ fontSize: 12, color: '#d8cfa8', lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
