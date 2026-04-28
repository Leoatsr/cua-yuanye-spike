import { useEffect, useState, type ReactNode } from 'react';
import { fetchUserLevel, LEVEL_NAMES, LEVEL_COLORS } from '../lib/levelStore';
import { EventBus } from '../game/EventBus';

/**
 * F5.1 · 等级门控组件
 *
 * Wraps any UI element that requires a minimum level.
 * - If user's level >= min → render children normally
 * - If user's level < min → render children disabled + show "需要 Lx" tooltip on hover
 *
 * Usage:
 *   <RequiresLevel min={2} action="创建提案">
 *     <button onClick={createProposal}>提交</button>
 *   </RequiresLevel>
 *
 * The action label is used in the tooltip ("创建提案需要 L2 mentor")
 */

interface RequiresLevelProps {
  min: 0 | 1 | 2 | 3 | 4;
  action: string;          // human-readable action name
  children: ReactNode;     // what gets disabled / passed through
  /** Optional: replace children entirely with a "locked" message instead of disabling */
  blockMode?: 'disable' | 'replace';
}

export function RequiresLevel({
  min, action, children, blockMode = 'disable',
}: RequiresLevelProps) {
  const [userLevel, setUserLevel] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const info = await fetchUserLevel();
      if (mounted) setUserLevel(info?.level ?? 0);
    };
    load();

    const onUpdate = (info: { level: number } | null) => {
      if (!mounted) return;
      setUserLevel(info?.level ?? 0);
    };
    EventBus.on('level-updated', onUpdate);

    return () => {
      mounted = false;
      EventBus.off('level-updated', onUpdate);
    };
  }, []);

  // Still loading — render disabled to be safe
  const meetsRequirement = userLevel !== null && userLevel >= min;

  if (meetsRequirement) {
    return <>{children}</>;
  }

  const requiredColor = LEVEL_COLORS[min];
  const requiredName = LEVEL_NAMES[min];
  const tooltipMsg = `${action}需要 L${min} ${requiredName}`;
  const userLevelDisplay = userLevel !== null ? `（你当前 L${userLevel} ${LEVEL_NAMES[userLevel]}）` : '';

  if (blockMode === 'replace') {
    return (
      <div style={{
        padding: '12px 16px',
        background: `${requiredColor}1a`,
        border: `1px dashed ${requiredColor}66`,
        borderRadius: 4,
        textAlign: 'center',
        fontSize: 12,
        color: '#a8a08e',
        fontFamily: 'inherit',
      }}>
        🔒 {tooltipMsg}{userLevelDisplay}
      </div>
    );
  }

  // Disable mode: render children inert + tooltip overlay
  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        position: 'relative',
        opacity: 0.5,
        cursor: 'not-allowed',
      }}
    >
      {/* The children — block clicks via overlay */}
      <div style={{ pointerEvents: 'none' }}>
        {children}
      </div>
      {/* Click blocker that shows tooltip */}
      <div
        style={{
          position: 'absolute', inset: 0,
          cursor: 'not-allowed',
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          // Briefly highlight on click
          setHovering(true);
          window.setTimeout(() => setHovering(false), 2500);
        }}
        title={`${tooltipMsg}${userLevelDisplay}`}
      />
      {/* Tooltip on hover */}
      {hovering && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 4px)',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 12px',
          background: '#1a1a22',
          border: `1px solid ${requiredColor}`,
          borderRadius: 4,
          fontSize: 11,
          color: '#f5f0e0',
          whiteSpace: 'nowrap',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
          pointerEvents: 'none',
        }}>
          🔒 {tooltipMsg}
          {userLevel !== null && (
            <div style={{
              fontSize: 10, color: '#a8a08e', marginTop: 2,
            }}>
              你当前 L{userLevel} {LEVEL_NAMES[userLevel]}
            </div>
          )}
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `6px solid ${requiredColor}`,
          }} />
        </div>
      )}
    </div>
  );
}

/**
 * Programmatic version — returns whether user has required level.
 * Used for non-UI checks (e.g. "should I even attempt this API call?").
 */
export async function checkLevelRequirement(
  min: number,
): Promise<{ ok: boolean; current: number | null; reason?: string }> {
  const info = await fetchUserLevel();
  const current = info?.level ?? null;
  if (current === null) {
    return { ok: false, current: null, reason: '请先登录' };
  }
  if (current < min) {
    return {
      ok: false,
      current,
      reason: `需要 L${min} ${LEVEL_NAMES[min]}，当前 L${current} ${LEVEL_NAMES[current]}`,
    };
  }
  return { ok: true, current };
}
