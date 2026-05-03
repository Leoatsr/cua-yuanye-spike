import type { ReactElement, ReactNode } from 'react';

export interface TilePalette {
  fill: string;
  dot?: string;
  line?: string;
}

export interface TileSprite {
  x: number;
  y: number;
  w?: number;
  h?: number;
  el: ReactNode;
}

export interface TileDecal {
  x: number;
  y: number;
  svg: ReactNode;
}

interface TileMapProps {
  data: string[];
  palette: Record<string, TilePalette>;
  tileSize?: number;
  scale?: number;
  sprites?: TileSprite[];
  decals?: TileDecal[];
}

export function TileMap({
  data,
  palette,
  tileSize = 16,
  scale = 2,
  sprites = [],
  decals = [],
}: TileMapProps) {
  const cols = data[0].length;
  const rows = data.length;
  const cells: ReactElement[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = data[y][x];
      const tile = palette[c];
      if (!tile) continue;
      cells.push(
        <rect
          key={`${x}-${y}`}
          x={x * tileSize}
          y={y * tileSize}
          width={tileSize}
          height={tileSize}
          fill={tile.fill}
        />
      );
      if (tile.dot) {
        cells.push(
          <rect
            key={`d-${x}-${y}`}
            x={x * tileSize + tileSize / 2 - 1}
            y={y * tileSize + tileSize / 2 - 1}
            width="2"
            height="2"
            fill={tile.dot}
          />
        );
      }
      if (tile.line) {
        cells.push(
          <rect
            key={`l-${x}-${y}`}
            x={x * tileSize}
            y={y * tileSize + tileSize - 1}
            width={tileSize}
            height="1"
            fill={tile.line}
          />
        );
      }
    }
  }
  return (
    <svg
      width={cols * tileSize * scale}
      height={rows * tileSize * scale}
      viewBox={`0 0 ${cols * tileSize} ${rows * tileSize}`}
      style={{
        imageRendering: 'pixelated',
        shapeRendering: 'crispEdges',
        display: 'block',
      }}
    >
      {cells}
      {decals.map((d, i) => (
        <g key={`decal-${i}`} transform={`translate(${d.x * tileSize}, ${d.y * tileSize})`}>
          {d.svg}
        </g>
      ))}
      {sprites.map((s, i) => (
        <foreignObject
          key={`s-${i}`}
          x={s.x * tileSize}
          y={s.y * tileSize}
          width={s.w || tileSize}
          height={s.h || tileSize * 2}
        >
          <div style={{ width: '100%', height: '100%' }}>{s.el}</div>
        </foreignObject>
      ))}
    </svg>
  );
}
