import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';

export type Facing = 'down' | 'left' | 'right' | 'up';

export interface NPCConfig {
  key: string;
  name: string;
  x: number;
  y: number;
  texture: string;
  /** Dialogue lines, OR a function returning lines (for dynamic dialogue) */
  dialogue: string[] | (() => string[]);
  facing?: Facing;
  hideMark?: boolean;
  markChar?: string;
  questId?: string;
}

export class NPC extends Phaser.Physics.Arcade.Sprite {
  config: NPCConfig;
  private mark?: Phaser.GameObjects.Text;
  private markTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, config: NPCConfig) {
    super(scene, config.x, config.y, config.texture, 0);
    this.config = config;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setSize(12, 6).setOffset(10, 17);

    // Floating mark (skipped for signposts etc.)
    if (!config.hideMark) {
      this.mark = scene.add
        .text(this.x, this.y - 14, config.markChar ?? '!', {
          fontFamily: 'sans-serif',
          fontSize: '14px',
          color: '#FFD700',
          stroke: '#000',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(100);

      this.markTween = scene.tweens.add({
        targets: this.mark,
        y: this.y - 18,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Set initial idle direction
    const facing = config.facing ?? 'down';
    const animKey = `${config.texture}-idle-${facing === 'left' ? 'right' : facing}`;
    if (scene.anims.exists(animKey)) {
      this.anims.play(animKey);
      if (facing === 'left') this.setFlipX(true);
    }
  }

  destroy(fromScene?: boolean) {
    this.markTween?.stop();
    this.mark?.destroy();
    super.destroy(fromScene);
  }

  /**
   * Change the floating mark character (e.g. from '!' to '?' to indicate
   * a new task). Pass null/empty to hide.
   */
  setMark(char: string | null) {
    if (!this.mark) return;
    if (char === null || char === '') {
      this.mark.setVisible(false);
      this.markTween?.pause();
    } else {
      this.mark.setText(char);
      this.mark.setVisible(true);
      this.markTween?.resume();
    }
  }

  triggerDialogue() {
    const dialogue = this.config.dialogue;
    const lines = typeof dialogue === 'function' ? dialogue() : dialogue;
    EventBus.emit('show-dialogue', {
      name: this.config.name,
      lines,
      questId: this.config.questId,
    });
  }
}
