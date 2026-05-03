interface HelpButtonProps {
  onClick?: () => void;
  label?: string;        // 默认 "?"，但可换 "M" "?"等
}

/**
 * 右下 — 帮助按钮（设计稿里的金色问号）
 */
export function HelpButton({ onClick, label = '?' }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className="pb pb-primary"
      style={{ width: 56, height: 56, padding: 0, fontSize: 24 }}
    >
      {label}
    </button>
  );
}
