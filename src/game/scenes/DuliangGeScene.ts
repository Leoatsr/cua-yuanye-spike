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
 * 度量阁 (Duliang Ge) — 测评工作组工坊室内
 *
 * Theme: AI model evaluation lab.
 * Visual: dashboards, radar charts on the wall, benchmark workstation.
 */
export class DuliangGeScene extends Phaser.Scene {
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

  private dashX = 0;
  private dashY = 0;
  private radarX = 0;
  private radarY = 0;
  private leaderX = 0;
  private leaderY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('DuliangGe');
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

    // ---- Wave 7.K 主道具：雷达图墙 (北墙居中 · 占 dashX/Y) ----
    this.dashX = ROOM_WIDTH / 2;
    this.dashY = 120;
    this.drawDashboardWall(this.dashX, this.dashY);

    // ---- Wave 7.K 中央桌：天平砝码 (E 看跑分表 · 占 radarX/Y) ----
    this.radarX = ROOM_WIDTH / 2;
    this.radarY = ROOM_HEIGHT / 2 + 20;
    this.drawRadarChart(this.radarX, this.radarY);

    // ---- Wave 7.K 副件 R：试管架 (东墙 · 占 leaderX/Y) ----
    this.leaderX = ROOM_WIDTH - 110;
    this.leaderY = ROOM_HEIGHT / 2 + 30;
    this.drawLeaderboard(this.leaderX, this.leaderY);

    // ---- Wave 7.K 副件 L：盆栽 (西墙 · 用 drawWorkbench 改写) ----
    this.drawWorkbench(110, ROOM_HEIGHT / 2 + 30);

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
    this.mp = setupMultiplayer(this, 'DuliangGe', () => this.player, () => this.currentFacing);

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
    this.add.text(ROOM_WIDTH / 2, 80, '— 测评工坊 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#854f0b', backgroundColor: '#fdf0cfee',
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

  // ============ DRAWING (Wave 7.K · 4 区精简 · 保留方法名兼容旧 update) ============

  /** 主道具：雷达图墙 (北墙居中 · 占 dashX/Y) */
  private drawDashboardWall(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 暖木外框
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 88, y - 28, 176, 56);
    // 卡其主题色边
    g.fillStyle(0xbfa66a, 1);
    g.fillRect(x - 84, y - 24, 168, 48);
    // 米色挂板
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 80, y - 20, 160, 40);
    // 顶部标签条
    g.fillStyle(0x854f0b, 1);
    g.fillRect(x - 80, y - 20, 160, 6);
    // 雷达图 (5 边形 · 左半)
    const cx = x - 50, cy = y + 4, r = 14;
    const angles: number[] = [];
    for (let i = 0; i < 5; i++) angles.push((i / 5) * Math.PI * 2 - Math.PI / 2);
    // 边框 + spokes
    g.lineStyle(1, 0x854f0b, 0.6);
    for (let i = 0; i < 5; i++) {
      const x1 = cx + Math.cos(angles[i]) * r;
      const y1 = cy + Math.sin(angles[i]) * r;
      const x2 = cx + Math.cos(angles[(i + 1) % 5]) * r;
      const y2 = cy + Math.sin(angles[(i + 1) % 5]) * r;
      g.lineBetween(x1, y1, x2, y2);
      g.lineBetween(cx, cy, x1, y1);
    }
    // 评分多边形 (绿)
    g.fillStyle(0x97c459, 0.5);
    const scores = [0.85, 0.9, 0.7, 0.8, 0.75];
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const px = cx + Math.cos(angles[i]) * r * scores[i];
      const py = cy + Math.sin(angles[i]) * r * scores[i];
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
    // 评分数据点
    g.fillStyle(0x639922, 1);
    for (let i = 0; i < 5; i++) {
      const px = cx + Math.cos(angles[i]) * r * scores[i];
      const py = cy + Math.sin(angles[i]) * r * scores[i];
      g.fillCircle(px, py, 1.5);
    }
    // 右侧条形分数条 (4 条)
    for (let i = 0; i < 4; i++) {
      const cy2 = y - 8 + i * 8;
      // 标签点
      g.fillStyle(0x854f0b, 1);
      g.fillCircle(x - 4, cy2, 1.5);
      // 满槽 (米黄底)
      g.fillStyle(0xc9a55b, 0.4);
      g.fillRect(x + 4, cy2 - 2, 60, 4);
      // 分数填充 (绿)
      const w = 30 + i * 7;
      g.fillStyle(0x639922, 1);
      g.fillRect(x + 4, cy2 - 2, w, 4);
    }
  }

  /**
   * 中央桌：天平砝码 (E 看跑分表)
   * 占用 radarX/Y 字段（保留 · 实现重写）
   */
  private drawRadarChart(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 桌面 (暖木)
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 50, y - 18, 100, 36);
    g.fillStyle(0xa0673b, 1);
    g.fillRect(x - 48, y - 16, 96, 32);
    // 天平底座
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 4, y - 4, 8, 12);
    // 横梁
    g.fillRect(x - 30, y - 6, 60, 2);
    // 左托盘悬挂线
    g.lineStyle(1, 0x5d3a1a, 1);
    g.lineBetween(x - 28, y - 6, x - 26, y - 2);
    g.lineBetween(x + 28, y - 6, x + 26, y - 2);
    // 左托盘 (卡其)
    g.fillStyle(0xbfa66a, 1);
    g.fillRect(x - 32, y - 2, 12, 4);
    // 砝码 (堆叠 2 个)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 30, y - 4, 8, 2);
    g.fillRect(x - 28, y - 7, 4, 3);
    // 右托盘 (卡其)
    g.fillStyle(0xbfa66a, 1);
    g.fillRect(x + 20, y - 2, 12, 4);
    // 右托盘的小金币 (1 个)
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x + 26, y - 4, 2);
    // 桌前一份记录 (米色纸 + 卡其条)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 22, y + 6, 44, 10);
    g.fillStyle(0x854f0b, 1);
    g.fillRect(x - 22, y + 6, 44, 2);
    g.fillStyle(0x854f0b, 0.5);
    g.fillRect(x - 18, y + 11, 30, 1);
    // 桌脚
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 48, y + 18, 4, 14);
    g.fillRect(x + 44, y + 18, 4, 14);
  }

  /**
   * 副件 R：试管架 (东墙 · 占 leaderX/Y)
   * 占用 leaderX/Y 字段（保留 · 实现重写）
   */
  private drawLeaderboard(x: number, y: number) {
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
    // 上层 3 个试管
    const tubeColors = [0xc0392b, 0x97c459, 0x378ADD];  // 红/绿/蓝
    for (let i = 0; i < 3; i++) {
      const tx = x - 12 + i * 12;
      // 试管玻璃 (浅蓝 半透)
      g.fillStyle(0xe6f1fb, 0.4);
      g.fillRect(tx - 3, y - 30, 6, 18);
      // 液体
      g.fillStyle(tubeColors[i], 1);
      g.fillRect(tx - 2, y - 22, 4, 10);
      // 试管圆底
      g.fillStyle(tubeColors[i], 1);
      g.fillCircle(tx, y - 12, 2);
      // 试管口浅色
      g.fillStyle(0xfdf0cf, 1);
      g.fillRect(tx - 3, y - 30, 6, 1);
    }
    // 中层装饰：实验数据本
    g.fillStyle(0xbfa66a, 1);
    g.fillRect(x - 14, y - 8, 28, 18);
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 12, y - 6, 24, 4);
    g.fillStyle(0x854f0b, 0.5);
    g.fillRect(x - 10, y - 1, 20, 1);
    g.fillRect(x - 10, y + 2, 16, 1);
    g.fillRect(x - 10, y + 5, 18, 1);
    // 底层文件夹
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 16, y + 14, 32, 18);
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 14, y + 16, 28, 4);
  }

  /** 副件 L：盆栽 (西墙 · drawWorkbench 改写为通用盆栽) */
  private drawWorkbench(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 陶盆
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 14, y + 4, 28, 22);
    g.fillStyle(0x8b6f3a, 1);
    g.fillRect(x - 12, y + 6, 24, 18);
    // 盆顶土
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 12, y + 4, 24, 4);
    // 叶
    g.fillStyle(0x3b6d11, 1);
    g.fillCircle(x - 8, y - 4, 6);
    g.fillCircle(x + 8, y - 4, 6);
    g.fillCircle(x, y - 12, 7);
    g.fillCircle(x - 4, y + 2, 5);
    g.fillCircle(x + 4, y + 2, 5);
    // 高光
    g.fillStyle(0x639922, 1);
    g.fillCircle(x - 2, y - 14, 3);
    g.fillCircle(x + 6, y - 6, 2);
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

  private triggerDash() {
    EventBus.emit('show-dialogue', {
      name: '📐 雷达图墙',
      lines: [
        '（墙上雷达五维评分图 + 4 条进度条）',
        '',
        '"测评的核心：把模糊的「好」变成可量化的数字。"',
        '"5 维：编码 / 推理 / 知识 / 对话 / 安全"',
        '',
        '当前样本：编码 85 / 推理 90 / 知识 70',
        '         对话 80 / 安全 75',
      ],
    });
  }

  private triggerRadar() {
    EventBus.emit('show-dialogue', {
      name: '⚖ 跑分天平',
      lines: [
        '（你低头看到桌上摆着天平）',
        '',
        '"一边砝码（标准），一边金币（待测）——直到天平水平，分数就出来了。"',
        '',
        '（桌前那张记录单写着）',
        '"测评数据全部公开 · 任何质疑都欢迎复测。"',
      ],
    });
  }

  private triggerLeaderboard() {
    EventBus.emit('show-dialogue', {
      name: '🧪 试管样本',
      lines: [
        '（红/绿/蓝 3 个试管 · 不同的待测样本）',
        '',
        '"红 = 待测 · 绿 = 通过 · 蓝 = 复测中。"',
        '',
        '"每个样本都要跑完 5 维测评，才能上榜。"',
        '架上还有数据本，记录着每月新样本。',
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
    const distDash = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.dashX, this.dashY);
    const distRadar = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.radarX, this.radarY);
    const distLead = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.leaderX, this.leaderY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distDash < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看雷达图').setPosition(this.dashX, this.dashY + 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerDash();
    } else if (distRadar < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看跑分表').setPosition(this.radarX, this.radarY - 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerRadar();
    } else if (distLead < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看试管').setPosition(this.leaderX, this.leaderY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerLeaderboard();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
