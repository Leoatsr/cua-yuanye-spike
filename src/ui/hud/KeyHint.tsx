import { Chip } from '../index';

interface KeyHintProps {
  text?: string;
}

/**
 * 游戏底部居中 — 操作提示
 *
 * 用法：
 *   <KeyHint />  // 默认 "WASD 移动 · E 互动 · 空格继续"
 *   <KeyHint text="按 E 跟工坊主对话" />
 */
export function KeyHint({ text = 'WASD 移动 · E 互动 · 空格继续' }: KeyHintProps) {
  return <Chip>{text}</Chip>;
}
