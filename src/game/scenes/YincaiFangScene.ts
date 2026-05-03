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
 * 引才坊 (Yincai Fang) — 招聘工作组工坊室内
 *
 * Theme: Recruitment / talent matching agency.
 * Visual: job postings cork board, resume rack, interview round table.
 */
export class YincaiFangScene extends Phaser.Scene {
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

  private boardX = 0;
  private boardY = 0;
  private resumeX = 0;
  private resumeY = 0;
  private tableX = 0;
  private tableY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('YincaiFang');
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
    g.fillStyle(0x8b4513, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(3, 0x5d3a1a, 1);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    // 横向木板缝
    g.lineStyle(1, 0xc9a55b, 0.3);
    for (let y = 102; y < ROOM_HEIGHT - 60; y += 64) {
      g.lineBetween(64, y, ROOM_WIDTH - 64, y);
    }
    // A 布局：左侧候选人等候区暖色地毯（拉低饱和度的金色暗示这是接待区）
    g.fillStyle(0xdaa520, 0.06);
    g.fillRect(70, ROOM_HEIGHT / 2 - 50, 130, 130);

    // ---- 北墙顶梁 (Wave 7.K · 暖木) ----
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- Wave 7.K 主道具：荣誉徽章墙 (北墙居中 · 占 boardX/Y · 金主题) ----
    this.boardX = ROOM_WIDTH / 2;
    this.boardY = 120;
    this.drawJobBoard(this.boardX, this.boardY);

    // ---- Wave 7.K 中央桌：面试桌 (带 2 把椅子 · 占 tableX/Y) ----
    this.tableX = ROOM_WIDTH / 2;
    this.tableY = ROOM_HEIGHT / 2 + 30;
    this.drawInterviewTable(this.tableX, this.tableY);

    // ---- Wave 7.K 副件 R：JD 公告板 (东墙 · 占 resumeX/Y) ----
    this.resumeX = ROOM_WIDTH - 110;
    this.resumeY = ROOM_HEIGHT / 2 + 20;
    this.drawResumeRack(this.resumeX, this.resumeY);

    // ---- Wave 7.K 副件 L：候选人沙发等候区 (drawPlant 改写为整个等候区) ----
    this.drawPlant(120, ROOM_HEIGHT / 2 + 20);

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
    this.mp = setupMultiplayer(this, 'YincaiFang', () => this.player, () => this.currentFacing);

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
    this.add.text(ROOM_WIDTH / 2, 80, '— 招聘工坊 —', {
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

  // ============ DRAWING (Wave 7.K · A 面试间布局 · 保留方法名) ============

  /** 主道具：荣誉徽章墙 (北墙居中 · 拉宽 240 · 占 boardX/Y · 金主题) */
  private drawJobBoard(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 暖木外框
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 120, y - 28, 240, 56);
    // 金主题色边
    g.fillStyle(0xdaa520, 1);
    g.fillRect(x - 116, y - 24, 232, 48);
    // 米色挂板
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 112, y - 20, 224, 40);
    // 顶部金条 + 标签
    g.fillStyle(0x854f0b, 1);
    g.fillRect(x - 112, y - 20, 224, 5);
    // 8 枚徽章 (4×2 阵列 · 圆形)
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const bx = x - 84 + col * 56;
        const by = y - 8 + row * 14;
        // 外圈金色
        g.fillStyle(0xdaa520, 1);
        g.fillCircle(bx, by, 5);
        // 内圈深金
        g.fillStyle(0x854f0b, 1);
        g.fillCircle(bx, by, 3.5);
        // 中心高光
        g.fillStyle(0xfac775, 1);
        g.fillCircle(bx, by, 1.5);
        // 徽章下挂带 (红丝带 · 用 2 矩形拼三角形避免 fillTriangle)
        g.fillStyle(0x791f1f, 1);
        g.fillRect(bx - 2, by + 4, 4, 2);
        g.fillRect(bx - 1, by + 6, 2, 1);
      }
    }
  }

  /** 副件 R：JD 公告板 (东墙 · 占 resumeX/Y · 卷轴风) */
  private drawResumeRack(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 木架
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 22, y - 36, 44, 72);
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 20, y - 34, 40, 68);
    // 顶部金条
    g.fillStyle(0xdaa520, 1);
    g.fillRect(x - 20, y - 34, 40, 5);
    // 大 JD 卷轴 (米色 + 红封边)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 16, y - 26, 32, 56);
    // 卷轴上下端 (深木轴)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 18, y - 28, 36, 4);
    g.fillRect(x - 18, y + 26, 36, 4);
    // 红色"招贤"印章 (顶部)
    g.fillStyle(0x791f1f, 1);
    g.fillRect(x - 6, y - 20, 12, 8);
    g.fillStyle(0xfdf0cf, 1);
    g.fillCircle(x, y - 16, 1.5);
    // 文字行 (假装)
    g.fillStyle(0x444441, 0.5);
    for (let i = 0; i < 6; i++) {
      const ty = y - 6 + i * 5;
      g.fillRect(x - 12, ty, 24, 1);
    }
    // 底部金色"求贤"标签
    g.fillStyle(0xdaa520, 1);
    g.fillRect(x - 10, y + 18, 20, 6);
  }

  /** 中央桌：面试桌 (带 2 把椅子 · 占 tableX/Y) */
  private drawInterviewTable(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 后椅子 (面试官)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 12, y - 38, 24, 16);
    g.fillStyle(0x791f1f, 1);
    g.fillRect(x - 10, y - 36, 20, 12);
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x - 8, y - 34, 16, 4);
    // 桌面 (暖木 · 长方形)
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 50, y - 18, 100, 36);
    g.fillStyle(0xa0673b, 1);
    g.fillRect(x - 48, y - 16, 96, 32);
    // 桌面装饰：左侧简历堆 (米色 3 张)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 40, y - 10, 18, 20);
    g.lineStyle(1, 0x5d3a1a, 0.3);
    g.strokeRect(x - 40, y - 10, 18, 20);
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 36, y - 12, 18, 20);
    g.strokeRect(x - 36, y - 12, 18, 20);
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 32, y - 14, 18, 20);
    g.strokeRect(x - 32, y - 14, 18, 20);
    // 红色名牌
    g.fillStyle(0x791f1f, 1);
    g.fillRect(x - 30, y - 14, 14, 4);
    // 桌面右：水杯
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x + 12, y - 6, 8, 12);
    g.lineStyle(1, 0x5d3a1a, 0.5);
    g.strokeRect(x + 12, y - 6, 8, 12);
    // 桌面右：印章 (金)
    g.fillStyle(0xdaa520, 1);
    g.fillRect(x + 26, y - 8, 8, 10);
    g.fillStyle(0x854f0b, 1);
    g.fillRect(x + 28, y - 10, 4, 4);
    // 桌脚
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 48, y + 18, 4, 14);
    g.fillRect(x + 44, y + 18, 4, 14);
    // 前椅子 (候选人 · 朝向后椅)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 12, y + 30, 24, 14);
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 10, y + 32, 20, 10);
  }

  /** 副件 L：候选人沙发等候区 (drawPlant 改写 · 沙发 + 茶几 + 杂志) */
  private drawPlant(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 上方：双人沙发
    const sx = x;
    const sy = y - 36;
    // 沙发底座
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(sx - 28, sy - 4, 56, 18);
    // 沙发坐垫 (绿色 · 顾问区温暖感)
    g.fillStyle(0x3b6d11, 1);
    g.fillRect(sx - 26, sy - 2, 52, 14);
    // 坐垫分隔线
    g.lineStyle(1, 0x2a4a08, 0.7);
    g.lineBetween(sx, sy - 2, sx, sy + 12);
    // 沙发靠背
    g.fillStyle(0x639922, 1);
    g.fillRect(sx - 28, sy - 14, 56, 12);
    g.lineStyle(1, 0x2a4a08, 0.7);
    g.lineBetween(sx, sy - 14, sx, sy - 2);
    // 沙发扶手
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(sx - 32, sy - 8, 4, 16);
    g.fillRect(sx + 28, sy - 8, 4, 16);
    // 沙发脚
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(sx - 28, sy + 14, 4, 4);
    g.fillRect(sx + 24, sy + 14, 4, 4);
    // 沙发上一个抱枕 (米色)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(sx + 14, sy - 4, 10, 10);

    // 下方：茶几 + 杂志
    const tx = x;
    const ty = y + 22;
    // 茶几面 (圆形 · 用 4 个矩形拼)
    g.fillStyle(0x5d3a1a, 1);
    g.fillCircle(tx, ty, 18);
    g.fillStyle(0x8b4513, 1);
    g.fillCircle(tx, ty, 16);
    g.fillStyle(0xa0673b, 1);
    g.fillCircle(tx, ty, 14);
    // 茶几脚 (中央木柱)
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(tx - 3, ty + 14, 6, 12);
    // 茶几底盘
    g.fillStyle(0x5d3a1a, 1);
    g.fillCircle(tx, ty + 26, 8);
    // 茶几上：杂志 (蓝色)
    g.fillStyle(0x185fa5, 1);
    g.fillRect(tx - 8, ty - 4, 14, 4);
    // 茶几上：水杯 (米色)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(tx + 6, ty - 6, 6, 8);
    g.lineStyle(1, 0x5d3a1a, 0.5);
    g.strokeRect(tx + 6, ty - 6, 6, 8);
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

  private triggerBoard() {
    EventBus.emit('show-dialogue', {
      name: '🏅 荣誉徽章墙',
      lines: [
        '（金边徽章 8 枚 · 每枚下挂红丝带）',
        '',
        '"这墙上的每一枚徽章 · 都是一次成功的内推。"',
        '',
        '"匹配 = 候选人能力 × 团队需求 × 时机。"',
        '"——三者同时对上 · 才能挂在墙上。"',
        '',
        '当前：19 枚成功匹配 · 73 份在档简历',
      ],
    });
  }

  private triggerResume() {
    EventBus.emit('show-dialogue', {
      name: '📜 招贤榜',
      lines: [
        '（一卷红封边长卷 · 顶部"招贤"红印章）',
        '',
        '"CUA 不是猎头公司——'
        + '我们做的是匹配和内推。"',
        '',
        '当前在招（12 个职位）：',
        '─ AI 工程师 4 · 产品/运营 4',
        '─ 研究/学术 4',
        '',
        '"想发布职位？发邮件到 jobs@cua.dev。"',
      ],
    });
  }

  private triggerTable() {
    EventBus.emit('show-dialogue', {
      name: '🪑 面试桌',
      lines: [
        '（一张长桌 · 后椅红色（面试官）· 前椅木色（候选人））',
        '',
        '（桌上摆着一摞简历 + 水杯 + 金印章）',
        '',
        '"面试不是审视——是双向选择。"',
        '"我们问候选人的问题 · 候选人也可以问我们。"',
        '',
        '"每周三、周五开放面谈 · 任何成员都可来坐坐。"',
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
    const distBoard = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boardX, this.boardY);
    const distRes = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.resumeX, this.resumeY);
    const distTbl = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.tableX, this.tableY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distBoard < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看徽章墙').setPosition(this.boardX, this.boardY + 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBoard();
    } else if (distRes < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看招贤榜').setPosition(this.resumeX, this.resumeY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerResume();
    } else if (distTbl < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看面试桌').setPosition(this.tableX, this.tableY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerTable();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
