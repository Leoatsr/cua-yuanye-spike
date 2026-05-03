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

    // ---- Floor (Wave 7.K · 落地页米色) ----
    const g = this.add.graphics();
    g.setDepth(-5);
    // 外圈暖木墙
    g.fillStyle(0x8b4513, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // 内地板 米色
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    // 内边深木线
    g.lineStyle(3, 0x5d3a1a, 1);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    // 横向木板缝
    g.lineStyle(1, 0xc9a55b, 0.3);
    for (let y = 102; y < ROOM_HEIGHT - 60; y += 64) {
      g.lineBetween(64, y, ROOM_WIDTH - 64, y);
    }

    // ---- 北墙顶梁 (Wave 7.K · 暖木) ----
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- Wave 7.K 主道具：5 盆栽墙（北墙居中）----
    this.centerSteleX = ROOM_WIDTH / 2;
    this.centerSteleY = 120;
    this.drawCenterStele(this.centerSteleX, this.centerSteleY);

    // ---- Wave 7.K 中央桌：地球仪 (E 看年报 · 入口)----
    // 注意：保留旧 EventBus 'open-merit-board' 触发逻辑 - 这是生态工坊核心功能
    // 复用 leftSteleX/Y 字段表示中央桌（命名不改 · 避免 K 那种字段错位 bug）
    this.leftSteleX = ROOM_WIDTH / 2;
    this.leftSteleY = ROOM_HEIGHT / 2 + 20;
    this.drawSideStele(this.leftSteleX, this.leftSteleY);

    // ---- Wave 7.K 副件：年报架 (东墙) ----
    this.rightSteleX = ROOM_WIDTH - 110;
    this.rightSteleY = ROOM_HEIGHT / 2 + 30;
    this.drawCandleBrazier(this.rightSteleX, this.rightSteleY);

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
    doorG.fillStyle(0x4a3826, 1);
    doorG.fillRect(this.exitX - 22, this.exitY - 30, 44, 56);
    doorG.lineStyle(2, 0x2a1e10, 1);
    doorG.strokeRect(this.exitX - 22, this.exitY - 30, 44, 56);
    doorG.fillStyle(0xb8a472, 1);
    doorG.fillCircle(this.exitX + 12, this.exitY, 3);

    // ---- Title ----
    this.add.text(ROOM_WIDTH / 2, 80, '— 生态工坊 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#3b6d11', backgroundColor: '#fdf0cfee',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    this.exitHint = this.add.text(0, 0, '[E] 离开', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#fdf0cf', backgroundColor: '#5d3a1add',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.interactHint = this.add.text(0, 0, '[E]', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#000000aa',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);
  }

  // ============ DRAWING (Wave 7.K · 4 区精简 · 保留方法名兼容旧 update) ============

  /** 主道具：5 盆栽墙 (北墙居中 · 占用 centerSteleX/Y) */
  private drawCenterStele(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 暖木外框
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 90, y - 28, 180, 56);
    // 深绿主题色边
    g.fillStyle(0x3b6d11, 1);
    g.fillRect(x - 86, y - 24, 172, 48);
    // 米色挂板
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 82, y - 20, 164, 40);
    // 5 个盆栽
    for (let i = 0; i < 5; i++) {
      const px = x - 64 + i * 32;
      // 陶盆
      g.fillStyle(0x6b5230, 1);
      g.fillRect(px - 8, y + 8, 16, 10);
      g.fillStyle(0x8b6f3a, 1);
      g.fillRect(px - 7, y + 9, 14, 8);
      // 叶
      g.fillStyle(0x3b6d11, 1);
      g.fillCircle(px - 4, y - 2, 5);
      g.fillCircle(px + 4, y - 2, 5);
      g.fillCircle(px, y - 8, 5);
      // 高光
      g.fillStyle(0x639922, 1);
      g.fillCircle(px, y - 10, 2);
    }
  }

  /**
   * 中央桌：地球仪 (E 触发 open-merit-board · 这是生态工坊核心)
   * 占用 leftSteleX/Y 字段（不改名 · 兼容 update 引用）
   */
  private drawSideStele(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 桌面 (暖木)
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 50, y - 18, 100, 36);
    g.fillStyle(0xa0673b, 1);
    g.fillRect(x - 48, y - 16, 96, 32);
    // 地球仪支架
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 2, y - 6, 4, 14);
    g.fillRect(x - 14, y + 6, 28, 4);
    // 地球
    g.fillStyle(0x378ADD, 1);
    g.fillCircle(x, y - 4, 12);
    // 大陆 (绿)
    g.fillStyle(0x3b6d11, 1);
    g.fillCircle(x - 4, y - 8, 4);
    g.fillCircle(x + 5, y - 2, 3);
    g.fillCircle(x - 2, y + 2, 3);
    // 经度线
    g.lineStyle(1, 0x0c447c, 0.4);
    g.strokeCircle(x, y - 4, 12);
    g.lineBetween(x - 12, y - 4, x + 12, y - 4);
    // 桌脚
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 48, y + 18, 4, 14);
    g.fillRect(x + 44, y + 18, 4, 14);
    // 桌前一本年报（绿封）
    g.fillStyle(0x3b6d11, 1);
    g.fillRect(x - 38, y - 8, 14, 18);
    g.fillStyle(0xdaa520, 1);
    g.fillRect(x - 38, y - 4, 14, 2);
  }

  /** 副件：年报架 (东墙 · 占用 rightSteleX/Y) */
  private drawCandleBrazier(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 木架
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 22, y - 36, 44, 72);
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 20, y - 34, 40, 68);
    // 隔板
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 20, y - 12, 40, 2);
    g.fillRect(x - 20, y + 10, 40, 2);
    // 上层 3 本年报 (绿/蓝/紫)
    const books = [0x3b6d11, 0x185fa5, 0x534ab7];
    for (let i = 0; i < 3; i++) {
      g.fillStyle(books[i], 1);
      g.fillRect(x - 16 + i * 12, y - 32, 8, 18);
      g.fillStyle(0xdaa520, 1);
      g.fillRect(x - 16 + i * 12, y - 28, 8, 2);
      g.fillStyle(0x2a1e10, 1);
      g.fillRect(x - 16 + i * 12, y - 32, 8, 1);
    }
    // 中层装饰盆栽
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 8, y - 4, 16, 12);
    g.fillStyle(0x3b6d11, 1);
    g.fillCircle(x - 4, y - 8, 4);
    g.fillCircle(x + 4, y - 8, 4);
    g.fillCircle(x, y - 12, 4);
    // 底层文件夹
    g.fillStyle(0x3b6d11, 1);
    g.fillRect(x - 16, y + 14, 32, 18);
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 14, y + 16, 28, 4);
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
      name: '🌿 生态观察',
      lines: [
        '（盆栽们在窗光下静静呼吸）',
        '',
        '"软件生态像花园——不浇水会枯萎，过度修剪会失去野性。"',
        '"我们做的事：观察、记录、引介——不强加。"',
        '',
        '（架子上的年报：CUA 软件生态开放度报告）',
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
    const distCenter = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.centerSteleX, this.centerSteleY);
    const distLeft = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.leftSteleX, this.leftSteleY);
    const distRight = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.rightSteleX, this.rightSteleY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distLeft < INTERACT_DISTANCE) {
      // 中央桌 (地球仪) → 打开 MeritBoardPanel (核心功能)
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看功德录').setPosition(this.leftSteleX, this.leftSteleY - 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerCenterStele();
    } else if (distCenter < INTERACT_DISTANCE * 1.5) {
      // 主道具 (5 盆栽墙) → 看盆栽
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看盆栽墙').setPosition(this.centerSteleX, this.centerSteleY + 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerSideStele();
    } else if (distRight < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 翻年报').setPosition(this.rightSteleX, this.rightSteleY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerSideStele();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
