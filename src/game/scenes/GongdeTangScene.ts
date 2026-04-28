import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 130;
const INTERACT_DISTANCE = 56;

const ROOM_WIDTH = 720;
const ROOM_HEIGHT = 520;

interface SceneInitData {
  returnX?: number;
  returnY?: number;
}

/**
 * 功德堂 (Gongde Tang) — 贡献工作组工坊室内
 *
 * Theme: Hall of merit/contributors. Special — opens MeritBoardPanel which
 * pulls real CV data from Supabase via get_cv_leaderboard RPC.
 *
 * Visual: stone steles with carved names, central merit stele, candle braziers.
 */
export class GongdeTangScene extends Phaser.Scene {
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

  private exitX = 0;
  private exitY = 0;
  private exitHint!: Phaser.GameObjects.Text;
  private interactHint!: Phaser.GameObjects.Text;

  // Central merit stele (the big one)
  private centerSteleX = 0;
  private centerSteleY = 0;

  // Side decorative steles
  private leftSteleX = 0;
  private leftSteleY = 0;
  private rightSteleX = 0;
  private rightSteleY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('GongdeTang');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Floor (sacred temple, stone slabs) ----
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x1a1410, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    g.fillStyle(0x4a3826, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(3, 0xb8a472, 1);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);

    // Stone slab pattern
    g.lineStyle(1, 0x3a2818, 0.7);
    for (let y = 70; y < ROOM_HEIGHT - 60; y += 60) {
      g.lineBetween(60, y, ROOM_WIDTH - 60, y);
    }
    for (let x = 120; x < ROOM_WIDTH - 60; x += 80) {
      g.lineBetween(x, 70, x, ROOM_HEIGHT - 60);
    }

    // Red ceremonial carpet running from door to center
    g.fillStyle(0x8a2018, 1);
    g.fillRect(ROOM_WIDTH / 2 - 36, 70, 72, ROOM_HEIGHT - 130);
    g.lineStyle(2, 0xfbbf24, 0.6);
    g.strokeRect(ROOM_WIDTH / 2 - 36, 70, 72, ROOM_HEIGHT - 130);
    // Carpet pattern (gold thread)
    g.lineStyle(1, 0xfbbf24, 0.4);
    for (let cy = 90; cy < ROOM_HEIGHT - 80; cy += 40) {
      g.lineBetween(ROOM_WIDTH / 2 - 28, cy, ROOM_WIDTH / 2 + 28, cy);
    }

    // ---- North wall (red lacquer + gold trim) ----
    g.fillStyle(0x8a2018, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);
    g.fillStyle(0xfbbf24, 0.8);
    g.fillRect(60, 72, ROOM_WIDTH - 120, 2);

    // ---- Central merit stele (north, the BIG one) ----
    this.centerSteleX = ROOM_WIDTH / 2;
    this.centerSteleY = 160;
    this.drawCenterStele(this.centerSteleX, this.centerSteleY);

    // ---- Side steles (decorative, with carved sample names) ----
    this.leftSteleX = 160;
    this.leftSteleY = ROOM_HEIGHT / 2 + 30;
    this.drawSideStele(this.leftSteleX, this.leftSteleY);

    this.rightSteleX = ROOM_WIDTH - 160;
    this.rightSteleY = ROOM_HEIGHT / 2 + 30;
    this.drawSideStele(this.rightSteleX, this.rightSteleY);

    // ---- Candle braziers (south corners) ----
    this.drawCandleBrazier(140, ROOM_HEIGHT - 130);
    this.drawCandleBrazier(ROOM_WIDTH - 140, ROOM_HEIGHT - 130);

    // ---- Player ----
    this.createCharacterAnims('player');
    this.player = this.physics.add.sprite(ROOM_WIDTH / 2, ROOM_HEIGHT - 110, 'player', 0);
    this.player.setCollideWorldBounds(true);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(12, 6).setOffset(10, 17);
    this.player.anims.play('player-idle-up');

    // ---- Walls ----
    const walls = this.physics.add.staticGroup();
    walls.add(this.add.rectangle(ROOM_WIDTH / 2, 50, ROOM_WIDTH, 20, 0, 0));
    walls.add(this.add.rectangle(ROOM_WIDTH / 2, ROOM_HEIGHT - 60, ROOM_WIDTH, 20, 0, 0));
    walls.add(this.add.rectangle(50, ROOM_HEIGHT / 2, 20, ROOM_HEIGHT, 0, 0));
    walls.add(this.add.rectangle(ROOM_WIDTH - 50, ROOM_HEIGHT / 2, 20, ROOM_HEIGHT, 0, 0));
    this.physics.add.collider(this.player, walls);

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // G1.1 · Multiplayer (via helper)
    this.mp = setupMultiplayer(this, 'GongdeTang', () => this.player, () => this.currentFacing);

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

    // ---- Exit ----
    this.exitX = ROOM_WIDTH / 2;
    this.exitY = ROOM_HEIGHT - 70;
    const doorG = this.add.graphics();
    doorG.fillStyle(0x4a1010, 1);
    doorG.fillRect(this.exitX - 22, this.exitY - 30, 44, 56);
    doorG.lineStyle(2, 0x2a0808, 1);
    doorG.strokeRect(this.exitX - 22, this.exitY - 30, 44, 56);
    doorG.fillStyle(0xfbbf24, 1);
    doorG.fillCircle(this.exitX + 12, this.exitY, 3);

    // ---- Title ----
    this.add.text(ROOM_WIDTH / 2, 30, '— 功德堂 · 贡献工作组 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#fbbf24', backgroundColor: '#1a1410aa',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    this.exitHint = this.add.text(0, 0, '[E] 离开', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#3a4a6add',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.interactHint = this.add.text(0, 0, '[E]', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#000000aa',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);
  }

  // ============ DRAWING ============

  private drawCenterStele(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Stele platform (3 tiers stone)
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 70, y + 56, 140, 14);
    g.lineStyle(2, 0x3a2818, 1);
    g.strokeRect(x - 70, y + 56, 140, 14);
    g.fillStyle(0x8a6f4a, 1);
    g.fillRect(x - 56, y + 42, 112, 14);
    g.strokeRect(x - 56, y + 42, 112, 14);

    // Main stele body (vertical stone tablet, gray)
    g.fillStyle(0x9a8d6c, 1);
    g.fillRect(x - 40, y - 60, 80, 100);
    g.lineStyle(3, 0x4a3826, 1);
    g.strokeRect(x - 40, y - 60, 80, 100);
    // Stele crown (rounded top)
    g.fillStyle(0x9a8d6c, 1);
    g.fillEllipse(x, y - 60, 80, 24);
    g.lineStyle(3, 0x4a3826, 1);
    g.strokeEllipse(x, y - 60, 80, 24);

    // Gold inscription frame
    g.fillStyle(0xb8a472, 1);
    g.fillRect(x - 32, y - 50, 64, 80);
    g.lineStyle(2, 0x6b5230, 1);
    g.strokeRect(x - 32, y - 50, 64, 80);
    // Inner inscription panel (cream)
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 28, y - 46, 56, 72);

    // "功德" big characters at top (gold)
    this.add.text(x, y - 40, '功 德', {
      fontFamily: 'serif', fontSize: '11px',
      color: '#8a4a18', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
    this.add.text(x, y - 26, '——', {
      fontFamily: 'serif', fontSize: '8px',
      color: '#9a8d6c',
    }).setOrigin(0.5).setDepth(3);

    // Mock leaderboard text lines (the real data shows in panel)
    const g2 = this.add.graphics();
    g2.setDepth(3);
    for (let i = 0; i < 6; i++) {
      const ey = y - 14 + i * 8;
      // Rank dot
      g2.fillStyle(i === 0 ? 0xfbbf24 : i === 1 ? 0xc0c0c0 : i === 2 ? 0xcd7f32 : 0x9a8d6c, 1);
      g2.fillCircle(x - 22, ey, 2);
      // Name line
      g2.fillStyle(0x4a3826, 0.6);
      g2.fillRect(x - 16, ey - 1, 20, 1.5);
      // CV line
      g2.fillStyle(0x8a4a18, 0.6);
      g2.fillRect(x + 8, ey - 1, 14, 1.5);
    }

    // Floating banner with year
    g.fillStyle(0x8a2018, 1);
    g.fillRect(x - 30, y + 36, 60, 14);
    g.lineStyle(2, 0xfbbf24, 1);
    g.strokeRect(x - 30, y + 36, 60, 14);
    this.add.text(x, y + 43, '功 德 录', {
      fontFamily: 'serif', fontSize: '8px',
      color: '#fbbf24', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
  }

  private drawSideStele(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Smaller stele
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 30, y + 50, 60, 8);
    g.fillStyle(0x9a8d6c, 1);
    g.fillRect(x - 22, y - 50, 44, 100);
    g.lineStyle(2, 0x4a3826, 1);
    g.strokeRect(x - 22, y - 50, 44, 100);
    g.fillEllipse(x, y - 50, 44, 16);
    g.strokeEllipse(x, y - 50, 44, 16);

    // Inscription (sample names — simulated carved text)
    g.fillStyle(0x4a3826, 1);
    for (let i = 0; i < 8; i++) {
      g.fillRect(x - 16, y - 38 + i * 9, 32, 2);
    }
  }

  private drawCandleBrazier(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Stand (3-leg tripod)
    g.lineStyle(3, 0x4a3826, 1);
    g.lineBetween(x - 14, y + 30, x, y);
    g.lineBetween(x + 14, y + 30, x, y);
    g.lineBetween(x, y + 30, x, y);
    // Bowl (bronze)
    g.fillStyle(0x8a6f4a, 1);
    g.fillCircle(x, y - 4, 14);
    g.lineStyle(2, 0x4a3826, 1);
    g.strokeCircle(x, y - 4, 14);
    // Inner bowl (dark)
    g.fillStyle(0x2a1e10, 1);
    g.fillCircle(x, y - 4, 11);
    // Embers (small red dots)
    g.fillStyle(0xff6030, 1);
    g.fillCircle(x - 3, y - 6, 1.5);
    g.fillCircle(x + 4, y - 2, 1.5);
    g.fillCircle(x - 1, y, 1);
    // Flame (animated)
    const flame = this.add.graphics();
    flame.setDepth(3);
    flame.fillStyle(0xff6030, 0.85);
    flame.fillTriangle(x - 5, y - 8, x + 5, y - 8, x, y - 18);
    flame.fillStyle(0xfbbf24, 0.9);
    flame.fillTriangle(x - 2, y - 10, x + 2, y - 10, x, y - 14);
    this.tweens.add({
      targets: flame, scaleY: 0.7,
      duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // Glow halo
    flame.fillStyle(0xff8030, 0.15);
    flame.fillCircle(x, y - 12, 14);
  }

  // ============ ANIMATION ============

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

  private exit() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('SproutCity', { spawnX: this.returnX, spawnY: this.returnY });
    });
  }

  private triggerCenterStele() {
    // Open the merit board panel (real data)
    EventBus.emit('open-merit-board');
  }

  private triggerSideStele() {
    EventBus.emit('show-dialogue', {
      name: '🪨 功德石碑',
      lines: [
        '（一面青石碑，刻着早期贡献者的名字）',
        '',
        '"碑上无虚名——上石必有功。"',
        '',
        '"功德堂的规矩：百 CP 起，方可入碑。"',
        '"——这是早期、还有空位的小碑。"',
        '"中央那座大碑，是当下的功德录。"',
      ],
    });
  }

  // ============ UPDATE ============

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
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.mKey)) EventBus.emit('open-world-map', { currentScene: 'SproutCity' });
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) EventBus.emit('open-quest-log');
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) EventBus.emit('open-mailbox');

    const distExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitX, this.exitY);
    const distCenter = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.centerSteleX, this.centerSteleY + 30);
    const distLeft = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.leftSteleX, this.leftSteleY);
    const distRight = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.rightSteleX, this.rightSteleY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distCenter < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 拜功德碑').setPosition(this.centerSteleX, this.centerSteleY - 90).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerCenterStele();
    } else if (distLeft < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看碑铭').setPosition(this.leftSteleX, this.leftSteleY - 70).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerSideStele();
    } else if (distRight < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看碑铭').setPosition(this.rightSteleX, this.rightSteleY - 70).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerSideStele();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
