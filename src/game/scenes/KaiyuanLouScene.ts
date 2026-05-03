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
    // Wave 7.K · 改用横向木板缝（不再是格子网）· 每 64px 一条
    g.lineStyle(1, 0xc9a55b, 0.3);
    for (let y = 102; y < ROOM_HEIGHT - 60; y += 64) {
      g.lineBetween(64, y, ROOM_WIDTH - 64, y);
    }

    // ---- 北墙顶梁 (Wave 7.K · 暖木) ----
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- Wave 7.K 主道具：PR 通知灯墙（北墙居中 · 紧凑）----
    this.monitorsX = ROOM_WIDTH / 2;
    this.monitorsY = 120;
    this.drawPRWall(this.monitorsX, this.monitorsY);

    // ---- Wave 7.K 工作桌（中央 · E 翻代码笔记）----
    this.serverX = ROOM_WIDTH / 2;
    this.serverY = ROOM_HEIGHT / 2 + 20;
    this.drawCenterDesk(this.serverX, this.serverY);

    // ---- Wave 7.K 副件 L：开源协议书架（西墙）----
    this.boardX = 110;
    this.boardY = ROOM_HEIGHT / 2 + 30;
    this.drawShelf(this.boardX, this.boardY);

    // ---- Wave 7.K 副件 R：盆栽（东墙）----
    this.drawPlant(ROOM_WIDTH - 110, ROOM_HEIGHT / 2 + 30);

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
    this.add.text(ROOM_WIDTH / 2, 80, '— 开源工坊 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#3b6d11', backgroundColor: '#fdf0cfee',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    // ---- Hints ----
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

  // ============ DRAWING (Wave 7.K · 4 区精简) ============

  /**
   * 主道具：PR 通知灯墙 (北墙居中)
   * 4 个绿/橙 LED 状态点 + 标签 · 占北墙中央 1/3
   */
  private drawPRWall(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 木框
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 88, y - 28, 176, 56);
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 84, y - 24, 168, 48);
    // 米色挂板
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 80, y - 20, 160, 40);
    // 顶部"PULL REQUESTS"标签条 (绿)
    g.fillStyle(0x3b6d11, 1);
    g.fillRect(x - 80, y - 20, 160, 8);
    // 4 个 PR 状态条 (绿/绿/橙/绿)
    const colors = [0x639922, 0x639922, 0xba7517, 0x639922];
    const labels = colors.length;
    for (let i = 0; i < labels; i++) {
      const cy = y - 7 + i * 7;
      // LED 灯
      g.fillStyle(colors[i], 1);
      g.fillCircle(x - 72, cy, 2);
      // 文字假装条
      g.fillStyle(0x6b5230, 0.7);
      g.fillRect(x - 64, cy - 1, 80, 2);
      // 右侧时间戳条
      g.fillStyle(0x9c7c54, 0.5);
      g.fillRect(x + 30, cy - 1, 36, 2);
    }
  }

  /**
   * 中央工作桌 - 单个键盘 + 笔记本（E 翻代码笔记）
   */
  private drawCenterDesk(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 桌面 (暖木)
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 50, y - 18, 100, 36);
    g.fillStyle(0xa0673b, 1);
    g.fillRect(x - 48, y - 16, 96, 32);
    // 键盘
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 22, y + 2, 44, 12);
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 20, y + 4, 40, 8);
    // 键帽点（米色）
    g.fillStyle(0xfdf0cf, 1);
    for (let i = 0; i < 4; i++) {
      g.fillRect(x - 18 + i * 10, y + 6, 6, 2);
    }
    // 笔记本（合上的 · 上方）
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 18, y - 13, 36, 12);
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 16, y - 11, 32, 8);
    // 笔记本封面绿色书签
    g.fillStyle(0x3b6d11, 1);
    g.fillRect(x - 4, y - 13, 6, 14);
    // 桌脚
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 48, y + 18, 4, 14);
    g.fillRect(x + 44, y + 18, 4, 14);
  }

  /**
   * 副件 L：开源协议书架（西墙）
   */
  private drawShelf(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 木架（窄）
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 22, y - 36, 44, 72);
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 20, y - 34, 40, 68);
    // 3 层隔板
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 20, y - 12, 40, 2);
    g.fillRect(x - 20, y + 10, 40, 2);
    // 协议书 3 本（顶层 · Apache MIT GPL · 不同色书脊）
    const books = [0x639922, 0x378ADD, 0xD85A30];  // 绿/蓝/橙
    for (let i = 0; i < 3; i++) {
      g.fillStyle(books[i], 1);
      g.fillRect(x - 16 + i * 12, y - 32, 8, 18);
      // 书脊深色细线
      g.fillStyle(0x2a1e10, 1);
      g.fillRect(x - 16 + i * 12, y - 32, 8, 1);
      g.fillRect(x - 16 + i * 12, y - 15, 8, 1);
    }
    // 中层 · 装饰瓶
    g.fillStyle(0x9c7c54, 1);
    g.fillRect(x - 6, y - 8, 12, 18);
    g.fillStyle(0x3b6d11, 1);
    g.fillCircle(x, y - 10, 2);
    // 底层 · 文件夹
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 16, y + 14, 32, 18);
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 14, y + 16, 28, 4);
  }

  /**
   * 副件 R：盆栽（东墙 · 生命气息）
   */
  private drawPlant(x: number, y: number) {
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
    // 叶 · 多片错落
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

  private triggerMonitors() {
    EventBus.emit('show-dialogue', {
      name: '🟢 PR 通知墙',
      lines: [
        '（4 个 LED 闪烁 · 显示当前 PR 状态）',
        '',
        '🟢 #142 add docs · ready to merge',
        '🟢 #138 fix lint · ready to merge',
        '🟠 #131 refactor api · review needed',
        '🟢 #128 update deps · ready to merge',
        '',
        '"开源不在于「看」，在于「参与」。"',
        '"想动手——欢迎在 GitHub 上提 PR。"',
      ],
    });
  }

  private triggerServer() {
    EventBus.emit('show-dialogue', {
      name: '📓 代码笔记',
      lines: [
        '（你翻开桌上的笔记本）',
        '',
        '"读代码 · 不要从 README 开始，从 main 函数开始。"',
        '"提 PR · rebase 一下，让 commit 干净。"',
        '"评 review · 先说优点，再说改进。"',
        '',
        '（封面那枚绿色书签写着）"open source is craft."',
      ],
    });
  }

  private triggerBoard() {
    EventBus.emit('show-dialogue', {
      name: '📚 开源协议',
      lines: [
        '（书架上 3 本协议书 · 不同色书脊）',
        '',
        '🟢 Apache 2.0 · 商用友好、专利保护',
        '🔵 MIT · 极简自由、几乎无限制',
        '🟠 GPL v3 · 强 copyleft、衍生品也开源',
        '',
        '"协议不是法律陷阱，是你对世界说话的方式。"',
        '"——选哪个，看你想让世界怎样使用你的代码。"',
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
      this.interactHint.setText('[E] 看 PR 状态').setPosition(this.monitorsX, this.monitorsY + 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerMonitors();
    } else if (distSrv < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 翻代码笔记').setPosition(this.serverX, this.serverY - 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerServer();
    } else if (distBoard < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看协议书').setPosition(this.boardX, this.boardY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBoard();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
