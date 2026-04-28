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

    // ---- Floor (laboratory tile, light gray) ----
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    g.fillStyle(0xcfd0d4, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(3, 0x8a8d96, 1);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    // Tile pattern
    g.lineStyle(1, 0xa0a3a8, 0.6);
    for (let y = 70; y < ROOM_HEIGHT - 60; y += 40) {
      g.lineBetween(60, y, ROOM_WIDTH - 60, y);
    }
    for (let x = 60; x < ROOM_WIDTH - 60; x += 40) {
      g.lineBetween(x, 70, x, ROOM_HEIGHT - 60);
    }

    // ---- North wall ----
    g.fillStyle(0x2a2e36, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- Dashboard wall (north — 3 horizontal screens with charts) ----
    this.dashX = ROOM_WIDTH / 2;
    this.dashY = 130;
    this.drawDashboardWall(this.dashX, this.dashY);

    // ---- Radar chart frame (west) ----
    this.radarX = 140;
    this.radarY = ROOM_HEIGHT / 2;
    this.drawRadarChart(this.radarX, this.radarY);

    // ---- Leaderboard (east) ----
    this.leaderX = ROOM_WIDTH - 130;
    this.leaderY = ROOM_HEIGHT / 2;
    this.drawLeaderboard(this.leaderX, this.leaderY);

    // ---- Workstation desks (center-south) ----
    this.drawWorkbench(ROOM_WIDTH / 2 - 90, ROOM_HEIGHT / 2 + 80);
    this.drawWorkbench(ROOM_WIDTH / 2 + 90, ROOM_HEIGHT / 2 + 80);

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
    this.add.text(ROOM_WIDTH / 2, 30, '— 度量阁 · 测评工作组 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#7fc090', backgroundColor: '#1a1a22aa',
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

  private drawDashboardWall(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Mounting bar
    g.fillStyle(0x4a4d56, 1);
    g.fillRect(x - 220, y - 50, 440, 6);
    // 3 dashboard screens
    const screens = [
      { offset: -150, type: 'line' },
      { offset: 0, type: 'bars' },
      { offset: 150, type: 'metrics' },
    ];
    screens.forEach((s) => {
      const sx = x + s.offset;
      // Bezel
      g.fillStyle(0x1a1a1a, 1);
      g.fillRect(sx - 60, y - 44, 120, 70);
      g.lineStyle(2, 0x4a4d56, 1);
      g.strokeRect(sx - 60, y - 44, 120, 70);
      // Screen
      g.fillStyle(0x0a0a14, 1);
      g.fillRect(sx - 56, y - 40, 112, 62);
      // Screen content
      if (s.type === 'line') {
        // Line chart (going up)
        g.lineStyle(2, 0x4ade80, 1);
        const points = [-50, -45, -38, -42, -32, -28, -20, -22, -10, -5, 8, 12];
        for (let i = 0; i < points.length - 1; i++) {
          g.lineBetween(
            sx - 50 + i * 9, y + points[i] / 2,
            sx - 50 + (i + 1) * 9, y + points[i + 1] / 2,
          );
        }
        // Y-axis
        g.lineStyle(1, 0x4a4d56, 1);
        g.lineBetween(sx - 50, y - 36, sx - 50, y + 18);
        g.lineBetween(sx - 50, y + 18, sx + 48, y + 18);
      } else if (s.type === 'bars') {
        // Bar chart
        const heights = [12, 18, 14, 28, 22, 16, 32, 24];
        heights.forEach((h, i) => {
          g.fillStyle(0x60a5fa, 0.85);
          g.fillRect(sx - 48 + i * 12, y + 16 - h, 8, h);
        });
        g.lineStyle(1, 0x4a4d56, 1);
        g.lineBetween(sx - 50, y + 16, sx + 48, y + 16);
      } else {
        // Metrics (4 large numbers)
        g.fillStyle(0xfb923c, 0.9);
        g.fillRect(sx - 50, y - 32, 48, 22);
        g.fillStyle(0x4ade80, 0.9);
        g.fillRect(sx + 4, y - 32, 48, 22);
        g.fillStyle(0xa78bfa, 0.9);
        g.fillRect(sx - 50, y - 4, 48, 22);
        g.fillStyle(0xfbbf24, 0.9);
        g.fillRect(sx + 4, y - 4, 48, 22);
      }
      // Power LED
      g.fillStyle(0x00ff00, 1);
      g.fillCircle(sx + 50, y + 20, 2);
    });
  }

  private drawRadarChart(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Frame
    g.fillStyle(0x4a4d56, 1);
    g.fillRect(x - 60, y - 70, 120, 140);
    g.lineStyle(2, 0x2a2e36, 1);
    g.strokeRect(x - 60, y - 70, 120, 140);
    // White paper
    g.fillStyle(0xf0f0f0, 1);
    g.fillRect(x - 54, y - 64, 108, 128);

    // Radar chart: 6-sided polygon with grid
    const cx = x;
    const cy = y;
    const radii = [40, 30, 20, 10];
    const angles: number[] = [];
    for (let i = 0; i < 6; i++) angles.push((i / 6) * Math.PI * 2 - Math.PI / 2);

    // Grid hexagons
    g.lineStyle(1, 0xa0a3a8, 0.6);
    radii.forEach((r) => {
      const points: number[] = [];
      angles.forEach((a) => {
        points.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      });
      g.strokePoints(points.flatMap((v, i, arr) => [v, arr[i + 1]]).filter((_, i) => i % 4 < 2), true);
    });
    // Spokes
    angles.forEach((a) => {
      g.lineBetween(cx, cy, cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
    });
    // Data polygon (mock score)
    const scores = [32, 28, 38, 22, 35, 30];
    const dataPts: Array<[number, number]> = [];
    angles.forEach((a, i) => {
      dataPts.push([cx + Math.cos(a) * scores[i], cy + Math.sin(a) * scores[i]]);
    });
    g.fillStyle(0x4ade80, 0.4);
    g.beginPath();
    g.moveTo(dataPts[0][0], dataPts[0][1]);
    for (let i = 1; i < dataPts.length; i++) g.lineTo(dataPts[i][0], dataPts[i][1]);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0x16a34a, 1);
    g.strokePath();
    // Data points
    g.fillStyle(0x16a34a, 1);
    dataPts.forEach(([px, py]) => g.fillCircle(px, py, 2.5));
  }

  private drawLeaderboard(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Frame (gold trim)
    g.fillStyle(0xb8a472, 1);
    g.fillRect(x - 50, y - 80, 100, 160);
    g.lineStyle(2, 0x6b5230, 1);
    g.strokeRect(x - 50, y - 80, 100, 160);
    // Inner panel
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 44, y - 74, 88, 148);
    // Title bar (gold)
    g.fillStyle(0xb8a472, 1);
    g.fillRect(x - 44, y - 74, 88, 16);
    // Trophy icon at top
    g.fillStyle(0xf4d35e, 1);
    g.fillTriangle(x - 6, y - 70, x + 6, y - 70, x, y - 62);

    // 6 ranking entries
    for (let i = 0; i < 6; i++) {
      const ey = y - 50 + i * 18;
      // Rank number
      g.fillStyle(i < 3 ? 0xf4d35e : 0xa0a0a0, 1);
      g.fillCircle(x - 36, ey, 5);
      // Score bar (decreasing)
      const w = 50 - i * 6;
      g.fillStyle(i < 3 ? 0xf4d35e : 0xb0b0b0, 0.7);
      g.fillRect(x - 24, ey - 3, w, 6);
      // Name line
      g.fillStyle(0x6b5230, 0.6);
      g.fillRect(x - 24, ey + 4, 20, 1.5);
    }
  }

  private drawWorkbench(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Bench top
    g.fillStyle(0xe8e4d0, 1);
    g.fillRect(x - 32, y - 14, 64, 28);
    g.lineStyle(2, 0x9a8d6c, 1);
    g.strokeRect(x - 32, y - 14, 64, 28);
    // Desktop computer (CRT-ish)
    g.fillStyle(0x2a2e36, 1);
    g.fillRect(x - 18, y - 10, 36, 24);
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 14, y - 6, 28, 16);
    // Screen content (csv data)
    g.lineStyle(1, 0x00ff00, 0.7);
    for (let i = 0; i < 5; i++) {
      g.lineBetween(x - 12, y - 4 + i * 3, x + 8, y - 4 + i * 3);
    }
    // Keyboard
    g.fillStyle(0x4a4d56, 1);
    g.fillRect(x - 16, y + 16, 32, 4);
    // Legs
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 30, y + 14, 4, 24);
    g.fillRect(x + 26, y + 14, 4, 24);
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
      name: '📊 实时仪表盘',
      lines: [
        '（3 块屏幕显示着实时数据流）',
        '',
        '#1 折线图：模型分数趋势（持续上升）',
        '#2 柱状图：8 个测评维度分布',
        '#3 关键指标：4 项核心数字（橙/绿/紫/黄）',
        '',
        '"测评不是为了打榜——是为了让结果可信。"',
      ],
    });
  }

  private triggerRadar() {
    EventBus.emit('show-dialogue', {
      name: '📐 雷达图',
      lines: [
        '（六维雷达图：编码、推理、知识、安全、对话、长文本）',
        '',
        '"模型有偏科——单一榜单容易误判。"',
        '"度量阁的标准：6 维全测，雷达呈现。"',
        '',
        '当前样本：某主流模型',
        '─ 编码 32 / 推理 28 / 知识 38',
        '─ 安全 22 / 对话 35 / 长文本 30',
      ],
    });
  }

  private triggerLeaderboard() {
    EventBus.emit('show-dialogue', {
      name: '🏆 测评榜',
      lines: [
        '（金边牌，前 3 名金色光环）',
        '',
        '"每月一更新——按 6 维加权综合分。"',
        '"前 3 名的模型一年内可被反复测试。"',
        '',
        '榜单底部：',
        '"测评数据全部公开 · 任何质疑都欢迎复测。"',
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
      this.interactHint.setText('[E] 看仪表盘').setPosition(this.dashX, this.dashY - 70).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerDash();
    } else if (distRadar < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看雷达图').setPosition(this.radarX, this.radarY - 90).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerRadar();
    } else if (distLead < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看测评榜').setPosition(this.leaderX, this.leaderY - 100).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerLeaderboard();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
