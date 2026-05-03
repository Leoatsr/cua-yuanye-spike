interface DialogueBoxProps {
  npcName: string;       // e.g. "村长 · 阿降"
  text: string;
  onAdvance?: () => void;
}

/**
 * 底部居中 — NPC 对话框
 *
 * 用法：
 *   <DialogueBox
 *     npcName="村长 · 阿降"
 *     text="初来乍到？先把这五件小事做了..."
 *     onAdvance={() => setIndex(i => i + 1)}
 *   />
 *
 * 注：右下三角▼会自己闪烁（在 design-system.css 里）
 */
export function DialogueBox({ npcName, text, onAdvance }: DialogueBoxProps) {
  return (
    <div
      onClick={onAdvance}
      style={{ cursor: onAdvance ? 'pointer' : 'default' }}
    >
      <div className="dialogue">
        <div className="name">{npcName}</div>
        <div>{text}</div>
      </div>
    </div>
  );
}
