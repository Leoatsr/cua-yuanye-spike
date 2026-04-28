import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import {
  SOLAR_TERM_DESCRIPTIONS,
} from '../lib/solarTermNotifier';
import { seasonEmoji, type SolarTerm, type Season } from '../lib/timeStore';

/**
 * 节气切换 Banner
 *
 * 监听 solar-term-change 事件 → 屏幕中央弹一个 8 秒 banner
 * 例如："📜 节气更迭 · 今日是「立春」 — 万物初醒，春之始"
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

      // 8 秒后自动消失
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
        background: 'linear-gradient(135deg, rgba(31, 34, 48, 0.97), rgba(21, 23, 31, 0.97))',
        border: '2px solid rgba(224, 176, 96, 0.6)',
        borderRadius: 8,
        padding: '20px 36px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 24px rgba(224, 176, 96, 0.3)',
        zIndex: 90,
        textAlign: 'center',
        cursor: 'pointer',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
        animation: 'solar-term-banner-in 0.6s ease-out',
        minWidth: 380,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: '#a8a08e',
          letterSpacing: '0.2em',
          marginBottom: 8,
        }}
      >
        ✦ 节气更迭 ✦
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: '#e0b060',
          marginBottom: 6,
          letterSpacing: '0.1em',
          fontFamily: 'serif',
        }}
      >
        {seasonEmoji(banner.season)} {banner.newTerm}
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#d8cfa8',
          fontStyle: 'italic',
          letterSpacing: '0.05em',
        }}
      >
        {desc}
      </div>
      <div
        style={{
          fontSize: 10,
          color: '#6e6856',
          marginTop: 10,
          letterSpacing: '0.05em',
        }}
      >
        点击关闭
      </div>
      <style>{`
        @keyframes solar-term-banner-in {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
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
