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
 * 引才坊 (Yincai Fang) — 招聘工作组工坊室内
 *
 * Theme: Recruitment / talent matching agency.
 * Visual: job postings cork board, resume rack, interview round table.
 */
export class YincaiFangScene extends Phaser.Scene {
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

  private boardX = 0;
  private boardY = 0;
  private resumeX = 0;
  private resumeY = 0;
  private tableX = 0;
  private tableY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('YincaiFang');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Floor (warm office wood, with rug feel) ----
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x18120e, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    g.fillStyle(0xc8a87a, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(3, 0x6b5230, 1);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    // Wood plank lines
    g.lineStyle(1, 0x8a6f4a, 0.5);
    for (let y = 70; y < ROOM_HEIGHT - 60; y += 36) {
      g.lineBetween(60, y, ROOM_WIDTH - 60, y);
    }

    // ---- North wall ----
    g.fillStyle(0x6b5230, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- Job posting cork board (north — covers most of north wall) ----
    this.boardX = ROOM_WIDTH / 2;
    this.boardY = 130;
    this.drawJobBoard(this.boardX, this.boardY);

    // ---- Resume rack (east) ----
    this.resumeX = ROOM_WIDTH - 130;
    this.resumeY = ROOM_HEIGHT / 2;
    this.drawResumeRack(this.resumeX, this.resumeY);

    // ---- Interview round table (center-south) ----
    this.tableX = ROOM_WIDTH / 2;
    this.tableY = ROOM_HEIGHT / 2 + 60;
    this.drawInterviewTable(this.tableX, this.tableY);

    // ---- Plant pots (decoration, west) ----
    this.drawPlant(140, ROOM_HEIGHT / 2 - 50);
    this.drawPlant(140, ROOM_HEIGHT / 2 + 90);

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
    this.mp = setupMultiplayer(this, 'YincaiFang', () => this.player, () => this.currentFacing);

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
    this.add.text(ROOM_WIDTH / 2, 30, '— 引才坊 · 招聘工作组 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#e0a060', backgroundColor: '#18120eaa',
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

  private drawJobBoard(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Cork board frame
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 200, y - 50, 400, 100);
    g.lineStyle(3, 0x3a2818, 1);
    g.strokeRect(x - 200, y - 50, 400, 100);
    // Cork surface
    g.fillStyle(0xc89070, 1);
    g.fillRect(x - 192, y - 42, 384, 84);
    // Cork texture (small dots)
    g.fillStyle(0x8a5040, 0.4);
    for (let dx = -180; dx < 180; dx += 14) {
      for (let dy = -36; dy < 36; dy += 14) {
        g.fillCircle(x + dx + (dy % 7), y + dy, 1);
      }
    }
    // 12 job postings (3 rows x 4 cols, each is a pinned card)
    const cardW = 64, cardH = 22;
    const startX = x - 180;
    const startY = y - 36;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const cx = startX + col * (cardW + 8);
        const cy = startY + row * (cardH + 6);
        // Card background (white/yellow)
        g.fillStyle(row === 0 ? 0xfff8e0 : (row === 1 ? 0xe0f0ff : 0xfff0f0), 1);
        g.fillRect(cx, cy, cardW, cardH);
        g.lineStyle(1, 0x6b5230, 0.6);
        g.strokeRect(cx, cy, cardW, cardH);
        // Title bar
        const colors = [0xe0a060, 0x60a0e0, 0xe06070];
        g.fillStyle(colors[row], 0.8);
        g.fillRect(cx, cy, cardW, 5);
        // Lines (job desc)
        g.lineStyle(1, 0x4a3826, 0.5);
        g.lineBetween(cx + 4, cy + 9, cx + cardW - 4, cy + 9);
        g.lineBetween(cx + 4, cy + 13, cx + cardW - 8, cy + 13);
        g.lineBetween(cx + 4, cy + 17, cx + cardW - 16, cy + 17);
        // Pin (red)
        g.fillStyle(0xff3030, 1);
        g.fillCircle(cx + cardW / 2, cy - 1, 2);
        g.fillStyle(0x800000, 1);
        g.fillCircle(cx + cardW / 2, cy - 1, 1);
      }
    }
  }

  private drawResumeRack(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Frame (wood shelf with multiple slots)
    g.fillStyle(0x4a3826, 1);
    g.fillRect(x - 46, y - 90, 92, 180);
    g.lineStyle(2, 0x2a1e10, 1);
    g.strokeRect(x - 46, y - 90, 92, 180);
    // 4 horizontal shelves, each holding folders
    for (let shelf = 0; shelf < 4; shelf++) {
      const sy = y - 80 + shelf * 42;
      // Shelf surface
      g.fillStyle(0x8a6f4a, 1);
      g.fillRect(x - 42, sy, 84, 4);
      // 5-6 folders standing up on each shelf
      const folderColors = [0xe0a060, 0x6090c0, 0x70b070, 0xc06070, 0xa080c0];
      for (let f = 0; f < 5; f++) {
        const fx = x - 38 + f * 16;
        g.fillStyle(folderColors[f % folderColors.length], 1);
        g.fillRect(fx, sy - 32, 12, 32);
        g.lineStyle(1, 0x3a2818, 1);
        g.strokeRect(fx, sy - 32, 12, 32);
        // Tab
        g.fillStyle(0xc8a87a, 1);
        g.fillRect(fx + 2, sy - 36, 8, 5);
      }
    }
  }

  private drawInterviewTable(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(0);
    // Round table
    g.fillStyle(0x8a6f4a, 1);
    g.fillCircle(x, y, 50);
    g.lineStyle(2, 0x4a3826, 1);
    g.strokeCircle(x, y, 50);
    // Inner ring
    g.fillStyle(0x6b5230, 1);
    g.fillCircle(x, y, 36);

    // 4 chairs around (north / south / east / west)
    const g2 = this.add.graphics();
    g2.setDepth(1);
    [
      [x, y - 64], [x, y + 64], [x + 64, y], [x - 64, y],
    ].forEach(([cx, cy]) => {
      g2.fillStyle(0x4a3826, 1);
      g2.fillRect(cx - 8, cy - 8, 16, 16);
      g2.lineStyle(1, 0x2a1e10, 1);
      g2.strokeRect(cx - 8, cy - 8, 16, 16);
      // Cushion
      g2.fillStyle(0x9a4a3a, 1);
      g2.fillRect(cx - 7, cy - 7, 14, 14);
    });

    // Coffee cups + papers on table
    const g3 = this.add.graphics();
    g3.setDepth(2);
    // Cup 1
    g3.fillStyle(0xede5cf, 1);
    g3.fillCircle(x - 18, y - 8, 5);
    g3.fillStyle(0x6b3a18, 1);
    g3.fillCircle(x - 18, y - 8, 3);
    // Cup 2
    g3.fillStyle(0xede5cf, 1);
    g3.fillCircle(x + 14, y + 6, 5);
    g3.fillStyle(0x6b3a18, 1);
    g3.fillCircle(x + 14, y + 6, 3);
    // Resume on table
    g3.fillStyle(0xede5cf, 1);
    g3.fillRect(x - 6, y - 14, 16, 22);
    g3.lineStyle(1, 0x6b5230, 0.5);
    g3.lineBetween(x - 4, y - 8, x + 8, y - 8);
    g3.lineBetween(x - 4, y - 4, x + 6, y - 4);
    g3.lineBetween(x - 4, y, x + 6, y);
    g3.lineBetween(x - 4, y + 4, x + 4, y + 4);
  }

  private drawPlant(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Pot
    g.fillStyle(0x8a4a1e, 1);
    g.fillTriangle(x - 14, y + 18, x + 14, y + 18, x, y + 30);
    g.fillRect(x - 14, y + 16, 28, 4);
    g.lineStyle(2, 0x3a1808, 1);
    g.strokeRect(x - 14, y + 16, 28, 4);
    // Leaves (green clumps)
    g.fillStyle(0x4a8050, 1);
    g.fillCircle(x, y + 6, 12);
    g.fillCircle(x - 8, y + 2, 8);
    g.fillCircle(x + 8, y + 2, 8);
    g.fillCircle(x, y - 6, 8);
    g.lineStyle(1, 0x2a4828, 1);
    g.strokeCircle(x, y + 6, 12);
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
      name: '📌 招聘公告板',
      lines: [
        '（软木板上钉满了 12 张职位卡片）',
        '',
        '上排（橙色）：AI 工程师 · 4 个职位',
        '中排（蓝色）：产品/运营 · 4 个职位',
        '下排（红色）：研究/学术 · 4 个职位',
        '',
        '"CUA 不是猎头公司——"',
        '"我们做的是匹配和内推。"',
        '',
        '"想发布职位？给 jobs@cua.dev 发邮件。"',
      ],
    });
  }

  private triggerResume() {
    EventBus.emit('show-dialogue', {
      name: '📁 简历架',
      lines: [
        '（4 层架子，每层放着 5 份彩色文件夹）',
        '',
        '"求职者把简历放这里——按方向归类。"',
        '"工作组成员定期翻阅，主动牵线。"',
        '',
        '"你的简历应该被合适的人看到。"',
        '',
        '当前：73 份简历 · 已成功内推 19 例',
      ],
    });
  }

  private triggerTable() {
    EventBus.emit('show-dialogue', {
      name: '☕ 面试圆桌',
      lines: [
        '（4 把椅子围着圆桌，桌上有咖啡和一份简历）',
        '',
        '"圆桌——平等的形状。"',
        '"求职者不是被审视的对象，是平等的对话者。"',
        '',
        '"每周三、周五是开放面谈日。"',
        '"想聊聊职业方向——任何成员都可来坐坐。"',
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
    const distBoard = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boardX, this.boardY);
    const distRes = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.resumeX, this.resumeY);
    const distTbl = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.tableX, this.tableY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distBoard < INTERACT_DISTANCE * 1.8) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看招聘板').setPosition(this.boardX, this.boardY - 70).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBoard();
    } else if (distRes < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看简历架').setPosition(this.resumeX, this.resumeY - 110).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerResume();
    } else if (distTbl < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看面试桌').setPosition(this.tableX, this.tableY - 70).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerTable();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
