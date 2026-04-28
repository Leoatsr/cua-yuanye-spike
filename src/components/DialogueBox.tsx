import { useEffect, useState, useCallback } from 'react';
import { EventBus } from '../game/EventBus';

interface DialogueData {
  name: string;
  lines: string[];
}

export function DialogueBox() {
  const [data, setData] = useState<DialogueData | null>(null);
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const onShow = (d: DialogueData) => {
      setData(d);
      setLineIndex(0);
      // Play SFX on initial dialogue open
      EventBus.emit('dialogue-advance');
    };
    EventBus.on('show-dialogue', onShow);
    return () => {
      EventBus.off('show-dialogue', onShow);
    };
  }, []);

  const advance = useCallback(() => {
    if (!data) return;
    if (lineIndex < data.lines.length - 1) {
      setLineIndex(lineIndex + 1);
      EventBus.emit('dialogue-advance');
    } else {
      setData(null);
      setLineIndex(0);
    }
  }, [data, lineIndex]);

  useEffect(() => {
    if (!data) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data, advance]);

  if (!data) return null;

  const isLast = lineIndex >= data.lines.length - 1;

  return (
    <div
      onClick={advance}
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(720px, 80vw)',
        padding: '16px 20px',
        background: 'rgba(20, 20, 30, 0.92)',
        color: '#fff',
        border: '2px solid #fff',
        borderRadius: 4,
        cursor: 'pointer',
        userSelect: 'none',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        zIndex: 100,
        fontSize: 16,
      }}
    >
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: 8,
          color: '#FFD700',
          fontSize: 14,
        }}
      >
        {data.name}
      </div>
      <div style={{ lineHeight: 1.6, minHeight: 26 }}>
        {data.lines[lineIndex]}
      </div>
      <div
        style={{
          textAlign: 'right',
          fontSize: 12,
          opacity: 0.6,
          marginTop: 8,
        }}
      >
        ▼ {isLast ? '空格关闭' : '空格继续'}
      </div>
    </div>
  );
}
