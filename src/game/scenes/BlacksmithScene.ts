import * as Phaser from 'phaser';
import { bgmManager } from '../bgmManager';
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
 * Wave 10 · 铁匠铺 (Blacksmith)
 *
 * 方向 1 经典作坊 · 顶梁暗红 (火焰系) · 双火炉 + 中央铁砧
 *
 * 主题: 发布每日热点 (北墙公告榜)
 *
 * 布局:
 *   - 北墙左: 双火炉 (黑底 + 橙黄火光)
 *   - 北墙右: 每日热点榜 (5 行)
 *   - 西墙: 工具墙 (锤钳剪挂件)
 *   - 中央: 大铁砧 (椭圆黑底 + 锤痕)
 *   - 双工作桌 (南偏中)
 *   - 铁匠 NPC (中东 · 红围裙 + 锤在手 · graphics 手画)
 *
 * 互动 4: 火炉 / 热点榜 / 铁砧 / 铁匠
 */
export class BlacksmithScene extends Phaser.Scene {
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

  // 互动点
  private furnaceX = 155;
  private furnaceY = 145;
  private boardX = 500;
  private boardY = 145;
  private anvilX = 360;
  private anvilY = 290;
  private smithX = 440;
  private smithY = 270;

  private exitX = 0;
  private exitY = 0;

  private smithDialogueIndex = 0;

  private exitHint!: Phaser.GameObjects.Text;
  private interactHint!: Phaser.GameObjects.Text;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  // 火光闪烁动画
  private furnaceFlames: Phaser.GameObjects.Arc[] = [];
  private flameTimer = 0;

  constructor() {
    super('Blacksmith');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
    this.smithDialogueIndex = 0;
    this.furnaceFlames = [];
    this.flameTimer = 0;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    bgmManager.stop(this); // 内景静默
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Floor ----
    const g = this.add.graphics();
    g.setDepth(-5);
    // 外圈暖木
    g.fillStyle(0x8b4513, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // 内地板 米色 (跟工坊一致)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(3, 0x5d3a1a, 1);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    // 横向木板缝
    g.lineStyle(1, 0xc9a55b, 0.3);
    for (let y = 102; y < ROOM_HEIGHT - 60; y += 64) {
      g.lineBetween(64, y, ROOM_WIDTH - 64, y);
    }

    // ---- 北墙顶梁 (暗红 · 铁匠铺专属) ----
    g.fillStyle(0x6b3434, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- 道具 ----
    this.drawDoubleFurnace(this.furnaceX, this.furnaceY);
    this.drawHotnewsBoard(this.boardX, this.boardY);
    this.drawToolWall();
    this.drawCentralAnvil(this.anvilX, this.anvilY);
    this.drawWorkBenches();
    this.drawSmithNPC(this.smithX, this.smithY);

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
    // 双火炉碰撞
    walls.add(this.add.rectangle(this.furnaceX, this.furnaceY, 130, 60, 0, 0));
    // 热点榜碰撞
    walls.add(this.add.rectangle(this.boardX, this.boardY, 200, 60, 0, 0));
    // 中央铁砧碰撞 (椭圆近似)
    walls.add(this.add.rectangle(this.anvilX, this.anvilY, 80, 40, 0, 0));
    // 工具墙
    walls.add(this.add.rectangle(95, 280, 30, 140, 0, 0));
    // 双工作桌
    walls.add(this.add.rectangle(220, 380, 80, 30, 0, 0));
    walls.add(this.add.rectangle(500, 380, 80, 30, 0, 0));
    this.physics.add.collider(this.player, walls);

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    this.mp = setupMultiplayer(this, 'Blacksmith', () => this.player, () => this.currentFacing);
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
    this.add.text(ROOM_WIDTH / 2, 80, '— 铁匠铺 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#a32d2d', backgroundColor: '#fdf0cfee',
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

  // ============ DRAWING ============

  /** 北墙左 · 双火炉 (橙黄火光 · 闪烁) */
  private drawDoubleFurnace(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 炉体 (黑底)
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 65, y - 30, 130, 60);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - 65, y - 30, 130, 60);
    // 中线分两炉
    g.lineBetween(x, y - 30, x, y + 30);
    // 炉口 (深黑椭圆)
    g.fillStyle(0x1a0a0a, 1);
    g.fillEllipse(x - 32, y, 36, 18);
    g.fillEllipse(x + 32, y, 36, 18);
    // 烟囱 (顶部)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 40, y - 36, 16, 8);
    g.fillRect(x + 24, y - 36, 16, 8);
    // 烟囱口 (黑)
    g.fillStyle(0x1a0a0a, 1);
    g.fillRect(x - 38, y - 34, 12, 4);
    g.fillRect(x + 26, y - 34, 12, 4);

    // 火光 (橙黄圆 · 后续闪烁)
    const flame1 = this.add.circle(x - 32, y, 11, 0xff7733);
    const flame2 = this.add.circle(x + 32, y, 11, 0xff7733);
    flame1.setDepth(3);
    flame2.setDepth(3);
    // 火光内核 (亮黄)
    const core1 = this.add.circle(x - 32, y, 5, 0xfff200);
    const core2 = this.add.circle(x + 32, y, 5, 0xfff200);
    core1.setDepth(4);
    core2.setDepth(4);

    this.furnaceFlames = [flame1, flame2, core1, core2];
  }

  /** 北墙右 · 每日热点榜 (5 行) */
  private drawHotnewsBoard(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 板底 米色
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 100, y - 32, 200, 64);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - 100, y - 32, 200, 64);
    // 顶部红横线 (强调"热点")
    g.lineStyle(2, 0xa32d2d, 1);
    g.lineBetween(x - 100, y - 28, x + 100, y - 28);
    // 5 行小横条
    g.lineStyle(0.8, 0x5d3a1a, 0.5);
    for (let i = 0; i < 5; i++) {
      g.lineBetween(x - 90, y - 18 + i * 9, x + 90, y - 18 + i * 9);
    }
    // 钉子 (4 角)
    g.fillStyle(0x5d3a1a, 1);
    g.fillCircle(x - 95, y - 28, 2);
    g.fillCircle(x + 95, y - 28, 2);
    g.fillCircle(x - 95, y + 28, 2);
    g.fillCircle(x + 95, y + 28, 2);
    // 标牌
    this.add.text(x, y - 48, '今日热点 · 5 条', {
      fontFamily: 'serif', fontSize: '9px',
      color: '#a32d2d', backgroundColor: '#fdf0cfee',
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
    }).setOrigin(0.5).setDepth(3);
  }

  /** 西墙 · 工具墙 (锤、钳、剪挂件) */
  private drawToolWall() {
    const g = this.add.graphics();
    g.setDepth(2);
    const wx = 95;
    const wy = 280;
    // 板
    g.fillStyle(0x8b5a2b, 1);
    g.fillRect(wx - 15, wy - 70, 30, 140);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(wx - 15, wy - 70, 30, 140);

    // 锤 (顶部)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(wx - 1, wy - 60, 2, 22);  // 柄
    g.fillStyle(0x6a6a6a, 1);
    g.fillRect(wx - 8, wy - 64, 16, 6);  // 头

    // 钳 (中)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(wx - 1, wy - 30, 2, 18);  // 柄
    g.fillStyle(0x6a6a6a, 1);
    g.fillTriangle(wx, wy - 36, wx - 5, wy - 30, wx + 5, wy - 30);  // 钳头

    // 剪 (底)
    g.fillStyle(0x6a6a6a, 1);
    g.fillRect(wx - 6, wy + 10, 12, 4);
    g.fillRect(wx - 1, wy + 14, 2, 14);
    g.lineStyle(1, 0x3a3a3a, 1);
    g.lineBetween(wx - 4, wy + 28, wx - 8, wy + 36);
    g.lineBetween(wx + 4, wy + 28, wx + 8, wy + 36);
  }

  /** 中央铁砧 (椭圆黑底 + 锤痕) */
  private drawCentralAnvil(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 砧基 (梯形支座)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 28, y + 8, 56, 14);
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 22, y + 18, 44, 6);
    // 砧台主体 (椭圆黑铁)
    g.fillStyle(0x3a3a3a, 1);
    g.fillEllipse(x, y - 4, 90, 28);
    g.lineStyle(2, 0x1a1a1a, 1);
    g.strokeEllipse(x, y - 4, 90, 28);
    // 砧顶亮面
    g.fillStyle(0x6a6a6a, 1);
    g.fillEllipse(x, y - 8, 80, 8);
    // 锤痕 (3 道斜线)
    g.lineStyle(0.8, 0x1a1a1a, 0.6);
    g.lineBetween(x - 20, y - 9, x - 12, y - 11);
    g.lineBetween(x - 4, y - 8, x + 4, y - 10);
    g.lineBetween(x + 12, y - 9, x + 20, y - 11);
    // 砧角延伸 (传统铁砧形状)
    g.fillStyle(0x3a3a3a, 1);
    g.fillTriangle(x + 38, y - 10, x + 56, y - 4, x + 38, y - 2);
  }

  /** 双工作桌 (南偏中) */
  private drawWorkBenches() {
    const g = this.add.graphics();
    g.setDepth(2);
    const drawBench = (cx: number, cy: number) => {
      g.fillStyle(0x8b5a2b, 1);
      g.fillRect(cx - 40, cy - 15, 80, 30);
      g.lineStyle(2, 0x5d3a1a, 1);
      g.strokeRect(cx - 40, cy - 15, 80, 30);
      // 桌脚
      g.fillStyle(0x3a2a1a, 1);
      g.fillRect(cx - 38, cy + 13, 4, 8);
      g.fillRect(cx + 34, cy + 13, 4, 8);
      // 桌面工具痕迹
      g.fillStyle(0x5d3a1a, 0.4);
      g.fillCircle(cx - 16, cy - 4, 4);
      g.fillRect(cx + 4, cy - 8, 18, 4);
    };
    drawBench(220, 380);
    drawBench(500, 380);
  }

  /** 铁匠 NPC (graphics 手画 · 红围裙 + 锤在手) */
  private drawSmithNPC(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(3);
    // 阴影
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(x, y + 20, 22, 6);
    // 上衣 灰色 (粗布)
    g.fillStyle(0x5a4a3a, 1);
    g.fillRect(x - 11, y - 4, 22, 16);
    // 红围裙 (主标识)
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x - 10, y + 4, 20, 18);
    // 围裙带子
    g.fillStyle(0x7a2020, 1);
    g.fillRect(x - 10, y + 4, 20, 2);
    // 头 米色 (晒得偏黑一点)
    g.fillStyle(0xe5cb9c, 1);
    g.fillRect(x - 7, y - 18, 14, 16);
    // 头发 (短黑发)
    g.fillStyle(0x2a1a0a, 1);
    g.fillRect(x - 7, y - 20, 14, 6);
    // 眼
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 3, y - 12, 1.5, 1.5);
    g.fillRect(x + 1.5, y - 12, 1.5, 1.5);
    // 腮红 (热脸)
    g.fillStyle(0xff7733, 0.4);
    g.fillCircle(x - 4, y - 8, 2);
    g.fillCircle(x + 4, y - 8, 2);
    // 锤 (右手 · 大锤)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x + 14, y - 8, 2, 22);  // 柄
    g.fillStyle(0x6a6a6a, 1);
    g.fillRect(x + 9, y - 12, 14, 8);  // 锤头
    g.lineStyle(1, 0x1a1a1a, 1);
    g.strokeRect(x + 9, y - 12, 14, 8);
    // 名牌
    this.add.text(x, y - 36, '铁匠 · 阿炎', {
      fontFamily: 'serif', fontSize: '10px',
      color: '#a32d2d', backgroundColor: '#fdf0cfee',
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
    }).setOrigin(0.5).setDepth(4);
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
      this.scene.start('Main', { returnX: this.returnX, returnY: this.returnY });
    });
  }

  private triggerFurnace() {
    EventBus.emit('show-dialogue', {
      name: '🔥 双火炉',
      lines: [
        '（炉火橙红 · 烤得脸暖 · 风箱呼呼地响）',
        '',
        '"炉火一日不灭。"',
        '—— 铁匠铺的规矩。',
      ],
    });
  }

  private triggerBoard() {
    EventBus.emit('show-dialogue', {
      name: '📰 今日热点 · 5 条',
      lines: [
        '1. CV 排行榜更新 · 阿陈反超阿降',
        '2. 9 工坊新增 3 个任务 · 明日截止',
        '3. 议政高地 · 远见塔开放新沙盘',
        '4. 典籍阁新到 12 篇 arXiv',
        '5. 共创之都 · 周三集会',
        '',
        '"看完别走 · 顺手拍个砖。"',
      ],
    });
  }

  private triggerAnvil() {
    EventBus.emit('show-dialogue', {
      name: '⚒ 中央铁砧',
      lines: [
        '（铁砧上有新鲜锤痕 · 似在打一柄长剑）',
        '',
        '锤痕深浅有度 · 看得出师傅的功夫。',
        '砧台余温尚在。',
      ],
    });
  }

  private triggerSmith() {
    const lines = [
      '炉火一日不灭。锤声一日不歇。',
      '这社区每天有什么响动 · 我都给你列在那榜上。',
      '看完别走 · 顺带帮我擦把锤子。',
      '铁要趁热打。事要趁早议。',
    ];
    EventBus.emit('show-dialogue', {
      name: '⚒ 铁匠 · 阿炎',
      lines: [lines[this.smithDialogueIndex]],
    });
    this.smithDialogueIndex = (this.smithDialogueIndex + 1) % lines.length;
  }

  // ============ UPDATE ============

  update(_time: number, delta: number) {
    if (!this.player || !this.cursors) return;

    // 火光闪烁 (装饰)
    this.flameTimer += delta;
    if (this.flameTimer > 200) {
      this.flameTimer = 0;
      this.furnaceFlames.forEach((f, i) => {
        const scale = 0.85 + Math.random() * 0.3;
        f.setScale(scale);
        // 内核更亮 · 外焰更暖
        if (i >= 2) {
          (f as Phaser.GameObjects.Arc).setFillStyle(Math.random() > 0.5 ? 0xfff200 : 0xffd700);
        }
      });
    }

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

    if (Phaser.Input.Keyboard.JustDown(this.mKey)) EventBus.emit('open-world-map', { currentScene: 'Main' });
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) EventBus.emit('open-quest-log');
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) EventBus.emit('open-mailbox');

    const distExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitX, this.exitY);
    const distFurnace = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.furnaceX, this.furnaceY);
    const distBoard = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boardX, this.boardY);
    const distAnvil = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.anvilX, this.anvilY);
    const distSmith = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.smithX, this.smithY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distSmith < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 与铁匠对话').setPosition(this.smithX, this.smithY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerSmith();
    } else if (distBoard < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看热点榜').setPosition(this.boardX, this.boardY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBoard();
    } else if (distFurnace < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看火炉').setPosition(this.furnaceX, this.furnaceY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerFurnace();
    } else if (distAnvil < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看铁砧').setPosition(this.anvilX, this.anvilY - 40).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerAnvil();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
