import { useEffect, useState } from 'react';
import {
  computeGameTime,
  timeSettings,
  type GameTime,
  type DayPhase,
  type Season,
} from '../lib/timeStore';

/**
 * 全屏季节 + 昼夜滤镜
 *
 * 在 Phaser canvas 上方叠加一个半透明 div，根据当前游戏时间渲染：
 *   - 昼夜：晨曦橙黄 / 白天透明 / 黄昏橙红 / 夜晚深蓝
 *   - 季节：浅色调（春绿 / 夏蓝 / 秋金 / 冬青白）
 *
 * 不阻挡鼠标事件（pointerEvents: none）
 */

const PHASE_OVERLAY: Record<DayPhase, string> = {
  dawn: 'linear-gradient(180deg, rgba(255, 180, 120, 0.18) 0%, rgba(255, 200, 150, 0.08) 50%, transparent 100%)',
  day: 'transparent',
  dusk: 'linear-gradient(180deg, rgba(220, 100, 80, 0.20) 0%, rgba(200, 90, 70, 0.10) 50%, transparent 100%)',
  night: 'linear-gradient(180deg, rgba(20, 30, 60, 0.45) 0%, rgba(10, 15, 40, 0.55) 100%)',
};

const SEASON_TINT: Record<Season, string> = {
  春: 'rgba(160, 220, 180, 0.06)',  // 浅绿
  夏: 'rgba(140, 200, 230, 0.06)',  // 浅蓝
  秋: 'rgba(220, 180, 100, 0.08)',  // 浅金
  冬: 'rgba(220, 230, 240, 0.10)',  // 浅青白
};

export function TimeOverlay() {
  const [time, setTime] = useState<GameTime>(() => computeGameTime());
  const [settingsTick, setSettingsTick] = useState(0);

  // 订阅设置变化
  useEffect(() => {
    const unsub = timeSettings.subscribe(() => setSettingsTick((t) => t + 1));
    return unsub;
  }, []);

  // 时间循环 — 每 5 秒更新一次（游戏内 ~2.5 分钟）
  useEffect(() => {
    const tick = () => setTime(computeGameTime());
    const interval = window.setInterval(tick, 5000);
    return () => window.clearInterval(interval);
  }, []);

  void settingsTick; // ensure re-render on settings change
  const settings = timeSettings.get();
  if (!settings.enabled || !settings.showOverlay) return null;
  const intensity = settings.overlayIntensity;

  return (
    <>
      {/* 昼夜遮罩 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: PHASE_OVERLAY[time.phase],
          pointerEvents: 'none',
          zIndex: 5,
          mixBlendMode: 'multiply',
          transition: 'background 8s ease-in-out, opacity 0.3s',
          opacity: intensity,
        }}
      />
      {/* 季节 tint */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: SEASON_TINT[time.season],
          pointerEvents: 'none',
          zIndex: 4,
          mixBlendMode: 'overlay',
          transition: 'background 30s ease-in-out, opacity 0.3s',
          opacity: intensity,
        }}
      />
    </>
  );
}
