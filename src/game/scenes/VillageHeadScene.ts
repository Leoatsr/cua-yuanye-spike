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
 * Wave 10 · 阿降村长小屋 (VillageHead)
 *
 * 严格按 GongdeTang 模板风格:
 *   - 720×520 房间 + camera zoom 2
 *   - 暖木外框 + 米色内地板 + 64px 间隔木板纹
 *   - 北顶梁 14px 深暖木 + 标题挂北墙下方
 *   - EventBus 'show-dialogue' 用 React DialogueBox
 *   - player 6 方向走路 + idle 动画
 *
 * 布局 (方向 4 半开放堂屋):
 *   - 北墙: 社区拓扑图 + 9 工坊名册 (并排)
 *   - 中央: 阿降案台 (砚 + 卷宗 + 印章)
 *   - 阿降 NPC 在案台北侧 (graphics 手画 · 红长袍 + 灰发 + 拐杖)
 *   - 双侧书架 (4 层彩书)
 *   - 南墙: 2 访客椅 + 中央门
 *
 * 互动 4: 北地图 / 北名册 / 阿降对话 / 案台 (坐下)
 */
export class VillageHeadScene extends Phaser.Scene {
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
  private mapX = 220;     // 北墙地图
  private mapY = 145;
  private rosterX = 500;  // 北墙名册
  private rosterY = 145;
  private deskX = 360;    // 中央案台
  private deskY = 290;
  private axiangX = 360;  // 阿降 NPC (案台北侧)
  private axiangY = 235;

  // 出口
  private exitX = 0;
  private exitY = 0;

  // 阿降对话索引
  private axiangDialogueIndex = 0;

  private exitHint!: Phaser.GameObjects.Text;
  private interactHint!: Phaser.GameObjects.Text;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('VillageHead');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
    this.axiangDialogueIndex = 0;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    bgmManager.stop(this); // 内景静默
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Floor (跟 GongdeTang 一脉) ----
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

    // ---- 北墙顶梁 ----
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- 道具绘制 ----
    this.drawCommunityMap(this.mapX, this.mapY);
    this.drawWorkshopRoster(this.rosterX, this.rosterY);
    this.drawSideShelves();
    this.drawCentralDesk(this.deskX, this.deskY);
    this.drawAxiangNPC(this.axiangX, this.axiangY);
    this.drawSouthChairs();

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
    // 案台碰撞
    walls.add(this.add.rectangle(this.deskX, this.deskY, 200, 60, 0, 0));
    // 双侧书架碰撞
    walls.add(this.add.rectangle(95, 270, 30, 130, 0, 0));
    walls.add(this.add.rectangle(625, 270, 30, 130, 0, 0));
    this.physics.add.collider(this.player, walls);

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    this.mp = setupMultiplayer(this, 'VillageHead', () => this.player, () => this.currentFacing);
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
    this.add.text(ROOM_WIDTH / 2, 80, '— 阿降村长小屋 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#3b6d11', backgroundColor: '#fdf0cfee',
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

  /** 北墙 · 社区拓扑图 (米色卷轴 + 木轴 + 节点) */
  private drawCommunityMap(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 卷轴底纸
    g.fillStyle(0xfaecc4, 1);
    g.fillRect(x - 70, y - 40, 140, 80);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - 70, y - 40, 140, 80);
    // 上下木轴
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 78, y - 44, 156, 6);
    g.fillRect(x - 78, y + 38, 156, 6);
    // 萌芽点 (绿)
    g.fillStyle(0x3b6d11, 1);
    g.fillCircle(x - 30, y + 5, 5);
    // 议政点 (红)
    g.fillStyle(0xa32d2d, 1);
    g.fillCircle(x + 40, y - 18, 6);
    // 9 工坊小节点 (金)
    g.fillStyle(0xdaa520, 1);
    const nodes: [number, number][] = [
      [-15, -5], [0, -10], [15, 0], [-5, 15], [10, 18],
      [-25, 18], [20, -25], [25, 10], [-10, -25],
    ];
    nodes.forEach(([dx, dy]) => g.fillCircle(x + dx, y + dy, 2.5));
    // 连线 (萌芽 → 议政)
    g.lineStyle(1, 0x5d3a1a, 0.5);
    g.lineBetween(x - 30, y + 5, x + 40, y - 18);
  }

  /** 北墙 · 9 工坊名册 (木板 + 行) */
  private drawWorkshopRoster(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 木板
    g.fillStyle(0xc89a4a, 1);
    g.fillRect(x - 70, y - 40, 140, 80);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - 70, y - 40, 140, 80);
    // 9 行小横条
    g.lineStyle(1, 0x5d3a1a, 0.6);
    for (let i = 0; i < 9; i++) {
      g.lineBetween(x - 60, y - 32 + i * 8, x + 60, y - 32 + i * 8);
    }
    // 标签
    this.add.text(x, y - 50, '9 工坊名册', {
      fontFamily: 'serif', fontSize: '9px',
      color: '#5d3a1a', backgroundColor: '#fdf0cfee',
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
    }).setOrigin(0.5).setDepth(3);
  }

  /** 双侧书架 (西 + 东) */
  private drawSideShelves() {
    const g = this.add.graphics();
    g.setDepth(2);
    const bookColors = [0xa32d2d, 0x3b6d11, 0x4a3a6a, 0xdaa520, 0x2f6b5d];

    const drawShelf = (sx: number, sy: number) => {
      // 架体
      g.fillStyle(0x8b5a2b, 1);
      g.fillRect(sx - 15, sy - 65, 30, 130);
      g.lineStyle(2, 0x5d3a1a, 1);
      g.strokeRect(sx - 15, sy - 65, 30, 130);
      // 4 层架板
      for (let i = 1; i < 4; i++) {
        g.lineBetween(sx - 15, sy - 65 + i * 32, sx + 15, sy - 65 + i * 32);
      }
      // 4 层 × 4 本
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 4; i++) {
          g.fillStyle(bookColors[(row + i) % bookColors.length], 1);
          g.fillRect(sx - 12 + i * 6, sy - 60 + row * 32, 5, 22);
        }
      }
    };

    drawShelf(95, 270);   // 西书架
    drawShelf(625, 270);  // 东书架
  }

  /** 中央案台 (米色面 + 砚 + 卷宗 + 印章) */
  private drawCentralDesk(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 案台
    g.fillStyle(0xe8c98a, 1);
    g.fillRect(x - 100, y - 30, 200, 60);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - 100, y - 30, 200, 60);
    // 抽屉横线
    g.lineStyle(1, 0x5d3a1a, 0.5);
    g.lineBetween(x - 100, y + 5, x + 100, y + 5);
    g.lineBetween(x, y + 5, x, y + 30);
    // 砚台 (黑椭圆)
    g.fillStyle(0x2a2a2a, 1);
    g.fillEllipse(x - 70, y - 8, 22, 12);
    // 笔
    g.lineStyle(2, 0x5d3a1a, 1);
    g.lineBetween(x - 56, y - 10, x - 40, y - 22);
    // 3 卷宗
    g.fillStyle(0xfaecc4, 1);
    g.fillRect(x - 18, y - 20, 10, 22);
    g.fillRect(x - 6, y - 20, 10, 22);
    g.fillRect(x + 6, y - 20, 10, 22);
    g.lineStyle(1, 0x5d3a1a, 1);
    g.strokeRect(x - 18, y - 20, 10, 22);
    g.strokeRect(x - 6, y - 20, 10, 22);
    g.strokeRect(x + 6, y - 20, 10, 22);
    // 红印章
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x + 30, y - 18, 18, 18);
    g.lineStyle(1, 0x5d1515, 1);
    g.strokeRect(x + 30, y - 18, 18, 18);
  }

  /** 阿降 NPC (graphics 手画 · 红长袍 + 灰发 + 拐杖) */
  private drawAxiangNPC(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(3);
    // 阴影
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(x, y + 20, 20, 6);
    // 长袍 红
    g.fillStyle(0xa32d2d, 1);
    g.fillRect(x - 10, y - 4, 20, 24);
    // 长袍底深红
    g.fillStyle(0x7a2020, 1);
    g.fillRect(x - 10, y + 18, 20, 4);
    // 头 米色
    g.fillStyle(0xfce5b4, 1);
    g.fillRect(x - 7, y - 18, 14, 16);
    // 灰发
    g.fillStyle(0x9a9a9a, 1);
    g.fillRect(x - 7, y - 20, 14, 6);
    g.fillCircle(x, y - 22, 3);
    // 眼
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 3, y - 12, 1.5, 1.5);
    g.fillRect(x + 1.5, y - 12, 1.5, 1.5);
    // 拐杖 (右手)
    g.lineStyle(2, 0x5d3a1a, 1);
    g.lineBetween(x + 14, y - 4, x + 16, y + 22);
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x + 14, y - 4, 3);
    // 名牌
    this.add.text(x, y - 32, '阿降', {
      fontFamily: 'serif', fontSize: '10px',
      color: '#a32d2d', backgroundColor: '#fdf0cfee',
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
    }).setOrigin(0.5).setDepth(4);
  }

  /** 南墙 · 2 访客椅 */
  private drawSouthChairs() {
    const g = this.add.graphics();
    g.setDepth(2);
    const drawChair = (cx: number, cy: number) => {
      g.fillStyle(0x8b5a2b, 1);
      g.fillRect(cx - 15, cy - 15, 30, 30);
      g.lineStyle(2, 0x5d3a1a, 1);
      g.strokeRect(cx - 15, cy - 15, 30, 30);
      g.fillStyle(0xa05a35, 1);
      g.fillRect(cx - 15, cy - 15, 30, 8);
    };
    drawChair(190, 410);
    drawChair(530, 410);
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

  private triggerMap() {
    EventBus.emit('show-dialogue', {
      name: '🗺️ 社区拓扑图',
      lines: [
        '（卷轴上画着萌芽镇全貌）',
        '',
        '萌芽镇 · 议政高地 · 9 工坊节点齐备。',
        '从这里能望见远见塔的灯火。',
        '议政高地三阁矗立 · 各司其职。',
      ],
    });
  }

  private triggerRoster() {
    EventBus.emit('show-dialogue', {
      name: '📋 9 工坊名册',
      lines: [
        '（木板上手书 9 行）',
        '',
        '· 开源工坊　· 播宫工坊　· 测评工坊',
        '· 招聘工坊　· 数据工坊　· 会议工坊',
        '· 百晓工坊　· 内参工坊　· 生态工坊',
        '',
        '"各有所长 · 凑齐了一座镇。"',
      ],
    });
  }

  private triggerDesk() {
    EventBus.emit('show-dialogue', {
      name: '📜 阿降的案台',
      lines: [
        '（砚台干净 · 卷宗整齐 · 印章红艳）',
        '',
        '"降"字红印章下压着几篇待批文件。',
        '看样子村长每天都在这里整理社区事务。',
      ],
    });
  }

  private triggerAxiang() {
    const lines = [
      '看地图请便。',
      '议政高地从此望去 · 三阁高耸。',
      '9 工坊各有所长 · 名册自取。',
      '累了？椅子坐坐。',
    ];
    EventBus.emit('show-dialogue', {
      name: '🧓 阿降村长',
      lines: [lines[this.axiangDialogueIndex]],
    });
    this.axiangDialogueIndex = (this.axiangDialogueIndex + 1) % lines.length;
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
    const distMap = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.mapX, this.mapY);
    const distRoster = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.rosterX, this.rosterY);
    const distAxiang = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.axiangX, this.axiangY);
    const distDesk = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.deskX, this.deskY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distAxiang < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 与阿降对话').setPosition(this.axiangX, this.axiangY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerAxiang();
    } else if (distMap < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看地图').setPosition(this.mapX, this.mapY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerMap();
    } else if (distRoster < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看名册').setPosition(this.rosterX, this.rosterY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerRoster();
    } else if (distDesk < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看案台').setPosition(this.deskX, this.deskY - 40).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerDesk();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
