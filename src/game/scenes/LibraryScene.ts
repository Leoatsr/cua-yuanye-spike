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
 * Wave 10 · 典籍阁 (Library)
 *
 * 严格按 GongdeTang 模板 (720×520 + zoom 2 + 米色内地板).
 *
 * 布局 (方向 1 阅览大厅):
 *   - 北墙: 大检索目录柜 (5×3 抽屉 · 按工坊/会议/年代分类)
 *   - 中央: 长读书桌 + 3 盏铜灯 + 论文摞
 *   - 双侧: 满墙书架 (5 层彩书 · 暗示 800+ 卷)
 *   - 西墙书架旁: 百晓 NPC (青衫 + 玄帽 + 卷宗 · graphics 手画)
 *   - 南墙: 中央门
 *
 * 互动 4: 检索柜 / 长桌 (坐下) / 阅读灯 (彩蛋调亮) / 百晓
 *
 * 百晓对话 (热心馆员调 · 4 句循环):
 *   1. 找论文呀？北墙目录柜 · 按工坊分类 · 你点点看。
 *   2. 东边架上是新到的 800 多篇 · 月底再补一批。
 *   3. 急着读？长桌坐下 · 我帮你调灯。
 *   4. 看完顺手放回原位 · 下个人就好找了。
 */
export class LibraryScene extends Phaser.Scene {
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

  // 互动点坐标
  private cabinetX = 360;
  private cabinetY = 145;
  private deskX = 360;
  private deskY = 290;
  private lampX = 360;
  private lampY = 270;
  private baixiaoX = 145;
  private baixiaoY = 290;

  // 出口
  private exitX = 0;
  private exitY = 0;

  // 百晓对话索引
  private baixiaoDialogueIndex = 0;

  // 灯火彩蛋
  private lampGlow: Phaser.GameObjects.Graphics | null = null;
  private lampBright = false;

  private exitHint!: Phaser.GameObjects.Text;
  private interactHint!: Phaser.GameObjects.Text;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('Library');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
    this.baixiaoDialogueIndex = 0;
    this.lampBright = false;
    this.lampGlow = null;
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

    // ---- 北墙顶梁 ----
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- 中央地毯 (青绿 · 学者书阁特色) ----
    const rugG = this.add.graphics();
    rugG.setDepth(-3);
    rugG.fillStyle(0x2f6b5d, 0.8);
    rugG.fillRect(180, 220, 360, 160);
    rugG.lineStyle(2, 0x1f4a3d, 1);
    rugG.strokeRect(180, 220, 360, 160);
    // 地毯内金边
    rugG.lineStyle(1, 0xdaa520, 0.7);
    rugG.strokeRect(186, 226, 348, 148);

    // ---- 道具 ----
    this.drawCabinet(this.cabinetX, this.cabinetY);
    this.drawSideShelves();
    this.drawCentralDesk(this.deskX, this.deskY);
    this.drawLamps();
    this.drawBaixiaoNPC(this.baixiaoX, this.baixiaoY);

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
    // 检索柜
    walls.add(this.add.rectangle(this.cabinetX, this.cabinetY, 320, 70, 0, 0));
    // 长桌
    walls.add(this.add.rectangle(this.deskX, this.deskY, 240, 60, 0, 0));
    // 双侧书架
    walls.add(this.add.rectangle(95, 290, 30, 220, 0, 0));
    walls.add(this.add.rectangle(625, 290, 30, 220, 0, 0));
    this.physics.add.collider(this.player, walls);

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    this.mp = setupMultiplayer(this, 'Library', () => this.player, () => this.currentFacing);
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
    this.add.text(ROOM_WIDTH / 2, 80, '— 典籍阁 · 800+ —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#4a3a6a', backgroundColor: '#fdf0cfee',
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

  /** 北墙 · 大检索目录柜 (5×3 抽屉) */
  private drawCabinet(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 柜体
    g.fillStyle(0x8b5a2b, 1);
    g.fillRect(x - 160, y - 35, 320, 70);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - 160, y - 35, 320, 70);

    // 5 列 × 3 行
    const cols = 5;
    const rows = 3;
    const dW = 320 / cols;
    const dH = 70 / rows;

    g.lineStyle(1, 0x5d3a1a, 1);
    const labels = [
      ['开源', '播宫', '测评', '招聘', '数据'],
      ['会议', '百晓', '内参', '生态', '混合'],
      ['arXiv', '2026', '2025', '2024', '历年'],
    ];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dX = x - 160 + c * dW;
        const dY = y - 35 + r * dH;
        g.strokeRect(dX, dY, dW, dH);
        // 抽屉拉手 (小金圆)
        g.fillStyle(0xdaa520, 1);
        g.fillCircle(dX + dW / 2, dY + dH - 4, 1.5);
        g.lineStyle(1, 0x5d3a1a, 1);
        // 标签 (CSS 方式 · 跟 GongdeTang 标题一致)
        const label = labels[r][c];
        this.add.text(dX + dW / 2, dY + dH / 2 - 2, label, {
          fontFamily: 'sans-serif', fontSize: '7px',
          color: '#fdf0cf',
        }).setOrigin(0.5).setDepth(3);
      }
    }

    // 顶上小铭牌
    this.add.text(x, y - 50, '检索目录 · 800+ 篇', {
      fontFamily: 'serif', fontSize: '9px',
      color: '#3a2a1a', backgroundColor: '#fdf0cfee',
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
    }).setOrigin(0.5).setDepth(3);
  }

  /** 双侧满墙书架 (5 层彩书) */
  private drawSideShelves() {
    const g = this.add.graphics();
    g.setDepth(2);
    const bookColors = [
      0xa32d2d, 0x3b6d11, 0x4a3a6a, 0xdaa520, 0x2f6b5d, 0x8b3a62, 0x4a90c2,
    ];

    const drawShelf = (sx: number) => {
      const sy = 290;
      // 架体
      g.fillStyle(0x8b5a2b, 1);
      g.fillRect(sx - 15, sy - 110, 30, 220);
      g.lineStyle(2, 0x5d3a1a, 1);
      g.strokeRect(sx - 15, sy - 110, 30, 220);
      // 5 层架板
      for (let i = 1; i < 5; i++) {
        g.lineBetween(sx - 15, sy - 110 + i * 44, sx + 15, sy - 110 + i * 44);
      }
      // 5 层 × 4 本彩书
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i < 4; i++) {
          g.fillStyle(bookColors[(row * 2 + i) % bookColors.length], 1);
          g.fillRect(sx - 12 + i * 6, sy - 105 + row * 44, 5, 32);
        }
      }
    };

    drawShelf(95);   // 西
    drawShelf(625);  // 东
  }

  /** 中央长读书桌 */
  private drawCentralDesk(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 桌面
    g.fillStyle(0xe8c98a, 1);
    g.fillRect(x - 120, y - 30, 240, 60);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - 120, y - 30, 240, 60);
    // 3 工位分隔
    g.lineStyle(1, 0x5d3a1a, 0.5);
    g.lineBetween(x - 40, y - 30, x - 40, y + 30);
    g.lineBetween(x + 40, y - 30, x + 40, y + 30);
    // 抽屉
    g.lineBetween(x - 120, y, x + 120, y);

    // 中工位 论文摞
    g.fillStyle(0xfaecc4, 1);
    g.fillRect(x - 8, y - 22, 16, 22);
    g.lineStyle(1, 0x5d3a1a, 1);
    g.strokeRect(x - 8, y - 22, 16, 22);
    g.lineStyle(0.5, 0x5d3a1a, 0.4);
    for (let i = 0; i < 3; i++) {
      g.lineBetween(x - 8, y - 18 + i * 6, x + 8, y - 18 + i * 6);
    }

    // 左工位 砚台
    g.fillStyle(0x2a2a2a, 1);
    g.fillEllipse(x - 80, y - 8, 18, 10);

    // 右工位 卷宗
    g.fillStyle(0xfaecc4, 1);
    g.fillRect(x + 60, y - 18, 8, 18);
    g.fillRect(x + 70, y - 18, 8, 18);
    g.fillRect(x + 80, y - 18, 8, 18);
    g.lineStyle(1, 0x5d3a1a, 1);
    g.strokeRect(x + 60, y - 18, 8, 18);
    g.strokeRect(x + 70, y - 18, 8, 18);
    g.strokeRect(x + 80, y - 18, 8, 18);
  }

  /** 3 盏铜灯 (桌面上 · 互动彩蛋) */
  private drawLamps() {
    const lampPositions = [300, 360, 420];
    const lampY = 250;
    for (const lx of lampPositions) {
      const g = this.add.graphics();
      g.setDepth(3);
      // 灯柱
      g.fillStyle(0x5d3a1a, 1);
      g.fillRect(lx - 1, lampY + 8, 2, 12);
      // 灯罩
      g.fillStyle(0xdaa520, 1);
      g.fillCircle(lx, lampY, 6);
      g.lineStyle(1, 0x5d3a1a, 1);
      g.strokeCircle(lx, lampY, 6);
      // 灯芯
      g.fillStyle(0xfff8a0, 1);
      g.fillCircle(lx, lampY, 2);
    }
    // 暗光晕容器 (待 lampBright 切换)
    this.lampGlow = this.add.graphics();
    this.lampGlow.setDepth(2);
    this.updateLampGlow();
  }

  private updateLampGlow() {
    if (!this.lampGlow) return;
    const lampPositions = [300, 360, 420];
    const lampY = 250;
    this.lampGlow.clear();
    if (this.lampBright) {
      for (const lx of lampPositions) {
        this.lampGlow.fillStyle(0xffe080, 0.3);
        this.lampGlow.fillCircle(lx, lampY, 30);
        this.lampGlow.fillStyle(0xffe080, 0.18);
        this.lampGlow.fillCircle(lx, lampY, 50);
      }
    }
  }

  /** 百晓 NPC (graphics 手画 · 青衫 + 玄帽 + 卷宗) */
  private drawBaixiaoNPC(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(3);
    // 阴影
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(x, y + 20, 20, 6);
    // 青衫 (青绿)
    g.fillStyle(0x2f6b5d, 1);
    g.fillRect(x - 10, y - 4, 20, 24);
    // 青衫底深色
    g.fillStyle(0x1f4a3d, 1);
    g.fillRect(x - 10, y + 18, 20, 4);
    // 领口 米色
    g.fillStyle(0xfce5b4, 1);
    g.fillRect(x - 3, y - 4, 6, 4);
    // 头 米色
    g.fillStyle(0xfce5b4, 1);
    g.fillRect(x - 7, y - 18, 14, 16);
    // 玄色幞头
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(x - 8, y - 22, 16, 8);
    g.fillRect(x - 3, y - 25, 6, 3);
    // 帽子金边
    g.lineStyle(0.5, 0xdaa520, 1);
    g.strokeRect(x - 8, y - 22, 16, 8);
    // 眼
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 3, y - 12, 1.5, 1.5);
    g.fillRect(x + 1.5, y - 12, 1.5, 1.5);
    // 嘴 (微笑)
    g.lineStyle(0.8, 0x5d2020, 1);
    g.lineBetween(x - 2, y - 7, x + 2, y - 7);
    // 卷宗 (左手)
    g.fillStyle(0xfaecc4, 1);
    g.fillRect(x - 22, y + 4, 10, 14);
    g.lineStyle(1, 0x5d3a1a, 1);
    g.strokeRect(x - 22, y + 4, 10, 14);
    g.lineStyle(0.5, 0x5d3a1a, 0.5);
    g.lineBetween(x - 21, y + 8, x - 13, y + 8);
    g.lineBetween(x - 21, y + 12, x - 13, y + 12);
    // 名牌
    this.add.text(x, y - 36, '百晓', {
      fontFamily: 'serif', fontSize: '10px',
      color: '#2f6b5d', backgroundColor: '#fdf0cfee',
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
    }).setOrigin(0.5).setDepth(4);
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

  private triggerCabinet() {
    EventBus.emit('show-dialogue', {
      name: '🗄️ 检索目录 · 5×3 抽屉',
      lines: [
        '（按工坊、会议、年代分类）',
        '',
        '工坊：开源 · 播宫 · 测评 · 招聘 · 数据 · 会议 · 百晓 · 内参 · 生态',
        '会议：arXiv · 历年',
        '年代：2026 · 2025 · 2024',
        '',
        '"800+ 篇论文索引齐备 · 任凭翻阅。"',
      ],
    });
  }

  private triggerDesk() {
    EventBus.emit('show-dialogue', {
      name: '📜 长读书桌 · 3 工位',
      lines: [
        '（在长桌前坐下 · 翻开了一篇论文）',
        '',
        '左位有砚台 · 中位有论文摞 · 右位有卷宗。',
        '...专注的两个时辰过去了。',
      ],
    });
  }

  private triggerLamp() {
    this.lampBright = !this.lampBright;
    this.updateLampGlow();
    EventBus.emit('show-dialogue', {
      name: this.lampBright ? '💡 灯火亮起' : '💡 熄灯',
      lines: this.lampBright
        ? ['（3 盏铜灯亮起 · 桌面通透）', '', '"读得清字 · 看得见人。"']
        : ['（灯熄了 · 借窗光也能读）'],
    });
  }

  private triggerBaixiao() {
    const lines = [
      '找论文呀？北墙目录柜 · 按工坊分类 · 你点点看。',
      '东边架上是新到的 800 多篇 · 月底再补一批。',
      '急着读？长桌坐下 · 我帮你调灯。',
      '看完顺手放回原位 · 下个人就好找了。',
    ];
    EventBus.emit('show-dialogue', {
      name: '📖 百晓馆员',
      lines: [lines[this.baixiaoDialogueIndex]],
    });
    this.baixiaoDialogueIndex = (this.baixiaoDialogueIndex + 1) % lines.length;
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
    const distCabinet = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.cabinetX, this.cabinetY);
    const distDesk = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.deskX, this.deskY);
    const distLamp = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.lampX, this.lampY);
    const distBaixiao = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.baixiaoX, this.baixiaoY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distBaixiao < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 与百晓对话').setPosition(this.baixiaoX, this.baixiaoY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBaixiao();
    } else if (distCabinet < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 查阅目录').setPosition(this.cabinetX, this.cabinetY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerCabinet();
    } else if (distLamp < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText(this.lampBright ? '[E] 熄灯' : '[E] 调亮灯火').setPosition(this.lampX, this.lampY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerLamp();
    } else if (distDesk < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 坐下读书').setPosition(this.deskX, this.deskY - 40).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerDesk();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
