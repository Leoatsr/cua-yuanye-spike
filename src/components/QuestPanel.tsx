import { useEffect, useState, useRef } from 'react';
import { EventBus } from '../game/EventBus';

interface QuestItem {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
}

const INITIAL_QUESTS: QuestItem[] = [
  { id: 'axiang-first',  label: '与老村长高粱首次交谈',     done: false, hint: '高粱在镇北的小屋门前' },
  { id: 'signpost',      label: '阅读镇中央的告示板',       done: false, hint: '镇中央十字路口的告示牌' },
  { id: 'librarian',     label: '拜访典籍阁的图书管理员',   done: false, hint: '典籍阁在高粱小屋的右边' },
  { id: 'blacksmith',    label: '见见铁匠老周',             done: false, hint: '铁匠铺在镇子西南' },
  { id: 'merchant',      label: '听听商人阿满的故事',       done: false, hint: '商人摊位在镇子中南' },
  { id: 'fisher',        label: '走到水边找到钓鱼老人',     done: false, hint: '镇子东南角的水池边' },
  { id: 'flowers',       label: '采摘镇子里的 3 朵花',      done: false, hint: '镇子里散落着粉色的花丛' },
  { id: 'corners',       label: '走到镇子的 4 个角',        done: false, hint: '走到地图最远的 4 个角落' },
  { id: 'axiang-final',  label: '回去找高粱复命',           done: false, hint: '完成前面所有任务后再回去找高粱' },
];

const STORAGE_KEY = 'cua-yuanye-quests-v2';
const STORAGE_KEY_EGGS = 'cua-yuanye-eggs-v1';
const STORAGE_KEY_FLOWERS = 'cua-yuanye-flowers-v1';
const STORAGE_KEY_CORNERS = 'cua-yuanye-corners-v1';
const STORAGE_KEY_BADGE = 'cua-yuanye-badge-v1';

interface ToastMsg {
  id: number;
  text: string;
  type: 'quest' | 'egg' | 'progress';
}

export function QuestPanel() {
  const [quests, setQuests] = useState<QuestItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedQuests = JSON.parse(saved) as QuestItem[];
        return INITIAL_QUESTS.map((q) => {
          const match = savedQuests.find((s) => s.id === q.id);
          return match ? { ...q, done: match.done } : q;
        });
      }
    } catch { /* ignore */ }
    return INITIAL_QUESTS;
  });

  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showCompletion, setShowCompletion] = useState(false);
  const [recentlyCompletedId, setRecentlyCompletedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(true);  // F4.x layout: default collapsed
  const [hasBadge, setHasBadge] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY_BADGE) === '1';
  });
  const completionShownRef = useRef(false);
  const toastIdRef = useRef(0);

  // Use a ref to read the latest quests in event handlers without re-binding
  const questsRef = useRef(quests);
  useEffect(() => {
    questsRef.current = quests;
  }, [quests]);

  const addToast = (text: string, type: ToastMsg['type'] = 'quest') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quests));
    } catch { /* ignore */ }
  }, [quests]);

  useEffect(() => {
    const markQuestDone = (id: string) => {
      setQuests((prev) => {
        const existing = prev.find((q) => q.id === id);
        if (!existing || existing.done) return prev;
        setRecentlyCompletedId(id);
        setTimeout(() => setRecentlyCompletedId(null), 1500);
        addToast(`✓ ${existing.label}`, 'quest');
        return prev.map((q) => (q.id === id ? { ...q, done: true } : q));
      });
    };

    const onDialogueShow = (data: { name: string; lines: string[]; questId?: string }) => {
      const id = data.questId ?? inferQuestIdFromName(data.name);
      if (!id) return;

      // Special handling for axiang-final: only mark done if all other quests done
      if (id === 'axiang-final') {
        const allOthersDone = INITIAL_QUESTS
          .filter((q) => q.id !== 'axiang-final')
          .every((q) => questsRef.current.find((qq) => qq.id === q.id)?.done);
        if (!allOthersDone) return;
      }

      const realId = id === 'axiang' ? 'axiang-first' : id;
      markQuestDone(realId);
    };

    const onFlowerPicked = (data: { flowerId: string }) => {
      try {
        const picked: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY_FLOWERS) ?? '[]');
        if (picked.includes(data.flowerId)) return;
        picked.push(data.flowerId);
        localStorage.setItem(STORAGE_KEY_FLOWERS, JSON.stringify(picked));
        addToast(`🌸 摘下一朵花（${picked.length}/3）`, 'progress');
        if (picked.length >= 3) {
          markQuestDone('flowers');
        }
      } catch { /* ignore */ }
    };

    const onCornerReached = (data: { cornerId: string }) => {
      try {
        const reached: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CORNERS) ?? '[]');
        if (reached.includes(data.cornerId)) return;
        reached.push(data.cornerId);
        localStorage.setItem(STORAGE_KEY_CORNERS, JSON.stringify(reached));
        addToast(`📍 到达镇子的一个角（${reached.length}/4）`, 'progress');
        if (reached.length >= 4) {
          markQuestDone('corners');
        }
      } catch { /* ignore */ }
    };

    const onEasterEgg = (data: { eggId: string; text: string }) => {
      try {
        const found: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EGGS) ?? '[]');
        if (found.includes(data.eggId)) return;
        found.push(data.eggId);
        localStorage.setItem(STORAGE_KEY_EGGS, JSON.stringify(found));
        addToast(`✨ 隐藏发现:${data.text}`, 'egg');
      } catch { /* ignore */ }
    };

    // ---- Generic toast event (used by QuestLog and other components) ----
    const onShowToast = (data: { text: string; type?: 'quest' | 'progress' | 'egg' }) => {
      addToast(data.text, data.type ?? 'progress');
    };

    EventBus.on('show-dialogue', onDialogueShow);
    EventBus.on('flower-picked', onFlowerPicked);
    EventBus.on('corner-reached', onCornerReached);
    EventBus.on('easter-egg', onEasterEgg);
    EventBus.on('show-toast', onShowToast);
    return () => {
      EventBus.off('show-dialogue', onDialogueShow);
      EventBus.off('flower-picked', onFlowerPicked);
      EventBus.off('corner-reached', onCornerReached);
      EventBus.off('easter-egg', onEasterEgg);
      EventBus.off('show-toast', onShowToast);
    };
  }, []);

  useEffect(() => {
    const allDone = quests.every((q) => q.done);
    if (allDone && !completionShownRef.current) {
      completionShownRef.current = true;
      setTimeout(() => {
        setShowCompletion(true);
        setHasBadge(true);
        localStorage.setItem(STORAGE_KEY_BADGE, '1');
        EventBus.emit('badge-earned');
      }, 600);
    }
  }, [quests]);

  const completedCount = quests.filter((q) => q.done).length;
  const currentHint = quests.find((q) => !q.done)?.hint;

  return (
    <>
      <div
        style={{
          position: 'fixed', top: 16, right: 200, zIndex: 50,
          background: 'rgba(20, 20, 30, 0.85)', color: '#f5f0e0',
          padding: collapsed ? '6px 12px' : '10px 14px',
          borderRadius: 4,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
          minWidth: collapsed ? 'auto' : 220,
          maxWidth: collapsed ? 'auto' : 260,
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)', fontSize: 12,
          border: '1px solid rgba(255, 215, 0, 0.3)',
          cursor: collapsed ? 'pointer' : 'default',
        }}
        onClick={collapsed ? () => setCollapsed(false) : undefined}
      >
        <div
          onClick={collapsed ? undefined : () => setCollapsed(true)}
          style={{
            fontSize: 13, fontWeight: 600,
            marginBottom: collapsed ? 0 : 8,
            color: '#FFD700', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <span>📋 任务</span>
          <span style={{ fontSize: 11, color: '#a8b3a0', fontWeight: 400 }}>
            {completedCount}/{quests.length} {collapsed ? '▾' : '▴'}
          </span>
        </div>
        {!collapsed && (
          <>
            <div style={{ height: 1, background: 'rgba(245, 240, 224, 0.15)', margin: '0 0 8px 0' }} />
            <div style={{
              fontSize: 11, color: '#a8b3a0',
              marginBottom: 6,
              letterSpacing: '0.05em',
            }}>
              🌱 萌芽镇 · 九大裂变
            </div>
            {quests.map((q) => {
              const isFlashing = recentlyCompletedId === q.id;
              return (
                <div
                  key={q.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start',
                    lineHeight: 1.4, margin: '4px 0',
                    color: q.done ? '#7fc090' : '#c8c0a8',
                    opacity: q.done ? 0.85 : 1,
                    textDecoration: q.done ? 'line-through' : 'none',
                    transition: 'all 0.3s',
                    animation: isFlashing ? 'questFlash 1.2s ease-out' : 'none',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block', width: 14, flexShrink: 0,
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

            {currentHint && (
              <div
                style={{
                  marginTop: 10, padding: '6px 8px',
                  background: 'rgba(255, 215, 0, 0.08)',
                  borderLeft: '2px solid rgba(255, 215, 0, 0.4)',
                  fontSize: 11, color: '#d8c890', lineHeight: 1.4,
                }}
              >
                💡 {currentHint}
              </div>
            )}
          </>
        )}

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
          @keyframes toastSlide {
            from { opacity: 0; transform: translateX(20px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes toastFade {
            0% { opacity: 1; }
            85% { opacity: 1; }
            100% { opacity: 0; }
          }
        `}</style>
      </div>

      {hasBadge && (
        <div
          style={{
            position: 'fixed', bottom: 16, left: 16, zIndex: 50,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(20, 20, 30, 0.85)',
            padding: '6px 10px', borderRadius: 6,
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(220, 180, 60, 0.4)',
          }}
        >
          <img
            src="/assets/sprites/badge-citizen.png"
            alt="萌芽镇镇民"
            style={{ width: 32, height: 32, imageRendering: 'pixelated' }}
          />
          <span
            style={{
              fontSize: 11, color: '#FFD700',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
              letterSpacing: '0.05em',
            }}
          >
            萌芽镇<br />镇民
          </span>
        </div>
      )}

      <div
        style={{
          position: 'fixed', bottom: 80, right: 16, zIndex: 60,
          display: 'flex', flexDirection: 'column', gap: 8,
          alignItems: 'flex-end', pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: '8px 14px', borderRadius: 6, fontSize: 12,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
              background:
                t.type === 'egg' ? 'rgba(80, 30, 100, 0.92)' :
                t.type === 'progress' ? 'rgba(30, 60, 90, 0.92)' :
                'rgba(40, 80, 50, 0.92)',
              color: '#fff',
              border:
                t.type === 'egg' ? '1px solid rgba(220, 160, 250, 0.5)' :
                '1px solid rgba(180, 220, 200, 0.3)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
              maxWidth: 280,
              animation: 'toastSlide 0.3s ease-out, toastFade 4.5s ease-out',
            }}
          >
            {t.text}
          </div>
        ))}
      </div>

      {showCompletion && (
        <CompletionBanner onClose={() => setShowCompletion(false)} />
      )}
    </>
  );
}

function inferQuestIdFromName(name: string): string | null {
  if (name.includes('高粱')) return 'axiang';
  if (name.includes('告示板')) return 'signpost';
  if (name.includes('图书')) return 'librarian';
  if (name.includes('铁匠')) return 'blacksmith';
  if (name.includes('商人')) return 'merchant';
  if (name.includes('钓鱼')) return 'fisher';
  return null;
}

function CompletionBanner({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 10000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: '20%', left: '50%',
        transform: 'translateX(-50%)', zIndex: 200,
        background: 'rgba(30, 40, 32, 0.96)', color: '#f5f0e0',
        border: '1px solid rgba(255, 215, 0, 0.5)',
        borderRadius: 8, padding: '32px 44px', textAlign: 'center',
        cursor: 'pointer', userSelect: 'none',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 80px rgba(255, 215, 0, 0.18)',
        animation: 'bannerSlide 0.6s ease-out',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        maxWidth: 'min(520px, 80vw)',
      }}
    >
      <img
        src="/assets/sprites/badge-citizen.png"
        alt="徽章"
        style={{
          width: 64, height: 64,
          imageRendering: 'pixelated',
          marginBottom: 16,
        }}
      />
      <div style={{ fontSize: 16, color: '#FFD700', letterSpacing: '0.15em', marginBottom: 14 }}>
        🌱 你已成为萌芽镇镇民
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.8, margin: '12px 0', color: '#e0d8c0' }}>
        九大裂变任务已经完成。
        <br />
        高粱说，从今天起，你就是萌芽镇的人了。
        <br />
        <br />
        <span style={{ fontSize: 13, color: '#a8b3a0' }}>
          这只是CUA 基地的第一站——
          <br />
          往后还有共创之都、议政高地、大集会广场。
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#8a8576', marginTop: 24, letterSpacing: '0.05em' }}>
        点击关闭 · 你可以继续在镇上闲逛
      </div>
    </div>
  );
}
