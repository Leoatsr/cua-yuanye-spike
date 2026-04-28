import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';

export interface SignPostConfig {
  name: string;
  x: number;       // world x of the signpost tile center
  y: number;       // world y
  dialogue: string[];
  questId?: string;
}

/**
 * A non-sprite interactive "NPC" — it's a fixed point on the map
 * (typically the signpost tile in the obstacle layer) that the player
 * can interact with by approaching and pressing E.
 *
 * It has a floating "?" mark above it to signal interaction availability.
 */
export class SignPost {
  config: SignPostConfig;
  scene: Phaser.Scene;
  private mark: Phaser.GameObjects.Text;
  private markTween: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, config: SignPostConfig) {
    this.scene = scene;
    this.config = config;

    this.mark = scene.add
      .text(config.x, config.y - 22, '📜', {
        fontSize: '16px',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.markTween = scene.tweens.add({
      targets: this.mark,
      y: config.y - 26,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  get x() { return this.config.x; }
  get y() { return this.config.y; }

  triggerDialogue() {
    EventBus.emit('show-dialogue', {
      name: this.config.name,
      lines: this.config.dialogue,
      questId: this.config.questId,
    });
  }

  destroy() {
    this.markTween.stop();
    this.mark.destroy();
  }
}
