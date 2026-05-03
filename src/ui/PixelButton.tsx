import type { CSSProperties, ReactNode, MouseEvent } from 'react';

interface PixelButtonProps {
  children: ReactNode;
  variant?: string;
  size?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}

export function PixelButton({
  children,
  variant = '',
  size = '',
  onClick,
  className = '',
  style,
  disabled = false,
}: PixelButtonProps) {
  return (
    <button
      className={`pb ${variant} ${size} ${className}`}
      style={style}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
