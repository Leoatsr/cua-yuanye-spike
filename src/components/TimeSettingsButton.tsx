import { useEffect, useState } from 'react';
import { timeSettings } from '../lib/timeStore';

/**
 * 时间系统设置按钮 + 弹窗
 *
 * S2-A 升级：
 *   - 加时间倍率调节（1x / 4x / 24x / 60x）
 *   - 加色调强度滑块（0% - 200%）
 */

export function TimeSettingsButton() {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = timeSettings.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  void tick;
  const settings = timeSettings.get();

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        title="时间系统设置"
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'rgba(20, 24, 30, 0.85)',
          border: '1px solid rgba(168, 179, 160, 0.3)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          zIndex: 50,
          transition: 'all 0.2s',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
        }}
      >
        ⚙️
      </div>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
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
              width: 'min(480px, 92vw)',
              maxHeight: '88vh',
              background: 'linear-gradient(180deg, #1f2230 0%, #15171f 100%)',
              border: '1px solid rgba(184, 137, 58, 0.5)',
              borderRadius: 8,
              boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
              zIndex: 100,
              color: '#f5f0e0',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
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
                  SETTINGS
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#e0b060' }}>
                  ⏰ 时间系统设置
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
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

            <div style={{ padding: '20px 22px', overflow: 'auto', flex: 1 }}>
              <ToggleRow
                label="启用季节/昼夜系统"
                desc="总开关 — 关闭后下面所有功能都不生效"
                checked={settings.enabled}
                onChange={(v) => timeSettings.update({ enabled: v })}
              />
              <ToggleRow
                label="显示昼夜色调"
                desc="屏幕添加昼夜光线遮罩 + 季节色调"
                checked={settings.showOverlay}
                onChange={(v) => timeSettings.update({ showOverlay: v })}
                disabled={!settings.enabled}
              />
              <ToggleRow
                label="显示时间 HUD"
                desc="屏幕顶部中央显示当前季节/节气/时间"
                checked={settings.showHUD}
                onChange={(v) => timeSettings.update({ showHUD: v })}
                disabled={!settings.enabled}
              />

              {/* 时间倍率 */}
              <div
                style={{
                  padding: '12px',
                  marginBottom: 8,
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(184, 137, 58, 0.15)',
                  borderRadius: 4,
                  opacity: settings.enabled ? 1 : 0.4,
                }}
              >
                <div style={{ fontSize: 13, color: '#f5f0e0', marginBottom: 4 }}>
                  时间倍率
                </div>
                <div style={{ fontSize: 11, color: '#8a8576', marginBottom: 10 }}>
                  调节游戏时间流逝速度（默认 1x = 48 分钟一天）
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { value: 1, label: '1x' },
                    { value: 4, label: '4x' },
                    { value: 24, label: '24x' },
                    { value: 60, label: '60x' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        settings.enabled &&
                        timeSettings.update({ timeMultiplier: opt.value })
                      }
                      disabled={!settings.enabled}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: 12,
                        background:
                          settings.timeMultiplier === opt.value
                            ? 'rgba(167, 139, 250, 0.25)'
                            : 'rgba(184, 137, 58, 0.05)',
                        border: `1px solid ${
                          settings.timeMultiplier === opt.value
                            ? 'rgba(167, 139, 250, 0.5)'
                            : 'rgba(184, 137, 58, 0.2)'
                        }`,
                        borderRadius: 3,
                        color:
                          settings.timeMultiplier === opt.value ? '#a78bfa' : '#a8a08e',
                        cursor: settings.enabled ? 'pointer' : 'not-allowed',
                        fontFamily: 'monospace',
                        fontWeight:
                          settings.timeMultiplier === opt.value ? 700 : 400,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#6e6856',
                    marginTop: 6,
                    fontFamily: 'monospace',
                  }}
                >
                  当前 {settings.timeMultiplier}x ·{' '}
                  {(48 / settings.timeMultiplier).toFixed(1)} 现实分钟 = 1 游戏日
                </div>
              </div>

              {/* 色调强度 */}
              <div
                style={{
                  padding: '12px',
                  marginBottom: 8,
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(184, 137, 58, 0.15)',
                  borderRadius: 4,
                  opacity: settings.enabled && settings.showOverlay ? 1 : 0.4,
                }}
              >
                <div style={{ fontSize: 13, color: '#f5f0e0', marginBottom: 4 }}>
                  色调强度
                </div>
                <div style={{ fontSize: 11, color: '#8a8576', marginBottom: 10 }}>
                  昼夜遮罩 + 季节 tint 的强度（0% = 完全关闭，200% = 双倍）
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.overlayIntensity}
                  disabled={!settings.enabled || !settings.showOverlay}
                  onChange={(e) =>
                    timeSettings.update({ overlayIntensity: Number(e.target.value) })
                  }
                  style={{
                    width: '100%',
                    accentColor: '#a78bfa',
                  }}
                />
                <div
                  style={{
                    fontSize: 10,
                    color: '#6e6856',
                    marginTop: 4,
                    fontFamily: 'monospace',
                    textAlign: 'right',
                  }}
                >
                  {Math.round(settings.overlayIntensity * 100)}%
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: '12px 14px',
                  background: 'rgba(184, 137, 58, 0.06)',
                  border: '1px solid rgba(184, 137, 58, 0.2)',
                  borderRadius: 4,
                  fontSize: 11,
                  color: '#a8a08e',
                  lineHeight: 1.7,
                }}
              >
                <div style={{ color: '#e0b060', marginBottom: 4, fontWeight: 600 }}>
                  ⏱️ 时间映射
                </div>
                · 1 游戏日 = 48 / 倍率 现实分钟<br />
                · 1 游戏季 = 7 游戏日<br />
                · 24 节气循环：立春 → 雨水 → … → 大寒<br />
                · 昼夜：清晨 06-08 / 白昼 08-17 / 黄昏 17-19 / 夜晚 19-06
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      style={{
        padding: '10px 12px',
        marginBottom: 8,
        background: 'rgba(0,0,0,0.2)',
        border: `1px solid ${
          checked && !disabled
            ? 'rgba(127, 192, 144, 0.4)'
            : 'rgba(184, 137, 58, 0.15)'
        }`,
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        transition: 'all 0.15s',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: '#f5f0e0', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: '#8a8576' }}>{desc}</div>
      </div>
      <div
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked
            ? 'rgba(127, 192, 144, 0.5)'
            : 'rgba(168, 179, 160, 0.2)',
          position: 'relative',
          transition: 'background 0.2s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: checked ? '#7fc090' : '#8a8576',
            transition: 'left 0.2s, background 0.2s',
          }}
        />
      </div>
    </div>
  );
}
