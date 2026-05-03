import type { PrivateConversation } from '../lib/chatStore';
import { Sprite } from '../ui';

interface ConversationItemProps {
  conversation: PrivateConversation;
  active: boolean;
  onClick: () => void;
}

/**
 * 私聊 sidebar 单项 — 头像 + 名字 + 最后消息预览 + 未读
 */
export function ConversationItem({
  conversation,
  active,
  onClick,
}: ConversationItemProps) {
  const preview = conversation.last_message_content || '（暂无消息）';
  const truncated = preview.length > 20 ? preview.slice(0, 20) + '…' : preview;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '8px 10px',
        background: active ? 'var(--paper-2)' : 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--paper-3)',
        borderLeft: active ? '3px solid var(--gold)' : '3px solid transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        textAlign: 'left',
        fontFamily: 'var(--f-sans)',
        position: 'relative',
        transition: 'background 0.15s',
      }}
    >
      {/* 头像 */}
      <div
        style={{
          width: 32,
          height: 32,
          background: 'var(--paper-3)',
          border: '2px solid var(--wood-4)',
          padding: 1,
          flexShrink: 0,
        }}
      >
        {conversation.other_user_avatar ? (
          <img
            src={conversation.other_user_avatar}
            alt={conversation.other_user_name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              imageRendering: 'pixelated',
            }}
          />
        ) : (
          <Sprite name="char" scale={1} />
        )}
      </div>
      {/* 内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="t-title"
          style={{
            fontSize: 12,
            color: 'var(--wood-3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {conversation.other_user_name}
        </div>
        <div
          className="t-faint"
          style={{
            fontSize: 10,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {truncated}
        </div>
      </div>
      {/* 未读角标 */}
      {conversation.unread_count > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'var(--danger)',
            color: '#fff',
            fontSize: 9,
            padding: '1px 5px',
            border: '1px solid var(--wood-4)',
            fontFamily: 'var(--f-num)',
            minWidth: 16,
            textAlign: 'center',
          }}
        >
          {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
        </span>
      )}
    </button>
  );
}
