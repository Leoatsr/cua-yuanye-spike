import { useEffect, useState, useRef } from 'react';
import { EventBus } from '../game/EventBus';

interface QuestItem {
  id: string;
  label: string;
  done: boolean;
}

const INITIAL_QUESTS: QuestItem[] = [
  { id: 'axiang',     label: '与老村长阿降交谈',     done: false },
  { id: 'signpost',   label: '阅读镇中央的告示板',   done: false },
  { id: 'librarian',  label: '拜访典籍阁的图书管理员', done: false },
  { id: 'blacksmith', label: '见见铁匠老周',         done: false },
  { id: 'merchant',   label: '听听商人阿满的故事',   done: false },
  { id: 'fisher',     label: '走到水边找到钓鱼老人', done: false },
];

const STORAGE_KEY = 'cua-yuanye-quests-v1';

export function QuestPanel() {
  const [quests, setQuests] = useState<QuestItem[]>(() => {
    // Load from localStorage if present
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedQuests = JSON.parse(saved) as QuestItem[];
        // Merge with INITIAL_QUESTS to handle schema changes (new quests added)
        return INITIAL_QUESTS.map((q) => {
          const match = savedQuests.find((s) => s.id === q.id);
          return match ? { ...q, done: match.done } : q;
        });
      }
    } catch {
      // ignore corrupt storage
    }
    return INITIAL_QUESTS;
  });

  const [showCompletion, setShowCompletion] = useState(false);
  const [recentlyCompletedId, setRecentlyCompletedId] = useState<string | null>(null);
  const completionShownRef = useRef(false);

  // Persist quests
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quests));
    } catch {
      // ignore quota errors
    }
  }, [quests]);

  // Listen to dialogue events — when a dialogue ends, mark its NPC as visited
  useEffect(() => {
    const onDialogueShow = (data: { name: string; lines: string[]; questId?: string }) => {
      // The Phaser scene now passes a questId in the dialogue payload.
      // Fallback: try to infer from name (legacy path).
      const id = data.questId ?? inferQuestIdFromName(data.name);
      if (!id) return;

      setQuests((prev) => {
        const existing = prev.find((q) => q.id === id);
        if (!existing || existing.done) return prev;
        // Trigger flash animation for newly completed item
        setRecentlyCompletedId(id);
        setTimeout(() => setRecentlyCompletedId(null), 1500);
        return prev.map((q) => (q.id === id ? { ...q, done: true } : q));
      });
    };

    EventBus.on('show-dialogue', onDialogueShow);
    return () => {
      EventBus.off('show-dialogue', onDialogueShow);
    };
  }, []);

  // Watch for "all done" — show completion banner once
  useEffect(() => {
    const allDone = quests.every((q) => q.done);
    if (allDone && !completionShownRef.current) {
      completionShownRef.current = true;
      // Slight delay so the last checkmark animates first
      setTimeout(() => setShowCompletion(true), 600);
    }
  }, [quests]);

  const completedCount = quests.filter((q) => q.done).length;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 50,
          background: 'rgba(20, 20, 30, 0.85)',
          color: '#f5f0e0',
          padding: '10px 14px',
          borderRadius: 6,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
          minWidth: 200,
          maxWidth: 240,
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          fontSize: 12,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 8,
            color: '#FFD700',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>🌱 萌芽镇探索</span>
          <span
            style={{
              fontSize: 11,
              color: '#a8b3a0',
              fontWeight: 400,
            }}
          >
            {completedCount}/{quests.length}
          </span>
        </div>
        <div
          style={{
            height: 1,
            background: 'rgba(245, 240, 224, 0.15)',
            margin: '0 0 8px 0',
          }}
        />
        {quests.map((q) => {
          const isFlashing = recentlyCompletedId === q.id;
          return (
            <div
              key={q.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                lineHeight: 1.4,
                margin: '4px 0',
                color: q.done ? '#7fc090' : '#c8c0a8',
                opacity: q.done ? 0.85 : 1,
                textDecoration: q.done ? 'line-through' : 'none',
                transition: 'all 0.3s',
                animation: isFlashing ? 'questFlash 1.2s ease-out' : 'none',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  flexShrink: 0,
                  marginRight: 4,
                  color: q.done ? '#7fc090' : '#c8c0a8',
                }}
              >
                {q.done ? '✓' : '☐'}
              </span>
              <span>{q.label}</span>
            </div>
          );
        })}

        <style>{`
          @keyframes questFlash {
            0%   { background: rgba(127, 192, 144, 0); }
            30%  { background: rgba(127, 192, 144, 0.35); }
            100% { background: rgba(127, 192, 144, 0); }
          }
          @keyframes bannerSlide {
            from { opacity: 0; transform: translate(-50%, 20px); }
            to   { opacity: 1; transform: translate(-50%, 0); }
          }
        `}</style>
      </div>

      {showCompletion && (
        <CompletionBanner onClose={() => setShowCompletion(false)} />
      )}
    </>
  );
}

function inferQuestIdFromName(name: string): string | null {
  if (name.includes('阿降')) return 'axiang';
  if (name.includes('告示板')) return 'signpost';
  if (name.includes('图书')) return 'librarian';
  if (name.includes('铁匠')) return 'blacksmith';
  if (name.includes('商人')) return 'merchant';
  if (name.includes('钓鱼')) return 'fisher';
  return null;
}

function CompletionBanner({ onClose }: { onClose: () => void }) {
  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: '24%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        background: 'rgba(20, 30, 22, 0.95)',
        color: '#f5f0e0',
        border: '1px solid rgba(255, 215, 0, 0.4)',
        borderRadius: 8,
        padding: '24px 36px',
        textAlign: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        boxShadow:
          '0 8px 32px rgba(0,0,0,0.5), 0 0 60px rgba(255, 215, 0, 0.15)',
        animation: 'bannerSlide 0.6s ease-out',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        maxWidth: 'min(480px, 80vw)',
      }}
    >
      <div style={{ fontSize: 14, color: '#FFD700', letterSpacing: '0.15em', marginBottom: 12 }}>
        🌱 萌芽镇探索完成
      </div>
      <div style={{ fontSize: 16, lineHeight: 1.7, margin: '12px 0' }}>
        谢谢你来过这里。
        <br />
        这只是源野物语的第一站——往后还有共创之都、议政高地、大集会广场。
      </div>
      <div style={{ fontSize: 12, color: '#8a8576', marginTop: 20, letterSpacing: '0.05em' }}>
        点击关闭 · 你可以继续在镇上闲逛
      </div>
    </div>
  );
}
