import { useEffect, useState } from 'react';
import { EMOTES, type EmoteDef } from '../lib/emoteCatalog';
import { emoteManager } from '../lib/emoteManager';

/**
 * G6 · 表情按钮 + 弹窗
 *
 * 位置：左下角，HUD 区域附近
 * 点击 😀 → 弹出 8 个表情按钮 → 点击触发
 * ESC / 点击外面 关闭
 */

const EMOTE_COOLDOWN_MS = 1500; // 防止刷屏

export function EmotePanel() {
  const [open, setOpen] = useState(false);
  const [lastTriggerAt, setLastTriggerAt] = useState(0);

  // ESC closes
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

  const handleEmote = async (def: EmoteDef) => {
    const now = Date.now();
    if (now - lastTriggerAt < EMOTE_COOLDOWN_MS) return;
    setLastTriggerAt(now);
    await emoteManager.trigger(def.command);
    setOpen(false);
  };

  return (
    <>
      {/* Trigger button */}
      <div
        onClick={() => setOpen((v) => !v)}
        title="表情 (古风动作)"
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(20, 24, 30, 0.85)',
          border: open
            ? '1px solid rgba(224, 176, 96, 0.7)'
            : '1px solid rgba(168, 179, 160, 0.3)',
          boxShadow: open
            ? '0 0 12px rgba(224, 176, 96, 0.4)'
            : '0 4px 12px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
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
        😀
      </div>

      {/* Backdrop + popup */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 49,
            }}
          />
          <div
            style={{
              position: 'fixed',
              bottom: 70,
              right: 16,
              background: 'linear-gradient(180deg, #1f2230 0%, #15171f 100%)',
              border: '1px solid rgba(184, 137, 58, 0.5)',
              borderRadius: 8,
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              padding: 12,
              zIndex: 50,
              width: 280,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#8a8576',
                letterSpacing: '0.15em',
                marginBottom: 8,
                textAlign: 'center',
                paddingBottom: 8,
                borderBottom: '1px dashed rgba(184, 137, 58, 0.2)',
              }}
            >
              EMOTES · G6 · 古风动作
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
              }}
            >
              {EMOTES.map((def) => (
                <EmoteButton
                  key={def.command}
                  def={def}
                  onClick={() => void handleEmote(def)}
                />
              ))}
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 10,
                color: '#6e6856',
                letterSpacing: '0.05em',
                textAlign: 'center',
                fontStyle: 'italic',
              }}
            >
              点击触发 · 也可在聊天框直接输入命令（如 /yi）
            </div>
          </div>
        </>
      )}
    </>
  );
}

function EmoteButton({
  def,
  onClick,
}: {
  def: EmoteDef;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      title={`${def.label} · ${def.description} · ${def.command}`}
      style={{
        padding: '12px 6px',
        background: 'rgba(168, 179, 160, 0.06)',
        border: '1px solid rgba(168, 179, 160, 0.15)',
        borderRadius: 5,
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(224, 176, 96, 0.15)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(224, 176, 96, 0.5)';
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(168, 179, 160, 0.06)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(168, 179, 160, 0.15)';
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 4 }}>{def.emoji}</div>
      <div style={{ fontSize: 11, color: '#f5f0e0', fontWeight: 500 }}>
        {def.label}
      </div>
    </div>
  );
}
