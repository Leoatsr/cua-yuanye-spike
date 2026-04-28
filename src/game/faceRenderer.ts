import * as Phaser from 'phaser';
import {
  HAIR_COLOR_HEX,
  OUTFIT_TINT_HEX,
  type FaceData,
} from '../lib/faceStore';

/**
 * F6.0 · Phaser 角色捏脸渲染层
 *
 * 用法：
 *   const face = applyFaceToSprite(scene, playerSprite, faceData);
 *   ...
 *   face.destroy();  // 离场清理
 *
 * 实现：
 *   - outfit color → 直接给 sprite tint (sprite 默认蓝衣，tint 让它变色)
 *   - hairstyle + hair color → graphics 画一个发型，跟随 sprite 移动
 */

interface AppliedFace {
  hairGraphics: Phaser.GameObjects.Graphics | null;
  /** Updates each frame to follow the sprite. Call from update(). */
  syncToSprite: (sprite: Phaser.GameObjects.Sprite) => void;
  /** Re-renders hair (after face change). */
  reapply: (face: FaceData) => void;
  /** Cleanup. */
  destroy: () => void;
}

/**
 * Apply face customization to a player sprite.
 * Call once when the scene creates the player.
 * Then call result.syncToSprite(sprite) every frame in update().
 */
export function applyFaceToSprite(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  initialFace: FaceData,
): AppliedFace {
  // ----- Outfit: apply tint to sprite -----
  applyOutfitTint(sprite, initialFace.outfit_color);

  // ----- Hair: graphics overlay -----
  let hairG: Phaser.GameObjects.Graphics | null = null;
  let currentFace = initialFace;

  const drawHair = () => {
    if (hairG) {
      hairG.destroy();
      hairG = null;
    }
    if (currentFace.hairstyle === 0) {
      // 光头：no hair graphics
      return;
    }
    hairG = scene.add.graphics();
    hairG.setDepth(sprite.depth + 1);
    renderHair(hairG, sprite.x, sprite.y, currentFace);
  };

  drawHair();

  return {
    hairGraphics: hairG,

    syncToSprite: (s: Phaser.GameObjects.Sprite) => {
      if (!hairG) return;
      hairG.clear();
      renderHair(hairG, s.x, s.y, currentFace);
    },

    reapply: (newFace: FaceData) => {
      currentFace = newFace;
      applyOutfitTint(sprite, newFace.outfit_color);
      drawHair();
    },

    destroy: () => {
      if (hairG) {
        hairG.destroy();
        hairG = null;
      }
      sprite.clearTint();
    },
  };
}

/**
 * Apply outfit color via sprite tint.
 * The base player.png has a blue outfit — tint shifts the color.
 */
function applyOutfitTint(sprite: Phaser.GameObjects.Sprite, outfitColor: number) {
  const tint = OUTFIT_TINT_HEX[outfitColor] ?? 0xffffff;
  if (tint === 0xffffff) {
    sprite.clearTint();
  } else {
    sprite.setTint(tint);
  }
}

/**
 * Render hair graphics at given world position.
 * The sprite is ~16 tall, head is at y - 4 to y - 8 (top of sprite).
 * Sprite anchor is center, so x is center, y is bottom-ish.
 */
function renderHair(
  g: Phaser.GameObjects.Graphics,
  spriteX: number,
  spriteY: number,
  face: FaceData,
) {
  const color = HAIR_COLOR_HEX[face.hair_color] ?? 0x2a1810;
  // Head center is roughly at sprite center, slightly above center
  // Sprite is 32x32 with origin at center — head pixels are around y - 6 to y - 10
  const hx = spriteX;
  const hy = spriteY - 7;

  switch (face.hairstyle) {
    case 0:
      // 光头 — no hair
      return;

    case 1:
      // 短发 — small bowl cap covering top
      g.fillStyle(color, 1);
      g.fillRect(hx - 4, hy - 5, 8, 4);
      // Side sideburns
      g.fillRect(hx - 4, hy - 1, 1, 2);
      g.fillRect(hx + 3, hy - 1, 1, 2);
      // Outline (subtle)
      g.lineStyle(1, 0x000000, 0.3);
      g.strokeRect(hx - 4, hy - 5, 8, 4);
      return;

    case 2:
      // 中分 — parted in middle
      g.fillStyle(color, 1);
      g.fillRect(hx - 4, hy - 5, 8, 4);
      // Center part (gap)
      g.fillStyle(0xeacba0, 1);  // skin color showing through
      g.fillRect(hx - 1, hy - 5, 2, 2);
      // Side bangs going down
      g.fillStyle(color, 1);
      g.fillRect(hx - 5, hy - 4, 2, 5);
      g.fillRect(hx + 3, hy - 4, 2, 5);
      // Outline
      g.lineStyle(1, 0x000000, 0.3);
      g.strokeRect(hx - 4, hy - 5, 8, 4);
      return;

    case 3:
      // 马尾 — gathered ponytail to one side (back)
      g.fillStyle(color, 1);
      g.fillRect(hx - 4, hy - 5, 8, 4);
      // Bangs (front)
      g.fillRect(hx - 4, hy - 1, 8, 1);
      // Ponytail behind/below
      g.fillRect(hx + 3, hy + 2, 3, 6);
      g.fillRect(hx + 4, hy + 6, 2, 4);
      // Tie band (slightly different shade)
      g.fillStyle(0x4a3826, 1);
      g.fillRect(hx + 3, hy + 2, 3, 1);
      // Outline
      g.lineStyle(1, 0x000000, 0.3);
      g.strokeRect(hx - 4, hy - 5, 8, 4);
      return;
  }
}
