import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import { getTotalCV } from '../lib/cv';

/**
 * Shows the player's total CV in the top-left corner, next to the HUD logo.
 * Pulses gold when CV is added.
 */
export function CVDisplay() {
  const [cv, setCv] = useState<number>(() => getTotalCV());
  const [pulse, setPulse] = useState(false);
  const [lastIncrement, setLastIncrement] = useState<number | null>(null);

  useEffect(() => {
    const onCvUpdate = (data: { totalCV: number }) => {
      const next = getTotalCV();
      setCv(next);
      setLastIncrement(data.totalCV);
      setPulse(true);
      setTimeout(() => setPulse(false), 2200);
      setTimeout(() => setLastIncrement(null), 3500);
    };

    EventBus.on('cv-updated', onCvUpdate);
    return () => { EventBus.off('cv-updated', onCvUpdate); };
  }, []);

  // Don't render if player has 0 CV (clean opening — earn first to see)
  if (cv === 0 && !pulse) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 130,        // sits to the right of HUD logo
        zIndex: 50,
        background: 'rgba(20, 20, 30, 0.85)',
        padding: '8px 14px',
        borderRadius: 6,
        border: '1px solid rgba(255, 215, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        userSelect: 'none',
        animation: pulse ? 'cvPulse 2.2s ease-out' : 'none',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      <span style={{ fontSize: 14 }}>🏆</span>
      <span
        style={{
          fontSize: 13,
          color: '#FFD700',
          letterSpacing: '0.05em',
          fontWeight: 600,
        }}
      >
        CV {cv}
      </span>

      {lastIncrement !== null && (
        <span
          style={{
            fontSize: 11,
            color: '#7fc090',
            marginLeft: 6,
            animation: 'incFade 3.5s ease-out forwards',
          }}
        >
          +{lastIncrement}
        </span>
      )}

      <style>{`
        @keyframes cvPulse {
          0%   { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.6); }
          100% { box-shadow: 0 0 0 18px rgba(255, 215, 0, 0); }
        }
        @keyframes incFade {
          0%   { opacity: 0; transform: translateY(0); }
          15%  { opacity: 1; transform: translateY(-2px); }
          85%  { opacity: 1; transform: translateY(-2px); }
          100% { opacity: 0; transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
