import { useEffect, useState } from 'react';
import {
  computeGameTime,
  formatTime,
  seasonEmoji,
  phaseEmoji,
  phaseLabel,
  timeSettings,
  type GameTime,
} from '../lib/timeStore';

/**
 * 顶部中央时间 HUD
 *
 * 显示：
 *   - 季节 emoji + 节气名（春 · 立春）
 *   - 时间（08:30）
 *   - 昼夜阶段 emoji + 标签（☀️ 白昼）
 */

export function TimeHUD() {
  const [time, setTime] = useState<GameTime>(() => computeGameTime());
  const [settingsTick, setSettingsTick] = useState(0);

  useEffect(() => {
    const unsub = timeSettings.subscribe(() => setSettingsTick((t) => t + 1));
    return unsub;
  }, []);

  // 每 5 秒刷新
  useEffect(() => {
    const tick = () => setTime(computeGameTime());
    const interval = window.setInterval(tick, 5000);
    return () => window.clearInterval(interval);
  }, []);

  void settingsTick;
  const settings = timeSettings.get();
  if (!settings.enabled || !settings.showHUD) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(20, 24, 30, 0.85)',
        border: '1px solid rgba(184, 137, 58, 0.4)',
        borderRadius: 6,
        padding: '6px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        zIndex: 80,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
        fontSize: 12,
        color: '#f5f0e0',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        pointerEvents: 'none', // 不挡鼠标
        userSelect: 'none',
      }}
    >
      {/* 季节 + 节气 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 14 }}>{seasonEmoji(time.season)}</span>
        <span style={{ color: '#e0b060', letterSpacing: '0.05em' }}>
          {time.season} · {time.solarTerm}
        </span>
      </div>

      <span style={{ color: '#6e6856' }}>·</span>

      {/* 时间 */}
      <div
        style={{
          fontFamily: 'monospace',
          fontWeight: 600,
          color: '#a5c8ff',
          fontSize: 13,
          letterSpacing: '0.05em',
        }}
      >
        {formatTime(time)}
      </div>

      <span style={{ color: '#6e6856' }}>·</span>

      {/* 昼夜阶段 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 14 }}>{phaseEmoji(time.phase)}</span>
        <span style={{ color: '#a8a08e' }}>{phaseLabel(time.phase)}</span>
      </div>
    </div>
  );
}
