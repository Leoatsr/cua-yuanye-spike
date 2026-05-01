import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import { SOLAR_TERM_DESCRIPTIONS } from '../lib/solarTermNotifier';
import { seasonEmoji, type SolarTerm, type Season } from '../lib/timeStore';

/**
 * 节气切换 Banner · Wave 7.E.2 像素风
 *
 * 视觉：羊皮纸 + 木框 + 金色印章感
 * Logic 不变：监听 solar-term-change · 8 秒自动消失 · 点击关闭
 */

interface BannerData {
  id: number;
  newTerm: SolarTerm;
  season: Season;
}

export function SolarTermBanner() {
  const [banner, setBanner] = useState<BannerData | null>(null);

  useEffect(() => {
    let counter = 0;
    const onChange = (data: unknown) => {
      const d = data as { newTerm?: SolarTerm; season?: Season };
      if (!d?.newTerm || !d?.season) return;
      counter++;
      const id = counter;
      setBanner({ id, newTerm: d.newTerm, season: d.season });
      window.setTimeout(() => {
        setBanner((b) => (b?.id === id ? null : b));
      }, 8000);
    };
    EventBus.on('solar-term-change', onChange);
    return () => {
      EventBus.off('solar-term-change', onChange);
    };
  }, []);

  if (!banner) return null;

  const desc = SOLAR_TERM_DESCRIPTIONS[banner.newTerm];

  return (
    <div
      onClick={() => setBanner(null)}
      style={{
        position: 'fixed',
        top: '38%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--paper-1, #fdf0cf)',
        border: '4px solid var(--wood-3, #8b4513)',
        boxShadow:
          '0 0 0 4px var(--wood-4, #5d3a1a), inset 0 0 0 3px var(--paper-3, #e8c98a), 8px 8px 0 0 rgba(60, 30, 10, 0.3)',
        padding: '24px 40px',
        zIndex: 90,
        textAlign: 'center',
        cursor: 'pointer',
        fontFamily:
          'var(--f-title, "Songti SC", "Noto Serif SC", serif)',
        animation: 'pixel-banner-in 0.6s ease-out',
        minWidth: 380,
        maxWidth: 500,
      }}
    >
      {/* 上装饰条 */}
      <div
        style={{
          fontFamily: 'var(--f-pixel, "Courier New", monospace)',
          fontSize: 10,
          color: 'var(--wood-2, #a0522d)',
          letterSpacing: '0.3em',
          marginBottom: 10,
          textTransform: 'uppercase',
        }}
      >
        ✦ 节气更迭 ✦
      </div>

      {/* 主标题 (季节 emoji + 节气名) */}
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: 'var(--wood-3, #8b4513)',
          marginBottom: 8,
          letterSpacing: '0.15em',
          fontFamily: 'var(--f-title, "Songti SC", "Noto Serif SC", serif)',
          textShadow:
            '2px 2px 0 var(--paper-3, #e8c98a), 3px 3px 0 var(--paper-shadow, #c9a55b)',
        }}
      >
        <span style={{ marginRight: 12 }}>{seasonEmoji(banner.season)}</span>
        <span>{banner.newTerm}</span>
      </div>

      {/* 描述 */}
      <div
        style={{
          fontSize: 14,
          color: 'var(--ink, #3a2a1a)',
          fontStyle: 'italic',
          letterSpacing: '0.08em',
          fontFamily: 'var(--f-title, "Songti SC", "Noto Serif SC", serif)',
          marginBottom: 4,
        }}
      >
        {desc}
      </div>

      {/* 下装饰条 */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: '2px dashed var(--paper-shadow, #c9a55b)',
          fontFamily: 'var(--f-pixel, "Courier New", monospace)',
          fontSize: 10,
          color: 'var(--ink-faint, #9c7c54)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        ▼ 点击关闭 ▼
      </div>

      <style>{`
        @keyframes pixel-banner-in {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.85);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
