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
 * 执政厅室内 (Council Hall) — proposal voting and decisions.
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

  private podiumX = 0;
  private podiumY = 0;
  private boardX = 0;
  private boardY = 0;

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

    // ---- Floor ----
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // Marble floor
    g.fillStyle(0xefe9d9, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, ROOM_HEIGHT - 120);
    g.lineStyle(3, 0xb8a472, 1);
    g.strokeRect(60, 60, ROOM_WIDTH - 120, ROOM_HEIGHT - 120);
    // Tile pattern (checkerboard cream)
    g.fillStyle(0xe6deca, 0.5);
    const tile = 60;
    for (let y = 60; y < ROOM_HEIGHT - 60; y += tile) {
      for (let x = 60; x < ROOM_WIDTH - 60; x += tile) {
        if (((x / tile) + (y / tile)) % 2 === 0) {
          g.fillRect(x, y, tile, tile);
        }
      }
    }

    // ---- Inner colonnade (around perimeter) ----
    const colSpacing = 130;
    for (let x = 130; x < ROOM_WIDTH - 80; x += colSpacing) {
      this.drawColumn(x, 130);
      this.drawColumn(x, ROOM_HEIGHT - 130);
    }
    for (let y = 200; y < ROOM_HEIGHT - 130; y += colSpacing) {
      this.drawColumn(130, y);
      this.drawColumn(ROOM_WIDTH - 130, y);
    }

    // ---- Central podium (north) ----
    this.podiumX = ROOM_WIDTH / 2;
    this.podiumY = 200;
    this.drawPodium(this.podiumX, this.podiumY);

    // ---- Proposal board (east wall) ----
    this.boardX = ROOM_WIDTH - 180;
    this.boardY = ROOM_HEIGHT / 2;
    this.drawBoard(this.boardX, this.boardY);

    // ---- Audience benches (rows) ----
    for (let row = 0; row < 3; row++) {
      const by = 350 + row * 70;
      this.drawBench(ROOM_WIDTH / 2 - 140, by);
      this.drawBench(ROOM_WIDTH / 2 + 140, by);
    }

    // ---- Brazier (decorative) ----
    this.drawBrazier(220, ROOM_HEIGHT - 200);
    this.drawBrazier(ROOM_WIDTH - 220, ROOM_HEIGHT - 200);

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
    this.add.text(ROOM_WIDTH / 2, 30, '执政厅 · 提案与决议', {
      fontFamily: 'serif', fontSize: '16px',
      color: '#f5f0e0', backgroundColor: '#1a141aaa',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    // Hints
    this.exitHint = this.add.text(0, 0, '[E] 离开执政厅', {
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
    g.fillStyle(0xe6deca, 1);
    g.fillRect(x - 12, y - 40, 24, 80);
    g.fillStyle(0xc8c0a3, 1);
    g.fillRect(x - 16, y - 40, 32, 5);
    g.fillRect(x - 16, y + 35, 32, 5);
    g.lineStyle(1, 0xc0b89d, 0.6);
    g.lineBetween(x, y - 36, x, y + 36);
  }

  private drawPodium(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Stepped base
    g.fillStyle(0xc8c0a3, 1);
    g.fillRect(x - 70, y + 30, 140, 16);
    g.fillStyle(0xdcd4b9, 1);
    g.fillRect(x - 56, y + 14, 112, 16);
    // Podium body
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 36, y - 40, 72, 54);
    g.lineStyle(2, 0x9a8d6c, 1);
    g.strokeRect(x - 36, y - 40, 72, 54);
    // Front emblem
    g.fillStyle(0xb8a472, 1);
    g.fillCircle(x, y - 10, 12);
    g.lineStyle(2, 0x9a8d6c, 1);
    g.strokeCircle(x, y - 10, 12);
  }

  private drawBoard(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Frame
    g.fillStyle(0x4a3e26, 1);
    g.fillRect(x - 38, y - 80, 76, 12);
    g.fillRect(x - 38, y + 68, 76, 12);
    g.fillRect(x - 38, y - 80, 12, 160);
    g.fillRect(x + 26, y - 80, 12, 160);
    // Parchment
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 26, y - 68, 52, 136);
    // Lines (mock proposals)
    g.lineStyle(1, 0x6b5a3e, 0.7);
    for (let i = 0; i < 6; i++) {
      g.lineBetween(x - 18, y - 50 + i * 22, x + 18, y - 50 + i * 22);
    }
    // Title bar
    g.fillStyle(0xb8a472, 1);
    g.fillRect(x - 26, y - 68, 52, 14);
  }

  private drawBench(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    g.fillStyle(0x4a3e26, 1);
    g.fillRect(x - 50, y, 100, 14);
    g.fillRect(x - 46, y + 14, 6, 12);
    g.fillRect(x + 40, y + 14, 6, 12);
    g.lineStyle(1, 0x2a1e16, 1);
    g.strokeRect(x - 50, y, 100, 14);
  }

  private drawBrazier(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Stand
    g.fillStyle(0x4a3e26, 1);
    g.fillRect(x - 4, y, 8, 30);
    g.fillRect(x - 14, y + 30, 28, 6);
    // Bowl
    g.fillStyle(0x8a6f4a, 1);
    g.fillCircle(x, y, 14);
    g.lineStyle(2, 0x4a3e26, 1);
    g.strokeCircle(x, y, 14);
    // Flame
    g.fillStyle(0xe07060, 1);
    g.fillTriangle(x - 8, y - 6, x + 8, y - 6, x, y - 18);
    g.fillStyle(0xe0b060, 1);
    g.fillTriangle(x - 4, y - 8, x + 4, y - 8, x, y - 14);
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

  private triggerPodiumDialogue() {
    EventBus.emit('show-dialogue', {
      name: '🪶 议事讲台',
      lines: [
        '（讲台上空无一人，但站上去有股庄严感）',
        '"提案、辩论、决议——都从这里开始。"',
        '"按章程，需 L5 议事权方可登台陈词。"',
        '提案系统正在筹建中——',
        '当真的有 5+ L5 玩家入驻时，这里会真的活起来。',
        '（你后退一步，留给真正的议事者）',
      ],
    });
  }

  private triggerBoardDialogue() {
    EventBus.emit('show-dialogue', {
      name: '📋 提案公示板',
      lines: [
        '（一块巨大的羊皮纸，本应贴满提案）',
        '当前公示：暂无',
        '',
        '"提案 → 公示（24h）→ 投票（72h）→ 决议归档"',
        '"每一步都被看见，每一票都有据。"',
        '──',
        '「提案系统」预计将与 GitHub Discussions 联动——',
        '届时，社区在 GitHub 上的讨论会同步显示在这里。',
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
    const distPodium = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.podiumX, this.podiumY);
    const distBoard = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boardX, this.boardY);
    const nearExit = distExit < 56;
    const nearPodium = distPodium < INTERACT_DISTANCE;
    const nearBoard = distBoard < INTERACT_DISTANCE;

    if (nearExit) {
      this.exitHint.setPosition(this.exitX, this.exitY - 50).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (nearPodium) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 登台').setPosition(this.podiumX, this.podiumY - 60).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerPodiumDialogue();
    } else if (nearBoard) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看公示').setPosition(this.boardX, this.boardY - 90).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBoardDialogue();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
