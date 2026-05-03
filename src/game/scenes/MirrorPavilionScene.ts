import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 130;
const INTERACT_DISTANCE = 56;

const ROOM_WIDTH = 700;
const ROOM_HEIGHT = 500;
// Wave 8.MirrorPavilion · 天平中心 · 公正大堂

interface SceneInitData {
  returnX?: number;
  returnY?: number;
}

/**
 * 明镜阁室内 (Mirror Pavilion) · 天平中心 — appeals & oversight.
 * In C6.0, just the room. C6.2 will hook into the existing C-9 appeal system.
 */
export class MirrorPavilionScene extends Phaser.Scene {
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

  private scaleX = 0;
  private scaleY = 0;
  private petitionX = 0;
  private petitionY = 0;
  private archiveX = 0;
  private archiveY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('MirrorPavilion');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 380;
    this.returnY = data.returnY ?? 1670;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // === Wave 8 · 米色羊皮纸地板 (替代灰蓝) ===
    const g = this.add.graphics();
    g.setDepth(-5);
    // 暖木墙边
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // 米色羊皮纸地板
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, ROOM_HEIGHT - 120);
    g.lineStyle(3, 0x8b6f4a, 1);
    g.strokeRect(60, 60, ROOM_WIDTH - 120, ROOM_HEIGHT - 120);
    // 散点纹理
    g.fillStyle(0xead4a0, 0.4);
    for (let i = 0; i < 50; i++) {
      const px = 80 + Math.random() * (ROOM_WIDTH - 160);
      const py = 80 + Math.random() * (ROOM_HEIGHT - 160);
      g.fillCircle(px, py, 1.5);
    }
    // 中央同心圆地纹 (天平基座)
    g.lineStyle(1, 0x2a4a4a, 0.4);
    for (let r = 50; r < 180; r += 22) {
      g.strokeCircle(ROOM_WIDTH / 2, ROOM_HEIGHT / 2, r);
    }

    // === 顶梁 (青色 · 跟外景圆顶呼应) ===
    g.fillStyle(0x2a4a4a, 1);
    g.fillRect(0, 0, ROOM_WIDTH, 36);
    g.fillStyle(0x4a6a6a, 1);
    g.fillRect(0, 0, ROOM_WIDTH, 6);

    // === 4 角白柱 ===
    this.drawColumn(110, 100);
    this.drawColumn(ROOM_WIDTH - 110, 100);
    this.drawColumn(110, ROOM_HEIGHT - 110);
    this.drawColumn(ROOM_WIDTH - 110, ROOM_HEIGHT - 110);

    // === 装饰：北墙小铜镜 (不互动 · 只点缀) ===
    this.drawSmallMirror(ROOM_WIDTH / 2, 90);

    // === 主互动 1：巨大天平 (中央 · 公正大堂主角) ===
    this.scaleX = ROOM_WIDTH / 2;
    this.scaleY = ROOM_HEIGHT / 2;
    this.drawGiantScale(this.scaleX, this.scaleY);

    // === 主互动 2：申诉箱 (左下) ===
    this.petitionX = 160;
    this.petitionY = ROOM_HEIGHT - 140;
    this.drawPetitionBox(this.petitionX, this.petitionY);

    // === 主互动 3：案卷柜 (右下) ===
    this.archiveX = ROOM_WIDTH - 160;
    this.archiveY = ROOM_HEIGHT - 140;
    this.drawArchiveCabinet(this.archiveX, this.archiveY);

    // ---- Player ----
    this.createCharacterAnims('player');
    this.player = this.physics.add.sprite(ROOM_WIDTH / 2, ROOM_HEIGHT - 110, 'player', 0);
    this.player.setCollideWorldBounds(true);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(12, 6).setOffset(10, 17);
    this.player.anims.play('player-idle-up');

    // Walls
    const walls = this.physics.add.staticGroup();
    walls.add(this.add.rectangle(ROOM_WIDTH / 2, 50, ROOM_WIDTH, 20, 0, 0));
    walls.add(this.add.rectangle(ROOM_WIDTH / 2, ROOM_HEIGHT - 60, ROOM_WIDTH, 20, 0, 0));
    walls.add(this.add.rectangle(50, ROOM_HEIGHT / 2, 20, ROOM_HEIGHT, 0, 0));
    walls.add(this.add.rectangle(ROOM_WIDTH - 50, ROOM_HEIGHT / 2, 20, ROOM_HEIGHT, 0, 0));
    this.physics.add.collider(this.player, walls);

    // Camera
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // G1.1 · Multiplayer (via helper)
    this.mp = setupMultiplayer(this, 'MirrorPavilion', () => this.player, () => this.currentFacing);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(2);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.eKey = this.input.keyboard!.addKey('E');
    this.mKey = this.input.keyboard!.addKey('M');
    this.jKey = this.input.keyboard!.addKey('J');
    this.kKey = this.input.keyboard!.addKey('K');

    // Exit
    this.exitX = ROOM_WIDTH / 2;
    this.exitY = ROOM_HEIGHT - 70;
    const doorG = this.add.graphics();
    doorG.fillStyle(0x6b5a3e, 1);
    doorG.fillRect(this.exitX - 22, this.exitY - 30, 44, 56);
    doorG.lineStyle(2, 0x4a3e26, 1);
    doorG.strokeRect(this.exitX - 22, this.exitY - 30, 44, 56);

    // Title
    this.add.text(ROOM_WIDTH / 2, 30, '明镜阁 · 监察与申诉', {
      fontFamily: 'serif', fontSize: '16px',
      color: '#f5f0e0', backgroundColor: '#1a141aaa',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    // Hints
    this.exitHint = this.add.text(0, 0, '[E] 离开明镜阁', {
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

  private drawColumn(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 米色柱身
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 8, y - 50, 16, 100);
    g.lineStyle(1, 0x8b6f4a, 0.8);
    g.strokeRect(x - 8, y - 50, 16, 100);
    // 柱头
    g.fillStyle(0xc9a55b, 1);
    g.fillRect(x - 12, y - 50, 24, 6);
    g.fillRect(x - 12, y + 44, 24, 6);
    // 柱身纹
    g.lineStyle(1, 0xc9a55b, 0.5);
    g.lineBetween(x - 3, y - 44, x - 3, y + 44);
    g.lineBetween(x + 3, y - 44, x + 3, y + 44);
  }

  /** 北墙小铜镜 (装饰 · 不互动) */
  private drawSmallMirror(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 金边框
    g.fillStyle(0xdaa520, 1);
    g.fillEllipse(x, y, 70, 50);
    g.lineStyle(2, 0x8b6f4a, 1);
    g.strokeEllipse(x, y, 70, 50);
    // 镜面 (青色调)
    g.fillStyle(0x7aa0a0, 1);
    g.fillEllipse(x, y, 56, 38);
    // 镜面高光
    g.lineStyle(1.5, 0xc8e0e0, 0.7);
    g.strokeEllipse(x - 10, y - 6, 22, 14);
    // 顶饰金叶
    g.fillStyle(0xdaa520, 1);
    g.fillTriangle(x, y - 32, x - 6, y - 26, x + 6, y - 26);
  }

  /** 巨大天平 (中央 · 主互动 1) */
  private drawGiantScale(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // === 立柱 (青铜) ===
    g.fillStyle(0x4a6a6a, 1);
    g.fillRect(x - 8, y - 30, 16, 100);
    g.lineStyle(2, 0x2a4a4a, 1);
    g.strokeRect(x - 8, y - 30, 16, 100);
    // 立柱顶饰 (金球)
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x, y - 35, 8);
    g.lineStyle(1, 0x8b6f4a, 1);
    g.strokeCircle(x, y - 35, 8);
    // === 横梁 (粗) ===
    g.fillStyle(0x6a8a8a, 1);
    g.fillRect(x - 110, y - 26, 220, 10);
    g.lineStyle(2, 0x2a4a4a, 1);
    g.strokeRect(x - 110, y - 26, 220, 10);
    // 横梁中心金徽
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x, y - 21, 5);
    // === 双吊链 ===
    g.lineStyle(2, 0x2a4a4a, 1);
    for (let dx of [-100, 100]) {
      // 链条 (3 段)
      for (let i = 0; i < 3; i++) {
        g.fillStyle(0x4a6a6a, 1);
        g.fillCircle(x + dx, y - 15 + i * 6, 2.5);
      }
    }
    // === 左盘 (米色羊皮纸 · 含申诉权重) ===
    g.fillStyle(0xfdf0cf, 1);
    g.fillEllipse(x - 100, y + 8, 60, 14);
    g.lineStyle(2, 0x2a4a4a, 1);
    g.strokeEllipse(x - 100, y + 8, 60, 14);
    g.fillStyle(0xc9a55b, 1);
    g.fillEllipse(x - 100, y + 12, 60, 14);
    // 左盘内"申诉"标记
    g.fillStyle(0x6b3434, 1);
    g.fillCircle(x - 100, y + 5, 4);
    // === 右盘 (米色 · 含决议权重) ===
    g.fillStyle(0xfdf0cf, 1);
    g.fillEllipse(x + 100, y + 8, 60, 14);
    g.lineStyle(2, 0x2a4a4a, 1);
    g.strokeEllipse(x + 100, y + 8, 60, 14);
    g.fillStyle(0xc9a55b, 1);
    g.fillEllipse(x + 100, y + 12, 60, 14);
    // 右盘内"决议"金块
    g.fillStyle(0xdaa520, 1);
    g.fillRect(x + 96, y, 8, 8);
    // === 底座 (青铜阶梯) ===
    g.fillStyle(0x4a6a6a, 1);
    g.fillRect(x - 30, y + 70, 60, 8);
    g.fillStyle(0x6a8a8a, 1);
    g.fillRect(x - 24, y + 64, 48, 6);
    g.fillStyle(0x4a6a6a, 1);
    g.fillRect(x - 18, y + 58, 36, 6);
    // 底座金徽
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x, y + 75, 4);
    // === 标签 ===
    this.add.text(x, y - 50, '公正之衡', {
      fontFamily: 'serif', fontSize: '12px',
      color: '#fdf0cf', backgroundColor: '#2a4a4aee',
      padding: { left: 6, right: 6, top: 1, bottom: 1 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
  }

  /** 申诉箱 (左下 · 主互动 2) */
  private drawPetitionBox(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 木箱主体
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 30, y - 30, 60, 50);
    g.lineStyle(2, 0x3a2a1a, 1);
    g.strokeRect(x - 30, y - 30, 60, 50);
    // 顶盖 (深色 · 略凸)
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 32, y - 32, 64, 6);
    // 投递口 (顶部细缝)
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 18, y - 31, 36, 2);
    // 青色锁 (前面)
    g.fillStyle(0x2a4a4a, 1);
    g.fillRect(x - 8, y - 8, 16, 12);
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x, y - 2, 3);
    // 标签条
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 22, y + 8, 44, 10);
    g.lineStyle(1, 0x8b6f4a, 1);
    g.strokeRect(x - 22, y + 8, 44, 10);
    // 标签文字
    this.add.text(x, y + 13, '申诉', {
      fontFamily: 'serif', fontSize: '10px',
      color: '#5d3a1a', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
    // 底座
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 32, y + 20, 64, 4);
  }

  /** 案卷柜 (右下 · 主互动 3) */
  private drawArchiveCabinet(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 柜身
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 35, y - 32, 70, 64);
    g.lineStyle(2, 0x3a2a1a, 1);
    g.strokeRect(x - 35, y - 32, 70, 64);
    // 顶盖
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 38, y - 36, 76, 6);
    // 3 抽屉
    for (let i = 0; i < 3; i++) {
      const dy = -22 + i * 20;
      // 抽屉面
      g.fillStyle(0x8b6f4a, 1);
      g.fillRect(x - 30, y + dy, 60, 16);
      g.lineStyle(1, 0x3a2a1a, 1);
      g.strokeRect(x - 30, y + dy, 60, 16);
      // 把手 (青铜)
      g.fillStyle(0x2a4a4a, 1);
      g.fillRect(x - 6, y + dy + 6, 12, 4);
      g.fillStyle(0xdaa520, 1);
      g.fillCircle(x, y + dy + 8, 1.5);
    }
    // 标签条
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 25, y - 28, 50, 10);
    this.add.text(x, y - 23, '案卷', {
      fontFamily: 'serif', fontSize: '10px',
      color: '#2a4a4a', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
    // 底座
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 38, y + 32, 76, 4);
  }

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

  private exit() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('GovHill', { spawnX: this.returnX, spawnY: this.returnY });
    });
  }

  private triggerScaleDialogue() {
    EventBus.emit('show-dialogue', {
      name: '⚖️ 公正之衡',
      lines: [
        '（青铜立柱、横梁、双吊盘——天平静立中央）',
        '"明镜照影，天平称重——监察之要，皆在此衡。"',
        '',
        '左盘：申诉权重',
        '右盘：决议权重',
        '',
        '本阁主管：',
        '─ 任务申诉（CV 评分异议）',
        '─ 监察委员会复议',
        '─ 章程异议（向理事会反馈）',
        '',
        '"3 位复审员独立评议——只上调，不下调。"',
        '"明镜不偏私，天平不徇情。"',
      ],
    });
  }

  private triggerPetitionDialogue() {
    EventBus.emit('show-dialogue', {
      name: '📥 申诉箱',
      lines: [
        '（一只青锁木箱 · 顶部细缝可投递书信）',
        '"凡评审结果存疑——皆可申诉。"',
        '',
        '申诉流程：',
        '─ 1. 在任务面板（J 键）发起申诉',
        '─ 2. 系统自动分配 3 位复审员',
        '─ 3. 独立评议 · 7 日内出复审结论',
        '─ 4. 复审结论归档（案卷柜）',
        '',
        '"明镜不偏私，但也不轻易翻案。"',
        '──',
        '后续将统一收归本阁 · 通过 [E] 直接投递。',
      ],
    });
  }

  private triggerArchiveDialogue() {
    EventBus.emit('show-dialogue', {
      name: '🗄️ 案卷柜',
      lines: [
        '（三层抽屉的青铜把手柜 · 历次仲裁的归档之地）',
        '',
        '【上层】近期申诉案：暂无（系统初启）',
        '【中层】历史决议案：暂无',
        '【下层】章程异议：暂无',
        '',
        '"每一桩判定，皆有据可查。"',
        '"被看见 · 被记录 · 被追溯——是公允的根基。"',
        '──',
        '后续将与申诉记录联动 · 自动归档。',
      ],
    });
  }

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

    if (Phaser.Input.Keyboard.JustDown(this.mKey)) EventBus.emit('open-world-map', { currentScene: 'GovHill' });
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) EventBus.emit('open-quest-log');
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) EventBus.emit('open-mailbox');

    const distExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitX, this.exitY);
    const distScale = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.scaleX, this.scaleY);
    const distPetition = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.petitionX, this.petitionY);
    const distArchive = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.archiveX, this.archiveY);
    const nearExit = distExit < 56;
    const nearScale = distScale < INTERACT_DISTANCE * 1.4;
    const nearPetition = distPetition < INTERACT_DISTANCE;
    const nearArchive = distArchive < INTERACT_DISTANCE;

    if (nearExit) {
      this.exitHint.setPosition(this.exitX, this.exitY - 40).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (nearScale) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看天平').setPosition(this.scaleX, this.scaleY - 70).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerScaleDialogue();
    } else if (nearPetition) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 投申诉').setPosition(this.petitionX, this.petitionY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerPetitionDialogue();
    } else if (nearArchive) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看案卷').setPosition(this.archiveX, this.archiveY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerArchiveDialogue();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
