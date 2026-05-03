import type { ReactNode } from 'react';
import { PixelPanel } from '../index';

export interface HotbarSlot {
  content?: ReactNode;     // sprite or emoji
  qty?: number;             // 道具数量
}

interface HotbarProps {
  slots: HotbarSlot[];      // 长度建议 5
}

/**
 * 右下 — 5 格快捷栏（库存）
 *
 * 用法：
 *   <Hotbar slots={[
 *     { content: <Sprite name="leaf" scale={3} /> },
 *     { content: <Sprite name="coin" scale={3} />, qty: 12 },
 *     { content: '📜' },
 *     {},
 *     {},
 *   ]} />
 */
export function Hotbar({ slots }: HotbarProps) {
  return (
    <PixelPanel
      className="pp-tight"
      style={{ padding: 8, display: 'flex', gap: 4 }}
    >
      {slots.map((slot, i) => (
        <HotbarCell key={i} index={i + 1} slot={slot} />
      ))}
    </PixelPanel>
  );
}

function HotbarCell({ index, slot }: { index: number; slot: HotbarSlot }) {
  const isEmpty = slot.content === undefined || slot.content === null;
  return (
    <div
      className={`inv-cell ${isEmpty ? 'inv-cell-empty' : ''}`}
      style={{ width: 44, height: 44, position: 'relative' }}
    >
      {!isEmpty && slot.content}
      <span
        style={{
          position: 'absolute',
          top: 1,
          left: 2,
          fontSize: 9,
          fontFamily: 'var(--f-num)',
          color: 'var(--wood-4)',
        }}
      >
        {index}
      </span>
      {slot.qty !== undefined && slot.qty > 1 && (
        <span className="qty">{slot.qty}</span>
      )}
    </div>
  );
}
