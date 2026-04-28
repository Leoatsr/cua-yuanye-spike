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
 * 开源楼 (Kaiyuan Lou) — 开源工作组工坊室内
 *
 * Theme: GitHub-style open source collaboration hub.
 * Visual: monitor wall, server rack, code visualization board.
 */
export class KaiyuanLouScene extends Phaser.Scene {
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

  private monitorsX = 0;
  private monitorsY = 0;
  private serverX = 0;
  private serverY = 0;
  private boardX = 0;
  private boardY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('KaiyuanLou');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Floor (tech-cool dark gray) ----
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // Inner floor — anti-static gray with grid
    g.fillStyle(0x2a2e36, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(3, 0x3a3e48, 1);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    // Grid lines
    g.lineStyle(1, 0x383c46, 0.5);
    for (let y = 70; y < ROOM_HEIGHT - 60; y += 32) {
      g.lineBetween(60, y, ROOM_WIDTH - 60, y);
    }
    for (let x = 60; x < ROOM_WIDTH - 60; x += 32) {
      g.lineBetween(x, 70, x, ROOM_HEIGHT - 60);
    }

    // ---- North wall (with brand banner) ----
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);
    // Github-style green banner
    g.fillStyle(0x2da44e, 1);
    g.fillRect(ROOM_WIDTH / 2 - 80, 56, 160, 6);

    // ---- Monitor wall (north — 4 monitors with glow) ----
    this.monitorsX = ROOM_WIDTH / 2;
    this.monitorsY = 130;
    this.drawMonitorWall(this.monitorsX, this.monitorsY);

    // ---- Server rack (east) ----
    this.serverX = ROOM_WIDTH - 130;
    this.serverY = ROOM_HEIGHT / 2 + 30;
    this.drawServerRack(this.serverX, this.serverY);

    // ---- Git flow board (west) ----
    this.boardX = 140;
    this.boardY = ROOM_HEIGHT / 2 + 30;
    this.drawGitBoard(this.boardX, this.boardY);

    // ---- Workstation desks ----
    this.drawWorkDesk(ROOM_WIDTH / 2 - 100, ROOM_HEIGHT / 2 + 80);
    this.drawWorkDesk(ROOM_WIDTH / 2 + 100, ROOM_HEIGHT / 2 + 80);

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
    this.mp = setupMultiplayer(this, 'KaiyuanLou', () => this.player, () => this.currentFacing);

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

    // ---- Exit door ----
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
    this.add.text(ROOM_WIDTH / 2, 30, '— 开源楼 · 开源工作组 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#7fc090', backgroundColor: '#1a1a22aa',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    // ---- Hints ----
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

  private drawMonitorWall(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Long mounting bracket
    g.fillStyle(0x4a4d56, 1);
    g.fillRect(x - 220, y - 50, 440, 6);
    // 4 monitors side by side
    const mWidth = 90, mHeight = 56, gap = 14;
    const startX = x - (4 * mWidth + 3 * gap) / 2;
    for (let i = 0; i < 4; i++) {
      const mx = startX + i * (mWidth + gap);
      // Bezel
      g.fillStyle(0x1a1a1a, 1);
      g.fillRect(mx, y - 44, mWidth, mHeight);
      g.lineStyle(2, 0x4a4d56, 1);
      g.strokeRect(mx, y - 44, mWidth, mHeight);
      // Screen content (different per monitor)
      g.fillStyle(0x0d1117, 1);  // GitHub dark
      g.fillRect(mx + 4, y - 40, mWidth - 8, mHeight - 8);
      // Mock UI elements
      if (i === 0) {
        // PR list
        g.fillStyle(0x238636, 0.8);
        g.fillRect(mx + 8, y - 35, mWidth - 16, 6);
        g.fillStyle(0x1f6feb, 0.7);
        g.fillRect(mx + 8, y - 27, mWidth - 16, 4);
        g.fillRect(mx + 8, y - 21, mWidth - 24, 4);
        g.fillRect(mx + 8, y - 15, mWidth - 30, 4);
      } else if (i === 1) {
        // Code (rainbow lines)
        g.fillStyle(0xc9d1d9, 0.7);
        g.fillRect(mx + 8, y - 35, mWidth - 28, 3);
        g.fillStyle(0xff7b72, 0.7);
        g.fillRect(mx + 12, y - 30, mWidth - 36, 3);
        g.fillStyle(0xa5d6ff, 0.7);
        g.fillRect(mx + 16, y - 25, mWidth - 40, 3);
        g.fillStyle(0xd2a8ff, 0.7);
        g.fillRect(mx + 12, y - 20, mWidth - 32, 3);
        g.fillStyle(0xc9d1d9, 0.5);
        g.fillRect(mx + 8, y - 15, mWidth - 26, 3);
      } else if (i === 2) {
        // Graph (commits)
        g.fillStyle(0x2da44e, 0.8);
        const heights = [10, 14, 8, 18, 22, 12, 16];
        heights.forEach((h, idx) => {
          g.fillRect(mx + 10 + idx * 10, y - 14 - h, 6, h);
        });
      } else {
        // Issues count + activity
        g.fillStyle(0xfb950099, 1);
        g.fillRect(mx + 8, y - 36, 24, 10);
        g.fillStyle(0x2da44e99, 1);
        g.fillRect(mx + 36, y - 36, 24, 10);
        g.fillStyle(0xc9d1d9, 0.6);
        g.fillRect(mx + 8, y - 22, mWidth - 16, 2);
        g.fillRect(mx + 8, y - 18, mWidth - 24, 2);
        g.fillRect(mx + 8, y - 14, mWidth - 30, 2);
      }
      // Power LED (green)
      g.fillStyle(0x00ff00, 1);
      g.fillCircle(mx + mWidth - 8, y + 8, 2);
    }
  }

  private drawServerRack(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Cabinet
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(x - 32, y - 80, 64, 160);
    g.lineStyle(2, 0x4a4d56, 1);
    g.strokeRect(x - 32, y - 80, 64, 160);
    // 8 server units stacked
    for (let i = 0; i < 8; i++) {
      const sy = y - 76 + i * 19;
      g.fillStyle(0x2a2e36, 1);
      g.fillRect(x - 28, sy, 56, 16);
      g.lineStyle(1, 0x4a4d56, 1);
      g.strokeRect(x - 28, sy, 56, 16);
      // LEDs
      const ledColor = (i % 3 === 0) ? 0x00ff00 : (i % 3 === 1 ? 0xffaa00 : 0x0080ff);
      g.fillStyle(ledColor, 1);
      g.fillCircle(x - 22, sy + 8, 2);
      g.fillCircle(x - 16, sy + 8, 2);
      // Vent slots
      g.lineStyle(1, 0x1a1a1a, 1);
      for (let v = 0; v < 4; v++) {
        g.lineBetween(x + 4 + v * 5, sy + 4, x + 4 + v * 5, sy + 12);
      }
    }
  }

  private drawGitBoard(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Frame
    g.fillStyle(0x4a4d56, 1);
    g.fillRect(x - 50, y - 70, 100, 140);
    g.lineStyle(2, 0x2a2e36, 1);
    g.strokeRect(x - 50, y - 70, 100, 140);
    // Whiteboard surface
    g.fillStyle(0xf0f0f0, 1);
    g.fillRect(x - 44, y - 64, 88, 128);
    // Git branch visualization (simplified)
    g.lineStyle(2, 0x2da44e, 1);
    g.lineBetween(x - 30, y - 50, x - 30, y + 50);  // main
    g.lineStyle(2, 0xfb9500, 1);
    g.lineBetween(x - 10, y - 30, x - 10, y + 20);  // feat
    g.lineStyle(2, 0x1f6feb, 1);
    g.lineBetween(x + 10, y - 10, x + 10, y + 30);  // fix
    // Commit dots
    g.fillStyle(0x2da44e, 1);
    [-40, -20, 0, 20, 40].forEach((dy) => g.fillCircle(x - 30, y + dy, 3));
    g.fillStyle(0xfb9500, 1);
    [-25, -5, 15].forEach((dy) => g.fillCircle(x - 10, y + dy, 3));
    g.fillStyle(0x1f6feb, 1);
    [-5, 15, 25].forEach((dy) => g.fillCircle(x + 10, y + dy, 3));
    // Merge connectors
    g.lineStyle(1, 0xa0a0a0, 0.7);
    g.lineBetween(x - 10, y - 30, x - 30, y - 25);
    g.lineBetween(x - 10, y + 20, x - 30, y + 22);
    g.lineBetween(x + 10, y - 10, x - 10, y - 5);
  }

  private drawWorkDesk(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Desk top
    g.fillStyle(0x4a4d56, 1);
    g.fillRect(x - 32, y - 14, 64, 28);
    g.lineStyle(2, 0x2a2e36, 1);
    g.strokeRect(x - 32, y - 14, 64, 28);
    // Laptop
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(x - 16, y - 10, 32, 20);
    g.fillStyle(0x0d1117, 1);
    g.fillRect(x - 14, y - 8, 28, 16);
    // Code on screen
    g.lineStyle(1, 0x2da44e, 0.8);
    g.lineBetween(x - 12, y - 4, x + 4, y - 4);
    g.lineBetween(x - 12, y, x + 8, y);
    g.lineBetween(x - 12, y + 4, x - 2, y + 4);
    // Apple logo (white circle)
    g.fillStyle(0xc9d1d9, 0.6);
    g.fillCircle(x, y, 2);
    // Legs
    g.fillStyle(0x2a2e36, 1);
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

  private triggerMonitors() {
    EventBus.emit('show-dialogue', {
      name: '🖥️ 监控大屏',
      lines: [
        '（4 块屏幕同时显示 GitHub 数据）',
        '',
        '#1: Pull Request 排队中 · 23 件',
        '#2: 最新代码提交（彩虹高亮）',
        '#3: 最近 7 日 commit 柱状图',
        '#4: 24 件未结 Issue · 3 件本周新增',
        '',
        '"开源不在于「看」，在于「参与」。"',
        '"想动手——欢迎在 GitHub 上提 PR。"',
      ],
    });
  }

  private triggerServer() {
    EventBus.emit('show-dialogue', {
      name: '🗄️ 服务器机柜',
      lines: [
        '（机柜里 8 台服务器嗡嗡作响）',
        '',
        '"CUA 自托管的开源项目都跑在这。"',
        '"网页、机器人、API、数据库——都是社区维护。"',
        '',
        '（你看到一台贴着 "CUA-PRIMARY" 的机器灯亮着绿）',
        '──这就是你正在玩的游戏的 host。',
      ],
    });
  }

  private triggerBoard() {
    EventBus.emit('show-dialogue', {
      name: '📊 Git 流程图',
      lines: [
        '（白板上画着分支模型）',
        '',
        '绿线：main 主干 · 5 commits',
        '橙线：feat 分支 · 3 commits',
        '蓝线：fix 分支 · 3 commits',
        '',
        '"功能在 feat 上做、修复在 fix 上做、合到 main。"',
        '"——这就是 git flow 最简版本。"',
        '',
        '（旁边写着）"提 PR 之前先 rebase。"',
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
    const distMon = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.monitorsX, this.monitorsY);
    const distSrv = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.serverX, this.serverY);
    const distBoard = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boardX, this.boardY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distMon < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看监控大屏').setPosition(this.monitorsX, this.monitorsY - 70).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerMonitors();
    } else if (distSrv < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看服务器').setPosition(this.serverX, this.serverY - 90).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerServer();
    } else if (distBoard < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看流程图').setPosition(this.boardX, this.boardY - 80).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBoard();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
