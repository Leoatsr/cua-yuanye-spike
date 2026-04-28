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
 * 声闻台 (Shengwen Tai) — 播客工作组工坊室内
 *
 * Theme: Podcast recording studio.
 * Visual: mixing console, microphones around a round table, acoustic foam walls.
 */
export class ShengwenTaiScene extends Phaser.Scene {
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

  private mixerX = 0;
  private mixerY = 0;
  private tableX = 0;
  private tableY = 0;
  private rosterX = 0;
  private rosterY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('ShengwenTai');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Floor (warm dark studio carpet) ----
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x18120e, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    g.fillStyle(0x4a3826, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(3, 0x2a1e10, 1);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);

    // ---- Acoustic foam walls (zigzag pattern, north + east + west) ----
    this.drawAcousticFoam();

    // ---- Mixer console (north center, big) ----
    this.mixerX = ROOM_WIDTH / 2;
    this.mixerY = 130;
    this.drawMixer(this.mixerX, this.mixerY);

    // ---- Round mic table (center) ----
    this.tableX = ROOM_WIDTH / 2;
    this.tableY = ROOM_HEIGHT / 2 + 30;
    this.drawMicTable(this.tableX, this.tableY);

    // ---- Guest roster wall (east) ----
    this.rosterX = ROOM_WIDTH - 130;
    this.rosterY = ROOM_HEIGHT / 2;
    this.drawGuestRoster(this.rosterX, this.rosterY);

    // ---- Antenna tower / broadcast (west) ----
    this.drawAntenna(140, ROOM_HEIGHT / 2);

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
    this.mp = setupMultiplayer(this, 'ShengwenTai', () => this.player, () => this.currentFacing);

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
    doorG.fillStyle(0x4a3826, 1);
    doorG.fillRect(this.exitX - 22, this.exitY - 30, 44, 56);
    doorG.lineStyle(2, 0x2a1e10, 1);
    doorG.strokeRect(this.exitX - 22, this.exitY - 30, 44, 56);
    doorG.fillStyle(0xb8a472, 1);
    doorG.fillCircle(this.exitX + 12, this.exitY, 3);

    // ---- Title ----
    this.add.text(ROOM_WIDTH / 2, 30, '— 声闻台 · 播客工作组 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#e0a060', backgroundColor: '#18120eaa',
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

  private drawAcousticFoam() {
    const g = this.add.graphics();
    g.setDepth(1);
    // Zigzag foam pattern on north wall
    g.fillStyle(0x6b3a18, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);
    g.fillStyle(0x8a4a1e, 1);
    for (let x = 70; x < ROOM_WIDTH - 60; x += 12) {
      g.fillTriangle(x, 60, x + 12, 60, x + 6, 74);
    }
  }

  private drawMixer(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Console body (slanted rectangle)
    g.fillStyle(0x2a2e36, 1);
    g.fillRect(x - 100, y - 30, 200, 50);
    g.lineStyle(2, 0x18121a, 1);
    g.strokeRect(x - 100, y - 30, 200, 50);
    // Front lip (lighter)
    g.fillStyle(0x3a3e46, 1);
    g.fillRect(x - 100, y + 14, 200, 6);
    // 8 channel sliders
    for (let i = 0; i < 8; i++) {
      const sx = x - 90 + i * 23;
      // Slider track
      g.fillStyle(0x18121a, 1);
      g.fillRect(sx - 2, y - 22, 4, 28);
      // Slider knob (random position to look mid-mix)
      const sliderY = y - 18 + (i * 7) % 22;
      g.fillStyle(0xc0c0c0, 1);
      g.fillRect(sx - 6, sliderY - 2, 12, 4);
      g.lineStyle(1, 0x404040, 1);
      g.strokeRect(sx - 6, sliderY - 2, 12, 4);
      // Channel LED
      const lit = (i % 3) !== 0;
      g.fillStyle(lit ? 0x00ff60 : 0x303030, 1);
      g.fillCircle(sx, y + 11, 1.5);
    }
    // Master volume knob (right side)
    g.fillStyle(0x18121a, 1);
    g.fillCircle(x + 116, y - 6, 8);
    g.fillStyle(0xc0c0c0, 1);
    g.fillCircle(x + 116, y - 6, 6);
    g.lineStyle(2, 0xff8080, 1);
    g.lineBetween(x + 116, y - 6, x + 120, y - 10);
    // VU meter (visual)
    g.fillStyle(0x18121a, 1);
    g.fillRect(x + 100, y + 6, 36, 10);
    g.fillStyle(0x00ff00, 1);
    g.fillRect(x + 102, y + 8, 12, 6);
    g.fillStyle(0xffaa00, 1);
    g.fillRect(x + 116, y + 8, 10, 6);
    g.fillStyle(0xff3030, 1);
    g.fillRect(x + 128, y + 8, 6, 6);
  }

  private drawMicTable(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(0);  // floor level (mic stands on top)
    // Round table
    g.fillStyle(0x6b5230, 1);
    g.fillCircle(x, y, 70);
    g.lineStyle(2, 0x3a2818, 1);
    g.strokeCircle(x, y, 70);
    // Inner darker ring
    g.fillStyle(0x4a3826, 1);
    g.fillCircle(x, y, 56);
    g.lineStyle(1, 0x3a2818, 1);
    g.strokeCircle(x, y, 56);

    // 4 microphones around the table (cardinal directions)
    const mics = [
      [x, y - 50],   // top
      [x + 50, y],   // right
      [x, y + 50],   // bottom
      [x - 50, y],   // left
    ];
    const g2 = this.add.graphics();
    g2.setDepth(2);
    mics.forEach(([mx, my]) => {
      // Mic stand
      g2.lineStyle(2, 0x2a2e36, 1);
      g2.lineBetween(mx, my, mx, my - 20);
      // Mic head (egg shape)
      g2.fillStyle(0x18121a, 1);
      g2.fillCircle(mx, my - 24, 5);
      g2.lineStyle(1, 0x4a4d56, 1);
      g2.strokeCircle(mx, my - 24, 5);
      // Mic mesh dots
      g2.fillStyle(0x6a6d76, 1);
      g2.fillCircle(mx - 1, my - 25, 0.5);
      g2.fillCircle(mx + 1, my - 23, 0.5);
      // Power LED (red, on)
      g2.fillStyle(0xff0000, 1);
      g2.fillCircle(mx + 3, my - 20, 1);
    });
    // "ON AIR" sign hanging above center
    g2.fillStyle(0x8a0000, 1);
    g2.fillRect(x - 24, y - 6, 48, 14);
    g2.lineStyle(2, 0x4a0000, 1);
    g2.strokeRect(x - 24, y - 6, 48, 14);
    this.add.text(x, y + 1, 'ON AIR', {
      fontFamily: 'monospace', fontSize: '8px',
      color: '#ffe0a0', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
  }

  private drawGuestRoster(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Frame
    g.fillStyle(0x4a3826, 1);
    g.fillRect(x - 40, y - 80, 80, 160);
    g.lineStyle(2, 0x2a1e10, 1);
    g.strokeRect(x - 40, y - 80, 80, 160);
    // Parchment
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 34, y - 74, 68, 148);
    // Title bar
    g.fillStyle(0x8a4a1e, 1);
    g.fillRect(x - 34, y - 74, 68, 14);
    // Mock entries (dots + lines for each guest)
    g.lineStyle(1, 0x6b5230, 1);
    for (let i = 0; i < 8; i++) {
      const ey = y - 56 + i * 16;
      g.fillStyle(0xb8a472, 1);
      g.fillCircle(x - 24, ey, 3);  // avatar dot
      g.fillStyle(0x6b5230, 0.7);
      g.fillRect(x - 18, ey - 3, 40, 2);  // name line
      g.fillRect(x - 18, ey + 1, 32, 1.5);  // role line
    }
  }

  private drawAntenna(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Tall antenna mast
    g.lineStyle(3, 0x4a4d56, 1);
    g.lineBetween(x, y - 100, x, y + 60);
    // Cross beams
    [-80, -50, -20, 10].forEach((dy) => {
      const w = (dy === -80) ? 14 : (dy === -50 ? 22 : (dy === -20 ? 30 : 38));
      g.lineBetween(x - w, y + dy, x + w, y + dy);
    });
    // Top beacon (animated red blink)
    const beacon = this.add.graphics();
    beacon.setDepth(3);
    beacon.fillStyle(0xff3030, 1);
    beacon.fillCircle(x, y - 105, 4);
    this.tweens.add({
      targets: beacon, alpha: 0.3,
      duration: 800, yoyo: true, repeat: -1,
    });
    // Wave rings emanating
    const wave = this.add.graphics();
    wave.setDepth(0);
    wave.lineStyle(1, 0xe0a060, 0.5);
    wave.strokeCircle(x, y - 60, 30);
    wave.strokeCircle(x, y - 60, 50);
    wave.strokeCircle(x, y - 60, 70);
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

  private triggerMixer() {
    EventBus.emit('show-dialogue', {
      name: '🎚️ 调音台',
      lines: [
        '（8 个推子整齐排列，VU 表跳动）',
        '',
        '"声音是 CUA 的一种生命方式。"',
        '"每周一档播客——访谈、辩论、分享。"',
        '',
        '当前正在剪辑：',
        '─ "AI 浪潮第 N 集 · 嘉宾访谈"',
        '─ "CUA 周报第 X 期 · 本周精选"',
      ],
    });
  }

  private triggerTable() {
    EventBus.emit('show-dialogue', {
      name: '🎙️ 录音圆桌',
      lines: [
        '（4 支麦克风围圈而立，红灯常亮）',
        '"ON AIR" 灯亮着——好像随时会有人来录。',
        '',
        '"这里坐过很多嘉宾——"',
        '"作者、研究员、产品经理、甚至有学生。"',
        '"每个人的声音，都被认真听过。"',
      ],
    });
  }

  private triggerRoster() {
    EventBus.emit('show-dialogue', {
      name: '📋 嘉宾名册',
      lines: [
        '（一卷长长的羊皮纸，记录所有上过节目的嘉宾）',
        '',
        '"已邀请：" 73 位',
        '"已录制：" 58 位',
        '"待发布：" 6 期',
        '',
        '名册底部写着：',
        '"想登台分享？给 podcast@cua.dev 发邮件吧。"',
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
    const distMix = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.mixerX, this.mixerY);
    const distTable = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.tableX, this.tableY);
    const distRoster = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.rosterX, this.rosterY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distMix < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看调音台').setPosition(this.mixerX, this.mixerY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerMixer();
    } else if (distTable < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看录音桌').setPosition(this.tableX, this.tableY - 80).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerTable();
    } else if (distRoster < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看嘉宾册').setPosition(this.rosterX, this.rosterY - 90).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerRoster();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
