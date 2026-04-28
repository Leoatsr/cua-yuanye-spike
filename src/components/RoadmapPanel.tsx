import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';

interface RoadmapStage {
  id: string;
  phaseLabel: string;
  name: string;
  description: string;
  status: 'done' | 'progress' | 'todo';
  progress: number;  // 0-100
  highlights: string[];
}

const STAGES: RoadmapStage[] = [
  {
    id: 'sproutown',
    phaseLabel: 'Phase 1',
    name: '萌芽镇',
    description: '像素体验 + 治理叙事的起点。',
    status: 'done',
    progress: 100,
    highlights: [
      '9 大裂变剧情',
      '阿降 NPC + 引导教程',
      '典籍阁 / 铁匠铺 / 阿降小屋',
      '萌芽印记成长系统',
    ],
  },
  {
    id: 'cocity',
    phaseLabel: 'Phase 2',
    name: '共创之都',
    description: '9 大工坊环绕中央喷泉广场。',
    status: 'progress',
    progress: 33,
    highlights: [
      '✓ 9 工坊外景与喷泉广场',
      '✓ 百晓居首个工坊开放（5 真任务）',
      '✓ 任务提交 / 撤回 / 审核 / 申诉闭环',
      '✓ CV 入账 + 邮件系统',
      '⋯ 其余 8 工坊筹建中',
    ],
  },
  {
    id: 'govhill',
    phaseLabel: 'Phase 4',
    name: '议政高地',
    description: '远见塔、执政厅、明镜阁——治理中心。',
    status: 'progress',
    progress: 25,
    highlights: [
      '✓ 三大陆地图层（C6.0）',
      '✓ 远见塔路线图（你正在看的就是）',
      '✓ 明镜阁申诉案桌（C6.2）',
      '⋯ 执政厅 · 提案投票系统（C6.3）',
      '⋯ L5 权限校验（待 F5）',
    ],
  },
  {
    id: 'realtask',
    phaseLabel: 'Phase 2.5',
    name: '真任务源',
    description: '从虚构任务，迁向真实贡献。',
    status: 'todo',
    progress: 0,
    highlights: [
      '⏭ GitHub Issues 双向同步',
      '⏭ 玩家提交回写 PR/Comment',
      '⏭ Issue Template 标准化',
      '⏭ contributor.md 自动 PR',
    ],
  },
  {
    id: 'multiplayer',
    phaseLabel: 'Phase 3',
    name: '多人在场',
    description: '同屏 10+ 玩家、实时协作。',
    status: 'todo',
    progress: 0,
    highlights: [
      '⏭ Supabase Realtime 在线状态',
      '⏭ 玩家位置同步',
      '⏭ 实时聊天（世界 / 工坊 / 私聊）',
      '⏭ 真审核员入驻',
    ],
  },
];

export function RoadmapPanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    EventBus.on('open-roadmap', onOpen);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      EventBus.off('open-roadmap', onOpen);
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
        animation: 'roadmapFadeIn 0.3s ease-out',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 720, width: '100%',
          background: 'linear-gradient(180deg, #1a1812 0%, #0f0d08 100%)',
          border: '1px solid rgba(184, 137, 58, 0.4)',
          borderRadius: 6,
          padding: '32px 36px 40px',
          boxShadow: '0 12px 50px rgba(0, 0, 0, 0.7)',
          color: '#f5f0e0',
        }}
      >
        {/* Title */}
        <div style={{ borderBottom: '1px solid rgba(184, 137, 58, 0.25)', paddingBottom: 20, marginBottom: 28 }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.25em',
            color: '#b8893a', textTransform: 'uppercase', marginBottom: 6,
          }}>
            VISION TOWER · ROADMAP
          </div>
          <div style={{
            fontFamily: 'serif', fontSize: 26, fontWeight: 600,
            color: '#f5f0e0', letterSpacing: '0.08em',
          }}>
            源野物语 · 五阶路线
          </div>
          <div style={{
            fontSize: 12, color: '#8a8576', marginTop: 8, lineHeight: 1.7,
          }}>
            从萌芽镇起，到议政高地止——这是 CUA 源野物语的全部地图。
            五个阶段，按真实进展更新。
          </div>
        </div>

        {/* Stages */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {STAGES.map((stage) => (
            <div
              key={stage.id}
              style={{
                position: 'relative',
                padding: '16px 18px',
                background: stage.status === 'done'
                  ? 'rgba(127, 192, 144, 0.06)'
                  : stage.status === 'progress'
                    ? 'rgba(184, 137, 58, 0.08)'
                    : 'rgba(168, 179, 160, 0.04)',
                border: `1px solid ${
                  stage.status === 'done'
                    ? 'rgba(127, 192, 144, 0.3)'
                    : stage.status === 'progress'
                      ? 'rgba(184, 137, 58, 0.4)'
                      : 'rgba(168, 179, 160, 0.15)'
                }`,
                borderRadius: 4,
              }}
            >
              {/* Phase label + status */}
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6,
                flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: '#b8893a', fontFamily: 'monospace', fontWeight: 600,
                }}>
                  {stage.phaseLabel}
                </span>
                <span style={{
                  fontSize: 18, fontWeight: 600, fontFamily: 'serif',
                  color: '#f5f0e0',
                }}>
                  {stage.name}
                </span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 10, fontFamily: 'monospace',
                  color: stage.status === 'done' ? '#7fc090'
                    : stage.status === 'progress' ? '#e0b060'
                    : '#8a8576',
                  letterSpacing: '0.08em',
                }}>
                  {stage.status === 'done' ? '✓ 已完成'
                    : stage.status === 'progress' ? `⋯ ${stage.progress}%`
                    : '— 未开始'}
                </span>
              </div>

              <div style={{
                fontSize: 13, color: '#a8a08e', marginBottom: 12, lineHeight: 1.6,
              }}>
                {stage.description}
              </div>

              {/* Progress bar */}
              <div style={{
                height: 4, background: 'rgba(168, 179, 160, 0.1)', borderRadius: 2,
                marginBottom: 14, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${stage.progress}%`,
                  background: stage.status === 'done'
                    ? 'linear-gradient(90deg, #7fc090, #5a9870)'
                    : stage.status === 'progress'
                      ? 'linear-gradient(90deg, #e0b060, #b8893a)'
                      : '#8a8576',
                  transition: 'width 0.6s ease-out',
                }} />
              </div>

              {/* Highlights */}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {stage.highlights.map((h, i) => (
                  <li key={i} style={{
                    fontSize: 12.5, color: '#c8c0a8', lineHeight: 1.85,
                    paddingLeft: 16, position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', left: 0,
                      color: stage.status === 'done' ? '#7fc090'
                        : stage.status === 'progress' ? '#b8893a'
                        : '#666',
                    }}>·</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 32, paddingTop: 20,
          borderTop: '1px solid rgba(184, 137, 58, 0.2)',
          textAlign: 'center',
          fontSize: 11, color: '#6e6856', letterSpacing: '0.1em',
          lineHeight: 1.8,
        }}>
          路还很长——但每一步都在走。
          <br />
          <span style={{ fontSize: 10, color: '#4a463e' }}>
            点击空白或按 Esc 关闭
          </span>
        </div>
      </div>

      <style>{`
        @keyframes roadmapFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
