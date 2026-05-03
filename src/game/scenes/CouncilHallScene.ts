import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 130;
const INTERACT_DISTANCE = 56;

const ROOM_WIDTH = 1000;
const ROOM_HEIGHT = 700;
// Wave 8.CouncilHall · 法庭式 (主席台 + 旁听席)

interface SceneInitData {
  returnX?: number;
  returnY?: number;
}

/**
 * 理事会室内 (Council Hall) · 法庭式 — proposal voting and decisions.
 * Phase 4 (C6.3) will add real proposal mechanics. C6.0 = room only.
 */
export class CouncilHallScene extends Phaser.Scene {
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

  private charterX = 0;
  private charterY = 0;
  private podiumX = 0;
  private podiumY = 0;
  private audienceX = 0;
  private audienceY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('CouncilHall');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 800;
    this.returnY = data.returnY ?? 1300;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // === Wave 8 · 米色羊皮纸地板 (替代灰蓝大理石) ===
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
    // 地板纹理
    g.fillStyle(0xead4a0, 0.4);
    for (let i = 0; i < 80; i++) {
      const px = 80 + Math.random() * (ROOM_WIDTH - 160);
      const py = 80 + Math.random() * (ROOM_HEIGHT - 160);
      g.fillCircle(px, py, 1.5);
    }
    // 中央走道纵线 (法庭仪式感)
    g.fillStyle(0xead4a0, 0.6);
    g.fillRect(ROOM_WIDTH / 2 - 60, 180, 120, ROOM_HEIGHT - 280);
    g.lineStyle(1, 0xc9a55b, 0.8);
    g.lineBetween(ROOM_WIDTH / 2 - 60, 180, ROOM_WIDTH / 2 - 60, ROOM_HEIGHT - 100);
    g.lineBetween(ROOM_WIDTH / 2 + 60, 180, ROOM_WIDTH / 2 + 60, ROOM_HEIGHT - 100);

    // === 顶梁 (红色 · 跟外景平顶呼应) ===
    g.fillStyle(0x6b3434, 1);
    g.fillRect(0, 0, ROOM_WIDTH, 36);
    g.fillStyle(0x854444, 1);
    g.fillRect(0, 0, ROOM_WIDTH, 6);

    // === 左右白柱 (3 对) ===
    this.drawColumn(120, 110);
    this.drawColumn(ROOM_WIDTH - 120, 110);
    this.drawColumn(120, ROOM_HEIGHT - 130);
    this.drawColumn(ROOM_WIDTH - 120, ROOM_HEIGHT - 130);

    // === 主互动 1：CUA 章程 (北墙) ===
    this.charterX = ROOM_WIDTH / 2;
    this.charterY = 110;
    this.drawCharter(this.charterX, this.charterY);

    // === 主互动 2：主席台 (中央 · 北侧) ===
    this.podiumX = ROOM_WIDTH / 2;
    this.podiumY = 220;
    this.drawPresidiumStage(this.podiumX, this.podiumY);

    // === 主互动 3：旁听席 (4 排长椅 · 中下部) ===
    this.audienceX = ROOM_WIDTH / 2;
    this.audienceY = ROOM_HEIGHT / 2 + 80;
    this.drawAudienceRows(this.audienceX, this.audienceY);

    // === 装饰：双火盆 (角落 · 法庭仪式感) ===
    this.drawBrazier(220, ROOM_HEIGHT - 180);
    this.drawBrazier(ROOM_WIDTH - 220, ROOM_HEIGHT - 180);

    // ---- Player ----
    this.createCharacterAnims('player');
    this.player = this.physics.add.sprite(ROOM_WIDTH / 2, ROOM_HEIGHT - 130, 'player', 0);
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

    // Camera
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // G1.1 · Multiplayer (via helper)
    this.mp = setupMultiplayer(this, 'CouncilHall', () => this.player, () => this.currentFacing);

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

    // Exit door (south)
    this.exitX = ROOM_WIDTH / 2;
    this.exitY = ROOM_HEIGHT - 70;
    const doorG = this.add.graphics();
    doorG.fillStyle(0x6b5a3e, 1);
    doorG.fillRect(this.exitX - 30, this.exitY - 40, 60, 70);
    doorG.lineStyle(2, 0x4a3e26, 1);
    doorG.strokeRect(this.exitX - 30, this.exitY - 40, 60, 70);

    // Title
    this.add.text(ROOM_WIDTH / 2, 30, '理事会 · 提案与决议', {
      fontFamily: 'serif', fontSize: '16px',
      color: '#f5f0e0', backgroundColor: '#1a141aaa',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    // Hints
    this.exitHint = this.add.text(0, 0, '[E] 离开理事会', {
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
    g.lineStyle(1, 0xc9a55b, 0.5);
    g.lineBetween(x - 3, y - 44, x - 3, y + 44);
    g.lineBetween(x + 3, y - 44, x + 3, y + 44);
  }

  /** CUA 章程 (北墙) · 主互动 1 */
  private drawCharter(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 框
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 110, y - 35, 220, 70);
    // 内框金边
    g.fillStyle(0xdaa520, 1);
    g.fillRect(x - 105, y - 30, 210, 60);
    // 米色羊皮纸面
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 100, y - 25, 200, 50);
    // 章程文字行 (用细线模拟)
    g.lineStyle(1, 0x6b3434, 0.7);
    for (let i = 0; i < 5; i++) {
      g.lineBetween(x - 90, y - 18 + i * 10, x + 90, y - 18 + i * 10);
    }
    // 标题"CUA 章程"
    this.add.text(x, y - 50, 'CUA 章程', {
      fontFamily: 'serif', fontSize: '13px',
      color: '#fdf0cf', backgroundColor: '#6b3434ee',
      padding: { left: 8, right: 8, top: 2, bottom: 2 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
  }

  /** 主席台 · 主互动 2 (3 椅 + 议事台) */
  private drawPresidiumStage(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 主席台基座 (米色阶梯)
    g.fillStyle(0xead4a0, 1);
    g.fillRect(x - 130, y + 20, 260, 16);
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 120, y + 10, 240, 12);
    g.lineStyle(2, 0x8b6f4a, 1);
    g.strokeRect(x - 120, y + 10, 240, 12);
    // 议事台 (中央 · 木质大桌)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 80, y - 10, 160, 24);
    g.lineStyle(2, 0x3a2a1a, 1);
    g.strokeRect(x - 80, y - 10, 160, 24);
    // 议事台金徽 (中央 CUA 标志)
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x, y + 2, 8);
    g.fillStyle(0x6b3434, 1);
    g.fillCircle(x, y + 2, 5);
    g.fillStyle(0xfac775, 1);
    g.fillCircle(x, y + 2, 2);
    // 3 主席椅 (台后)
    [-50, 0, 50].forEach((dx) => {
      // 椅背
      g.fillStyle(0x6b3434, 1);
      g.fillRect(x + dx - 14, y - 40, 28, 32);
      g.lineStyle(1, 0x4a1a1a, 1);
      g.strokeRect(x + dx - 14, y - 40, 28, 32);
      // 椅面
      g.fillStyle(0x8b3434, 1);
      g.fillRect(x + dx - 16, y - 12, 32, 6);
    });
    // 中央椅 高背 (主席座 · 略高)
    g.fillStyle(0xc0392b, 1);
    g.fillRect(x - 14, y - 50, 28, 12);
    g.lineStyle(1, 0x4a1a1a, 1);
    g.strokeRect(x - 14, y - 50, 28, 12);
  }

  /** 旁听席 · 主互动 3 (4 排长椅) */
  private drawAudienceRows(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 4 排长椅 · 每排左右各一
    for (let row = 0; row < 4; row++) {
      const by = y - 60 + row * 38;
      this.drawBench(x - 130, by);
      this.drawBench(x + 130, by);
    }
  }

  private drawBench(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 椅面
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 60, y, 120, 14);
    g.lineStyle(1, 0x3a2a1a, 1);
    g.strokeRect(x - 60, y, 120, 14);
    // 椅腿
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 56, y + 14, 6, 12);
    g.fillRect(x + 50, y + 14, 6, 12);
    // 椅面高光
    g.fillStyle(0x8b6f4a, 0.5);
    g.fillRect(x - 60, y, 120, 3);
  }

  private drawBrazier(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 立柱
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 4, y, 8, 30);
    g.fillRect(x - 14, y + 30, 28, 6);
    // 火盆
    g.fillStyle(0xc9a55b, 1);
    g.fillCircle(x, y, 14);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeCircle(x, y, 14);
    // 火焰
    g.fillStyle(0xc0392b, 1);
    g.fillTriangle(x - 8, y - 4, x + 8, y - 4, x, y - 18);
    g.fillStyle(0xdaa520, 1);
    g.fillTriangle(x - 4, y - 6, x + 4, y - 6, x, y - 14);
    g.fillStyle(0xfac775, 1);
    g.fillCircle(x, y - 10, 2);
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

  private triggerCharterDialogue() {
    EventBus.emit('show-dialogue', {
      name: '📜 CUA 章程',
      lines: [
        '（金边羊皮纸上写满了细密的小字）',
        '',
        '"理事会议事原则：',
        ' 一·提案需 L2 mentor 联署 3 人。',
        ' 二·公示 24 小时，方可投票。',
        ' 三·投票需 L1 活跃贡献者，多数过半。',
        ' 四·决议归档，每条皆有据。"',
        '',
        '"五·凡治理之事，均向高地公开。"',
        '──',
        '"治理不是终点。被看见，才是。"',
      ],
    });
  }

  private triggerPodiumDialogue() {
    EventBus.emit('show-dialogue', {
      name: '🪶 主席台',
      lines: [
        '（议事台中央嵌着 CUA 金徽 · 后方三把主席椅）',
        '"提案、辩论、决议——都从这里开始。"',
        '',
        '当前会议：',
        '─ 议程：暂无（无现役议题）',
        '─ 主持：待选',
        '─ 联席主席（L4）：缺位',
        '',
        '"按章程，需 L2 mentor 方可登台陈词。"',
        '提案系统正在筹建中——',
        '当真的有 5+ L2 玩家入驻时，这里会真的活起来。',
        '（你后退一步，留给真正的议事者）',
      ],
    });
  }

  private triggerAudienceDialogue() {
    EventBus.emit('show-dialogue', {
      name: '🪑 旁听席',
      lines: [
        '（4 排木长椅 · 此刻空无一人）',
        '',
        '"凡 CUA 成员，皆可旁听议事。"',
        '"L0 新人也能坐——只是没有发言权。"',
        '',
        '本席规则：',
        '─ 静默旁听 (任何人)',
        '─ 提问发言 (L1+ 活跃贡献者)',
        '─ 现场投票 (L1+ · 须实名)',
        '',
        '"看见，是参与的第一步。"',
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
    const distCharter = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.charterX, this.charterY);
    const distPodium = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.podiumX, this.podiumY);
    const distAudience = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.audienceX, this.audienceY);
    const nearExit = distExit < 56;
    const nearCharter = distCharter < INTERACT_DISTANCE * 1.4;
    const nearPodium = distPodium < INTERACT_DISTANCE * 1.5;
    const nearAudience = distAudience < INTERACT_DISTANCE * 2;

    if (nearExit) {
      this.exitHint.setPosition(this.exitX, this.exitY - 50).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (nearCharter) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看章程').setPosition(this.charterX, this.charterY - 70).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerCharterDialogue();
    } else if (nearPodium) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 登台').setPosition(this.podiumX, this.podiumY - 70).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerPodiumDialogue();
    } else if (nearAudience) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看旁听席').setPosition(this.audienceX, this.audienceY - 90).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerAudienceDialogue();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
