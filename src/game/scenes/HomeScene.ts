import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { getFaceLocal, type FaceData } from '../../lib/faceStore';
import { applyFaceToSprite } from '../faceRenderer';

const PLAYER_SPEED = 130;
const INTERACT_DISTANCE = 56;

const TILE = 32;
const ROOM_TILE_W = 20;
const ROOM_TILE_H = 15;
const ROOM_WIDTH = ROOM_TILE_W * TILE;   // 640
const ROOM_HEIGHT = ROOM_TILE_H * TILE;  // 480

interface SceneInitData {
  returnX?: number;
  returnY?: number;
}

/**
 * Wave 7.G · 自家小屋 (Player's Home)
 *
 * 视觉重做：从 graphics-drawn 改成 tilemap (跟 sproutown / blacksmith-forge 等同架构)
 * Tile assets:
 *   - public/assets/maps/home.json
 *   - public/assets/tilesets/home-tiles.png
 *
 * 互动点坐标改为 hardcode tile pos （不再用 graphics 画完算坐标）
 *
 * Logic 保留：
 *   - 4 个互动点 (memorial wall / desk / bed / fireplace)
 *   - 出口 + return 坐标
 *   - face customizer
 *   - 玩家走动 / 朝向动画
 *
 * Bug 修复：player.setDepth(5) 让玩家始终在家具之上
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

  // ---- Hardcoded tile-based interaction coords ----
  // 跟 home.json layout 对应
  private exitX = (10 * TILE) + TILE / 2;       // col 10 row 14 - 门
  private exitY = (14 * TILE) + TILE / 2;
  private wallX = (9.5 * TILE) + TILE / 2;      // col 9-10 row 1 - 纪念墙
  private wallY = (1 * TILE) + TILE / 2;
  private deskX = (15.5 * TILE) + TILE / 2;     // col 15-16 row 6 - 桌
  private deskY = (6 * TILE) + TILE / 2;
  private bedX = (4 * TILE) + TILE / 2;         // col 4 row 5-6 - 床
  private bedY = (5.5 * TILE) + TILE / 2;
  private fireplaceX = (16 * TILE) + TILE / 2;  // col 16 row 3 - 壁炉
  private fireplaceY = (3 * TILE) + TILE / 2;

  private exitHint!: Phaser.GameObjects.Text;
  private interactHint!: Phaser.GameObjects.Text;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;
  private flameTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('Home');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 17 * 32 + 16;
    this.returnY = data.returnY ?? 6 * 32 + 16;
  }

  preload() {
    // 安全：保险加载（即使 BootScene 漏了 · 这里也会装上）
    if (!this.cache.tilemap.has('home')) {
      this.load.tilemapTiledJSON('home', 'assets/maps/home.json');
    }
    if (!this.textures.exists('home-tiles')) {
      this.load.image('home-tiles', 'assets/tilesets/home-tiles.png');
    }
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Tilemap 加载 ----
    const map = this.make.tilemap({ key: 'home' });
    const tileset = map.addTilesetImage('home-tiles', 'home-tiles');
    if (!tileset) {
      console.error('[HomeScene] tileset home-tiles missing — fallback to dark floor');
      const g = this.add.graphics();
      g.fillStyle(0x2a1e16, 1);
      g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    } else {
      // 3 layers: Floor / Walls / Furniture
      const floor = map.createLayer('Floor', tileset, 0, 0);
      if (floor) floor.setDepth(-5);
      const walls = map.createLayer('Walls', tileset, 0, 0);
      if (walls) walls.setDepth(2);
      const furniture = map.createLayer('Furniture', tileset, 0, 0);
      if (furniture) furniture.setDepth(2);
    }

    // ---- Fireplace flame overlay (动态闪烁 · 像素三角) ----
    const flameG = this.add.graphics();
    flameG.setDepth(3);
    flameG.fillStyle(0xe07060, 1);
    flameG.fillTriangle(
      this.fireplaceX - 6, this.fireplaceY + 8,
      this.fireplaceX + 6, this.fireplaceY + 8,
      this.fireplaceX, this.fireplaceY - 4
    );
    flameG.fillStyle(0xe0b060, 1);
    flameG.fillTriangle(
      this.fireplaceX - 3, this.fireplaceY + 6,
      this.fireplaceX + 3, this.fireplaceY + 6,
      this.fireplaceX, this.fireplaceY
    );
    this.flameTween = this.tweens.add({
      targets: flameG,
      scaleY: 0.85,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ---- Title (room name banner top center) ----
    this.add.text(ROOM_WIDTH / 2, 16, '— 自家小屋 —', {
      fontFamily: 'serif',
      fontSize: '14px',
      color: '#fdf0cf',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    // ---- Player ----
    this.createCharacterAnims('player');
    // 出生在门口 · 朝上
    this.player = this.physics.add.sprite(this.exitX, this.exitY - 32, 'player', 0);
    this.player.setCollideWorldBounds(true);
    // Wave 7.F bugfix · player 显示在所有家具之上
    this.player.setDepth(5);
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
      if (this.flameTween) {
        this.flameTween.stop();
        this.flameTween = null;
      }
    });

    // ---- Input ----
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.eKey = this.input.keyboard!.addKey('E');
    this.mKey = this.input.keyboard!.addKey('M');
    this.jKey = this.input.keyboard!.addKey('J');
    this.kKey = this.input.keyboard!.addKey('K');

    // ---- Hint texts (created here once · positioned in update) ----
    this.exitHint = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#fdf0cf',
      backgroundColor: '#3a2a1a',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.interactHint = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#fdf0cf',
      backgroundColor: '#3a2a1a',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);
  }

  /** 创建 player 动画（如果还没创建过） */
  private createCharacterAnims(key: string) {
    if (this.anims.exists(`${key}-walk-down`)) return;
    this.anims.create({ key: `${key}-walk-down`, frames: this.anims.generateFrameNumbers(key, { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: `${key}-walk-right`, frames: this.anims.generateFrameNumbers(key, { start: 4, end: 7 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: `${key}-walk-up`, frames: this.anims.generateFrameNumbers(key, { start: 8, end: 11 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: `${key}-idle-down`, frames: [{ key, frame: 0 }], frameRate: 1 });
    this.anims.create({ key: `${key}-idle-right`, frames: [{ key, frame: 4 }], frameRate: 1 });
    this.anims.create({ key: `${key}-idle-up`, frames: [{ key, frame: 8 }], frameRate: 1 });
    this.anims.create({ key: `${key}-idle-left`, frames: [{ key, frame: 4 }], frameRate: 1 });
  }

  // ============ INTERACTIONS ============

  private exit() {
    this.scene.start('Main', { returnX: this.returnX, returnY: this.returnY });
  }

  private triggerWall() {
    EventBus.emit('open-home-wall');
  }

  private triggerDesk() {
    EventBus.emit('show-dialogue', {
      name: '📔 笔记',
      lines: [
        '（你翻开桌上的笔记本）',
        '"今天又往前走了一步——"',
        '"再小的一步也算——"',
      ],
    });
  }

  private triggerBed() {
    EventBus.emit('show-dialogue', {
      name: '🛏 床',
      lines: [
        '（柔软的红被子）',
        '"等任务都做完了再来歇一会吧。"',
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
      this.exitHint.setText('[E] 出门').setPosition(this.exitX, this.exitY - 36).setVisible(true);
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
