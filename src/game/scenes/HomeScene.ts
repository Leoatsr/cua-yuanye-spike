import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { getFaceLocal, type FaceData } from '../../lib/faceStore';
import { applyFaceToSprite } from '../faceRenderer';

const PLAYER_SPEED = 130;
const INTERACT_DISTANCE = 56;

const ROOM_WIDTH = 640;
const ROOM_HEIGHT = 480;

interface SceneInitData {
  returnX?: number;
  returnY?: number;
}

/**
 * 自家小屋 (Player's Home) — C10.
 *
 * Personal cozy space in Sprout Town. A wooden cabin interior with:
 *   - Memorial wall (taps quest history + proposal history)
 *   - Desk with notebook
 *   - Bed
 *   - Fireplace (warm vibe)
 *   - Window looking out at the town
 *
 * Drawn entirely with Phaser graphics. The memorial wall opens
 * a React panel (HomeWallPanel) showing player achievements.
 */
export class HomeScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerFace: ReturnType<typeof applyFaceToSprite> | null = null;
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

  // Interaction points
  private wallX = 0;
  private wallY = 0;
  private deskX = 0;
  private deskY = 0;
  private bedX = 0;
  private bedY = 0;
  private fireplaceX = 0;
  private fireplaceY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('Home');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 17 * 32 + 16;
    this.returnY = data.returnY ?? 6 * 32 + 16;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Floor (warm wood) ----
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x2a1e16, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // Wood floor — warm brown with planks
    g.fillStyle(0x8a6f4a, 1);
    g.fillRect(60, 80, ROOM_WIDTH - 120, ROOM_HEIGHT - 140);
    // Plank lines
    g.lineStyle(1, 0x6a5538, 0.5);
    for (let y = 80; y < ROOM_HEIGHT - 60; y += 32) {
      g.lineBetween(60, y, ROOM_WIDTH - 60, y);
    }
    for (let x = 100; x < ROOM_WIDTH - 60; x += 96) {
      g.lineBetween(x, 80, x, ROOM_HEIGHT - 60);
    }

    // ---- Wall (top, with logs texture) ----
    g.fillStyle(0x6a5538, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 24);
    g.lineStyle(2, 0x4a3826, 1);
    g.strokeRect(60, 60, ROOM_WIDTH - 120, 24);
    // Log lines
    for (let x = 80; x < ROOM_WIDTH - 60; x += 40) {
      g.lineBetween(x, 60, x, 84);
    }

    // ---- Memorial wall (north center, big panel of wood) ----
    this.wallX = ROOM_WIDTH / 2;
    this.wallY = 120;
    this.drawMemorialWall(this.wallX, this.wallY);

    // ---- Desk (east) ----
    this.deskX = ROOM_WIDTH - 120;
    this.deskY = ROOM_HEIGHT / 2;
    this.drawDesk(this.deskX, this.deskY);

    // ---- Bed (west) ----
    this.bedX = 130;
    this.bedY = ROOM_HEIGHT / 2;
    this.drawBed(this.bedX, this.bedY);

    // ---- Fireplace (north-east corner) ----
    this.fireplaceX = ROOM_WIDTH - 130;
    this.fireplaceY = 140;
    this.drawFireplace(this.fireplaceX, this.fireplaceY);

    // ---- Rug (center) ----
    this.drawRug(ROOM_WIDTH / 2, ROOM_HEIGHT / 2 + 40);

    // ---- Window (north-west) ----
    this.drawWindow(140, 100);

    // ---- Player ----
    this.createCharacterAnims('player');
    this.player = this.physics.add.sprite(ROOM_WIDTH / 2, ROOM_HEIGHT - 100, 'player', 0);
    this.player.setCollideWorldBounds(true);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(12, 6).setOffset(10, 17);
    this.player.anims.play('player-idle-up');

    // F6.0: apply face customization
    this.playerFace = applyFaceToSprite(this, this.player, getFaceLocal());
    const onFaceUpdate = (newFace: FaceData) => {
      if (this.playerFace) this.playerFace.reapply(newFace);
    };
    EventBus.on('face-updated', onFaceUpdate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('face-updated', onFaceUpdate);
      if (this.playerFace) {
        this.playerFace.destroy();
        this.playerFace = null;
      }
    });

    // ---- Walls (collision) ----
    const walls = this.physics.add.staticGroup();
    walls.add(this.add.rectangle(ROOM_WIDTH / 2, 50, ROOM_WIDTH, 20, 0, 0));
    walls.add(this.add.rectangle(ROOM_WIDTH / 2, ROOM_HEIGHT - 60, ROOM_WIDTH, 20, 0, 0));
    walls.add(this.add.rectangle(50, ROOM_HEIGHT / 2, 20, ROOM_HEIGHT, 0, 0));
    walls.add(this.add.rectangle(ROOM_WIDTH - 50, ROOM_HEIGHT / 2, 20, ROOM_HEIGHT, 0, 0));
    this.physics.add.collider(this.player, walls);

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
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

    // ---- Exit (south door) ----
    this.exitX = ROOM_WIDTH / 2;
    this.exitY = ROOM_HEIGHT - 70;
    const doorG = this.add.graphics();
    doorG.fillStyle(0x4a3826, 1);
    doorG.fillRect(this.exitX - 22, this.exitY - 30, 44, 56);
    doorG.lineStyle(2, 0x2a1e10, 1);
    doorG.strokeRect(this.exitX - 22, this.exitY - 30, 44, 56);
    // Door handle
    doorG.fillStyle(0xb8a472, 1);
    doorG.fillCircle(this.exitX + 12, this.exitY, 3);

    // ---- Title ----
    this.add.text(ROOM_WIDTH / 2, 30, '— 自家小屋 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#f5f0e0', backgroundColor: '#1a141aaa',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    // ---- Hints ----
    this.exitHint = this.add.text(0, 0, '[E] 出门', {
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

  private drawMemorialWall(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Big wooden panel framed
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 100, y - 30, 200, 60);
    g.lineStyle(3, 0x3a2818, 1);
    g.strokeRect(x - 100, y - 30, 200, 60);
    // Inner parchment
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 92, y - 22, 184, 44);
    // Decorative corners (gold)
    g.fillStyle(0xb8a472, 1);
    [-92, 88].forEach((dx) => {
      [-22, 18].forEach((dy) => {
        g.fillCircle(x + dx, y + dy, 3);
      });
    });
    // Inscription lines (mock content)
    g.lineStyle(1, 0x6b5230, 0.5);
    for (let i = 0; i < 4; i++) {
      g.lineBetween(x - 82, y - 14 + i * 10, x + 82, y - 14 + i * 10);
    }
    // Title pixel header
    this.add.text(x, y - 38, '✦ 纪念展示墙 ✦', {
      fontFamily: 'serif', fontSize: '9px',
      color: '#b8893a',
    }).setOrigin(0.5).setDepth(3);
  }

  private drawDesk(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Desk top
    g.fillStyle(0x6b5230, 1);
    g.fillRect(x - 36, y - 14, 72, 28);
    g.lineStyle(2, 0x3a2818, 1);
    g.strokeRect(x - 36, y - 14, 72, 28);
    // Legs
    g.fillStyle(0x4a3826, 1);
    g.fillRect(x - 32, y + 14, 5, 24);
    g.fillRect(x + 27, y + 14, 5, 24);
    // Notebook on desk
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 18, y - 8, 24, 16);
    g.lineStyle(1, 0x6b5230, 1);
    g.strokeRect(x - 18, y - 8, 24, 16);
    // Pen
    g.fillStyle(0x2a1e10, 1);
    g.fillRect(x + 8, y - 4, 14, 2);
    // Mug
    g.fillStyle(0xb8a472, 1);
    g.fillCircle(x + 22, y - 4, 5);
  }

  private drawBed(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Bed frame
    g.fillStyle(0x4a3826, 1);
    g.fillRect(x - 28, y - 50, 56, 100);
    g.lineStyle(2, 0x2a1e10, 1);
    g.strokeRect(x - 28, y - 50, 56, 100);
    // Mattress
    g.fillStyle(0xc8b890, 1);
    g.fillRect(x - 24, y - 46, 48, 92);
    // Pillow
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 20, y - 42, 40, 22);
    g.lineStyle(1, 0xb8a472, 1);
    g.strokeRect(x - 20, y - 42, 40, 22);
    // Blanket
    g.fillStyle(0x8a4a4a, 1);
    g.fillRect(x - 22, y - 8, 44, 50);
    // Headboard posts
    g.fillStyle(0x3a2818, 1);
    g.fillRect(x - 30, y - 56, 6, 12);
    g.fillRect(x + 24, y - 56, 6, 12);
  }

  private drawFireplace(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Stone fireplace
    g.fillStyle(0x6e6856, 1);
    g.fillRect(x - 30, y - 30, 60, 60);
    g.lineStyle(2, 0x3e3826, 1);
    g.strokeRect(x - 30, y - 30, 60, 60);
    // Stone pattern
    g.lineStyle(1, 0x4a4538, 0.7);
    g.lineBetween(x - 30, y - 14, x + 30, y - 14);
    g.lineBetween(x - 30, y + 4, x + 30, y + 4);
    g.lineBetween(x - 14, y - 30, x - 14, y + 30);
    g.lineBetween(x + 14, y - 30, x + 14, y + 30);
    // Inner opening (dark)
    g.fillStyle(0x1a0e08, 1);
    g.fillRect(x - 20, y - 12, 40, 32);
    // Logs
    g.fillStyle(0x6b3a18, 1);
    g.fillRect(x - 16, y + 12, 32, 4);
    g.fillRect(x - 14, y + 8, 28, 4);
    // Flame (animated via tween)
    const flame = this.add.graphics();
    flame.setDepth(3);
    flame.fillStyle(0xe07060, 1);
    flame.fillTriangle(x - 8, y + 8, x + 8, y + 8, x, y - 8);
    flame.fillStyle(0xe0b060, 1);
    flame.fillTriangle(x - 4, y + 6, x + 4, y + 6, x, y - 4);
    this.tweens.add({
      targets: flame,
      scaleY: 0.85,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // Mantle
    g.fillStyle(0x8a6f4a, 1);
    g.fillRect(x - 36, y - 36, 72, 8);
    g.lineStyle(2, 0x3a2818, 1);
    g.strokeRect(x - 36, y - 36, 72, 8);
  }

  private drawRug(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(0);  // below player, above floor
    // Round rug
    g.fillStyle(0x8a4a4a, 1);
    g.fillCircle(x, y, 60);
    g.lineStyle(2, 0x4a2828, 1);
    g.strokeCircle(x, y, 60);
    // Inner pattern
    g.fillStyle(0xb8a472, 0.8);
    g.fillCircle(x, y, 36);
    g.fillStyle(0x8a4a4a, 1);
    g.fillCircle(x, y, 18);
    g.fillStyle(0xede5cf, 0.9);
    g.fillCircle(x, y, 6);
  }

  private drawWindow(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Window frame
    g.fillStyle(0x4a3826, 1);
    g.fillRect(x - 24, y - 24, 48, 36);
    g.lineStyle(2, 0x2a1e10, 1);
    g.strokeRect(x - 24, y - 24, 48, 36);
    // Glass (light blue, day)
    g.fillStyle(0xb8c8d8, 0.9);
    g.fillRect(x - 20, y - 20, 40, 28);
    // Cross frame
    g.lineStyle(2, 0x4a3826, 1);
    g.lineBetween(x, y - 20, x, y + 8);
    g.lineBetween(x - 20, y - 6, x + 20, y - 6);
    // Distant tree silhouette
    g.fillStyle(0x4a7050, 0.6);
    g.fillCircle(x - 12, y - 10, 5);
    g.fillCircle(x + 8, y - 8, 4);
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

  private triggerWall() {
    EventBus.emit('open-home-wall');
  }

  private triggerDesk() {
    EventBus.emit('show-dialogue', {
      name: '📔 笔记本',
      lines: [
        '（桌上摊着一本手记，墨迹尚新）',
        '',
        '"今日所记 — 自家小屋落成。"',
        '"墙上挂了一面纪念展示墙——"',
        '"凡所贡献，皆将留痕于此。"',
        '',
        '"——这屋子小，但是属于我的。"',
      ],
    });
  }

  private triggerBed() {
    EventBus.emit('show-dialogue', {
      name: '🛏️ 床铺',
      lines: [
        '（一张温暖的木床，铺着褐红毛毯）',
        '"忙完了一天，至少还有这里可以躺。"',
        '（你没有真的躺下——还有事要做）',
      ],
    });
  }

  private triggerFireplace() {
    EventBus.emit('show-dialogue', {
      name: '🔥 壁炉',
      lines: [
        '（炉火跳动，木柴噼啪作响）',
        '"屋里暖和——比外面好。"',
        '（你伸手烤了烤手）',
      ],
    });
  }

  // ============ UPDATE LOOP ============

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

    // F6.0: sync hair graphics
    if (this.playerFace) {
      this.playerFace.syncToSprite(this.player);
    }

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

    if (Phaser.Input.Keyboard.JustDown(this.mKey)) EventBus.emit('open-world-map', { currentScene: 'Main' });
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) EventBus.emit('open-quest-log');
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) EventBus.emit('open-mailbox');

    const distExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitX, this.exitY);
    const distWall = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.wallX, this.wallY);
    const distDesk = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.deskX, this.deskY);
    const distBed = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.bedX, this.bedY);
    const distFire = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.fireplaceX, this.fireplaceY);

    const nearExit = distExit < 56;
    const nearWall = distWall < INTERACT_DISTANCE;
    const nearDesk = distDesk < INTERACT_DISTANCE;
    const nearBed = distBed < INTERACT_DISTANCE;
    const nearFire = distFire < INTERACT_DISTANCE;

    if (nearExit) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (nearWall) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看纪念墙').setPosition(this.wallX, this.wallY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerWall();
    } else if (nearDesk) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 翻笔记').setPosition(this.deskX, this.deskY - 30).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerDesk();
    } else if (nearBed) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看床').setPosition(this.bedX, this.bedY - 60).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBed();
    } else if (nearFire) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 烤火').setPosition(this.fireplaceX, this.fireplaceY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerFireplace();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
