export function HUD() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 50,
        color: '#fff',
        fontFamily: 'sans-serif',
        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 'bold' }}>CUA 基地</div>
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
        Spike Demo · WASD 移动 · E 对话
      </div>
    </div>
  );
}
