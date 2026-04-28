import * as Phaser from 'phaser';
import { OUTFIT_TINT_HEX, HAIR_COLOR_HEX } from '../../lib/faceStore';
import type { RemotePlayerInfo } from '../../lib/realtimePresence';

/**
 * G1.0 · 远程玩家精灵
 *
 * 渲染另一个玩家的角色 + 名字浮标 + 捏脸（hair + outfit tint）。
 * 本地用 Lerp 平滑插值（10fps 网络更新 → 60fps 渲染）。
 */

const LERP_FACTOR = 0.15; // 越大插值越快（瞬移），越小越慢（拖延）

export class RemotePlayer extends Phaser.GameObjects.Container {
  public userId: string;
  public info: RemotePlayerInfo;
  private sprite: Phaser.GameObjects.Sprite;
  private hairGraphics: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private interactIcon: Phaser.GameObjects.Text;  // G3: "E" prompt above head
  private targetX: number;
  private targetY: number;
  private currentFacing: 'up' | 'down' | 'left' | 'right';
  private isMoving: boolean = false;

  constructor(scene: Phaser.Scene, info: RemotePlayerInfo) {
    super(scene, info.x, info.y);
    this.userId = info.user_id;
    this.info = info;
    this.targetX = info.x;
    this.targetY = info.y;
    this.currentFacing = info.facing;

    // Use 'player' texture (same as main player)
    this.sprite = scene.add.sprite(0, 0, 'player', 0);

    // CRITICAL: create hairGraphics BEFORE calling applyFace (which calls renderHair)
    this.hairGraphics = scene.add.graphics();

    this.applyFace(info.face);

    this.nameText = scene.add.text(0, -22, info.display_name, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#0008',
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
    }).setOrigin(0.5, 0.5);

    // G3: E key prompt above head (hidden by default)
    this.interactIcon = scene.add.text(0, -36, 'E', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#000000',
      backgroundColor: '#FFD700',
      padding: { left: 5, right: 5, top: 1, bottom: 1 },
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.interactIcon.setVisible(false);

    this.add([this.sprite, this.hairGraphics, this.nameText, this.interactIcon]);
    scene.add.existing(this);
    this.setDepth(5);
  }

  applyFace(face: { hairstyle: number; hair_color: number; outfit_color: number }) {
    this.info.face = face;
    const tint = OUTFIT_TINT_HEX[face.outfit_color] ?? 0xffffff;
    if (tint === 0xffffff) {
      this.sprite.clearTint();
    } else {
      this.sprite.setTint(tint);
    }
    this.renderHair();
  }

  private renderHair() {
    this.hairGraphics.clear();
    const face = this.info.face;
    const color = HAIR_COLOR_HEX[face.hair_color] ?? 0x2a1810;
    const hx = 0;
    const hy = -7;

    switch (face.hairstyle) {
      case 0:
        return;
      case 1:
        this.hairGraphics.fillStyle(color, 1);
        this.hairGraphics.fillRect(hx - 4, hy - 5, 8, 4);
        this.hairGraphics.fillRect(hx - 4, hy - 1, 1, 2);
        this.hairGraphics.fillRect(hx + 3, hy - 1, 1, 2);
        this.hairGraphics.lineStyle(1, 0x000000, 0.3);
        this.hairGraphics.strokeRect(hx - 4, hy - 5, 8, 4);
        return;
      case 2:
        this.hairGraphics.fillStyle(color, 1);
        this.hairGraphics.fillRect(hx - 4, hy - 5, 8, 4);
        this.hairGraphics.fillStyle(0xeacba0, 1);
        this.hairGraphics.fillRect(hx - 1, hy - 5, 2, 2);
        this.hairGraphics.fillStyle(color, 1);
        this.hairGraphics.fillRect(hx - 5, hy - 4, 2, 5);
        this.hairGraphics.fillRect(hx + 3, hy - 4, 2, 5);
        this.hairGraphics.lineStyle(1, 0x000000, 0.3);
        this.hairGraphics.strokeRect(hx - 4, hy - 5, 8, 4);
        return;
      case 3:
        this.hairGraphics.fillStyle(color, 1);
        this.hairGraphics.fillRect(hx - 4, hy - 5, 8, 4);
        this.hairGraphics.fillRect(hx - 4, hy - 1, 8, 1);
        this.hairGraphics.fillRect(hx + 3, hy + 2, 3, 6);
        this.hairGraphics.fillRect(hx + 4, hy + 6, 2, 4);
        this.hairGraphics.fillStyle(0x4a3826, 1);
        this.hairGraphics.fillRect(hx + 3, hy + 2, 3, 1);
        this.hairGraphics.lineStyle(1, 0x000000, 0.3);
        this.hairGraphics.strokeRect(hx - 4, hy - 5, 8, 4);
        return;
    }
  }

  /** Update target from network. Position interpolates over time. */
  updateTargetPosition(x: number, y: number, vx: number, vy: number, facing: 'up' | 'down' | 'left' | 'right') {
    this.targetX = x;
    this.targetY = y;
    this.info.x = x;
    this.info.y = y;
    this.info.vx = vx;
    this.info.vy = vy;
    this.currentFacing = facing;
    this.info.facing = facing;
    this.isMoving = Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5;
  }

  updateName(displayName: string) {
    if (this.info.display_name !== displayName) {
      this.info.display_name = displayName;
      this.nameText.setText(displayName);
    }
  }

  /** G3: show/hide E key prompt above head */
  setInteractable(show: boolean) {
    this.interactIcon.setVisible(show);
  }

  /** Called every Phaser update tick. Lerp position + drive animation. */
  tick() {
    // Lerp position
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      this.x = this.targetX;
      this.y = this.targetY;
    } else {
      this.x += dx * LERP_FACTOR;
      this.y += dy * LERP_FACTOR;
    }

    // Drive animation based on facing + isMoving
    const animPrefix = this.isMoving ? 'player-walk' : 'player-idle';
    let dir: 'up' | 'down' | 'right' = 'down';
    let flipX = false;
    if (this.currentFacing === 'up') {
      dir = 'up';
    } else if (this.currentFacing === 'left') {
      dir = 'right'; flipX = true;
    } else if (this.currentFacing === 'right') {
      dir = 'right'; flipX = false;
    } else {
      dir = 'down';
    }
    this.sprite.setFlipX(flipX);
    const animKey = `${animPrefix}-${dir}`;
    if (this.scene.anims.exists(animKey)) {
      const current = this.sprite.anims.currentAnim;
      if (!current || current.key !== animKey) {
        this.sprite.anims.play(animKey, true);
      }
    }
  }

  override destroy() {
    this.sprite.destroy();
    this.hairGraphics.destroy();
    this.nameText.destroy();
    this.interactIcon.destroy();
    super.destroy();
  }
}
