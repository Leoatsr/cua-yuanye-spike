import type { CSSProperties, ReactNode } from 'react';

interface PixelPanelProps {
  children: ReactNode;
  variant?: string;
  className?: string;
  style?: CSSProperties;
}

export function PixelPanel({
  children,
  variant = '',
  className = '',
  style,
}: PixelPanelProps) {
  return (
    <div className={`pp ${variant} ${className}`} style={style}>
      {children}
    </div>
  );
}
