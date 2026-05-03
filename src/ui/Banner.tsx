import type { ReactNode } from 'react';

export type BannerTone = 'gold' | 'spring' | 'jade';

interface BannerProps {
  children: ReactNode;
  tone?: BannerTone;
}

const COLORS: Record<BannerTone, { bg: string; edge: string; outer: string }> = {
  gold: { bg: '#daa520', edge: '#5d3a1a', outer: '#3a2410' },
  spring: { bg: '#8fbc5c', edge: '#1f4a40', outer: '#1f4a40' },
  jade: { bg: '#2f6b5d', edge: '#0e2a25', outer: '#0e2a25' },
};

export function Banner({ children, tone = 'gold' }: BannerProps) {
  const c = COLORS[tone];
  return (
    <div
      style={{
        display: 'inline-block',
        background: c.bg,
        color: '#fff8dc',
        padding: '6px 24px',
        fontFamily: 'var(--f-pixel)',
        fontSize: 14,
        letterSpacing: '0.1em',
        border: `3px solid ${c.edge}`,
        boxShadow: `0 0 0 3px ${c.outer}, 4px 4px 0 rgba(0,0,0,0.2)`,
        position: 'relative',
      }}
    >
      {children}
    </div>
  );
}
