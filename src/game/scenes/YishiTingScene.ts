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
 * 议事厅 (Yishi Ting) — 会议工作组工坊室内
 *
 * Theme: Conference room.
 * Visual: Big oval table with chairs, projector screen, agenda board, microphones.
 */
export class YishiTingScene extends Phaser.Scene {
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

  private projectorX = 0;
  private projectorY = 0;
  private agendaX = 0;
  private agendaY = 0;
  private tableX = 0;
  private tableY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('YishiTing');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Floor (formal carpet, navy + cream) ----
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x1a1a2a, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    g.fillStyle(0xefe9d9, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(3, 0x9a8d6c, 1);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);

    // Wood inlay border
    g.lineStyle(1, 0x6b5230, 0.7);
    g.strokeRect(80, 90, ROOM_WIDTH - 160, ROOM_HEIGHT - 170);

    // ---- North wall ----
    g.fillStyle(0x4a3826, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- Projector screen (north center) ----
    this.projectorX = ROOM_WIDTH / 2;
    this.projectorY = 130;
    this.drawProjector(this.projectorX, this.projectorY);

    // ---- Agenda board (west) ----
    this.agendaX = 140;
    this.agendaY = ROOM_HEIGHT / 2;
    this.drawAgenda(this.agendaX, this.agendaY);

    // ---- Big oval table (center) ----
    this.tableX = ROOM_WIDTH / 2;
    this.tableY = ROOM_HEIGHT / 2 + 30;
    this.drawOvalTable(this.tableX, this.tableY);

    // ---- Coffee station (east) ----
    this.drawCoffeeStation(ROOM_WIDTH - 130, ROOM_HEIGHT / 2);

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
    this.mp = setupMultiplayer(this, 'YishiTing', () => this.player, () => this.currentFacing);

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
    this.add.text(ROOM_WIDTH / 2, 30, '— 议事厅 · 会议工作组 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#f5f0e0', backgroundColor: '#1a1a2aaa',
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

  private drawProjector(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Roller frame
    g.fillStyle(0x4a4d56, 1);
    g.fillRect(x - 100, y - 40, 200, 6);
    // Screen (white pull-down)
    g.fillStyle(0xf8f8f8, 1);
    g.fillRect(x - 96, y - 34, 192, 70);
    g.lineStyle(2, 0x2a2e36, 1);
    g.strokeRect(x - 96, y - 34, 192, 70);
    // Projected slide content
    // Title bar (dark blue)
    g.fillStyle(0x1f3a5f, 1);
    g.fillRect(x - 90, y - 28, 180, 14);
    // Title text indicator
    g.fillStyle(0xffe0a0, 1);
    g.fillRect(x - 86, y - 24, 80, 5);
    // Body bullet points
    g.fillStyle(0x2a2e36, 0.8);
    [0, 12, 24, 36].forEach((dy) => {
      g.fillCircle(x - 84, y - 6 + dy, 2);
      g.fillRect(x - 78, y - 8 + dy, 100 - dy, 2);
    });
    // Lighter bottom area (chart)
    g.fillStyle(0x4ade80, 0.6);
    g.fillRect(x + 30, y - 6, 12, 38);
    g.fillStyle(0x60a5fa, 0.6);
    g.fillRect(x + 46, y + 4, 12, 28);
    g.fillStyle(0xfbbf24, 0.6);
    g.fillRect(x + 62, y - 12, 12, 44);
    g.fillStyle(0xf87171, 0.6);
    g.fillRect(x + 78, y - 2, 10, 34);
  }

  private drawAgenda(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Frame
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 50, y - 80, 100, 160);
    g.lineStyle(2, 0x3a2818, 1);
    g.strokeRect(x - 50, y - 80, 100, 160);
    // Parchment
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 44, y - 74, 88, 148);
    // Title bar (deep blue, formal)
    g.fillStyle(0x1f3a5f, 1);
    g.fillRect(x - 44, y - 74, 88, 14);
    // Title text indicator
    g.fillStyle(0xffe0a0, 1);
    g.fillRect(x - 40, y - 70, 60, 5);
    // 6 agenda items
    for (let i = 0; i < 6; i++) {
      const ey = y - 50 + i * 18;
      // Numbered marker
      g.fillStyle(0xb8a472, 1);
      g.fillCircle(x - 36, ey, 4);
      // Text line
      g.fillStyle(0x4a3826, 0.7);
      g.fillRect(x - 28, ey - 2, 56, 1.5);
      g.fillRect(x - 28, ey + 2, 40, 1);
      // Status checkmark (first 3 done)
      if (i < 3) {
        g.lineStyle(1.5, 0x4ade80, 1);
        g.lineBetween(x + 32, ey - 2, x + 36, ey + 2);
        g.lineBetween(x + 36, ey + 2, x + 40, ey - 4);
      }
    }
  }

  private drawOvalTable(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(0);
    // Big oval table (dark wood)
    g.fillStyle(0x4a3826, 1);
    g.fillEllipse(x, y, 240, 110);
    g.lineStyle(3, 0x2a1e10, 1);
    g.strokeEllipse(x, y, 240, 110);
    // Inner darker ring
    g.fillStyle(0x6b5230, 1);
    g.fillEllipse(x, y, 220, 95);
    // Center decoration (gold ring)
    g.lineStyle(2, 0xb8a472, 0.8);
    g.strokeEllipse(x, y, 80, 36);

    // 8 chairs around table
    const g2 = this.add.graphics();
    g2.setDepth(1);
    const chairOffsets: Array<[number, number]> = [
      [-90, -55], [0, -65], [90, -55],     // top: 3
      [120, 0], [120, 30],                  // right: 2
      [-90, 55], [0, 65], [90, 55],         // bottom: 3 (replace one with screen-front)
    ];
    chairOffsets.forEach(([dx, dy]) => {
      g2.fillStyle(0x2a1e10, 1);
      g2.fillRect(x + dx - 10, y + dy - 10, 20, 20);
      g2.lineStyle(1, 0x000000, 1);
      g2.strokeRect(x + dx - 10, y + dy - 10, 20, 20);
      g2.fillStyle(0x9a4a3a, 1);
      g2.fillRect(x + dx - 9, y + dy - 9, 18, 18);
    });

    // Items on table
    const g3 = this.add.graphics();
    g3.setDepth(2);
    // 8 microphones (paired with chairs)
    [
      [-90, -36], [0, -42], [90, -36], [88, 6], [-90, 36], [0, 42], [90, 36], [-88, 6],
    ].forEach(([dx, dy]) => {
      // Mic stand
      g3.lineStyle(1.5, 0x2a2e36, 1);
      g3.lineBetween(x + dx, y + dy, x + dx, y + dy - 10);
      // Mic head
      g3.fillStyle(0x18121a, 1);
      g3.fillCircle(x + dx, y + dy - 12, 2.5);
    });
    // Notepads scattered
    [
      [-50, -10], [40, -10], [-30, 20], [50, 20],
    ].forEach(([dx, dy]) => {
      g3.fillStyle(0xede5cf, 1);
      g3.fillRect(x + dx, y + dy, 14, 10);
      g3.lineStyle(1, 0x6b5230, 0.5);
      g3.lineBetween(x + dx + 2, y + dy + 3, x + dx + 12, y + dy + 3);
      g3.lineBetween(x + dx + 2, y + dy + 6, x + dx + 10, y + dy + 6);
    });
    // Glass of water
    g3.fillStyle(0x60a5fa, 0.5);
    g3.fillCircle(x - 60, y - 30, 4);
    g3.lineStyle(1, 0xc9d1d9, 1);
    g3.strokeCircle(x - 60, y - 30, 4);
  }

  private drawCoffeeStation(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Side table
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 30, y - 30, 60, 60);
    g.lineStyle(2, 0x3a2818, 1);
    g.strokeRect(x - 30, y - 30, 60, 60);
    // Coffee maker
    g.fillStyle(0x2a2e36, 1);
    g.fillRect(x - 16, y - 24, 32, 24);
    g.fillStyle(0x4a4d56, 1);
    g.fillRect(x - 14, y - 22, 28, 16);
    // Pot (glass)
    g.fillStyle(0x6b3a18, 0.85);
    g.fillRect(x - 10, y - 4, 20, 14);
    g.lineStyle(1, 0xc9d1d9, 1);
    g.strokeRect(x - 10, y - 4, 20, 14);
    // Stack of cups
    g.fillStyle(0xede5cf, 1);
    [-2, 0, 2].forEach((dy) => g.fillCircle(x + 22, y + 14 + dy, 4));
    g.lineStyle(1, 0xa0a0a0, 1);
    [-2, 0, 2].forEach((dy) => g.strokeCircle(x + 22, y + 14 + dy, 4));
    // Indicator LED (on)
    g.fillStyle(0xff6030, 1);
    g.fillCircle(x + 12, y - 18, 1.5);
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

  private triggerProjector() {
    EventBus.emit('show-dialogue', {
      name: '📺 投影屏幕',
      lines: [
        '（投影显示着上次会议的幻灯片）',
        '',
        '"标题：CUA Q4 季度复盘"',
        '',
        '· 议程一：上季度成果',
        '· 议程二：本季度规划',
        '· 议程三：人员变动',
        '· 议程四：预算分配',
        '',
        '右下角是各工作组贡献柱状图。',
      ],
    });
  }

  private triggerAgenda() {
    EventBus.emit('show-dialogue', {
      name: '📋 议程板',
      lines: [
        '（金边木板，6 项议程依次列出）',
        '',
        '✓ 1. 开场致辞',
        '✓ 2. 上次会议纪要确认',
        '✓ 3. 进度同步',
        '○ 4. 议题讨论',
        '○ 5. 决议表决',
        '○ 6. 闭会总结',
        '',
        '"前 3 项已完成——后 3 项是今天的重头戏。"',
      ],
    });
  }

  private triggerTable() {
    EventBus.emit('show-dialogue', {
      name: '🪑 议事桌',
      lines: [
        '（巨大的椭圆桌，8 把椅子环绕，8 支麦克风对位）',
        '',
        '"圆桌——人人平等。"',
        '"椭圆——便于所有人对视。"',
        '"麦克风——保证每个声音被记录。"',
        '',
        '当前安排：8 个工作组组长定期碰头',
        '议事厅每月开 2 次例会。',
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
    const distProj = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.projectorX, this.projectorY);
    const distAg = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.agendaX, this.agendaY);
    const distTbl = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.tableX, this.tableY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distProj < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看投影').setPosition(this.projectorX, this.projectorY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerProjector();
    } else if (distAg < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看议程').setPosition(this.agendaX, this.agendaY - 100).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerAgenda();
    } else if (distTbl < INTERACT_DISTANCE * 2) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看议事桌').setPosition(this.tableX, this.tableY - 80).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerTable();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
