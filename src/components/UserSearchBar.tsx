import { useState } from 'react';
import { fetchProfileByUsername } from '../lib/profileStore';
import type { UserProfile } from '../lib/profileStore';
import { PixelButton } from '../ui';

interface UserSearchBarProps {
  /** 找到用户后回调（点 "去对话" 按钮触发）*/
  onStartConversation: (profile: UserProfile) => void;
  /** 当前自己的 user_id · 用于排除自己 */
  myUserId: string | null;
}

/**
 * 搜索用户名 · G2-D
 *
 * UI:
 *   [输入框] [🔍 搜索]
 *   [结果卡片] [+ 开始对话]
 */
export function UserSearchBar({ onStartConversation, myUserId }: UserSearchBarProps) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<UserProfile | null>(null);

  const search = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setError('');
    setResult(null);
    try {
      const profile = await fetchProfileByUsername(trimmed);
      if (!profile) {
        setError(`找不到用户 "${trimmed}"`);
      } else if (profile.user_id === myUserId) {
        setError('不能给自己发消息');
      } else {
        setResult(profile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void search();
    }
  };

  return (
    <div
      style={{
        padding: '10px 12px',
        borderBottom: '2px solid var(--wood-3)',
        background: 'var(--paper-1)',
      }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={onKeyDown}
          placeholder="搜索用户名..."
          style={{
            flex: 1,
            padding: '6px 8px',
            border: '2px solid var(--wood-4)',
            background: 'var(--paper-0)',
            fontSize: 12,
            fontFamily: 'var(--f-sans)',
            outline: 'none',
          }}
        />
        <PixelButton
          size="pb-sm"
          onClick={() => void search()}
          disabled={searching || !query.trim()}
        >
          🔍
        </PixelButton>
      </div>

      {error && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--danger)',
            marginTop: 6,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 6,
            padding: 8,
            background: 'var(--paper-2)',
            border: '2px solid var(--wood-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: 'var(--paper-3)',
              border: '2px solid var(--wood-4)',
              padding: 1,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {result.avatar_url && (
              <img
                src={result.avatar_url}
                alt={result.display_name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  imageRendering: 'pixelated',
                }}
              />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-title" style={{ fontSize: 12 }}>
              {result.display_name}
            </div>
            <div
              className="t-faint mono"
              style={{ fontSize: 10 }}
            >
              @{result.username}
            </div>
          </div>
          <PixelButton
            variant="pb-primary"
            size="pb-sm"
            onClick={() => {
              onStartConversation(result);
              setQuery('');
              setResult(null);
            }}
          >
            对话
          </PixelButton>
        </div>
      )}
    </div>
  );
}
