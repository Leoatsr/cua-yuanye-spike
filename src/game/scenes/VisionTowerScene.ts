import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 130;
const INTERACT_DISTANCE = 56;

const ROOM_WIDTH = 800;
const ROOM_HEIGHT = 600;
// Wave 8.VisionTower · 中央大沙盘布局

interface SceneInitData {
  returnX?: number;
  returnY?: number;
}

/**
 * 远见塔室内 (Vision Tower) — long-term planning, roadmap display.
 * Phase 4 will fill this with the actual roadmap. C6.0 is just the room.
 */
export class VisionTowerScene extends Phaser.Scene {
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

  private sandboxX = 0;
  private sandboxY = 0;
  private telescopeX = 0;
  private telescopeY = 0;
  private scrollX = 0;
  private scrollY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('VisionTower');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 800;
    this.returnY = data.returnY ?? 620;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // === Wave 8 · 米色羊皮纸地板 (替代灰蓝大理石) ===
    const g = this.add.graphics();
    g.setDepth(-5);
    // 暖木墙边
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // 米色羊皮纸地板
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, ROOM_HEIGHT - 120);
    g.lineStyle(3, 0x8b6f4a, 1);
    g.strokeRect(60, 60, ROOM_WIDTH - 120, ROOM_HEIGHT - 120);
    // 地板纹理 (浅暖光散点)
    g.fillStyle(0xead4a0, 0.4);
    for (let i = 0; i < 60; i++) {
      const px = 80 + Math.random() * (ROOM_WIDTH - 160);
      const py = 80 + Math.random() * (ROOM_HEIGHT - 160);
      g.fillCircle(px, py, 1.5);
    }
    // 中央同心圆地纹 (沙盘底)
    g.lineStyle(1, 0xc9a55b, 0.5);
    for (let r = 60; r < 200; r += 24) {
      g.strokeCircle(ROOM_WIDTH / 2, ROOM_HEIGHT / 2, r);
    }

    // === 顶梁 (紫色 · 跟外景圆顶呼应) ===
    g.fillStyle(0x4a3a6a, 1);
    g.fillRect(0, 0, ROOM_WIDTH, 36);
    g.fillStyle(0x6a5a8a, 1);
    g.fillRect(0, 0, ROOM_WIDTH, 6);

    // === 4 角白柱 ===
    this.drawColumn(120, 90);
    this.drawColumn(ROOM_WIDTH - 120, 90);
    this.drawColumn(120, ROOM_HEIGHT - 110);
    this.drawColumn(ROOM_WIDTH - 120, ROOM_HEIGHT - 110);

    // === 北墙小条横幅 "路线图 v3.0" ===
    this.drawBanner(ROOM_WIDTH / 2, 70);

    // === 装饰：左上星图 + 右上罗盘 ===
    this.drawStarChart(140, 130);
    this.drawCompass(ROOM_WIDTH - 140, 130);

    // === 主道具 1：CUA 大沙盘 (中央立体) ===
    this.sandboxX = ROOM_WIDTH / 2;
    this.sandboxY = ROOM_HEIGHT / 2;
    this.drawSandbox(this.sandboxX, this.sandboxY);

    // === 主道具 2：望远镜 (左侧 · 落地式 · 朝南方) ===
    this.telescopeX = 180;
    this.telescopeY = ROOM_HEIGHT / 2 + 60;
    this.drawTelescope(this.telescopeX, this.telescopeY);

    // === 主道具 3：里程碑卷轴架 (右侧) ===
    this.scrollX = ROOM_WIDTH - 180;
    this.scrollY = ROOM_HEIGHT / 2 + 60;
    this.drawScrollRack(this.scrollX, this.scrollY);

    // ---- Player ----
    this.createCharacterAnims('player');
    this.player = this.physics.add.sprite(ROOM_WIDTH / 2, ROOM_HEIGHT - 120, 'player', 0);
    this.player.setCollideWorldBounds(true);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(12, 6).setOffset(10, 17);
    this.player.anims.play('player-idle-up');

    // Wall colliders (invisible)
    const walls = this.physics.add.staticGroup();
    walls.add(this.add.rectangle(ROOM_WIDTH / 2, 50, ROOM_WIDTH, 20, 0, 0));   // top
    walls.add(this.add.rectangle(ROOM_WIDTH / 2, ROOM_HEIGHT - 60, ROOM_WIDTH, 20, 0, 0)); // bottom
    walls.add(this.add.rectangle(70, ROOM_HEIGHT / 2, 20, ROOM_HEIGHT, 0, 0));  // left
    walls.add(this.add.rectangle(ROOM_WIDTH - 70, ROOM_HEIGHT / 2, 20, ROOM_HEIGHT, 0, 0)); // right
    this.physics.add.collider(this.player, walls);

    // Camera
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // G1.1 · Multiplayer (via helper)
    this.mp = setupMultiplayer(this, 'VisionTower', () => this.player, () => this.currentFacing);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(2);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.eKey = this.input.keyboard!.addKey('E');
    this.mKey = this.input.keyboard!.addKey('M');
    this.jKey = this.input.keyboard!.addKey('J');
    this.kKey = this.input.keyboard!.addKey('K');

    // Exit (south door, back to GovHill)
    this.exitX = ROOM_WIDTH / 2;
    this.exitY = ROOM_HEIGHT - 70;
    // Door visual
    const doorG = this.add.graphics();
    doorG.fillStyle(0x6b5a3e, 1);
    doorG.fillRect(this.exitX - 24, this.exitY - 30, 48, 60);
    doorG.lineStyle(2, 0x4a3e26, 1);
    doorG.strokeRect(this.exitX - 24, this.exitY - 30, 48, 60);
    doorG.setDepth(0);

    // Title label
    this.add.text(ROOM_WIDTH / 2, 30, '远见塔 · 鸟瞰长程', {
      fontFamily: 'serif', fontSize: '16px',
      color: '#f5f0e0', backgroundColor: '#1a141aaa',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    // Hints
    this.exitHint = this.add.text(0, 0, '[E] 离开远见塔', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#3a4a6add',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.interactHint = this.add.text(0, 0, '[E] 查看', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#000000aa',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);
  }

  // ============ DRAWING HELPERS (Wave 8.VisionTower · 落地页米色风) ============

  /** 米色细柱 (跟外景柱子统一) */
  private drawColumn(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 柱身 (米色)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 8, y - 50, 16, 100);
    g.lineStyle(1, 0x8b6f4a, 0.8);
    g.strokeRect(x - 8, y - 50, 16, 100);
    // 柱头
    g.fillStyle(0xc9a55b, 1);
    g.fillRect(x - 12, y - 50, 24, 6);
    g.fillRect(x - 12, y + 44, 24, 6);
    // 柱身竖纹
    g.lineStyle(1, 0xc9a55b, 0.5);
    g.lineBetween(x - 3, y - 44, x - 3, y + 44);
    g.lineBetween(x + 3, y - 44, x + 3, y + 44);
  }

  /** 北墙小条横幅 "路线图 v3.0" */
  private drawBanner(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(3);
    // 横幅底
    g.fillStyle(0x4a3a6a, 1);
    g.fillRect(x - 90, y - 12, 180, 24);
    g.lineStyle(2, 0x2a1a4a, 1);
    g.strokeRect(x - 90, y - 12, 180, 24);
    // 高光
    g.fillStyle(0x6a5a8a, 1);
    g.fillRect(x - 90, y - 12, 180, 4);
    // 文字
    this.add.text(x, y, '路线图 v3.0', {
      fontFamily: 'serif', fontSize: '12px',
      color: '#fdf0cf', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);
  }

  /** 左上装饰：星图 (8 颗星 · 不互动) */
  private drawStarChart(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 圆框
    g.fillStyle(0xfdf0cf, 1);
    g.fillCircle(x, y, 28);
    g.lineStyle(2, 0x4a3a6a, 1);
    g.strokeCircle(x, y, 28);
    g.lineStyle(1, 0x4a3a6a, 0.5);
    g.strokeCircle(x, y, 18);
    // 8 颗星 (随机角度)
    g.fillStyle(0xdaa520, 1);
    const angles = [0.3, 1.1, 1.9, 2.6, 3.4, 4.2, 5.0, 5.8];
    angles.forEach((a) => {
      const sx = x + Math.cos(a) * 14;
      const sy = y + Math.sin(a) * 14;
      g.fillCircle(sx, sy, 2);
    });
    // 中央北极星
    g.fillStyle(0xfac775, 1);
    g.fillCircle(x, y, 3);
  }

  /** 右上装饰：罗盘 (不互动) */
  private drawCompass(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 圆框
    g.fillStyle(0xfdf0cf, 1);
    g.fillCircle(x, y, 26);
    g.lineStyle(2, 0x4a3a6a, 1);
    g.strokeCircle(x, y, 26);
    g.lineStyle(1, 0x4a3a6a, 0.5);
    g.strokeCircle(x, y, 18);
    // 指针 (红北白南)
    g.fillStyle(0xc0392b, 1);
    g.fillTriangle(x, y - 18, x - 4, y + 2, x + 4, y + 2);
    g.fillStyle(0xfdf0cf, 1);
    g.fillTriangle(x, y + 18, x - 4, y - 2, x + 4, y - 2);
    // 中心钉
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x, y, 3);
    // 4 方位刻度
    g.lineStyle(2, 0x4a3a6a, 1);
    g.lineBetween(x, y - 24, x, y - 22);
    g.lineBetween(x, y + 22, x, y + 24);
    g.lineBetween(x - 24, y, x - 22, y);
    g.lineBetween(x + 22, y, x + 24, y);
  }

  /** 主道具 1：CUA 大沙盘 (中央立体地图) */
  private drawSandbox(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 沙盘底座 (棕色)
    g.fillStyle(0x5d3a1a, 1);
    g.fillEllipse(x, y + 30, 200, 30);
    g.fillStyle(0x8b6f4a, 1);
    g.fillEllipse(x, y + 22, 200, 24);
    // 沙盘表面 (米色 · 椭圆)
    g.fillStyle(0xead4a0, 1);
    g.fillEllipse(x, y, 180, 100);
    g.lineStyle(2, 0x8b6f4a, 1);
    g.strokeEllipse(x, y, 180, 100);
    // 沙盘上的"地形"纹理
    g.fillStyle(0xfdf0cf, 0.6);
    g.fillEllipse(x - 30, y - 20, 50, 24);
    g.fillEllipse(x + 40, y + 10, 60, 30);

    // === 9 工坊位置 (3x3 网格 · 跟共创之都对应) ===
    const positions = [
      // 共创之都 9 工坊 (上半 · 米色小方块)
      { dx: -50, dy: -20, color: 0x4a8ad5, label: '开' },   // 开源
      { dx:   0, dy: -20, color: 0x6b9b3a, label: '生' },   // 生态
      { dx:  50, dy: -20, color: 0xdaa520, label: '测' },   // 测评
      { dx: -50, dy:  -5, color: 0xc0392b, label: '播' },   // 播客
      { dx:   0, dy:  -5, color: 0x8e44ad, label: '数' },   // 数据
      { dx:  50, dy:  -5, color: 0xe67e22, label: '内' },   // 内参
      { dx: -50, dy:  10, color: 0x2c3e50, label: '招' },   // 招聘
      { dx:   0, dy:  10, color: 0x16a085, label: '会' },   // 会议
      { dx:  50, dy:  10, color: 0xc0a060, label: '百' },   // 百科
    ];
    positions.forEach((p) => {
      g.fillStyle(p.color, 1);
      g.fillRect(x + p.dx - 6, y + p.dy - 5, 12, 10);
      g.lineStyle(1, 0x3a2a1a, 1);
      g.strokeRect(x + p.dx - 6, y + p.dy - 5, 12, 10);
    });

    // === 3 议政高地 (下半 · 紫红青小方块) ===
    const govs = [
      { dx: -30, dy: 28, color: 0x4a3a6a, label: '远' },
      { dx:   0, dy: 28, color: 0x6b3434, label: '理' },
      { dx:  30, dy: 28, color: 0x2a4a4a, label: '镜' },
    ];
    govs.forEach((p) => {
      g.fillStyle(p.color, 1);
      g.fillRect(x + p.dx - 5, y + p.dy - 4, 10, 8);
    });

    // 沙盘中央"CUA"标签
    this.add.text(x, y - 38, 'CUA · 沙盘', {
      fontFamily: 'serif', fontSize: '11px',
      color: '#5d3a1a', backgroundColor: '#fdf0cfee',
      padding: { left: 5, right: 5, top: 1, bottom: 1 },
    }).setOrigin(0.5).setDepth(3);
  }

  /** 望远镜 (左侧落地式) */
  private drawTelescope(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 三脚架
    g.lineStyle(3, 0x5d3a1a, 1);
    g.lineBetween(x - 18, y + 40, x, y);
    g.lineBetween(x + 18, y + 40, x, y);
    g.lineBetween(x, y + 40, x, y - 5);
    // 望远镜身 (45° 倾斜往上)
    g.fillStyle(0xc9a55b, 1);
    g.fillRect(x - 6, y - 30, 28, 14);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - 6, y - 30, 28, 14);
    // 镜头 (前端大圆)
    g.fillStyle(0x4a3a6a, 1);
    g.fillCircle(x + 24, y - 23, 6);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeCircle(x + 24, y - 23, 6);
    // 接目镜 (后端小圆)
    g.fillStyle(0x3a2a1a, 1);
    g.fillCircle(x - 7, y - 23, 3);
    // 装饰螺丝
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x + 8, y - 16, 1.5);
  }

  /** 里程碑卷轴架 (右侧) */
  private drawScrollRack(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 木架
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 40, y + 30, 80, 8);
    g.fillRect(x - 36, y - 50, 6, 80);
    g.fillRect(x + 30, y - 50, 6, 80);
    g.fillRect(x - 40, y - 50, 80, 6);
    // 4 卷轴 (从上到下)
    const scrollY = [-32, -12, 8, 28];
    scrollY.forEach((dy, i) => {
      // 卷轴底
      g.fillStyle(0xfdf0cf, 1);
      g.fillRect(x - 28, y + dy - 4, 56, 10);
      g.lineStyle(1, 0x8b6f4a, 1);
      g.strokeRect(x - 28, y + dy - 4, 56, 10);
      // 卷轴金边
      const colors = [0xdaa520, 0xc9a55b, 0x8b6f4a, 0xc0a060];
      g.fillStyle(colors[i], 1);
      g.fillRect(x - 28, y + dy - 4, 4, 10);
      g.fillRect(x + 24, y + dy - 4, 4, 10);
      // 卷轴文字痕迹
      g.lineStyle(1, 0x6b5a3e, 0.7);
      g.lineBetween(x - 22, y + dy - 1, x + 22, y + dy - 1);
      g.lineBetween(x - 22, y + dy + 2, x + 18, y + dy + 2);
    });
  }

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

  private exit() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('GovHill', { spawnX: this.returnX, spawnY: this.returnY });
    });
  }

  private triggerSandboxDialogue() {
    EventBus.emit('show-dialogue', {
      name: '🗺️ CUA 沙盘',
      lines: [
        '（一座立体的微缩 CUA · 9 工坊与 3 议政高地静静陈列）',
        '"鸟瞰当前世界——所有的位置都在这里。"',
        '',
        '共创之都 9 工坊：',
        '─ 开源 / 生态 / 测评 / 播客 / 数据',
        '─ 内参 / 招聘 / 会议 / 百晓居',
        '议政高地 3 厅：',
        '─ 远见塔（你正在这里）/ 理事会 / 明镜阁',
        '',
        '"这是已建成的部分——下一阶段是大集会广场。"',
      ],
    });
  }

  private triggerScrollDialogue() {
    EventBus.emit('show-dialogue', {
      name: '📜 里程碑卷轴',
      lines: [
        '（架上 4 卷里程碑卷轴 · 由近及远）',
        '',
        '【最近】Wave 8 · 议政高地落地页化',
        '【次近】Wave 7 · UI 像素风重做',
        '【已远】Wave 6 · 共创之都 9 工坊布局',
        '【最远】Wave 5 · 萌芽镇基础玩法',
        '',
        '"每一卷都是一段路——走过的路，不必再走。"',
        '──',
        '后续将与 GitHub Releases 联动 · 自动同步里程碑。',
      ],
    });
  }

  private triggerTelescopeDialogue() {
    EventBus.emit('show-dialogue', {
      name: '🔭 远眺天下',
      lines: [
        '（你扶住望远镜，向南望去）',
        '远处是共创之都的喷泉广场，再远是萌芽镇的炊烟。',
        '——这就是源野的全部？',
        '不，还有更远的——',
        '议政之外，是真实的 5000+ CUA 同行者。',
        '他们正在 GitHub 上写代码、在百科中写词条、在论坛中辩论。',
        '"治理不是终点。被看见，才是。"',
      ],
    });
  }

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

    if (Phaser.Input.Keyboard.JustDown(this.mKey)) EventBus.emit('open-world-map', { currentScene: 'GovHill' });
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) EventBus.emit('open-quest-log');
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) EventBus.emit('open-mailbox');

    const distExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitX, this.exitY);
    const distSandbox = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.sandboxX, this.sandboxY);
    const distTel = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.telescopeX, this.telescopeY);
    const distScroll = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.scrollX, this.scrollY);
    const nearExit = distExit < 56;
    const nearSandbox = distSandbox < INTERACT_DISTANCE;
    const nearTel = distTel < INTERACT_DISTANCE;
    const nearScroll = distScroll < INTERACT_DISTANCE;

    if (nearExit) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (nearSandbox) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看沙盘').setPosition(this.sandboxX, this.sandboxY - 60).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerSandboxDialogue();
    } else if (nearTel) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 望远眺').setPosition(this.telescopeX, this.telescopeY - 32).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerTelescopeDialogue();
    } else if (nearScroll) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看里程碑').setPosition(this.scrollX, this.scrollY - 60).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerScrollDialogue();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
