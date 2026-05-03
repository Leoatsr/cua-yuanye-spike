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
 * Wave 10 · 自家小屋 (Home)
 *
 * 方向 2 · 纪念墙为重 · 顶梁暖橙 (家炉感)
 *
 * 布局:
 *   - 北墙居中: 5 框纪念墙 (TODO: 后续对接个人中心历史任务前 5 条)
 *   - 西墙: 床 (竖放 · 红被 + 米枕)
 *   - 中央: 书桌 + 椅
 *   - 东南角: 壁炉 (橙黄火光闪烁)
 *   - 南墙中央: 门
 *
 * 互动 4:
 *   - 纪念墙 (意境化 · 暂留空)
 *   - 床 (歇会儿)
 *   - 书桌 (写日志)
 *   - 壁炉 (烤火 · 火光强弱切换)
 *
 * 出口: [E] 回 'Main' (萌芽镇)
 *
 * 重写说明:
 *   - 旧版走 home.json tilemap 路线 (Wave 7.G)
 *   - v2 改 graphics customScene · 跟阿降+典籍阁+铁匠铺一脉
 */
export class HomeScene extends Phaser.Scene {
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
  private memorialX = 360;
  private memorialY = 145;
  private bedX = 110;
  private bedY = 290;
  private deskX = 360;
  private deskY = 305;
  private fireplaceX = 600;
  private fireplaceY = 380;

  private exitX = 0;
  private exitY = 0;

  // 壁炉火光
  private fireplaceFlame: Phaser.GameObjects.Arc | null = null;
  private fireplaceCore: Phaser.GameObjects.Arc | null = null;
  private fireplaceGlow: Phaser.GameObjects.Graphics | null = null;
  private fireplaceBright = true;
  private flameTimer = 0;

  private exitHint!: Phaser.GameObjects.Text;
  private interactHint!: Phaser.GameObjects.Text;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('Home');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
    this.fireplaceBright = true;
    this.flameTimer = 0;
    this.fireplaceFlame = null;
    this.fireplaceCore = null;
    this.fireplaceGlow = null;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    bgmManager.stop(this); // 内景静默
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Floor (跟 GongdeTang 一脉) ----
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x8b4513, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(3, 0x5d3a1a, 1);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(1, 0xc9a55b, 0.3);
    for (let y = 102; y < ROOM_HEIGHT - 60; y += 64) {
      g.lineBetween(64, y, ROOM_WIDTH - 64, y);
    }

    // ---- 北墙顶梁 (暖橙) ----
    g.fillStyle(0xc97a3a, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- 道具 ----
    this.drawMemorialWall(this.memorialX, this.memorialY);
    this.drawBed(this.bedX, this.bedY);
    this.drawDesk(this.deskX, this.deskY);
    this.drawFireplace(this.fireplaceX, this.fireplaceY);

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
    // 纪念墙 (北墙挂件)
    walls.add(this.add.rectangle(this.memorialX, this.memorialY, 380, 70, 0, 0));
    // 床
    walls.add(this.add.rectangle(this.bedX, this.bedY, 50, 130, 0, 0));
    // 书桌
    walls.add(this.add.rectangle(this.deskX, this.deskY - 4, 140, 50, 0, 0));
    // 椅
    walls.add(this.add.rectangle(this.deskX, this.deskY + 40, 30, 30, 0, 0));
    // 壁炉
    walls.add(this.add.rectangle(this.fireplaceX, this.fireplaceY, 50, 70, 0, 0));
    this.physics.add.collider(this.player, walls);

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    this.mp = setupMultiplayer(this, 'Home', () => this.player, () => this.currentFacing);
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

    // ---- Exit (南门) ----
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
    this.add.text(ROOM_WIDTH / 2, 80, '— 自家小屋 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#a05a35', backgroundColor: '#fdf0cfee',
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

  /**
   * 北墙居中 · 5 框纪念墙
   * TODO: 对接个人中心历史任务前 5 条 · 现暂空
   */
  private drawMemorialWall(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 米色板 (380×70)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 190, y - 35, 380, 70);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - 190, y - 35, 380, 70);
    // 内边深木线
    g.lineStyle(1, 0x8b5a2b, 0.5);
    g.strokeRect(x - 184, y - 29, 368, 58);

    // 5 个红框 (居中均匀分布)
    const frameW = 50;
    const frameH = 44;
    const gap = 16;
    const totalW = frameW * 5 + gap * 4;
    const startX = x - totalW / 2;
    for (let i = 0; i < 5; i++) {
      const fx = startX + i * (frameW + gap);
      const fy = y - frameH / 2;
      // 框背景 (浅米)
      g.fillStyle(0xfaecc4, 1);
      g.fillRect(fx, fy, frameW, frameH);
      // 红外框
      g.lineStyle(2, 0xa32d2d, 1);
      g.strokeRect(fx, fy, frameW, frameH);
      // 内框金线
      g.lineStyle(0.8, 0xdaa520, 0.7);
      g.strokeRect(fx + 4, fy + 4, frameW - 8, frameH - 8);
      // 顶部小金牌挂坠
      g.fillStyle(0xdaa520, 1);
      g.fillRect(fx + frameW / 2 - 4, fy - 3, 8, 4);
      // 框中心问号 (待往事铭刻)
      g.lineStyle(1, 0xc89a4a, 0.6);
      const cx = fx + frameW / 2;
      const cy = fy + frameH / 2;
      g.strokeCircle(cx - 1, cy - 4, 4);
      g.lineBetween(cx - 1, cy + 1, cx - 1, cy + 4);
      g.fillStyle(0xc89a4a, 0.6);
      g.fillCircle(cx - 1, cy + 7, 0.8);
    }

    // 标牌
    this.add.text(x, y - 50, '纪念墙', {
      fontFamily: 'serif', fontSize: '10px',
      color: '#a05a35', backgroundColor: '#fdf0cfee',
      padding: { left: 6, right: 6, top: 1, bottom: 1 },
    }).setOrigin(0.5).setDepth(3);
  }

  /** 西墙竖放床 (红被 + 米枕) */
  private drawBed(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 床架 (暖木)
    g.fillStyle(0x8b5a2b, 1);
    g.fillRect(x - 22, y - 65, 44, 130);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - 22, y - 65, 44, 130);
    // 床头 (北端 · 高一点)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 22, y - 75, 44, 12);
    // 红被 (中间大部分)
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x - 18, y - 50, 36, 100);
    // 红被花纹 (暗红条)
    g.fillStyle(0x7a2020, 1);
    g.fillRect(x - 18, y - 30, 36, 3);
    g.fillRect(x - 18, y, 36, 3);
    g.fillRect(x - 18, y + 30, 36, 3);
    // 米色枕 (北端)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 16, y - 60, 32, 12);
    g.lineStyle(1, 0x5d3a1a, 1);
    g.strokeRect(x - 16, y - 60, 32, 12);
  }

  /** 中央书桌 + 椅 */
  private drawDesk(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 桌面 (米色 · 暖木边)
    g.fillStyle(0xe8c98a, 1);
    g.fillRect(x - 70, y - 25, 140, 50);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - 70, y - 25, 140, 50);
    // 抽屉横线
    g.lineStyle(1, 0x5d3a1a, 0.5);
    g.lineBetween(x - 70, y, x + 70, y);
    g.lineBetween(x, y, x, y + 25);
    // 桌脚
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 68, y + 23, 4, 10);
    g.fillRect(x + 64, y + 23, 4, 10);
    // 砚台 (左)
    g.fillStyle(0x2a2a2a, 1);
    g.fillEllipse(x - 50, y - 8, 18, 10);
    // 笔
    g.lineStyle(2, 0x5d3a1a, 1);
    g.lineBetween(x - 38, y - 10, x - 24, y - 22);
    // 一摞书 (右)
    const bookColors = [0x3b6d11, 0x4a3a6a, 0xa32d2d];
    for (let i = 0; i < 3; i++) {
      g.fillStyle(bookColors[i], 1);
      g.fillRect(x + 30, y - 22 + i * 6, 30, 6);
      g.lineStyle(1, 0x5d3a1a, 1);
      g.strokeRect(x + 30, y - 22 + i * 6, 30, 6);
    }
    // 中央 一卷未写完的日志 (米色)
    g.fillStyle(0xfaecc4, 1);
    g.fillRect(x - 15, y - 18, 24, 14);
    g.lineStyle(1, 0x5d3a1a, 1);
    g.strokeRect(x - 15, y - 18, 24, 14);
    g.lineStyle(0.5, 0x5d3a1a, 0.4);
    g.lineBetween(x - 13, y - 14, x + 7, y - 14);
    g.lineBetween(x - 13, y - 10, x + 7, y - 10);
    g.lineBetween(x - 13, y - 7, x + 4, y - 7);

    // 椅 (桌南侧)
    g.fillStyle(0x8b5a2b, 1);
    g.fillRect(x - 14, y + 33, 28, 20);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - 14, y + 33, 28, 20);
    // 椅背 (低)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 14, y + 33, 28, 4);
  }

  /** 东南角壁炉 (橙黄火光 · 闪烁) */
  private drawFireplace(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 砖外壳 (暗红砖)
    g.fillStyle(0x6b3434, 1);
    g.fillRect(x - 25, y - 35, 50, 70);
    g.lineStyle(2, 0x3a1a1a, 1);
    g.strokeRect(x - 25, y - 35, 50, 70);
    // 砖纹
    g.lineStyle(0.8, 0x3a1a1a, 0.6);
    g.lineBetween(x - 25, y - 20, x + 25, y - 20);
    g.lineBetween(x - 25, y - 5, x + 25, y - 5);
    g.lineBetween(x - 25, y + 10, x + 25, y + 10);
    g.lineBetween(x - 25, y + 25, x + 25, y + 25);
    // 错位砖
    g.lineBetween(x, y - 35, x, y - 20);
    g.lineBetween(x - 12, y - 20, x - 12, y - 5);
    g.lineBetween(x + 12, y - 20, x + 12, y - 5);
    g.lineBetween(x, y - 5, x, y + 10);

    // 炉口 (黑深洞)
    g.fillStyle(0x1a0a0a, 1);
    g.fillRect(x - 18, y - 5, 36, 28);
    // 炉口顶弧
    g.fillStyle(0x6b3434, 1);
    g.fillTriangle(x - 18, y - 5, x + 18, y - 5, x, y - 12);
    g.fillStyle(0x1a0a0a, 1);
    g.fillTriangle(x - 14, y - 5, x + 14, y - 5, x, y - 8);

    // 木柴 (3 条 · 交叉)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 14, y + 18, 28, 3);
    g.fillRect(x - 12, y + 14, 24, 3);
    g.fillRect(x - 10, y + 10, 20, 3);

    // 火光 (大橙圆)
    this.fireplaceFlame = this.add.circle(x, y + 8, 12, 0xff7733);
    this.fireplaceFlame.setDepth(3);
    // 内核 (亮黄)
    this.fireplaceCore = this.add.circle(x, y + 8, 6, 0xfff200);
    this.fireplaceCore.setDepth(4);

    // 暖光晕
    this.fireplaceGlow = this.add.graphics();
    this.fireplaceGlow.setDepth(1);
    this.updateFireplaceGlow();
  }

  private updateFireplaceGlow() {
    if (!this.fireplaceGlow) return;
    this.fireplaceGlow.clear();
    if (this.fireplaceBright) {
      this.fireplaceGlow.fillStyle(0xffe080, 0.18);
      this.fireplaceGlow.fillCircle(this.fireplaceX, this.fireplaceY + 8, 50);
      this.fireplaceGlow.fillStyle(0xffe080, 0.1);
      this.fireplaceGlow.fillCircle(this.fireplaceX, this.fireplaceY + 8, 80);
    }
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

  private triggerMemorial() {
    // TODO: 对接个人中心历史任务前 5 条
    EventBus.emit('show-dialogue', {
      name: '🖼 纪念墙',
      lines: [
        '（5 个红框整齐挂着 · 边角已经有点发黄）',
        '',
        '...还没有任何东西被刻上去。',
        '也许将来 · 9 工坊里某个夜晚 · 会有一桩值得纪念的事。',
      ],
    });
  }

  private triggerBed() {
    EventBus.emit('show-dialogue', {
      name: '🛏 床',
      lines: [
        '（米枕红被 · 绣边的线头掉了一截）',
        '',
        '躺一会儿罢...',
        '（短暂的小憩 · 屋外的风声似乎也变远了）',
      ],
    });
  }

  private triggerDesk() {
    EventBus.emit('show-dialogue', {
      name: '📜 书桌',
      lines: [
        '（一卷未写完的日志 · 砚台还有半池墨）',
        '',
        '坐下来 · 把今天发生的写下来。',
        '一天的事 · 落在纸上 · 才算真过完。',
      ],
    });
  }

  private triggerFireplace() {
    this.fireplaceBright = !this.fireplaceBright;
    this.updateFireplaceGlow();
    if (this.fireplaceFlame && this.fireplaceCore) {
      if (this.fireplaceBright) {
        this.fireplaceFlame.setFillStyle(0xff7733);
        this.fireplaceCore.setFillStyle(0xfff200);
        this.fireplaceFlame.setScale(1);
        this.fireplaceCore.setScale(1);
      } else {
        this.fireplaceFlame.setFillStyle(0x5d2020);
        this.fireplaceCore.setFillStyle(0xa05a35);
        this.fireplaceFlame.setScale(0.5);
        this.fireplaceCore.setScale(0.5);
      }
    }
    EventBus.emit('show-dialogue', {
      name: this.fireplaceBright ? '🔥 壁炉' : '🌫 余烬',
      lines: this.fireplaceBright
        ? ['（添了根柴 · 柴火噼啪作响 · 屋里暖了起来）', '', '"家里有炉火 · 才像个家。"']
        : ['（炉火只剩点点余烬 · 屋里渐渐凉了）'],
    });
  }

  // ============ UPDATE ============

  update(_time: number, delta: number) {
    if (!this.player || !this.cursors) return;

    // 火光闪烁 (装饰)
    this.flameTimer += delta;
    if (this.flameTimer > 200 && this.fireplaceFlame && this.fireplaceCore && this.fireplaceBright) {
      this.flameTimer = 0;
      const scale = 0.85 + Math.random() * 0.3;
      this.fireplaceFlame.setScale(scale);
      this.fireplaceCore.setFillStyle(Math.random() > 0.5 ? 0xfff200 : 0xffd700);
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
    const distMemorial = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.memorialX, this.memorialY);
    const distBed = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.bedX, this.bedY);
    const distDesk = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.deskX, this.deskY);
    const distFireplace = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.fireplaceX, this.fireplaceY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distMemorial < INTERACT_DISTANCE + 20) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看纪念墙').setPosition(this.memorialX, this.memorialY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerMemorial();
    } else if (distBed < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 歇会儿').setPosition(this.bedX, this.bedY - 80).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBed();
    } else if (distDesk < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 写日志').setPosition(this.deskX, this.deskY - 40).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerDesk();
    } else if (distFireplace < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText(this.fireplaceBright ? '[E] 让火小一些' : '[E] 添柴').setPosition(this.fireplaceX, this.fireplaceY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerFireplace();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
