import type { ReactNode } from 'react';

export type ChipTone = '' | 'spring' | 'gold' | 'jade' | 'danger';

interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
}

export function Chip({ children, tone = '' }: ChipProps) {
  return <span className={`pchip ${tone ? `pchip-${tone}` : ''}`}>{children}</span>;
}
