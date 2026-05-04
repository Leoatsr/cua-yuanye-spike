import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 130;
const INTERACT_DISTANCE = 56;

const ROOM_WIDTH = 1000;
const ROOM_HEIGHT = 700;

interface SceneInitData {
  returnX?: number;
  returnY?: number;
}

/**
 * 声闻台 (Shengwen Tai) — 播客工作组工坊室内
 *
 * Theme: Podcast recording studio.
 * Visual: mixing console, microphones around a round table, acoustic foam walls.
 */
export class ShengwenTaiScene extends Phaser.Scene {
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

  private mixerX = 0;
  private mixerY = 0;
  private tableX = 0;
  private tableY = 0;
  private rosterX = 0;
  private rosterY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('ShengwenTai');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.cameras.main.setBackgroundColor('#8b4513');
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
    // B 布局：左主播间地毯 (浅红) + 右嘉宾间地毯 (浅青)
    g.fillStyle(0xa32d2d, 0.06);
    g.fillRect(80, ROOM_HEIGHT / 2 - 30, ROOM_WIDTH / 2 - 100, 130);
    g.fillStyle(0x1a8b8b, 0.06);
    g.fillRect(ROOM_WIDTH / 2 + 20, ROOM_HEIGHT / 2 - 30, ROOM_WIDTH / 2 - 100, 130);

    // ---- 北墙顶梁 (Wave 7.K · 暖木) ----
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- B 布局：中央玻璃隔板 (垂直 · 不互动 · drawAcousticFoam 改写) ----
    this.drawAcousticFoam();

    // ---- Wave 7.K 主道具：ON AIR 灯条墙 (北墙居中拉宽 240 · 占 mixerX/Y) ----
    this.mixerX = ROOM_WIDTH / 2;
    this.mixerY = 120;
    this.drawMixer(this.mixerX, this.mixerY);

    // ---- Wave 7.K 主播间：左半中央桌 (主麦 + 调音推子 · 占 tableX/Y) ----
    this.tableX = ROOM_WIDTH / 4 + 20;
    this.tableY = ROOM_HEIGHT / 2 + 30;
    this.drawMicTable(this.tableX, this.tableY);

    // ---- Wave 7.K 嘉宾间：右半沙发 (沙发 + 嘉宾麦 · 占 rosterX/Y) ----
    this.rosterX = ROOM_WIDTH * 3 / 4 - 20;
    this.rosterY = ROOM_HEIGHT / 2 + 30;
    this.drawGuestRoster(this.rosterX, this.rosterY);

    // ---- Wave 7.K 副件 L (装饰)：节目封面墙 (drawAntenna 改写) ----
    this.drawAntenna(110, 130);

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
    this.mp = setupMultiplayer(this, 'ShengwenTai', () => this.player, () => this.currentFacing);

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
    this.add.text(ROOM_WIDTH / 2, 80, '— 播客工坊 —', {
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
      color: '#fdf0cf', backgroundColor: '#5d3a1add',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);
  }

  // ============ DRAWING (Wave 7.K · B 录音棚双间布局 · 保留方法名) ============

  /** 中央玻璃隔板 (垂直 · 不互动 · drawAcousticFoam 改写 · 顶部到中下 · 给底部门留通道) */
  private drawAcousticFoam() {
    const g = this.add.graphics();
    g.setDepth(1);
    const cx = ROOM_WIDTH / 2;
    const top = 150;  // 玻璃从北墙下方开始
    const bot = ROOM_HEIGHT - 130;  // 玻璃在门上方就停
    // 玻璃外框 (上下 + 左右暖木边)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(cx - 12, top, 24, 6);   // 上框
    g.fillRect(cx - 12, bot - 6, 24, 6);  // 下框
    g.fillRect(cx - 12, top, 4, bot - top);  // 左框
    g.fillRect(cx + 8, top, 4, bot - top);   // 右框
    // 玻璃 (浅蓝半透 · 模拟反光)
    g.fillStyle(0xb0d4f0, 0.3);
    g.fillRect(cx - 8, top + 6, 16, bot - top - 12);
    // 玻璃斜光线纹 (3 道)
    g.lineStyle(1, 0xfdf0cf, 0.4);
    for (let i = 0; i < 3; i++) {
      const ly = top + 30 + i * 60;
      g.lineBetween(cx - 6, ly, cx + 6, ly + 12);
    }
    // 中央"ON AIR"提示框 (玻璃中央)
    g.fillStyle(0x791f1f, 1);
    g.fillRect(cx - 8, ROOM_HEIGHT / 2 - 8, 16, 16);
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(cx - 6, ROOM_HEIGHT / 2 - 6, 12, 4);
    g.fillStyle(0xa32d2d, 0.6);
    g.fillRect(cx - 6, ROOM_HEIGHT / 2, 12, 4);
  }

  /** 主道具：ON AIR 灯条墙 (北墙居中拉宽 240 · 占 mixerX/Y · 红主题) */
  private drawMixer(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 暖木外框
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 120, y - 28, 240, 56);
    // 红主题色边
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x - 116, y - 24, 232, 48);
    // 黑屏底
    g.fillStyle(0x1a0808, 1);
    g.fillRect(x - 112, y - 20, 224, 40);
    // 顶部红色 LED 条 (亮)
    g.fillStyle(0xef5050, 1);
    g.fillRect(x - 112, y - 20, 224, 4);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(x - 112, y - 20, 224, 1);
    // 中央 ON AIR 灯牌 (大)
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x - 60, y - 12, 120, 24);
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 56, y - 8, 112, 16);
    // ON AIR 字色块 (用矩形拼字)
    // O
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x - 50, y - 6, 8, 2);
    g.fillRect(x - 50, y + 4, 8, 2);
    g.fillRect(x - 50, y - 4, 2, 8);
    g.fillRect(x - 44, y - 4, 2, 8);
    // N
    g.fillRect(x - 38, y - 6, 2, 12);
    g.fillRect(x - 30, y - 6, 2, 12);
    g.fillRect(x - 36, y - 4, 2, 4);
    g.fillRect(x - 34, y - 2, 2, 4);
    g.fillRect(x - 32, y, 2, 4);
    // (空格)
    // A
    g.fillRect(x - 18, y - 6, 8, 2);
    g.fillRect(x - 18, y - 4, 2, 10);
    g.fillRect(x - 12, y - 4, 2, 10);
    g.fillRect(x - 18, y, 8, 2);
    // I
    g.fillRect(x - 4, y - 6, 6, 2);
    g.fillRect(x - 2, y - 4, 2, 8);
    g.fillRect(x - 4, y + 4, 6, 2);
    // R
    g.fillRect(x + 6, y - 6, 2, 12);
    g.fillRect(x + 6, y - 6, 8, 2);
    g.fillRect(x + 12, y - 4, 2, 4);
    g.fillRect(x + 6, y, 6, 2);
    g.fillRect(x + 10, y + 2, 2, 4);
    // 底部状态条 (录音波形)
    g.lineStyle(2, 0xef5050, 0.7);
    for (let i = 0; i < 12; i++) {
      const wx = x - 50 + i * 9;
      const wh = (i % 3) * 3 + 2;
      g.lineBetween(wx, y + 14 - wh, wx, y + 14 + wh);
    }
  }

  /** 主播间：左半中央桌 + 主麦 + 调音推子 (占 tableX/Y) */
  private drawMicTable(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 桌 (暖木长桌)
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 50, y - 18, 100, 36);
    g.fillStyle(0xa0673b, 1);
    g.fillRect(x - 48, y - 16, 96, 32);
    // 桌脚
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 48, y + 18, 4, 14);
    g.fillRect(x + 44, y + 18, 4, 14);
    // 调音台 (左半)
    g.fillStyle(0x2c2c2a, 1);
    g.fillRect(x - 42, y - 10, 36, 16);
    // 4 推子 (横向 · 红色滑块)
    for (let i = 0; i < 4; i++) {
      const sx = x - 38 + i * 9;
      g.fillStyle(0x5f5e5a, 1);
      g.fillRect(sx, y - 8, 2, 12);
      // 滑块位置变化
      const sy = y - 4 + (i % 2) * 4;
      g.fillStyle(0xa32d2d, 1);
      g.fillRect(sx - 2, sy, 6, 3);
    }
    // 主麦克风 (落地式 · 桌右半)
    const mx = x + 16;
    const my = y - 20;
    // 麦支架
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(mx - 1, my, 2, 22);
    g.fillRect(mx - 8, my + 22, 16, 3);
    // 麦头 (深灰金属网)
    g.fillStyle(0x444441, 1);
    g.fillCircle(mx, my - 4, 6);
    g.fillStyle(0x888780, 1);
    g.fillCircle(mx, my - 4, 4);
    // 麦头光
    g.fillStyle(0xa32d2d, 1);
    g.fillCircle(mx, my - 4, 1);
    // 主播椅 (北 · 红色)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 14, y - 38, 28, 16);
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x - 12, y - 36, 24, 14);
    g.fillStyle(0xc94545, 1);
    g.fillRect(x - 10, y - 34, 20, 4);
    // 桌前耳机 (黑色)
    g.fillStyle(0x2c2c2a, 1);
    g.fillRect(x - 38, y + 4, 14, 4);
    g.fillCircle(x - 35, y + 4, 2);
    g.fillCircle(x - 27, y + 4, 2);
  }

  /** 嘉宾间：右半沙发 + 嘉宾麦 (占 rosterX/Y) */
  private drawGuestRoster(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 嘉宾沙发 (青色 · 圆角矩形 · 北朝向)
    const sy = y - 5;
    // 沙发底座
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 38, sy - 8, 76, 22);
    // 沙发坐垫 (青色)
    g.fillStyle(0x1a8b8b, 1);
    g.fillRect(x - 36, sy - 6, 72, 18);
    // 沙发靠背
    g.fillStyle(0x267878, 1);
    g.fillRect(x - 38, sy - 22, 76, 16);
    // 靠背高光
    g.fillStyle(0x3a9b9b, 1);
    g.fillRect(x - 36, sy - 20, 72, 4);
    // 沙发扶手
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 42, sy - 16, 4, 22);
    g.fillRect(x + 38, sy - 16, 4, 22);
    // 沙发脚
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 38, sy + 14, 4, 4);
    g.fillRect(x + 34, sy + 14, 4, 4);
    // 沙发上 2 个抱枕 (米色 + 青色)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 28, sy - 4, 12, 12);
    g.fillStyle(0x267878, 1);
    g.fillRect(x + 16, sy - 4, 12, 12);
    // 嘉宾麦 (悬挂式 · 桌前)
    const my = y + 26;
    // 桌 (小茶几)
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 16, my, 32, 14);
    g.fillStyle(0xa0673b, 1);
    g.fillRect(x - 14, my + 2, 28, 10);
    // 茶几脚
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 14, my + 14, 4, 8);
    g.fillRect(x + 10, my + 14, 4, 8);
    // 桌上嘉宾麦 (紧凑式)
    g.fillStyle(0x444441, 1);
    g.fillRect(x - 4, my - 4, 8, 8);
    g.fillStyle(0x888780, 1);
    g.fillCircle(x, my, 3);
    g.fillStyle(0x1a8b8b, 1);
    g.fillCircle(x, my, 1);
    // 桌上水杯
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x + 8, my + 4, 4, 6);
    g.lineStyle(1, 0x5d3a1a, 0.5);
    g.strokeRect(x + 8, my + 4, 4, 6);
  }

  /** 副件 L (装饰)：节目封面墙 (drawAntenna 改写) */
  private drawAntenna(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 暖木外框
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 30, y - 28, 60, 56);
    // 红主题色边
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x - 28, y - 26, 56, 52);
    // 米色挂板
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 26, y - 24, 52, 48);
    // 顶部"封面"标签条
    g.fillStyle(0x791f1f, 1);
    g.fillRect(x - 26, y - 24, 52, 5);
    // 4 个节目封面 (2×2 阵列 · 不同色)
    const covers = [0xa32d2d, 0x854f0b, 0x3b6d11, 0x1a8b8b];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const cx = x - 14 + col * 22;
        const cy = y - 12 + row * 18;
        g.fillStyle(covers[row * 2 + col], 1);
        g.fillRect(cx, cy, 18, 14);
        // 封面光
        g.fillStyle(0xfdf0cf, 0.8);
        g.fillRect(cx + 1, cy + 1, 16, 3);
        // 麦克风小图标
        g.fillStyle(0xfdf0cf, 1);
        g.fillCircle(cx + 9, cy + 8, 2);
        g.fillStyle(covers[row * 2 + col], 1);
        g.fillCircle(cx + 9, cy + 8, 1);
      }
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
      this.scene.start('SproutCity', { spawnX: this.returnX, spawnY: this.returnY });
    });
  }

  private triggerMixer() {
    EventBus.emit('show-dialogue', {
      name: '🔴 ON AIR 灯条',
      lines: [
        '（红色 ON AIR 灯条 · 下方录音波形跳动）',
        '',
        '"红灯亮着——意思是「正在录音 · 请安静」。"',
        '"绿灯亮着——意思是「Take 完了 · 可以聊天」。"',
        '',
        '当前状态：● 红灯 · 录音中',
        '"——别走过去 · 你的脚步声会被收进去。"',
      ],
    });
  }

  private triggerTable() {
    EventBus.emit('show-dialogue', {
      name: '🎙️ 主播间',
      lines: [
        '（红椅 + 调音推子 + 主麦 + 监听耳机）',
        '',
        '"主播是节目的脊梁——'
        + '负责开场 · 提问 · 收尾。"',
        '',
        '"调音台 4 推子：主播 / 嘉宾 / 背景音 / 主控。"',
        '"——音量平衡 · 永远是录音的第一难关。"',
      ],
    });
  }

  private triggerRoster() {
    EventBus.emit('show-dialogue', {
      name: '🎤 嘉宾间',
      lines: [
        '（青色沙发 + 抱枕 + 嘉宾麦 + 水杯）',
        '',
        '"嘉宾是节目的灵魂——'
        + '从坐下到开口 · 留 5 秒缓冲。"',
        '',
        '已邀请：73 位 · 已录制：58 位 · 待发布：6 期',
        '',
        '"想登台分享？给 podcast@cua.dev 发邮件。"',
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
    const distMix = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.mixerX, this.mixerY);
    const distTable = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.tableX, this.tableY);
    const distRoster = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.rosterX, this.rosterY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distMix < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看 ON AIR').setPosition(this.mixerX, this.mixerY + 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerMixer();
    } else if (distTable < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 进主播间').setPosition(this.tableX, this.tableY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerTable();
    } else if (distRoster < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 进嘉宾间').setPosition(this.rosterX, this.rosterY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerRoster();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
