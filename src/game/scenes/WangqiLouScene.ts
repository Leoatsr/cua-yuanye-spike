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
 * 望气楼 (Wangqi Lou) — 内参工作组工坊室内
 *
 * Theme: Intelligence / industry insights observatory.
 * Visual: World map with pinned events, telescope, encrypted vault, intel desk.
 */
export class WangqiLouScene extends Phaser.Scene {
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

  private mapX = 0;
  private mapY = 0;
  private telescopeX = 0;
  private telescopeY = 0;
  private vaultX = 0;
  private vaultY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('WangqiLou');
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

    // ---- 北墙顶梁 (Wave 7.K · 暖木) ----
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- Wave 7.K B 布局：上下双区分隔线 (中线 · 暗木条) ----
    const dividerY = ROOM_HEIGHT / 2 + 5;
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(80, dividerY - 1, ROOM_WIDTH - 160, 2);
    g.fillStyle(0xc9a55b, 0.5);
    g.fillRect(80, dividerY + 1, ROOM_WIDTH - 160, 1);

    // ====== 上半工作区 ======
    // 左上：档案柜阵列 4 抽屉横向 (drawIntelDesk · 装饰不互动)
    this.drawIntelDesk(ROOM_WIDTH / 4, 130);

    // 右上：情报地图墙 (主道具 · 占 mapX/Y)
    this.mapX = ROOM_WIDTH * 3 / 4;
    this.mapY = 130;
    this.drawWorldMap(this.mapX, this.mapY);

    // ====== 下半阅读区 ======
    // 左下：望远镜 (落地式 · 占 telescopeX/Y)
    this.telescopeX = 130;
    this.telescopeY = ROOM_HEIGHT / 2 + 70;
    this.drawTelescope(this.telescopeX, this.telescopeY);

    // 中下：高背阅读桌 (装饰 · 不互动 · 用 inline 方法画)
    this.drawReadingDesk(ROOM_WIDTH / 2, ROOM_HEIGHT / 2 + 70);

    // 右下：月报架 (副件 · 占 vaultX/Y)
    this.vaultX = ROOM_WIDTH - 130;
    this.vaultY = ROOM_HEIGHT / 2 + 70;
    this.drawVault(this.vaultX, this.vaultY);

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
    this.mp = setupMultiplayer(this, 'WangqiLou', () => this.player, () => this.currentFacing);

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
    this.add.text(ROOM_WIDTH / 2, 80, '— 内参工坊 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#444441', backgroundColor: '#fdf0cfee',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    this.exitHint = this.add.text(0, 0, '[E] 离开', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#fdf0cf', backgroundColor: '#5d3a1add',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.interactHint = this.add.text(0, 0, '[E]', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#fdf0cf', backgroundColor: '#5d3a1add',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);
  }

  // ============ DRAWING (Wave 7.K · B 上下双区布局 · 保留方法名) ============

  /** 主道具：情报地图墙 (右上 · 占 mapX/Y · 灰主题) */
  private drawWorldMap(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 暖木外框
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 88, y - 28, 176, 56);
    // 灰主题色边
    g.fillStyle(0x5f5e5a, 1);
    g.fillRect(x - 84, y - 24, 168, 48);
    // 米色地图底
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 80, y - 20, 160, 40);
    // 顶部"INTEL"灰条
    g.fillStyle(0x444441, 1);
    g.fillRect(x - 80, y - 20, 160, 5);
    // 大陆轮廓 (浅灰块)
    g.fillStyle(0xb4b2a9, 1);
    g.fillRect(x - 70, y - 10, 30, 18);
    g.fillRect(x - 36, y - 12, 26, 22);
    g.fillRect(x - 6, y - 8, 24, 14);
    g.fillRect(x + 22, y - 6, 22, 12);
    g.fillRect(x + 48, y - 10, 22, 16);
    // 海洋纹理 (浅蓝点)
    g.fillStyle(0x85b7eb, 0.4);
    for (let i = 0; i < 6; i++) {
      g.fillCircle(x - 70 + i * 24, y + 14, 1);
    }
    // 红/黄/蓝图钉 (8 个)
    const pins: [number, number, number][] = [
      [-58, -2, 0xa32d2d], [-44, 4, 0xa32d2d],
      [-22, -2, 0xef9f27], [-12, 4, 0xef9f27],
      [4, -4, 0x378ADD], [16, 0, 0x378ADD],
      [38, -2, 0xa32d2d], [56, -4, 0xef9f27],
    ];
    pins.forEach(([dx, dy, c]) => {
      g.fillStyle(c, 1);
      g.fillCircle(x + dx, y + dy, 2);
      g.fillStyle(0x2c2c2a, 1);
      g.fillCircle(x + dx, y + dy, 0.8);
    });
  }

  /** 副件 L：望远镜落地式 (左下 · 占 telescopeX/Y) */
  private drawTelescope(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 三脚架
    g.lineStyle(3, 0x3a2a1a, 1);
    g.lineBetween(x, y + 18, x - 12, y + 36);
    g.lineBetween(x, y + 18, x, y + 36);
    g.lineBetween(x, y + 18, x + 12, y + 36);
    // 三脚架交汇点 (金圈)
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x, y + 18, 3);
    // 镜筒 (深棕长筒)
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 4, y - 24, 8, 42);
    g.lineStyle(1, 0x888780, 1);
    g.strokeRect(x - 4, y - 24, 8, 42);
    // 镜筒装饰环 (3 道)
    g.fillStyle(0x888780, 1);
    g.fillRect(x - 5, y - 16, 10, 2);
    g.fillRect(x - 5, y - 4, 10, 2);
    g.fillRect(x - 5, y + 8, 10, 2);
    // 上端目镜 (突出的小圈)
    g.fillStyle(0x2c2c2a, 1);
    g.fillRect(x - 6, y - 28, 12, 6);
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x, y - 25, 2);
    // 下端物镜 (大蓝色玻璃)
    g.fillStyle(0x185fa5, 1);
    g.fillCircle(x, y + 16, 5);
    g.fillStyle(0x85b7eb, 0.4);
    g.fillCircle(x - 1, y + 14, 2);
  }

  /** 副件 R：月报架 (右下 · 占 vaultX/Y) */
  private drawVault(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 木架
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 22, y - 36, 44, 72);
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 20, y - 34, 40, 68);
    // 顶部标签条 (灰)
    g.fillStyle(0x444441, 1);
    g.fillRect(x - 20, y - 34, 40, 6);
    // 5 期月报 (堆叠 · 不同色封面 · 金封边)
    const reports = [0x791f1f, 0x854f0b, 0x3b6d11, 0x0c447c, 0x3c3489];
    for (let i = 0; i < 5; i++) {
      const ry = y - 26 + i * 12;
      g.fillStyle(reports[i], 1);
      g.fillRect(x - 16, ry, 32, 10);
      // 封面文字白条
      g.fillStyle(0xfdf0cf, 1);
      g.fillRect(x - 14, ry + 2, 28, 2);
      g.fillStyle(reports[i], 0.6);
      g.fillRect(x - 14, ry + 6, 18, 1);
      // 封边
      g.fillStyle(0xdaa520, 1);
      g.fillRect(x - 16, ry, 2, 10);
    }
  }

  /** 上半装饰：档案柜阵列 4 抽屉横向 (drawIntelDesk · 装饰不互动) */
  private drawIntelDesk(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 暖木外框
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 88, y - 28, 176, 56);
    // 灰背板
    g.fillStyle(0x5f5e5a, 1);
    g.fillRect(x - 84, y - 24, 168, 48);
    // 4 抽屉横向阵列
    for (let i = 0; i < 4; i++) {
      const dx = x - 78 + i * 40;
      // 抽屉框
      g.fillStyle(0x444441, 1);
      g.fillRect(dx, y - 20, 36, 40);
      g.lineStyle(1, 0x888780, 0.6);
      g.strokeRect(dx, y - 20, 36, 40);
      // 把手 (横条)
      g.fillStyle(0x888780, 1);
      g.fillRect(dx + 8, y, 20, 3);
      // 标签 (米色 · 写编号)
      g.fillStyle(0xfdf0cf, 1);
      g.fillRect(dx + 4, y - 16, 28, 6);
      g.fillStyle(0x444441, 0.7);
      g.fillRect(dx + 6, y - 14, 20, 1);
      g.fillRect(dx + 6, y - 12, 14, 1);
      // 锁孔 (金)
      g.fillStyle(0xdaa520, 1);
      g.fillCircle(dx + 30, y + 2, 1.5);
    }
  }

  /** 下半装饰：高背阅读桌 (drawReadingDesk · 装饰不互动) */
  private drawReadingDesk(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 高背椅 (椅背向上)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 14, y - 36, 28, 32);
    g.fillStyle(0x791f1f, 1);
    g.fillRect(x - 12, y - 34, 24, 28);
    // 椅背高光
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x - 10, y - 32, 20, 4);
    // 桌面 (暖木)
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 38, y - 6, 76, 22);
    g.fillStyle(0xa0673b, 1);
    g.fillRect(x - 36, y - 4, 72, 18);
    // 桌脚
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 36, y + 16, 4, 14);
    g.fillRect(x + 32, y + 16, 4, 14);
    // 桌上一份打开的报告 (米色)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 18, y - 2, 36, 14);
    g.lineStyle(1, 0x444441, 0.5);
    g.strokeRect(x - 18, y - 2, 36, 14);
    // 红色顶部条
    g.fillStyle(0x791f1f, 1);
    g.fillRect(x - 16, y, 32, 3);
    // 文字行
    g.fillStyle(0x444441, 0.5);
    g.fillRect(x - 16, y + 5, 28, 1);
    g.fillRect(x - 16, y + 7, 24, 1);
    g.fillRect(x - 16, y + 9, 18, 1);
    // 桌左：钢笔
    g.fillStyle(0x0c447c, 1);
    g.fillRect(x - 32, y + 2, 10, 2);
    g.fillStyle(0xdaa520, 1);
    g.fillRect(x - 24, y + 2, 2, 2);
    // 桌右：绿罩台灯
    g.fillStyle(0x3b6d11, 1);
    g.fillRect(x + 22, y - 4, 12, 4);
    g.fillStyle(0xfac775, 0.8);
    g.fillRect(x + 24, y, 8, 3);
    g.fillStyle(0x444441, 1);
    g.fillRect(x + 27, y + 3, 2, 4);
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

  private triggerMap() {
    EventBus.emit('show-dialogue', {
      name: '🗺️ 情报地图墙',
      lines: [
        '（米色地图底 · 8 处彩色图钉标着事件）',
        '',
        '红钉：突发事件 / 行业地震',
        '黄钉：值得跟进的趋势',
        '蓝钉：长期观察对象',
        '',
        '"望气——观天下之气 · 知风之所向。"',
        '"不站队 · 不预判——只观察 · 只记录。"',
      ],
    });
  }

  private triggerTelescope() {
    EventBus.emit('show-dialogue', {
      name: '🔭 望远镜',
      lines: [
        '（落地式三脚架望远镜 · 物镜对着外面的天）',
        '',
        '"夜空里能看到的 · 比白天多。"',
        '"行业里值得看的 · 也比表面多。"',
        '',
        '"望气——古时候是看星象。"',
        '"现在 · 是看 GitHub Trending · 看技术博客 · 看会议纪要。"',
        '',
        '"——风起于青萍之末。"',
      ],
    });
  }

  private triggerVault() {
    EventBus.emit('show-dialogue', {
      name: '📰 内参月报',
      lines: [
        '（架上 5 期月报 · 不同色封面 · 金色封边）',
        '',
        '红：行业地震 · 棕：投融资变化',
        '绿：开源生态 · 蓝：政策与监管',
        '紫：人物与组织变动',
        '',
        '"内参月报 · 每月初发布。"',
        '"——读多了你会发现 · 真相往往藏在颜色之间。"',
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
    const distMap = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.mapX, this.mapY);
    const distTel = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.telescopeX, this.telescopeY);
    const distVault = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.vaultX, this.vaultY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distMap < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看情报地图').setPosition(this.mapX, this.mapY + 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerMap();
    } else if (distTel < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 用望远镜').setPosition(this.telescopeX, this.telescopeY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerTelescope();
    } else if (distVault < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 翻月报').setPosition(this.vaultX, this.vaultY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerVault();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
