import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 130;
const INTERACT_DISTANCE = 56;

const ROOM_WIDTH = 800;
const ROOM_HEIGHT = 600;

interface SceneInitData {
  returnX?: number;
  returnY?: number;
}

/**
 * 远见塔室内 (Vision Tower) — long-term planning, roadmap display.
 * Phase 4 will fill this with the actual roadmap. C6.0 is just the room.
 */
export class VisionTowerScene extends Phaser.Scene {
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

  private chartX = 0;
  private chartY = 0;
  private telescopeX = 0;
  private telescopeY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('VisionTower');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 800;
    this.returnY = data.returnY ?? 620;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // Floor — circular marble (matches tower's circular base)
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // Marble floor (octagonal feel)
    g.fillStyle(0xefe9d9, 1);
    g.fillRoundedRect(80, 60, ROOM_WIDTH - 160, ROOM_HEIGHT - 120, 80);
    g.lineStyle(3, 0xb8a472, 1);
    g.strokeRoundedRect(80, 60, ROOM_WIDTH - 160, ROOM_HEIGHT - 120, 80);
    // Floor pattern (concentric arcs)
    g.lineStyle(1, 0xc0b89d, 0.5);
    for (let r = 80; r < 360; r += 40) {
      g.strokeCircle(ROOM_WIDTH / 2, ROOM_HEIGHT / 2, r);
    }
    // Center medallion
    g.fillStyle(0xb8a472, 1);
    g.fillCircle(ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 24);
    g.fillStyle(0xefe9d9, 1);
    g.fillCircle(ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 18);

    // Columns (4 corners)
    this.drawColumn(140, 130);
    this.drawColumn(ROOM_WIDTH - 140, 130);
    this.drawColumn(140, ROOM_HEIGHT - 130);
    this.drawColumn(ROOM_WIDTH - 140, ROOM_HEIGHT - 130);

    // Telescope (north wall — looking out at the world)
    this.telescopeX = ROOM_WIDTH / 2;
    this.telescopeY = 110;
    this.drawTelescope(this.telescopeX, this.telescopeY);

    // Chart wall (west — roadmap display)
    this.chartX = 140;
    this.chartY = ROOM_HEIGHT / 2;
    this.drawChartFrame(this.chartX, this.chartY);

    // Decorative scroll piles
    this.drawScrollPile(220, ROOM_HEIGHT - 180);
    this.drawScrollPile(ROOM_WIDTH - 220, ROOM_HEIGHT - 180);

    // ---- Player ----
    this.createCharacterAnims('player');
    this.player = this.physics.add.sprite(ROOM_WIDTH / 2, ROOM_HEIGHT - 120, 'player', 0);
    this.player.setCollideWorldBounds(true);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(12, 6).setOffset(10, 17);
    this.player.anims.play('player-idle-up');

    // Wall colliders (invisible)
    const walls = this.physics.add.staticGroup();
    walls.add(this.add.rectangle(ROOM_WIDTH / 2, 50, ROOM_WIDTH, 20, 0, 0));   // top
    walls.add(this.add.rectangle(ROOM_WIDTH / 2, ROOM_HEIGHT - 60, ROOM_WIDTH, 20, 0, 0)); // bottom
    walls.add(this.add.rectangle(70, ROOM_HEIGHT / 2, 20, ROOM_HEIGHT, 0, 0));  // left
    walls.add(this.add.rectangle(ROOM_WIDTH - 70, ROOM_HEIGHT / 2, 20, ROOM_HEIGHT, 0, 0)); // right
    this.physics.add.collider(this.player, walls);

    // Camera
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // G1.1 · Multiplayer (via helper)
    this.mp = setupMultiplayer(this, 'VisionTower', () => this.player, () => this.currentFacing);

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

    // Exit (south door, back to GovHill)
    this.exitX = ROOM_WIDTH / 2;
    this.exitY = ROOM_HEIGHT - 70;
    // Door visual
    const doorG = this.add.graphics();
    doorG.fillStyle(0x6b5a3e, 1);
    doorG.fillRect(this.exitX - 24, this.exitY - 30, 48, 60);
    doorG.lineStyle(2, 0x4a3e26, 1);
    doorG.strokeRect(this.exitX - 24, this.exitY - 30, 48, 60);
    doorG.setDepth(0);

    // Title label
    this.add.text(ROOM_WIDTH / 2, 30, '远见塔 · 路线图与远眺', {
      fontFamily: 'serif', fontSize: '16px',
      color: '#f5f0e0', backgroundColor: '#1a141aaa',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    // Hints
    this.exitHint = this.add.text(0, 0, '[E] 离开远见塔', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#3a4a6add',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.interactHint = this.add.text(0, 0, '[E] 查看', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#000000aa',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);
  }

  // ============ DRAWING HELPERS ============

  private drawColumn(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    g.fillStyle(0xe6deca, 1);
    g.fillRect(x - 14, y - 50, 28, 100);
    g.fillStyle(0xc8c0a3, 1);
    g.fillRect(x - 18, y - 50, 36, 6);
    g.fillRect(x - 18, y + 44, 36, 6);
    g.lineStyle(1, 0xc0b89d, 0.6);
    g.lineBetween(x, y - 44, x, y + 44);
  }

  private drawTelescope(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Tripod
    g.lineStyle(3, 0x4a3e26, 1);
    g.lineBetween(x - 20, y + 30, x, y);
    g.lineBetween(x + 20, y + 30, x, y);
    g.lineBetween(x, y + 30, x, y);
    // Telescope body
    g.fillStyle(0xb8a472, 1);
    g.fillRect(x - 30, y - 14, 60, 14);
    g.lineStyle(2, 0x4a3e26, 1);
    g.strokeRect(x - 30, y - 14, 60, 14);
    // Eyepiece
    g.fillStyle(0x4a3e26, 1);
    g.fillCircle(x + 32, y - 7, 4);
  }

  private drawChartFrame(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Frame
    g.fillStyle(0x4a3e26, 1);
    g.fillRect(x - 32, y - 60, 12, 120);
    g.fillRect(x - 32, y - 60, 64, 12);
    g.fillRect(x - 32, y + 48, 64, 12);
    g.fillRect(x + 20, y - 60, 12, 120);
    // Scroll content (parchment)
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 20, y - 48, 40, 96);
    // Chart lines (mock roadmap)
    g.lineStyle(1, 0x6b5a3e, 0.8);
    g.lineBetween(x - 14, y - 40, x + 14, y - 40);
    g.lineBetween(x - 14, y - 24, x + 8, y - 24);
    g.lineBetween(x - 14, y - 8, x + 14, y - 8);
    g.lineBetween(x - 14, y + 8, x + 6, y + 8);
    g.lineBetween(x - 14, y + 24, x + 14, y + 24);
    g.lineBetween(x - 14, y + 40, x + 10, y + 40);
  }

  private drawScrollPile(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    g.fillStyle(0xede5cf, 1);
    g.fillCircle(x, y, 8);
    g.fillCircle(x + 12, y - 4, 8);
    g.fillCircle(x - 8, y - 6, 8);
    g.lineStyle(1, 0x9a8d6c, 1);
    g.strokeCircle(x, y, 8);
    g.strokeCircle(x + 12, y - 4, 8);
    g.strokeCircle(x - 8, y - 6, 8);
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

  private triggerChartDialogue() {
    EventBus.emit('show-dialogue', {
      name: '📜 路线图',
      lines: [
        '（一卷长长的羊皮纸挂在墙上）',
        '"CUA 源野物语 · 阶段路线"',
        '─ 萌芽镇：完成 ✓',
        '─ 共创之都 · 百晓居：开放 ✓',
        '─ 共创之都 · 其余 8 工坊：筹建中',
        '─ 议政高地 · 治理上线：进行中',
        '─ 大集会广场 · 年度大会：未启',
        '"路还很长——但每一步都在走。"',
      ],
    });
  }

  private triggerTelescopeDialogue() {
    EventBus.emit('show-dialogue', {
      name: '🔭 远眺天下',
      lines: [
        '（你扶住望远镜，向南望去）',
        '远处是共创之都的喷泉广场，再远是萌芽镇的炊烟。',
        '——这就是源野的全部？',
        '不，还有更远的——',
        '议政之外，是真实的 5000+ CUA 同行者。',
        '他们正在 GitHub 上写代码、在百科中写词条、在论坛中辩论。',
        '"治理不是终点。被看见，才是。"',
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
    const distChart = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.chartX, this.chartY);
    const distTel = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.telescopeX, this.telescopeY);
    const nearExit = distExit < 56;
    const nearChart = distChart < INTERACT_DISTANCE;
    const nearTel = distTel < INTERACT_DISTANCE;

    if (nearExit) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (nearChart) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 查看路线图').setPosition(this.chartX, this.chartY - 80).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerChartDialogue();
    } else if (nearTel) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 望远眺').setPosition(this.telescopeX, this.telescopeY - 32).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerTelescopeDialogue();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
