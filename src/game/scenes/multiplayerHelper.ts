import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { presence, type RemotePlayerInfo } from '../../lib/realtimePresence';
import { chatManager } from '../../lib/chatStore';
import { RemotePlayer } from '../entities/RemotePlayer';

/**
 * G1.1 · Multiplayer scene helper
 * G3   · Adds nearest-player detection + 'E' interact prompt
 *
 * Each scene calls:
 *   const mp = setupMultiplayer(this, sceneKey, () => player, () => facing);
 *   ...
 *   in update(): mp.tick();
 *
 * Cleanup is auto-attached to scene SHUTDOWN.
 */

export interface MultiplayerHandle {
  tick: () => void;
  remotePlayers: Map<string, RemotePlayer>;
}

export const INTERACT_DISTANCE = 60;  // G3: how close before E shows

export function setupMultiplayer(
  scene: Phaser.Scene,
  sceneKey: string,
  getPlayer: () => Phaser.Physics.Arcade.Sprite | null,
  getFacing: () => 'up' | 'down' | 'left' | 'right',
): MultiplayerHandle {
  const remotePlayers = new Map<string, RemotePlayer>();

  // Join scene channel
  void presence.joinScene(sceneKey, () => {
    const player = getPlayer();
    if (!player) return null;
    return {
      user_id: presence.getMyMeta()?.user_id ?? '',
      x: player.x,
      y: player.y,
      vx: player.body?.velocity.x ?? 0,
      vy: player.body?.velocity.y ?? 0,
      facing: getFacing(),
    };
  });

  // G2-B: also join chat scene channel
  void chatManager.subscribeScene(sceneKey);

  const onJoin = (info: RemotePlayerInfo) => {
    if (remotePlayers.has(info.user_id)) return;
    // Skip bots if not in MainScene (bots are only in 萌芽镇 per Q2 plan)
    if (info.user_id.startsWith('bot-') && sceneKey !== 'Main') return;
    const rp = new RemotePlayer(scene, info);
    remotePlayers.set(info.user_id, rp);
  };

  const onLeave = (info: RemotePlayerInfo) => {
    const rp = remotePlayers.get(info.user_id);
    if (rp) {
      rp.destroy();
      remotePlayers.delete(info.user_id);
    }
  };

  const onMove = (info: RemotePlayerInfo) => {
    const rp = remotePlayers.get(info.user_id);
    if (rp) {
      rp.updateTargetPosition(info.x, info.y, info.vx, info.vy, info.facing);
      rp.applyFace(info.face);
      rp.updateName(info.display_name);
    }
  };

  const onCleared = () => {
    for (const rp of remotePlayers.values()) rp.destroy();
    remotePlayers.clear();
  };

  EventBus.on('remote-player-joined', onJoin);
  EventBus.on('remote-player-left', onLeave);
  EventBus.on('remote-player-moved', onMove);
  EventBus.on('remote-players-cleared', onCleared);

  // Bootstrap: render any players already in presence
  for (const info of presence.getRemotePlayers()) {
    onJoin(info);
  }

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    EventBus.off('remote-player-joined', onJoin);
    EventBus.off('remote-player-left', onLeave);
    EventBus.off('remote-player-moved', onMove);
    EventBus.off('remote-players-cleared', onCleared);
    for (const rp of remotePlayers.values()) rp.destroy();
    remotePlayers.clear();
    void presence.leaveScene();
    // G2-B: also leave chat scene channel
    void chatManager.leaveScene();
    // G3: clear nearest player
    EventBus.emit('nearest-player-changed', null);
  });

  // G3: track which player is currently "nearest" (showing E icon)
  let currentNearestId: string | null = null;

  return {
    tick: () => {
      // Get my position from getPlayer
      const me = getPlayer();
      let nearestId: string | null = null;
      let nearestInfo: RemotePlayerInfo | null = null;

      if (me) {
        let minDist = INTERACT_DISTANCE;
        for (const rp of remotePlayers.values()) {
          rp.tick();
          const dx = rp.info.x - me.x;
          const dy = rp.info.y - me.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            nearestId = rp.userId;
            nearestInfo = rp.info;
          }
        }
      } else {
        // No me, just tick
        for (const rp of remotePlayers.values()) rp.tick();
      }

      // Update E prompts only if changed
      if (nearestId !== currentNearestId) {
        // Hide previous
        if (currentNearestId !== null) {
          const prev = remotePlayers.get(currentNearestId);
          if (prev) prev.setInteractable(false);
        }
        // Show new
        if (nearestId !== null) {
          const cur = remotePlayers.get(nearestId);
          if (cur) cur.setInteractable(true);
        }
        currentNearestId = nearestId;
        EventBus.emit('nearest-player-changed', nearestInfo);
      }
    },
    remotePlayers,
  };
}

/**
 * Helper to compute facing from velocity vector (for scenes that don't track it).
 */
export function facingFromVelocity(
  vx: number, vy: number,
  prev: 'up' | 'down' | 'left' | 'right',
): 'up' | 'down' | 'left' | 'right' {
  if (Math.abs(vx) > Math.abs(vy)) {
    if (vx > 0) return 'right';
    if (vx < 0) return 'left';
  } else if (Math.abs(vy) > 0) {
    if (vy > 0) return 'down';
    return 'up';
  }
  return prev;
}
