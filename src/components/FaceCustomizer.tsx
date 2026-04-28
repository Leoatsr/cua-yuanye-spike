import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import {
  fetchUserFace,
  saveUserFace,
  HAIRSTYLE_NAMES,
  HAIR_COLOR_NAMES,
  OUTFIT_COLOR_NAMES,
  HAIR_COLOR_HEX,
  OUTFIT_TINT_HEX,
  type FaceData,
} from '../lib/faceStore';

/**
 * F6.0 · 捏脸面板
 * Triggered by EventBus 'open-face-customizer'.
 *
 * 3 个维度，每维度 4 选项：
 *   - 发型 (4)
 *   - 发色 (4)
 *   - 衣服色 (4)
 *
 * Live preview shows current selection rendered as SVG.
 */

type Status = 'idle' | 'saving' | 'saved' | 'error';

export function FaceCustomizer() {
  const [open, setOpen] = useState(false);
  const [face, setFace] = useState<FaceData | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const onOpen = async () => {
      setOpen(true);
      setStatus('idle');
      setErrorMsg('');
      const data = await fetchUserFace();
      setFace(data);
    };
    EventBus.on('open-face-customizer', onOpen);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'saving') setOpen(false);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      EventBus.off('open-face-customizer', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, [status]);

  if (!open || !face) return null;

  const setHairstyle = (v: 0 | 1 | 2 | 3) =>
    setFace({ ...face, hairstyle: v });
  const setHairColor = (v: 0 | 1 | 2 | 3) =>
    setFace({ ...face, hair_color: v });
  const setOutfitColor = (v: 0 | 1 | 2 | 3) =>
    setFace({ ...face, outfit_color: v });

  const handleSave = async () => {
    setStatus('saving');
    setErrorMsg('');
    const result = await saveUserFace(face);
    if (result.ok) {
      setStatus('saved');
      EventBus.emit('show-toast', { text: '✦ 形象已更新' });
      setTimeout(() => setOpen(false), 700);
    } else {
      setStatus('error');
      setErrorMsg(result.error ?? '保存失败');
    }
  };

  return (
    <div
      onClick={() => { if (status !== 'saving') setOpen(false); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(8, 12, 18, 0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, backdropFilter: 'blur(3px)',
        animation: 'faceFadeIn 0.3s ease-out',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 720, width: '100%',
          background: 'linear-gradient(180deg, #1f2230 0%, #15171f 100%)',
          border: '1px solid rgba(184, 137, 58, 0.4)',
          borderRadius: 6,
          padding: '32px 36px',
          boxShadow: '0 12px 50px rgba(0,0,0,0.7)',
          color: '#f5f0e0',
        }}
      >
        {/* Header */}
        <div style={{
          borderBottom: '1px solid rgba(184, 137, 58, 0.25)',
          paddingBottom: 16, marginBottom: 24,
        }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.25em',
            color: '#b8893a', textTransform: 'uppercase', marginBottom: 6,
          }}>
            FACE CUSTOMIZER · 魔 镜
          </div>
          <div style={{
            fontFamily: 'serif', fontSize: 22, fontWeight: 600,
            color: '#f5f0e0', letterSpacing: '0.05em',
          }}>
            ✦ 捏 脸 ✦
          </div>
          <div style={{
            fontSize: 12, color: '#a8a08e', marginTop: 6,
          }}>
            选定形象——萌芽镇内外，皆以此貌示人
          </div>
        </div>

        {/* Content: preview + controls */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '180px 1fr',
          gap: 32,
        }}>
          {/* Live preview */}
          <div style={{
            background: 'rgba(168, 179, 160, 0.05)',
            border: '1px solid rgba(168, 179, 160, 0.2)',
            borderRadius: 4,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}>
            <div style={{
              fontSize: 10, color: '#8a8576',
              letterSpacing: '0.12em',
              marginBottom: 12,
            }}>
              PREVIEW
            </div>
            <FacePreview face={face} />
            <div style={{
              marginTop: 14, fontSize: 11, color: '#a8a08e',
              fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.6,
            }}>
              {HAIRSTYLE_NAMES[face.hairstyle]} · {HAIR_COLOR_NAMES[face.hair_color]}<br/>
              {OUTFIT_COLOR_NAMES[face.outfit_color]}衣
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <ControlRow
              label="发型"
              options={HAIRSTYLE_NAMES.map((name, i) => ({
                value: i, label: name,
              }))}
              value={face.hairstyle}
              onChange={(v) => setHairstyle(v as 0 | 1 | 2 | 3)}
            />
            <ControlRow
              label="发色"
              options={HAIR_COLOR_NAMES.map((name, i) => ({
                value: i, label: name, color: '#' + HAIR_COLOR_HEX[i].toString(16).padStart(6, '0'),
              }))}
              value={face.hair_color}
              onChange={(v) => setHairColor(v as 0 | 1 | 2 | 3)}
            />
            <ControlRow
              label="衣色"
              options={OUTFIT_COLOR_NAMES.map((name, i) => ({
                value: i, label: name,
                color: i === 0 ? '#4878c8' : '#' + OUTFIT_TINT_HEX[i].toString(16).padStart(6, '0'),
              }))}
              value={face.outfit_color}
              onChange={(v) => setOutfitColor(v as 0 | 1 | 2 | 3)}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 28, paddingTop: 18,
          borderTop: '1px solid rgba(184, 137, 58, 0.15)',
          display: 'flex', gap: 12, justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
          {status === 'error' && (
            <span style={{
              flex: 1, fontSize: 12, color: '#e0a090',
            }}>
              ⚠️ {errorMsg}
            </span>
          )}
          {status === 'saved' && (
            <span style={{
              flex: 1, fontSize: 12, color: '#7fc090',
            }}>
              ✓ 已保存
            </span>
          )}
          <button
            onClick={() => setOpen(false)}
            disabled={status === 'saving'}
            style={{
              padding: '8px 18px', fontSize: 13,
              background: 'transparent',
              color: '#a8a08e',
              border: '1px solid rgba(168, 179, 160, 0.3)',
              borderRadius: 3,
              cursor: status === 'saving' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={status === 'saving'}
            style={{
              padding: '8px 22px', fontSize: 13, fontWeight: 600,
              background: 'rgba(184, 137, 58, 0.2)',
              color: '#e0b060',
              border: '1px solid rgba(184, 137, 58, 0.6)',
              borderRadius: 3,
              cursor: status === 'saving' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '0.08em',
              opacity: status === 'saving' ? 0.5 : 1,
            }}
          >
            {status === 'saving' ? '保存中...' : '✦ 保存'}
          </button>
        </div>

        <div style={{
          marginTop: 14, fontSize: 10, color: '#6e6856',
          textAlign: 'center',
        }}>
          点击空白或按 Esc 关闭
        </div>
      </div>

      <style>{`
        @keyframes faceFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ============ Sub-components ============

function ControlRow({
  label, options, value, onChange,
}: {
  label: string;
  options: Array<{ value: number; label: string; color?: string }>;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{
        fontSize: 11, letterSpacing: '0.15em',
        color: '#b8893a', marginBottom: 8,
        fontFamily: 'monospace',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, padding: '10px 6px', fontSize: 12,
              background: value === opt.value
                ? 'rgba(184, 137, 58, 0.25)'
                : 'rgba(168, 179, 160, 0.05)',
              color: value === opt.value ? '#e0b060' : '#a8a08e',
              border: `1.5px solid ${value === opt.value
                ? 'rgba(184, 137, 58, 0.7)'
                : 'rgba(168, 179, 160, 0.2)'}`,
              borderRadius: 3,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4,
            }}
          >
            {opt.color && (
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                background: opt.color,
                border: '1px solid rgba(0,0,0,0.4)',
              }} />
            )}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * SVG preview rendering — mirrors faceRenderer.ts (Phaser version).
 * Scaled up for the customizer dialog.
 */
function FacePreview({ face }: { face: FaceData }) {
  const hairColor = '#' + HAIR_COLOR_HEX[face.hair_color].toString(16).padStart(6, '0');
  const outfitTint = OUTFIT_TINT_HEX[face.outfit_color];
  // Default outfit is blue when tint = 0xffffff
  const outfitColor = face.outfit_color === 0
    ? '#4878c8'
    : '#' + outfitTint.toString(16).padStart(6, '0');

  return (
    <svg width="120" height="160" viewBox="0 0 120 160" style={{ imageRendering: 'pixelated' }}>
      {/* Body / outfit */}
      <rect x="40" y="80" width="40" height="40" fill={outfitColor} stroke="#000" strokeOpacity="0.3" />
      {/* Pants */}
      <rect x="42" y="118" width="16" height="30" fill="#3a2818" />
      <rect x="62" y="118" width="16" height="30" fill="#3a2818" />
      {/* Arms */}
      <rect x="28" y="80" width="12" height="30" fill={outfitColor} stroke="#000" strokeOpacity="0.3" />
      <rect x="80" y="80" width="12" height="30" fill={outfitColor} stroke="#000" strokeOpacity="0.3" />
      {/* Skin (head) */}
      <rect x="42" y="36" width="36" height="44" fill="#eacba0" stroke="#000" strokeOpacity="0.3" />
      {/* Eyes */}
      <rect x="50" y="56" width="4" height="4" fill="#000" />
      <rect x="66" y="56" width="4" height="4" fill="#000" />
      {/* Mouth */}
      <rect x="55" y="68" width="10" height="2" fill="#000" />
      {/* Hair */}
      {renderSvgHair(face, hairColor)}
    </svg>
  );
}

function renderSvgHair(face: FaceData, hairColor: string) {
  switch (face.hairstyle) {
    case 0:
      return null;
    case 1:
      // 短发 — bowl cap
      return (
        <>
          <rect x="40" y="28" width="40" height="20" fill={hairColor} stroke="#000" strokeOpacity="0.3" />
          <rect x="40" y="44" width="4" height="8" fill={hairColor} />
          <rect x="76" y="44" width="4" height="8" fill={hairColor} />
        </>
      );
    case 2:
      // 中分
      return (
        <>
          <rect x="40" y="28" width="40" height="20" fill={hairColor} stroke="#000" strokeOpacity="0.3" />
          <rect x="58" y="28" width="4" height="8" fill="#eacba0" />
          <rect x="36" y="32" width="6" height="22" fill={hairColor} />
          <rect x="78" y="32" width="6" height="22" fill={hairColor} />
        </>
      );
    case 3:
      // 马尾
      return (
        <>
          <rect x="40" y="28" width="40" height="20" fill={hairColor} stroke="#000" strokeOpacity="0.3" />
          <rect x="40" y="44" width="40" height="6" fill={hairColor} />
          <rect x="78" y="50" width="14" height="30" fill={hairColor} />
          <rect x="84" y="76" width="8" height="20" fill={hairColor} />
          <rect x="78" y="50" width="14" height="3" fill="#4a3826" />
        </>
      );
  }
}
