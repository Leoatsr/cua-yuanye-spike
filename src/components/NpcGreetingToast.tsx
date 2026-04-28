import { useEffect, useState, useRef } from 'react';
import { EventBus } from '../game/EventBus';
import { computeGameTime, timeSettings } from '../lib/timeStore';
import {
  isSproutTownNpc,
  pickGreeting,
} from '../lib/npcGreetings';

/**
 * NPC 问候 Toast
 *
 * 监听 show-dialogue 事件 — 如果 speaker 是萌芽镇 NPC，
 * 在屏幕右上方弹一个时段问候 toast（不替换原对话）
 *
 * 同一 NPC 在同一时段只弹一次（避免每次按 E 都重复）
 */

interface Greeting {
  id: number;
  speaker: string;
  text: string;
  phase: string;
}

const SHOWN_KEY = 'cua-yuanye-greeting-shown-v1';

interface ShownMap {
  // key: speaker_phase_seasonDay → timestamp
  [key: string]: number;
}

export function NpcGreetingToast() {
  const [greetings, setGreetings] = useState<Greeting[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    const shownMap: ShownMap = (() => {
      try {
        return JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '{}') as ShownMap;
      } catch {
        return {};
      }
    })();

    // 清理过期记录（24 现实小时之外）
    const now = Date.now();
    for (const k of Object.keys(shownMap)) {
      if (now - shownMap[k] > 24 * 60 * 60 * 1000) {
        delete shownMap[k];
      }
    }

    const onDialogue = (data: unknown) => {
      const settings = timeSettings.get();
      if (!settings.enabled) return;

      // 提取 speaker 名字 — 兼容多种 dialogue 数据格式
      const d = data as { speaker?: string; name?: string; npc?: string };
      const speaker = d?.speaker ?? d?.name ?? d?.npc ?? '';
      if (!isSproutTownNpc(speaker)) return;

      const t = computeGameTime();
      const key = `${speaker}_${t.phase}_${Math.floor(t.totalGameDays)}`;
      if (shownMap[key]) return; // 同时段同 NPC 已弹过

      shownMap[key] = now;
      try {
        localStorage.setItem(SHOWN_KEY, JSON.stringify(shownMap));
      } catch {
        // ignore
      }

      // 用 speaker 名字 hash 当 seed，让同 NPC 同时段问候稳定
      let seed = 0;
      for (let i = 0; i < speaker.length; i++) seed += speaker.charCodeAt(i);
      const text = pickGreeting(t.phase, seed + Math.floor(t.totalGameDays));

      const id = ++counterRef.current;
      setGreetings((arr) => [...arr, { id, speaker, text, phase: t.phase }]);

      // 5 秒后移除
      window.setTimeout(() => {
        setGreetings((arr) => arr.filter((g) => g.id !== id));
      }, 5000);
    };

    EventBus.on('show-dialogue', onDialogue);
    return () => {
      EventBus.off('show-dialogue', onDialogue);
    };
  }, []);

  if (greetings.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        right: 60,
        zIndex: 75,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      {greetings.map((g) => (
        <div
          key={g.id}
          style={{
            background: 'linear-gradient(135deg, rgba(31, 34, 48, 0.95), rgba(21, 23, 31, 0.95))',
            border: '1px solid rgba(224, 176, 96, 0.4)',
            borderLeft: '3px solid #e0b060',
            borderRadius: 4,
            padding: '8px 14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            fontSize: 12,
            color: '#f5f0e0',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
            maxWidth: 280,
            animation: 'greeting-slide-in 0.4s ease-out',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: '#a78bfa',
              marginBottom: 3,
              letterSpacing: '0.05em',
            }}
          >
            {g.speaker}
          </div>
          <div style={{ color: '#d8cfa8', lineHeight: 1.5 }}>"{g.text}"</div>
        </div>
      ))}
      <style>{`
        @keyframes greeting-slide-in {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
