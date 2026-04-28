import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 140;
const INTERACT_DISTANCE = 56;
const BGM_VOLUME = 0.22;

const MAP_WIDTH = 3000;
const MAP_HEIGHT = 2000;

interface SceneInitData {
  spawnX?: number;
  spawnY?: number;
}

/**
 * 大集会广场 (Grand Plaza) — Phase 4 / C7.
 *
 * Open-air ceremonial plaza for the annual community gathering.
 * Layout:
 *   - South: Port (entry from GovHill)
 *   - Center: Stepped marble plaza with central altar
 *   - North + East + West: Curved tiered seating (like Greek/Roman amphitheater)
 *
 * Drawn entirely with Phaser graphics primitives — no tilemap dependency.
 * In single-player it's an empty venue; comes alive when 100+ players gather.
 */
export class GrandPlazaScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private mp: MultiplayerHandle | null = null;
  private currentFacing: 'up' | 'down' | 'left' | 'right' = 'down';
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private eKey!: Phaser.Input.Keyboard.Key;
  private mKey!: Phaser.Input.Keyboard.Key;
  private jKey!: Phaser.Input.Keyboard.Key;
  private kKey!: Phaser.Input.Keyboard.Key;
  private lastDirection: 'down' | 'left' | 'right' | 'up' = 'down';

  private interactHint!: Phaser.GameObjects.Text;
  private portHint!: Phaser.GameObjects.Text;
  private heraldHint!: Phaser.GameObjects.Text;

  // Port (south) returns to GovHill
  private portX = 0;
  private portY = 0;

  // Central altar
  private altarX = 0;
  private altarY = 0;

  // Notice board (near port)
  private boardX = 0;
  private boardY = 0;

  // Herald NPC
  private heraldX = 0;
  private heraldY = 0;

  private spawnOverride: { x: number; y: number } | null = null;
  private inputLockUntil = 0;

  private bgm?: Phaser.Sound.BaseSound;

  constructor() {
    super('GrandPlaza');
  }

  init(data: SceneInitData & { returnX?: number; returnY?: number }) {
    if (data?.returnX !== undefined && data?.returnY !== undefined) {
      this.spawnOverride = { x: data.returnX, y: data.returnY };
    } else if (data?.spawnX !== undefined && data?.spawnY !== undefined) {
      this.spawnOverride = { x: data.spawnX, y: data.spawnY };
    } else {
      this.spawnOverride = null;
    }
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // ---- Visuals ----
    this.drawSky();
    this.drawAmphitheater();
    this.drawPlaza();
    this.drawAltar();
    this.drawObelisks();
    this.drawPortMarkers();
    this.drawNoticeBoard();

    // ---- Player ----
    this.createCharacterAnims('player');
    const defaultX = MAP_WIDTH / 2;
    const defaultY = MAP_HEIGHT - 220;
    const sx = this.spawnOverride?.x ?? defaultX;
    const sy = this.spawnOverride?.y ?? defaultY;
    this.player = this.physics.add.sprite(sx, sy, 'player', 0);
    this.player.setCollideWorldBounds(true);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(12, 6).setOffset(10, 17);
    this.player.anims.play('player-idle-up');

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    // G1.1 · Multiplayer (via helper)
    this.mp = setupMultiplayer(this, 'GrandPlaza', () => this.player, () => this.currentFacing);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(2);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // ---- Input ----
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.eKey = this.input.keyboard!.addKey('E');
    this.mKey = this.input.keyboard!.addKey('M');
    this.jKey = this.input.keyboard!.addKey('J');
    this.kKey = this.input.keyboard!.addKey('K');

    // ---- Port ----
    this.portX = MAP_WIDTH / 2;
    this.portY = MAP_HEIGHT - 80;

    // ---- Altar ----
    this.altarX = MAP_WIDTH / 2;
    this.altarY = MAP_HEIGHT / 2;

    // ---- Notice Board ----
    this.boardX = MAP_WIDTH / 2 - 220;
    this.boardY = MAP_HEIGHT - 280;

    // ---- Herald NPC ----
    this.heraldX = MAP_WIDTH / 2 + 220;
    this.heraldY = MAP_HEIGHT - 280;
    this.add.circle(this.heraldX, this.heraldY, 8, 0x8a6f4a).setDepth(2);
    this.add.circle(this.heraldX, this.heraldY - 10, 6, 0xeacba0).setDepth(2);
    // Herald banner
    const banner = this.add.text(this.heraldX, this.heraldY - 26, '🎺', {
      fontSize: '14px',
    }).setOrigin(0.5).setDepth(3);
    this.tweens.add({
      targets: banner, y: this.heraldY - 30,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ---- Labels ----
    this.add.text(MAP_WIDTH / 2, 80, '— 大集会广场 —', {
      fontFamily: 'serif', fontSize: '20px',
      color: '#f5f0e0', backgroundColor: '#1a141aaa',
      padding: { left: 14, right: 14, top: 5, bottom: 5 },
    }).setOrigin(0.5).setDepth(10);

    this.add.text(MAP_WIDTH / 2, this.altarY - 110, '中央祭坛', {
      fontFamily: 'serif', fontSize: '14px',
      color: '#f5f0e0', backgroundColor: '#1a141aaa',
      padding: { left: 6, right: 6, top: 2, bottom: 2 },
    }).setOrigin(0.5).setDepth(10);

    // ---- Hints ----
    this.interactHint = this.add.text(0, 0, '[E]', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#000000aa',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.portHint = this.add.text(0, 0, '[E] 返回议政高地', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#3a4a6add',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.heraldHint = this.add.text(0, 0, '[E] 司仪', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#000000aa',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    // ---- BGM ----
    if (this.cache.audio.exists('bgm-village')) {
      this.bgm = this.sound.add('bgm-village', { loop: true, volume: BGM_VOLUME });
      this.bgm.play();
    }

    // ---- World map travel listener ----
    const onTravel = (data: { sceneKey: string }) => {
      if (data.sceneKey === 'GrandPlaza') return;
      // Returning to other places → exit through port to GovHill first
      if (data.sceneKey === 'GovHill') {
        this.exitToPort();
      } else if (data.sceneKey === 'SproutCity' || data.sceneKey === 'Main') {
        // For now, route through GovHill (player will need another travel)
        this.exitToPort();
      }
    };
    EventBus.on('world-map-travel', onTravel);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('world-map-travel', onTravel);
      this.bgm?.stop();
    });
  }

  // ============ DRAWING ============

  private drawSky() {
    const g = this.add.graphics();
    // Cool open-sky gradient
    g.fillGradientStyle(0xb8c0d0, 0xb8c0d0, 0x8a92a4, 0x8a92a4, 1);
    g.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    g.setDepth(-10);
  }

  private drawAmphitheater() {
    // Tiered concentric semicircles (audience seating) on north + east + west
    const g = this.add.graphics();
    g.setDepth(-6);
    const cx = MAP_WIDTH / 2;
    const cy = MAP_HEIGHT / 2;

    // Background terrain ring (darker stone)
    g.fillStyle(0x6e6856, 1);
    g.fillCircle(cx, cy, 1200);
    // Stepped tiers (cream, with decreasing radii)
    const tiers = [1100, 980, 860, 740, 620];
    tiers.forEach((r, i) => {
      const shade = 0xc0b89d - i * 0x080808;
      g.fillStyle(shade, 1);
      g.fillCircle(cx, cy, r);
    });
    // Inner plaza color (lightest)
    g.fillStyle(0xefe9d9, 1);
    g.fillCircle(cx, cy, 540);

    // Tier outline strokes
    g.lineStyle(2, 0x9a8d6c, 0.5);
    [1100, 980, 860, 740, 620, 540].forEach((r) => {
      g.strokeCircle(cx, cy, r);
    });
  }

  private drawPlaza() {
    // Inner plaza paving — radial pattern
    const g = this.add.graphics();
    g.setDepth(-4);
    const cx = MAP_WIDTH / 2;
    const cy = MAP_HEIGHT / 2;

    // Radial spokes (12, like a clock)
    g.lineStyle(2, 0xc0b89d, 0.4);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      g.lineBetween(
        cx + Math.cos(angle) * 100,
        cy + Math.sin(angle) * 100,
        cx + Math.cos(angle) * 540,
        cy + Math.sin(angle) * 540,
      );
    }

    // Center medallion (big)
    g.fillStyle(0xb8a472, 1);
    g.fillCircle(cx, cy, 100);
    g.fillStyle(0xefe9d9, 1);
    g.fillCircle(cx, cy, 88);
    g.fillStyle(0xb8a472, 1);
    g.fillCircle(cx, cy, 50);
    g.fillStyle(0xefe9d9, 1);
    g.fillCircle(cx, cy, 38);
  }

  private drawAltar() {
    // Stepped pyramid altar at center, 3 tiers + brazier on top
    const g = this.add.graphics();
    g.setDepth(2);
    const cx = MAP_WIDTH / 2;
    const cy = MAP_HEIGHT / 2;

    // Tier 1 (bottom, widest)
    g.fillStyle(0xdcd4b9, 1);
    g.fillRect(cx - 70, cy - 18, 140, 18);
    g.lineStyle(2, 0x9a8d6c, 1);
    g.strokeRect(cx - 70, cy - 18, 140, 18);
    // Tier 2
    g.fillStyle(0xc8c0a3, 1);
    g.fillRect(cx - 56, cy - 36, 112, 18);
    g.strokeRect(cx - 56, cy - 36, 112, 18);
    // Tier 3 (top platform)
    g.fillStyle(0xede5cf, 1);
    g.fillRect(cx - 42, cy - 54, 84, 18);
    g.strokeRect(cx - 42, cy - 54, 84, 18);

    // Brazier on top
    g.fillStyle(0x4a3e26, 1);
    g.fillRect(cx - 4, cy - 70, 8, 16);
    g.fillStyle(0x8a6f4a, 1);
    g.fillCircle(cx, cy - 76, 14);
    g.lineStyle(2, 0x4a3e26, 1);
    g.strokeCircle(cx, cy - 76, 14);
    // Flame
    g.fillStyle(0xe07060, 1);
    g.fillTriangle(cx - 8, cy - 80, cx + 8, cy - 80, cx, cy - 96);
    g.fillStyle(0xe0b060, 1);
    g.fillTriangle(cx - 4, cy - 84, cx + 4, cy - 84, cx, cy - 92);
  }

  private drawObelisks() {
    // 4 obelisks at cardinal points outside the plaza ring
    const cx = MAP_WIDTH / 2;
    const cy = MAP_HEIGHT / 2;
    const positions: Array<[number, number]> = [
      [cx, cy - 600],   // north
      [cx + 600, cy],   // east
      [cx, cy + 600],   // south
      [cx - 600, cy],   // west
    ];
    const g = this.add.graphics();
    g.setDepth(2);
    positions.forEach(([x, y]) => {
      // Tall obelisk
      g.fillStyle(0xe6deca, 1);
      g.fillRect(x - 12, y - 80, 24, 160);
      g.lineStyle(2, 0x9a8d6c, 1);
      g.strokeRect(x - 12, y - 80, 24, 160);
      // Tip
      g.fillStyle(0xb8a472, 1);
      g.fillTriangle(x - 12, y - 80, x + 12, y - 80, x, y - 110);
      // Base
      g.fillStyle(0xc8c0a3, 1);
      g.fillRect(x - 18, y + 80, 36, 12);
    });
  }

  private drawPortMarkers() {
    // Two stone pillars + boat at south
    const g = this.add.graphics();
    g.setDepth(1);
    const px = MAP_WIDTH / 2;
    const py = MAP_HEIGHT - 100;
    [-80, 80].forEach((dx) => {
      g.fillStyle(0xe6deca, 1);
      g.fillRect(px + dx - 14, py - 100, 28, 100);
      g.lineStyle(2, 0x9a8d6c, 1);
      g.strokeRect(px + dx - 14, py - 100, 28, 100);
      g.fillStyle(0xc8c0a3, 1);
      g.fillRect(px + dx - 18, py - 100, 36, 8);
      g.fillRect(px + dx - 18, py - 8, 36, 8);
    });
    // Boat
    g.fillStyle(0x4a3e26, 1);
    g.fillTriangle(px - 30, py + 30, px + 30, py + 30, px, py + 50);
    g.fillRect(px - 22, py + 20, 44, 14);
  }

  private drawNoticeBoard() {
    const g = this.add.graphics();
    g.setDepth(2);
    const x = this.boardX;
    const y = this.boardY;
    // Wood post
    g.fillStyle(0x4a3e26, 1);
    g.fillRect(x - 4, y, 8, 30);
    // Board
    g.fillStyle(0x8a6f4a, 1);
    g.fillRect(x - 32, y - 28, 64, 32);
    g.lineStyle(2, 0x4a3e26, 1);
    g.strokeRect(x - 32, y - 28, 64, 32);
    // Parchment
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 26, y - 22, 52, 20);
    // Lines
    g.lineStyle(1, 0x6b5a3e, 0.6);
    g.lineBetween(x - 22, y - 16, x + 22, y - 16);
    g.lineBetween(x - 22, y - 10, x + 14, y - 10);
    g.lineBetween(x - 22, y - 4, x + 18, y - 4);
  }

  // ============ ANIMATION SETUP ============

  private createCharacterAnims(textureKey: string) {
    const animations = [
      { name: 'idle-down', start: 0, end: 5, rate: 6 },
      { name: 'idle-right', start: 6, end: 11, rate: 6 },
      { name: 'idle-up', start: 12, end: 17, rate: 6 },
      { name: 'walk-down', start: 18, end: 23, rate: 10 },
      { name: 'walk-right', start: 24, end: 29, rate: 10 },
      { name: 'walk-up', start: 30, end: 35, rate: 10 },
    ];
    animations.forEach((a) => {
      const key = `${textureKey}-${a.name}`;
      if (this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(textureKey, { start: a.start, end: a.end }),
        frameRate: a.rate, repeat: -1,
      });
    });
  }

  // ============ INTERACTION ============

  private exitToPort() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Return to GovHill east port (we'll add this in GovHillScene)
      this.scene.start('GovHill', {
        spawnX: 1500,             // east edge of GovHill
        spawnY: 1800,
      });
    });
  }

  private triggerHeraldDialogue() {
    EventBus.emit('show-dialogue', {
      name: '🎺 司仪',
      lines: [
        '"欢迎来到大集会广场——CUA 一年一度的会场。"',
        '"中央祭坛是仪式核心。每到岁末，全社区在此聚首。"',
        '"四周看台可容纳数百人，远道而来者皆能落座。"',
        '"——目前是空场。但当真到那一日，这里会满。"',
        '（司仪的银号闪过一道光）',
      ],
    });
  }

  private triggerAltarDialogue() {
    EventBus.emit('show-dialogue', {
      name: '🔥 中央祭坛',
      lines: [
        '（祭坛三阶，顶上一炉常燃之火）',
        '"年度大会的火，由社区共祭。"',
        '"提案审定者立于高阶，',
        '  审议已决之事，公布章程之变。"',
        '',
        '（你环顾四周空旷的看台——）',
        '总有一天，这里会站满人。',
      ],
    });
  }

  private triggerBoardDialogue() {
    EventBus.emit('show-dialogue', {
      name: '📋 公告',
      lines: [
        '— CUA 年度大会 · 流程 —',
        '',
        '一、回顾：过往一年的贡献成就',
        '二、决议：执政厅通过的提案公布',
        '三、嘉誉：刻石授名 · 新晋 L5 入名',
        '四、展望：来年路线图揭幕',
        '',
        '"每年岁末，皆于此地举行。"',
        '',
        '（公告底部，大字写着）',
        '— 下次大会日期：未定 —',
      ],
    });
  }

  // ============ UPDATE LOOP ============

  update() {
    if (!this.player || !this.cursors) return;

    let vx = 0, vy = 0;
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    if (left) vx = -PLAYER_SPEED;
    if (right) vx = PLAYER_SPEED;
    if (up) vy = -PLAYER_SPEED;
    if (down) vy = PLAYER_SPEED;
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    this.player.setVelocity(vx, vy);

    // G1.1: track facing + tick remote players
    this.currentFacing = facingFromVelocity(vx, vy, this.currentFacing);
    if (this.mp) this.mp.tick();

    if (vx < 0) { this.lastDirection = 'left'; this.player.setFlipX(true); this.player.anims.play('player-walk-right', true); }
    else if (vx > 0) { this.lastDirection = 'right'; this.player.setFlipX(false); this.player.anims.play('player-walk-right', true); }
    else if (vy < 0) { this.lastDirection = 'up'; this.player.setFlipX(false); this.player.anims.play('player-walk-up', true); }
    else if (vy > 0) { this.lastDirection = 'down'; this.player.setFlipX(false); this.player.anims.play('player-walk-down', true); }
    else {
      if (this.lastDirection === 'left') { this.player.setFlipX(true); this.player.anims.play('player-idle-right', true); }
      else if (this.lastDirection === 'right') { this.player.setFlipX(false); this.player.anims.play('player-idle-right', true); }
      else { this.player.setFlipX(false); this.player.anims.play(`player-idle-${this.lastDirection}`, true); }
    }

    if (this.time.now < this.inputLockUntil) {
      this.interactHint.setVisible(false);
      this.portHint.setVisible(false);
      this.heraldHint.setVisible(false);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
      EventBus.emit('open-world-map', { currentScene: 'GrandPlaza' });
    }
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) {
      EventBus.emit('open-quest-log');
    }
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) {
      EventBus.emit('open-mailbox');
    }

    const distPort = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.portX, this.portY);
    const distAltar = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.altarX, this.altarY);
    const distBoard = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boardX, this.boardY);
    const distHerald = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.heraldX, this.heraldY);

    const nearPort = distPort < 80;
    const nearAltar = distAltar < INTERACT_DISTANCE * 1.5;  // bigger zone for altar
    const nearBoard = distBoard < INTERACT_DISTANCE;
    const nearHerald = distHerald < INTERACT_DISTANCE;

    if (nearPort) {
      this.portHint.setPosition(this.portX, this.portY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      this.heraldHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exitToPort();
    } else if (nearHerald) {
      this.heraldHint.setPosition(this.heraldX, this.heraldY - 36).setVisible(true);
      this.portHint.setVisible(false);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerHeraldDialogue();
    } else if (nearAltar) {
      this.portHint.setVisible(false);
      this.heraldHint.setVisible(false);
      this.interactHint.setText('[E] 观祭坛').setPosition(this.altarX, this.altarY - 100).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerAltarDialogue();
    } else if (nearBoard) {
      this.portHint.setVisible(false);
      this.heraldHint.setVisible(false);
      this.interactHint.setText('[E] 看公告').setPosition(this.boardX, this.boardY - 40).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBoardDialogue();
    } else {
      this.interactHint.setVisible(false);
      this.portHint.setVisible(false);
      this.heraldHint.setVisible(false);
    }
  }
}
