import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PixelPanel, PixelButton, Chip } from '../ui';

interface ComingSoonProps {
  title: string;
  eyebrow: string;
  wave: string;
  desc: string;
}

export function ComingSoon({ title, eyebrow, wave, desc }: ComingSoonProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '32px 48px',
        background: 'var(--paper-0)',
      }}
      className="bg-paper"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <div className="t-eyebrow">{eyebrow}</div>
          <h1
            className="t-display"
            style={{
              fontSize: 40,
              margin: '6px 0 0',
              textShadow: '3px 3px 0 var(--paper-3)',
            }}
          >
            {title}
          </h1>
        </div>
        <PixelButton onClick={() => navigate('/')}>← 返回官网</PixelButton>
      </div>

      <div
        style={{
          maxWidth: 720,
          margin: '80px auto',
          textAlign: 'center',
        }}
      >
        <PixelPanel>
          <Chip tone="gold">{wave}</Chip>
          <h2 className="t-title" style={{ fontSize: 28, margin: '20px 0 12px' }}>
            正在重构中
          </h2>
          <p
            className="t-soft"
            style={{ fontSize: 14, lineHeight: 1.8, margin: '0 0 24px' }}
          >
            {desc}
          </p>
          <PixelButton variant="pb-primary" onClick={() => navigate('/')}>
            回首页看进度
          </PixelButton>
        </PixelPanel>
      </div>
    </div>
  );
}

export function ManualPage() {
  return (
    <ComingSoon
      title="玩家手册"
      eyebrow="MANUAL · 玩家手册"
      wave="Wave 3"
      desc="6 tab 完整手册（开始 / 核心循环 / 等级 CV / 社交 / 节气 / 议政）正在重构。当前请进入游戏内按 ? 键打开旧版手册。"
    />
  );
}

export function CodexPage() {
  return (
    <ComingSoon
      title="元素图鉴"
      eyebrow="CODEX · 元素图鉴"
      wave="Wave 3"
      desc="NPC / 工坊 / 道具 三类图鉴正在制作。完成后可在这里浏览所有游戏元素。"
    />
  );
}

export function MapsPage() {
  return (
    <ComingSoon
      title="世界地图"
      eyebrow="MAPS · 世界地图"
      wave="Wave 4"
      desc="三大区域（萌芽镇 / 贡献者中心 / 议政高地）的可视化地图正在制作。当前请进入游戏内按 M 键打开旧版地图。"
    />
  );
}
