import type { ReactElement } from 'react';

/**
 * Sprite — pixel art SVG sprites
 * 用 string-art 数组定义像素形状，渲染成 SVG
 */

const SPRITES: Record<string, string[]> = {
  leaf: [
    '00112200',
    '01112200',
    '11112220',
    '11122220',
    '01222200',
    '00222000',
    '00200000',
    '02000000',
  ],
  coin: [
    '00111100',
    '01122110',
    '11211211',
    '11221211',
    '11211211',
    '11221121',
    '01122110',
    '00111100',
  ],
  heart: [
    '01100110',
    '11211121',
    '12222221',
    '12222221',
    '12222221',
    '01222210',
    '00122100',
    '00012000',
  ],
  char: [
    '000022220000',
    '002233332200',
    '023443344320',
    '234433334432',
    '234411114432',
    '234411114432',
    '023411114320',
    '002211112200',
    '000211112000',
    '002221122200',
    '022211112220',
    '022221122220',
    '002221122200',
    '002201102200',
    '002201102200',
    '022200002220',
  ],
  tree: [
    '00111100',
    '01112110',
    '11122111',
    '11221211',
    '11122111',
    '01211110',
    '00033000',
    '00033000',
  ],
  chest: [
    '111111111111',
    '122222222221',
    '121111111121',
    '121333333121',
    '121344443121',
    '121344443121',
    '121333333121',
    '121111111121',
    '121155551121',
    '121111111121',
    '122222222221',
    '111111111111',
  ],
};

const PALETTE_BY_SPRITE: Record<string, Record<string, string>> = {
  leaf: { '1': '#4f7838', '2': '#8fbc5c', '3': '#1f4a40' },
  coin: { '1': '#a07515', '2': '#daa520', '3': '#fff2c2' },
  heart: { '1': '#7a1f1f', '2': '#c0392b', '3': '#f08080' },
  char: { '1': '#fce5c4', '2': '#3a2a1a', '3': '#a0522d', '4': '#5d3a1a' },
  tree: { '1': '#4f7838', '2': '#8fbc5c', '3': '#5d3a1a' },
  chest: { '1': '#5d3a1a', '2': '#a0522d', '3': '#daa520', '4': '#fff2c2', '5': '#3a2a1a' },
};

interface SpriteProps {
  name: keyof typeof SPRITES | string;
  scale?: number;
  palette?: Record<string, string>;
}

export function Sprite({ name, scale = 4, palette }: SpriteProps) {
  const data = SPRITES[name];
  if (!data) return null;
  const pal = palette || PALETTE_BY_SPRITE[name] || {};
  const rows = data.length;
  const cols = data[0].length;
  const cells: ReactElement[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = data[y][x];
      if (c === '0') continue;
      cells.push(
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={pal[c] || '#000'} />
      );
    }
  }
  return (
    <svg
      width={cols * scale}
      height={rows * scale}
      viewBox={`0 0 ${cols} ${rows}`}
      style={{
        imageRendering: 'pixelated',
        shapeRendering: 'crispEdges',
        display: 'block',
      }}
    >
      {cells}
    </svg>
  );
}
