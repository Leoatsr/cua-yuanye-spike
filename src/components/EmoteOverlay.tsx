import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import type { EmoteEvent } from '../lib/emoteManager';
import type { EmoteCategory } from '../lib/emoteCatalog';

/**
 * G6 · 表情可视化层（React DOM overlay）
 *
 * 监听 'emote-triggered' 事件 → 在屏幕中下方显示一条表情通知
 * 同时显示多个（最多 5 条）
 *
 * 视觉区分（按 category）:
 *   - shout  弹一下 + 向上飘粒子 + 3s
 *   - action 持续闪烁 + 5s
 *   - quiet  缓慢呼吸 + 4s
 */

interface ActiveEmote {
  id: string;
  event: EmoteEvent;
  expiresAt: number;
}

const MAX_VISIBLE = 5;

export function EmoteOverlay() {
  const [active, setActive] = useState<ActiveEmote[]>([]);

  useEffect(() => {
    const onEmote = (event: EmoteEvent) => {
      const id = `${event.user_id}-${event.triggered_at}-${Math.random().toString(36).slice(2, 7)}`;
      const expiresAt = event.triggered_at + event.emote.durationMs;
      setActive((prev) => {
        const next = [...prev, { id, event, expiresAt }];
        return next.slice(-MAX_VISIBLE);
      });
    };
    EventBus.on('emote-triggered', onEmote);
    return () => {
      EventBus.off('emote-triggered', onEmote);
    };
  }, []);

  // Auto-expire
  useEffect(() => {
    if (active.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setActive((prev) => prev.filter((a) => a.expiresAt > now));
    }, 250);
    return () => clearInterval(interval);
  }, [active.length]);

  if (active.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 90,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column-reverse',
        alignItems: 'center',
        gap: 8,
        zIndex: 70,
        pointerEvents: 'none',
        maxWidth: '90vw',
      }}
    >
      {active.map((a) => (
        <EmoteBubble key={a.id} ev={a.event} />
      ))}
      <style>{styleSheet}</style>
    </div>
  );
}

function EmoteBubble({ ev }: { ev: EmoteEvent }) {
  const { emote, display_name } = ev;
  const cat = emote.category;
  const animClass =
    cat === 'shout'
      ? 'emote-shout'
      : cat === 'action'
        ? 'emote-action'
        : 'emote-quiet';

  return (
    <div
      className={animClass}
      style={{
        background: 'linear-gradient(180deg, rgba(31,34,48,0.95), rgba(21,23,31,0.92))',
        border: `1px solid ${categoryColor(cat)}66`,
        borderLeft: `3px solid ${categoryColor(cat)}`,
        borderRadius: 6,
        padding: '8px 14px 8px 12px',
        boxShadow: `0 6px 16px rgba(0,0,0,0.5), 0 0 14px ${categoryColor(cat)}33`,
        color: '#f5f0e0',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 200,
      }}
    >
      <div className={cat === 'shout' ? 'emote-emoji-pop' : ''} style={{ fontSize: 24 }}>
        {emote.emoji}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: categoryColor(cat) }}>
          {display_name}
          <span style={{ marginLeft: 6, fontSize: 11, color: '#f5f0e0', fontWeight: 400 }}>
            {emote.label}
          </span>
        </div>
        <div style={{ fontSize: 10, color: '#8a8576', fontStyle: 'italic' }}>
          {emote.description}
        </div>
      </div>

      {/* Particles for shout category */}
      {cat === 'shout' && (
        <>
          <div className="emote-particle" style={particleStyle(0)} />
          <div className="emote-particle" style={particleStyle(1)} />
          <div className="emote-particle" style={particleStyle(2)} />
        </>
      )}
    </div>
  );
}

function categoryColor(cat: EmoteCategory): string {
  switch (cat) {
    case 'shout': return '#e0b060';
    case 'action': return '#f4a8c0';
    case 'quiet': return '#a5c8ff';
  }
}

function particleStyle(index: number): React.CSSProperties {
  return {
    position: 'absolute',
    left: 18 + index * 14,
    top: 4,
    fontSize: 14,
    pointerEvents: 'none',
    animation: `emoteFloat ${1.4 + index * 0.2}s ease-out forwards`,
    animationDelay: `${index * 0.15}s`,
  };
}

const styleSheet = `
@keyframes emoteIn {
  from { opacity: 0; transform: translateY(15px) scale(0.8); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes emoteFloat {
  0%   { opacity: 0; transform: translateY(0) scale(0.5); }
  20%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(-30px) scale(1); }
}
@keyframes emotePop {
  0%   { transform: scale(1); }
  20%  { transform: scale(1.4); }
  40%  { transform: scale(1); }
  60%  { transform: scale(1.2); }
  100% { transform: scale(1); }
}
@keyframes emoteFlash {
  0%, 100% { transform: scale(1) rotate(-3deg); filter: drop-shadow(0 0 4px rgba(244, 168, 192, 0.6)); }
  50%      { transform: scale(1.15) rotate(3deg); filter: drop-shadow(0 0 8px rgba(244, 168, 192, 1)); }
}
@keyframes emoteBreathe {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.7; transform: scale(0.95); }
}
.emote-shout {
  animation: emoteIn 0.3s ease-out;
  position: relative;
}
.emote-action {
  animation: emoteIn 0.3s ease-out;
  position: relative;
}
.emote-action > div:first-child {
  animation: emoteFlash 1s ease-in-out infinite;
}
.emote-quiet {
  animation: emoteIn 0.3s ease-out, emoteBreathe 2s ease-in-out infinite 0.3s;
  position: relative;
}
.emote-emoji-pop {
  animation: emotePop 0.6s ease-out;
}
`;
