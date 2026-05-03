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
 * 议事厅 (Yishi Ting) — 会议工作组工坊室内
 *
 * Theme: Conference room.
 * Visual: Big oval table with chairs, projector screen, agenda board, microphones.
 */
export class YishiTingScene extends Phaser.Scene {
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

  private projectorX = 0;
  private projectorY = 0;
  private agendaX = 0;
  private agendaY = 0;
  private tableX = 0;
  private tableY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('YishiTing');
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
    // A 布局：中央地毯（暗示这是会议主舞台）
    g.fillStyle(0x185fa5, 0.06);
    g.fillRect(180, ROOM_HEIGHT / 2 - 50, ROOM_WIDTH - 360, 130);

    // ---- 北墙顶梁 (Wave 7.K · 暖木) ----
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- Wave 7.K 主道具：投影屏 (北墙居中拉宽 240 · 占 projectorX/Y · 紫蓝主题) ----
    this.projectorX = ROOM_WIDTH / 2;
    this.projectorY = 120;
    this.drawProjector(this.projectorX, this.projectorY);

    // ---- Wave 7.K 中央：圆桌 + 6 椅 (panel 会议 · 占 tableX/Y) ----
    this.tableX = ROOM_WIDTH / 2;
    this.tableY = ROOM_HEIGHT / 2 + 30;
    this.drawOvalTable(this.tableX, this.tableY);

    // ---- Wave 7.K 副件 R：7 天日程白板 (东墙 · 占 agendaX/Y) ----
    this.agendaX = ROOM_WIDTH - 110;
    this.agendaY = ROOM_HEIGHT / 2 + 20;
    this.drawAgenda(this.agendaX, this.agendaY);

    // ---- Wave 7.K 副件 L：双红旗柱 (drawCoffeeStation 改写 · 调 2 次) ----
    this.drawCoffeeStation(110, ROOM_HEIGHT / 2 + 20);
    this.drawCoffeeStation(ROOM_WIDTH - 230, ROOM_HEIGHT / 2 + 20);

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
    this.mp = setupMultiplayer(this, 'YishiTing', () => this.player, () => this.currentFacing);

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
    this.add.text(ROOM_WIDTH / 2, 80, '— 会议工坊 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#0c447c', backgroundColor: '#fdf0cfee',
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

  // ============ DRAWING (Wave 7.K · A 圆桌会议厅布局 · 保留方法名) ============

  /** 主道具：投影屏 (北墙居中拉宽 240 · 占 projectorX/Y · 紫蓝主题) */
  private drawProjector(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 暖木外框
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 120, y - 28, 240, 56);
    // 蓝主题色边
    g.fillStyle(0x185fa5, 1);
    g.fillRect(x - 116, y - 24, 232, 48);
    // 暗背景屏幕 (黑底)
    g.fillStyle(0x0c1a30, 1);
    g.fillRect(x - 112, y - 20, 224, 40);
    // 顶部蓝色标签条
    g.fillStyle(0x4a8ad5, 1);
    g.fillRect(x - 112, y - 20, 224, 4);
    // 投影内容：3 大块 (议题列表 / 数据 / 时间)
    // 左：议题项 4 条 (蓝点 + 米色文字条)
    for (let i = 0; i < 4; i++) {
      const itemY = y - 12 + i * 8;
      g.fillStyle(0x4a8ad5, 1);
      g.fillCircle(x - 100, itemY, 1.5);
      g.fillStyle(0xfdf0cf, 0.8);
      g.fillRect(x - 95, itemY - 1, 32, 2);
    }
    // 中：饼图 (3 色扇区)
    const pcx = x;
    const pcy = y;
    g.fillStyle(0x4a8ad5, 1);
    g.fillCircle(pcx, pcy, 14);
    g.fillStyle(0x97c459, 1);
    g.beginPath();
    g.arc(pcx, pcy, 14, -Math.PI / 2, Math.PI / 4);
    g.lineTo(pcx, pcy);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xef9f27, 1);
    g.beginPath();
    g.arc(pcx, pcy, 14, Math.PI / 4, Math.PI);
    g.lineTo(pcx, pcy);
    g.closePath();
    g.fillPath();
    // 右：折线趋势
    g.lineStyle(2, 0x97c459, 1);
    const pts: [number, number][] = [[x + 30, y + 8], [x + 44, y + 4], [x + 58, y - 2], [x + 72, y - 6], [x + 86, y - 10], [x + 100, y - 14]];
    for (let i = 0; i < pts.length - 1; i++) {
      g.lineBetween(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
    g.fillStyle(0x97c459, 1);
    pts.forEach(p => g.fillCircle(p[0], p[1], 1.5));
    // 底部状态条
    g.fillStyle(0x4a8ad5, 0.6);
    g.fillRect(x - 100, y + 14, 200, 3);
  }

  /** 副件 R：7 天日程白板 (东墙 · 占 agendaX/Y) */
  private drawAgenda(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 木架
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 22, y - 36, 44, 72);
    // 白板背
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 20, y - 34, 40, 68);
    // 顶部标签条 (蓝)
    g.fillStyle(0x185fa5, 1);
    g.fillRect(x - 20, y - 34, 40, 6);
    // 7 天行 (周一到周日)
    for (let i = 0; i < 7; i++) {
      const dy = y - 26 + i * 9;
      // 日期标签
      g.fillStyle(0x0c447c, 1);
      g.fillRect(x - 18, dy, 6, 7);
      // 议程文字行 (米色 · 不同颜色表示不同会议类型)
      const colors = [0x97c459, 0xef9f27, 0x97c459, 0x791f1f, 0x4a8ad5, 0x97c459, 0xc9a55b];
      g.fillStyle(colors[i], 0.7);
      g.fillRect(x - 10, dy, 26, 7);
      g.fillStyle(0x0c447c, 0.6);
      g.fillRect(x - 8, dy + 1, 20, 1);
      g.fillRect(x - 8, dy + 4, 14, 1);
    }
    // 底部签名条
    g.fillStyle(0x185fa5, 0.5);
    g.fillRect(x - 20, y + 28, 40, 4);
  }

  /** 中央：圆桌 + 6 椅 (panel 会议 · 占 tableX/Y) */
  private drawOvalTable(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 6 椅 (围圆 · 上 2 下 2 左右各 1 · 蓝色面试官椅)
    const chairPositions: [number, number, number][] = [
      [x - 38, y - 20, 0],   // 左上
      [x, y - 28, 0],        // 上中
      [x + 38, y - 20, 0],   // 右上
      [x - 38, y + 20, 0],   // 左下
      [x, y + 28, 0],        // 下中
      [x + 38, y + 20, 0],   // 右下
    ];
    chairPositions.forEach(([cx, cy]) => {
      // 椅垫
      g.fillStyle(0x5d3a1a, 1);
      g.fillRect(cx - 8, cy - 6, 16, 12);
      g.fillStyle(0x185fa5, 1);
      g.fillRect(cx - 6, cy - 4, 12, 8);
      // 椅腿
      g.fillStyle(0x3a2a1a, 1);
      g.fillRect(cx - 7, cy + 6, 2, 4);
      g.fillRect(cx + 5, cy + 6, 2, 4);
    });
    // 圆桌底色 (椭圆 · 用矩形拼)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 50, y - 18, 100, 36);
    g.fillRect(x - 56, y - 14, 6, 28);
    g.fillRect(x + 50, y - 14, 6, 28);
    g.fillRect(x - 46, y - 22, 92, 4);
    g.fillRect(x - 46, y + 18, 92, 4);
    // 桌面 (亮木)
    g.fillStyle(0xa0673b, 1);
    g.fillRect(x - 48, y - 16, 96, 32);
    g.fillRect(x - 54, y - 12, 6, 24);
    g.fillRect(x + 48, y - 12, 6, 24);
    g.fillRect(x - 44, y - 20, 88, 4);
    g.fillRect(x - 44, y + 16, 88, 4);
    // 桌面纹理
    g.lineStyle(1, 0x5d3a1a, 0.4);
    g.lineBetween(x - 48, y, x + 48, y);
    // 中央议程文件 (米色 + 蓝顶条)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 12, y - 8, 24, 16);
    g.fillStyle(0x185fa5, 1);
    g.fillRect(x - 12, y - 8, 24, 3);
    // 6 个杯子 (每个椅子前一个 · 米色)
    chairPositions.forEach(([cx, cy]) => {
      const dx = cx > x ? -8 : (cx < x ? 8 : 0);
      const dy = cy > y ? -8 : (cy < y ? 8 : 0);
      const tcx = cx + dx;
      const tcy = cy + dy;
      g.fillStyle(0xfdf0cf, 1);
      g.fillCircle(tcx, tcy, 2);
      g.fillStyle(0x854f0b, 1);
      g.fillCircle(tcx, tcy, 1);
    });
  }

  /** 副件 L (调 2 次)：红旗柱 (drawCoffeeStation 改写) */
  private drawCoffeeStation(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 旗杆底座 (圆木台)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 8, y + 30, 16, 6);
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 6, y + 30, 12, 4);
    // 旗杆 (深木长杆)
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 1, y - 36, 2, 66);
    // 顶端金球
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x, y - 38, 3);
    // 红旗 (主体)
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x + 1, y - 34, 32, 24);
    // 旗高光 (顶部边)
    g.fillStyle(0xc94545, 1);
    g.fillRect(x + 1, y - 34, 32, 3);
    // 旗下边 (锯齿用小矩形 · 安全)
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x + 1, y - 10, 4, 6);
    g.fillRect(x + 9, y - 10, 4, 6);
    g.fillRect(x + 17, y - 10, 4, 6);
    g.fillRect(x + 25, y - 10, 4, 6);
    // 旗上的金色徽 (圆形)
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x + 17, y - 22, 5);
    g.fillStyle(0xa32d2d, 1);
    g.fillCircle(x + 17, y - 22, 3);
    g.fillStyle(0xfac775, 1);
    g.fillCircle(x + 17, y - 22, 1);
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

  private triggerProjector() {
    EventBus.emit('show-dialogue', {
      name: '📺 投影屏',
      lines: [
        '（黑底投影屏 · 蓝顶条 · 议题清单 + 饼图 + 上扬趋势）',
        '',
        '"标题：CUA Q4 季度复盘"',
        '',
        '· 上季度 4 大议题进度',
        '· 8 工作组 CV 占比 (饼图)',
        '· 30 天活跃度趋势 (上扬)',
        '',
        '"——会议不是宣布结论 · 是把事实摊开看。"',
      ],
    });
  }

  private triggerAgenda() {
    EventBus.emit('show-dialogue', {
      name: '📅 7 天日程白板',
      lines: [
        '（白板 · 7 行 · 每行不同颜色对应不同会议类型）',
        '',
        '一 · 绿：周会 (8 工作组组长)',
        '二 · 橙：评审 (开源项目)',
        '三 · 绿：周会',
        '四 · 红：紧急议题',
        '五 · 蓝：技术分享',
        '六 · 绿：跨组协作',
        '日 · 米：自由议事',
        '',
        '"——节奏稳了 · 才能持续做下去。"',
      ],
    });
  }

  private triggerTable() {
    EventBus.emit('show-dialogue', {
      name: '🪑 圆桌',
      lines: [
        '（圆桌 + 6 把蓝椅环绕 · 中央议程文件 + 6 个杯子）',
        '',
        '"圆桌——人人平等 · 没有主席台。"',
        '"6 个位 · 留给 8 工作组的代表轮值。"',
        '',
        '"——会议不是审判 · 是商议。"',
        '"——共识不是说服 · 是寻找。"',
        '',
        '今天有人坐下了——那就开会。',
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
    const distProj = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.projectorX, this.projectorY);
    const distAg = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.agendaX, this.agendaY);
    const distTbl = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.tableX, this.tableY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distProj < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看投影').setPosition(this.projectorX, this.projectorY + 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerProjector();
    } else if (distAg < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看 7 天日程').setPosition(this.agendaX, this.agendaY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerAgenda();
    } else if (distTbl < INTERACT_DISTANCE * 2) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看圆桌').setPosition(this.tableX, this.tableY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerTable();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
