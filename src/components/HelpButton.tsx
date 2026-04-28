import { useState } from 'react';
import { ManualPanel } from './ManualPanel';

/**
 * HUD 右下 ? 按钮
 *
 * Pub 2a: 打开完整分页式手册（替代原占位版）
 */
export function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        title="帮助 / 玩家手册"
        style={{
          position: 'fixed',
          bottom: 16,
          right: 70,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(20, 24, 30, 0.85)',
          border: open
            ? '1px solid rgba(165, 200, 255, 0.7)'
            : '1px solid rgba(168, 179, 160, 0.3)',
          boxShadow: open
            ? '0 0 12px rgba(165, 200, 255, 0.4)'
            : '0 4px 12px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 700,
          color: '#a5c8ff',
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
        ?
      </div>

      <ManualPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
