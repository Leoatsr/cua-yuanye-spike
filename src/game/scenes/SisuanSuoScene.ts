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
 * 司算所 (Sisuan Suo) — 数据工作组工坊室内
 *
 * Theme: Data analytics center.
 * Visual: huge wall of dashboards, server farm, SQL query terminal.
 */
export class SisuanSuoScene extends Phaser.Scene {
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

  private bigBoardX = 0;
  private bigBoardY = 0;
  private terminalX = 0;
  private terminalY = 0;
  private serverFarmX = 0;
  private serverFarmY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('SisuanSuo');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Floor (deep blue data center) ----
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x0a0e1a, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    g.fillStyle(0x141a26, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(3, 0x2a3146, 1);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    // Glowing grid lines
    g.lineStyle(1, 0x1f4068, 0.5);
    for (let y = 70; y < ROOM_HEIGHT - 60; y += 40) {
      g.lineBetween(60, y, ROOM_WIDTH - 60, y);
    }
    for (let x = 60; x < ROOM_WIDTH - 60; x += 40) {
      g.lineBetween(x, 70, x, ROOM_HEIGHT - 60);
    }

    // ---- North wall ----
    g.fillStyle(0x0a0e1a, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- BIG analytics board (north — full wall) ----
    this.bigBoardX = ROOM_WIDTH / 2;
    this.bigBoardY = 130;
    this.drawBigBoard(this.bigBoardX, this.bigBoardY);

    // ---- SQL query terminal (west) ----
    this.terminalX = 140;
    this.terminalY = ROOM_HEIGHT / 2;
    this.drawTerminal(this.terminalX, this.terminalY);

    // ---- Server farm (east) ----
    this.serverFarmX = ROOM_WIDTH - 130;
    this.serverFarmY = ROOM_HEIGHT / 2;
    this.drawServerFarm(this.serverFarmX, this.serverFarmY);

    // ---- Workstations ----
    this.drawAnalystDesk(ROOM_WIDTH / 2 - 90, ROOM_HEIGHT / 2 + 80);
    this.drawAnalystDesk(ROOM_WIDTH / 2 + 90, ROOM_HEIGHT / 2 + 80);

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
    this.mp = setupMultiplayer(this, 'SisuanSuo', () => this.player, () => this.currentFacing);

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
    this.add.text(ROOM_WIDTH / 2, 30, '— 司算所 · 数据工作组 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#60a5fa', backgroundColor: '#0a0e1aaa',
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

  private drawBigBoard(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Mounting bar
    g.fillStyle(0x2a3146, 1);
    g.fillRect(x - 240, y - 50, 480, 6);
    // Single huge LED panel
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 240, y - 44, 480, 80);
    g.lineStyle(3, 0x4a5466, 1);
    g.strokeRect(x - 240, y - 44, 480, 80);

    // 4 quadrants of data
    // Q1 (top-left): pie chart
    const pcx = x - 180, pcy = y - 12;
    g.fillStyle(0x60a5fa, 1);
    g.slice(pcx, pcy, 18, 0, Math.PI * 1.2);
    g.fillPath();
    g.fillStyle(0xa78bfa, 1);
    g.slice(pcx, pcy, 18, Math.PI * 1.2, Math.PI * 1.7);
    g.fillPath();
    g.fillStyle(0xfbbf24, 1);
    g.slice(pcx, pcy, 18, Math.PI * 1.7, Math.PI * 2);
    g.fillPath();
    g.lineStyle(1, 0x000000, 1);
    g.strokeCircle(pcx, pcy, 18);

    // Q2 (top-right): geo heatmap (rough world map dots)
    const dots: Array<[number, number, number]> = [
      [-110, -25, 0xf87171],
      [-90, -28, 0xfb923c],
      [-70, -20, 0xfbbf24],
      [-50, -15, 0xfb923c],
      [-30, -10, 0x60a5fa],
      [-100, -10, 0xa78bfa],
      [-120, -8, 0x4ade80],
      [-80, -5, 0xf87171],
      [-50, 5, 0x60a5fa],
      [-30, 8, 0xfbbf24],
    ];
    g.lineStyle(1, 0x4a5466, 0.5);
    g.strokeRect(x - 130, y - 38, 110, 38);
    dots.forEach(([dx, dy, color]) => {
      g.fillStyle(color, 0.85);
      g.fillCircle(x + dx, y + dy, 2);
    });

    // Q3 (bottom-left): line graph (multiline)
    g.lineStyle(2, 0x4ade80, 1);
    const line1 = [-220, -210, -195, -200, -185, -170, -160, -165, -150, -140];
    const heights1 = [22, 18, 26, 22, 30, 28, 34, 32, 36, 34];
    for (let i = 0; i < line1.length - 1; i++) {
      g.lineBetween(x + line1[i], y + (heights1[i] - 35) / 2 + 16,
        x + line1[i + 1], y + (heights1[i + 1] - 35) / 2 + 16);
    }
    g.lineStyle(2, 0xf87171, 1);
    const heights2 = [12, 16, 14, 20, 18, 24, 22, 28, 26, 30];
    for (let i = 0; i < line1.length - 1; i++) {
      g.lineBetween(x + line1[i], y + (heights2[i] - 35) / 2 + 16,
        x + line1[i + 1], y + (heights2[i + 1] - 35) / 2 + 16);
    }
    g.lineStyle(1, 0x4a5466, 1);
    g.lineBetween(x - 220, y - 4, x - 130, y - 4); // x axis
    g.lineBetween(x - 220, y - 30, x - 220, y - 4); // y axis

    // Q4 (bottom-right): KPI numbers (big colored blocks)
    const kpis = [
      { dx: -110, dy: 6, color: 0x4ade80 },   // green
      { dx: -75, dy: 6, color: 0x60a5fa },    // blue
      { dx: -110, dy: 22, color: 0xfbbf24 },  // amber
      { dx: -75, dy: 22, color: 0xf87171 },   // red
    ];
    kpis.forEach((k) => {
      g.fillStyle(k.color, 0.85);
      g.fillRect(x + k.dx - 16, y + k.dy - 6, 32, 12);
      g.lineStyle(1, k.color, 1);
      g.strokeRect(x + k.dx - 16, y + k.dy - 6, 32, 12);
    });

    // Glow LED indicators along the bottom
    for (let i = 0; i < 12; i++) {
      g.fillStyle(i % 4 === 0 ? 0x00ff00 : 0x303030, 1);
      g.fillCircle(x - 230 + i * 40, y + 30, 1.5);
    }
  }

  private drawTerminal(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Terminal cabinet
    g.fillStyle(0x18181a, 1);
    g.fillRect(x - 50, y - 60, 100, 120);
    g.lineStyle(2, 0x4a4d56, 1);
    g.strokeRect(x - 50, y - 60, 100, 120);
    // Terminal screen (CRT, green-on-black)
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 44, y - 54, 88, 70);
    // SQL query lines
    g.fillStyle(0x4ade80, 0.9);
    // First line: SELECT
    g.fillRect(x - 40, y - 49, 30, 3);
    // Second line: FROM
    g.fillRect(x - 40, y - 43, 22, 3);
    g.fillStyle(0xfbbf24, 0.9);
    g.fillRect(x - 14, y - 43, 28, 3);
    // Third line: WHERE
    g.fillStyle(0x4ade80, 0.9);
    g.fillRect(x - 40, y - 37, 26, 3);
    g.fillStyle(0xa78bfa, 0.9);
    g.fillRect(x - 12, y - 37, 18, 3);
    // Result rows
    g.fillStyle(0xc9d1d9, 0.7);
    for (let i = 0; i < 6; i++) {
      g.fillRect(x - 40, y - 28 + i * 4, 70 - i * 3, 1.5);
    }
    // Cursor (blinking)
    const cursor = this.add.graphics();
    cursor.setDepth(3);
    cursor.fillStyle(0x4ade80, 1);
    cursor.fillRect(x + 32, y - 49, 4, 3);
    this.tweens.add({
      targets: cursor, alpha: 0,
      duration: 600, yoyo: true, repeat: -1,
    });
    // Keyboard underneath
    g.fillStyle(0x4a4d56, 1);
    g.fillRect(x - 40, y + 22, 80, 12);
    g.lineStyle(1, 0x18181a, 1);
    for (let i = 0; i < 4; i++) {
      g.lineBetween(x - 36, y + 25 + i * 2, x + 36, y + 25 + i * 2);
    }
    // POWER LED
    g.fillStyle(0x00ff00, 1);
    g.fillCircle(x + 42, y - 56, 2);
  }

  private drawServerFarm(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 3 server racks side by side
    for (let r = 0; r < 3; r++) {
      const rx = x - 36 + r * 24;
      g.fillStyle(0x1a1a1a, 1);
      g.fillRect(rx - 10, y - 70, 20, 140);
      g.lineStyle(1, 0x4a4d56, 1);
      g.strokeRect(rx - 10, y - 70, 20, 140);
      // Server units
      for (let i = 0; i < 10; i++) {
        const sy = y - 66 + i * 13;
        g.fillStyle(0x2a2e36, 1);
        g.fillRect(rx - 8, sy, 16, 11);
        // LED dot (blink random)
        const ledColor = (i + r) % 3 === 0 ? 0x00ff00 :
                         (i + r) % 3 === 1 ? 0xffaa00 : 0x0080ff;
        g.fillStyle(ledColor, 1);
        g.fillCircle(rx - 5, sy + 5, 1);
      }
    }
    // Floor cable trough hint
    g.lineStyle(2, 0x4a5466, 0.5);
    g.lineBetween(x - 48, y + 76, x + 48, y + 76);
  }

  private drawAnalystDesk(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Desk
    g.fillStyle(0x2a2e36, 1);
    g.fillRect(x - 32, y - 14, 64, 28);
    g.lineStyle(1, 0x4a4d56, 1);
    g.strokeRect(x - 32, y - 14, 64, 28);
    // Dual monitor
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 22, y - 10, 18, 18);
    g.fillRect(x + 4, y - 10, 18, 18);
    // Charts on screens
    g.fillStyle(0x60a5fa, 0.7);
    g.fillRect(x - 20, y - 4, 14, 8);
    g.fillStyle(0x4ade80, 0.7);
    g.fillRect(x + 6, y - 4, 14, 8);
    // Keyboard
    g.fillStyle(0x4a4d56, 1);
    g.fillRect(x - 16, y + 16, 32, 4);
    // Legs
    g.fillStyle(0x18181a, 1);
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

  private triggerBoard() {
    EventBus.emit('show-dialogue', {
      name: '📈 大数据看板',
      lines: [
        '（4 象限实时数据滚动）',
        '',
        '左上：流量来源饼图（蓝/紫/黄）',
        '右上：地理热点分布（10 个热点）',
        '左下：双线趋势（绿增 / 红降）',
        '右下：4 个关键 KPI',
        '',
        '"数据不会撒谎——但要看人怎么读。"',
        '"司算所每周一出周报，每月一出月报。"',
      ],
    });
  }

  private triggerTerminal() {
    EventBus.emit('show-dialogue', {
      name: '💻 SQL 终端',
      lines: [
        '（绿光闪烁的 CRT 终端）',
        '',
        'SELECT user_id, sum(cv) AS total_cv',
        'FROM cv_entries',
        'WHERE earned_at > now() - interval \'30 days\'',
        'GROUP BY user_id',
        'ORDER BY total_cv DESC LIMIT 10;',
        '',
        '"——上面是查 30 日 CV 排行榜的真实查询。"',
        '（光标静静闪着）',
      ],
    });
  }

  private triggerServerFarm() {
    EventBus.emit('show-dialogue', {
      name: '🗄️ 服务器集群',
      lines: [
        '（3 排服务器机柜，30 个 LED 同时闪烁）',
        '',
        '"这是 CUA 数据基础设施。"',
        '"PostgreSQL 主从、Redis 缓存、ClickHouse 分析。"',
        '',
        '"——你玩游戏的每一次贡献，都在这里留下记录。"',
        '（绿灯持续亮着，黄灯偶尔闪一下）',
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
    const distBoard = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.bigBoardX, this.bigBoardY);
    const distTerm = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.terminalX, this.terminalY);
    const distFarm = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.serverFarmX, this.serverFarmY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distBoard < INTERACT_DISTANCE * 1.8) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看大看板').setPosition(this.bigBoardX, this.bigBoardY - 60).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBoard();
    } else if (distTerm < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 用 SQL 终端').setPosition(this.terminalX, this.terminalY - 80).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerTerminal();
    } else if (distFarm < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看服务器').setPosition(this.serverFarmX, this.serverFarmY - 90).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerServerFarm();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
