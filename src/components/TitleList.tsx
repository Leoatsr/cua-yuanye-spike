import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';

interface Title {
  id: string;
  label: string;
  giver: string;     // who gave it
}

const STORAGE_KEY = 'cua-yuanye-titles-v1';
const STORAGE_KEY_BADGE = 'cua-yuanye-badge-v1';

export function TitleList() {
  const [titles, setTitles] = useState<Title[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as Title[];
    } catch { /* ignore */ }
    return [];
  });

  const [hasBadge, setHasBadge] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY_BADGE) === '1'
  );

  // Track recently-added title for animation
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  useEffect(() => {
    const onTitleEarned = (data: Title) => {
      setTitles((prev) => {
        if (prev.some((t) => t.id === data.id)) return prev;
        const next = [...prev, data];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setRecentlyAddedId(data.id);
        setTimeout(() => setRecentlyAddedId(null), 2000);
        return next;
      });
    };

    const onBadgeEarned = () => setHasBadge(true);

    EventBus.on('title-earned', onTitleEarned);
    EventBus.on('badge-earned', onBadgeEarned);
    return () => {
      EventBus.off('title-earned', onTitleEarned);
      EventBus.off('badge-earned', onBadgeEarned);
    };
  }, []);

  // Don't render anything until the player is a citizen
  if (!hasBadge) return null;

  if (titles.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 70, // sits to the right of the citizen badge (badge is at left:16, ~50px wide)
        zIndex: 50,
        background: 'rgba(20, 20, 30, 0.85)',
        padding: '6px 10px',
        borderRadius: 6,
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(220, 180, 60, 0.3)',
        maxWidth: 320,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#a8b3a0',
          letterSpacing: '0.1em',
          marginBottom: 4,
        }}
      >
        🎖️ 称号
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
        }}
      >
        {titles.map((t) => {
          const isNew = t.id === recentlyAddedId;
          return (
            <span
              key={t.id}
              title={`来自 ${t.giver}`}
              style={{
                fontSize: 11,
                color: '#FFD700',
                background: 'rgba(255, 215, 0, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                borderRadius: 4,
                padding: '2px 8px',
                animation: isNew ? 'titleGlow 2s ease-out' : 'none',
              }}
            >
              {t.label}
            </span>
          );
        })}
      </div>
      <style>{`
        @keyframes titleGlow {
          0%   { background: rgba(255, 215, 0, 0.6); transform: scale(1.15); }
          100% { background: rgba(255, 215, 0, 0.08); transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
