import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 130;
const INTERACT_DISTANCE = 56;

const ROOM_WIDTH = 700;
const ROOM_HEIGHT = 500;

interface SceneInitData {
  returnX?: number;
  returnY?: number;
}

/**
 * 明镜阁室内 (Mirror Pavilion) — appeals & oversight.
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

  private mirrorX = 0;
  private mirrorY = 0;
  private deskX = 0;
  private deskY = 0;

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

    // Floor
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // Octagonal-feel floor
    g.fillStyle(0xefe9d9, 1);
    g.fillRoundedRect(60, 60, ROOM_WIDTH - 120, ROOM_HEIGHT - 120, 50);
    g.lineStyle(3, 0xb8a472, 1);
    g.strokeRoundedRect(60, 60, ROOM_WIDTH - 120, ROOM_HEIGHT - 120, 50);

    // Subtle radial pattern (mirror motif on floor)
    g.lineStyle(1, 0xc0b89d, 0.4);
    for (let r = 60; r < 200; r += 25) {
      g.strokeCircle(ROOM_WIDTH / 2, ROOM_HEIGHT / 2 - 20, r);
    }

    // Slim columns (4 corners)
    this.drawColumn(120, 120);
    this.drawColumn(ROOM_WIDTH - 120, 120);
    this.drawColumn(120, ROOM_HEIGHT - 120);
    this.drawColumn(ROOM_WIDTH - 120, ROOM_HEIGHT - 120);

    // Big mirror (north wall — focal piece)
    this.mirrorX = ROOM_WIDTH / 2;
    this.mirrorY = 130;
    this.drawMirror(this.mirrorX, this.mirrorY);

    // Petitioner desk (center-south)
    this.deskX = ROOM_WIDTH / 2;
    this.deskY = ROOM_HEIGHT / 2 + 30;
    this.drawDesk(this.deskX, this.deskY);

    // Decorative water basins (east + west)
    this.drawBasin(180, ROOM_HEIGHT / 2 + 30);
    this.drawBasin(ROOM_WIDTH - 180, ROOM_HEIGHT / 2 + 30);

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
    g.fillStyle(0xe6deca, 1);
    g.fillRect(x - 8, y - 36, 16, 72);
    g.fillStyle(0xc8c0a3, 1);
    g.fillRect(x - 12, y - 36, 24, 4);
    g.fillRect(x - 12, y + 32, 24, 4);
  }

  private drawMirror(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Outer frame (gilded oval)
    g.fillStyle(0xb8a472, 1);
    g.fillEllipse(x, y, 130, 90);
    g.lineStyle(3, 0x9a8d6c, 1);
    g.strokeEllipse(x, y, 130, 90);
    // Inner mirror (silver/blue tint)
    g.fillStyle(0xb8c8d8, 1);
    g.fillEllipse(x, y, 110, 70);
    // Mirror highlight (gradient effect with arcs)
    g.lineStyle(2, 0xe0eaf0, 0.6);
    g.strokeEllipse(x - 20, y - 12, 50, 30);
    // Decorative ornaments above mirror
    g.fillStyle(0xb8a472, 1);
    g.fillTriangle(x, y - 56, x - 8, y - 48, x + 8, y - 48);
  }

  private drawDesk(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Desk top
    g.fillStyle(0x6b5a3e, 1);
    g.fillRect(x - 60, y - 12, 120, 24);
    g.lineStyle(2, 0x4a3e26, 1);
    g.strokeRect(x - 60, y - 12, 120, 24);
    // Legs
    g.fillStyle(0x4a3e26, 1);
    g.fillRect(x - 56, y + 12, 6, 30);
    g.fillRect(x + 50, y + 12, 6, 30);
    // Scroll on desk
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 30, y - 8, 36, 6);
    g.lineStyle(1, 0x6b5a3e, 1);
    g.strokeRect(x - 30, y - 8, 36, 6);
    // Inkwell
    g.fillStyle(0x2a1e16, 1);
    g.fillCircle(x + 24, y - 4, 5);
  }

  private drawBasin(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Basin (stone bowl with water)
    g.fillStyle(0xc8c0a3, 1);
    g.fillEllipse(x, y, 50, 18);
    g.lineStyle(2, 0x9a8d6c, 1);
    g.strokeEllipse(x, y, 50, 18);
    // Water surface
    g.fillStyle(0x7080a0, 1);
    g.fillEllipse(x, y - 2, 40, 12);
    // Reflection highlight
    g.fillStyle(0xc8d8e8, 0.6);
    g.fillEllipse(x - 8, y - 4, 16, 4);
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

  private triggerMirrorDialogue() {
    EventBus.emit('show-dialogue', {
      name: '🪞 明镜',
      lines: [
        '（你站在镜前，看见自己的倒影）',
        '"明镜在此——照见公允，也照见瑕疵。"',
        '',
        '本阁主管：',
        '  · 任务申诉（CV 评分异议）',
        '  · 监察委员会复议',
        '',
        '（如果你对某次评审结果不服——'  ,
        ' 这里是申诉之地）',
        '',
        '提示：当前申诉入口在任务面板（J 键）',
        '──后续将统一收归本阁。',
      ],
    });
  }

  private triggerDeskDialogue() {
    EventBus.emit('show-dialogue', {
      name: '📜 申诉案桌',
      lines: [
        '（案桌上摆着一卷申诉书的样本和一支毛笔）',
        '',
        '"凡评审结果存疑——皆可申诉。"',
        '"3 位复审员独立评议——只上调，不下调。"',
        '',
        '当前已有的申诉案例：',
        '─ 通过 J 键 → 任务面板 → 已结算任务 → 发起申诉',
        '',
        '"明镜不偏私，但也不轻易翻案。"',
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
    const distMirror = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.mirrorX, this.mirrorY);
    const distDesk = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.deskX, this.deskY);
    const nearExit = distExit < 56;
    const nearMirror = distMirror < INTERACT_DISTANCE;
    const nearDesk = distDesk < INTERACT_DISTANCE;

    if (nearExit) {
      this.exitHint.setPosition(this.exitX, this.exitY - 40).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (nearMirror) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 照镜').setPosition(this.mirrorX, this.mirrorY - 60).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerMirrorDialogue();
    } else if (nearDesk) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看案卷').setPosition(this.deskX, this.deskY - 30).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerDeskDialogue();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
