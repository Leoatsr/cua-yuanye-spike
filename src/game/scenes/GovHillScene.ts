import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { fetchUserLevel } from '../../lib/levelStore';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 140;
const INTERACT_DISTANCE = 56;
const BGM_VOLUME = 0.25;

/**
 * 议政高地 (Governance Hill) — Phase 4 governance center.
 *
 * Layout (south to north):
 *   - Port (south, entry from Sprout City)
 *   - Stone steps leading up
 *   - Mirror Pavilion (west, lower platform)
 *   - Council Hall (center, main plaza)
 *   - Vision Tower (north, highest peak)
 *
 * Visual style: B2 Greek council — white marble, stone columns,
 * pediments. Drawn entirely with Phaser graphics primitives
 * (no tilemap dependency) so it renders without external assets.
 */

const MAP_WIDTH = 1600;
const MAP_HEIGHT = 2400;

interface BuildingTrigger {
  id: 'vision-tower' | 'council-hall' | 'mirror-pavilion';
  name: string;
  description: string;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  /** Door point — where player enters when pressing E */
  doorX: number;
  doorY: number;
  sceneKey: string;
}

const BUILDINGS: BuildingTrigger[] = [
  {
    id: 'vision-tower',
    name: '远见塔',
    description: '远眺天下、规划长程。CUA 路线图的公示之地。',
    worldX: 800, worldY: 380,
    width: 280, height: 380,
    doorX: 800, doorY: 560,
    sceneKey: 'VisionTower',
  },
  {
    id: 'council-hall',
    name: '执政厅',
    description: '提案、辩论、决议。CUA 议事的中枢。',
    worldX: 800, worldY: 1080,
    width: 480, height: 320,
    doorX: 800, doorY: 1240,
    sceneKey: 'CouncilHall',
  },
  {
    id: 'mirror-pavilion',
    name: '明镜阁',
    description: '监察、申诉、复议。让贡献的天平回归公允。',
    worldX: 380, worldY: 1500,
    width: 260, height: 220,
    doorX: 380, doorY: 1610,
    sceneKey: 'MirrorPavilion',
  },
];

interface SceneInitData {
  spawnX?: number;
  spawnY?: number;
}

export class GovHillScene extends Phaser.Scene {
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

  private interactHint!: Phaser.GameObjects.Text;
  private portHint!: Phaser.GameObjects.Text;
  private guardHint!: Phaser.GameObjects.Text;
  private eastPortHint!: Phaser.GameObjects.Text;

  // Port (south, returns to Sprout City)
  private portX = 0;
  private portY = 0;

  // East port — to GrandPlaza (大集会广场)
  private eastPortX = 0;
  private eastPortY = 0;

  // Guard NPC at port
  private guardX = 0;
  private guardY = 0;

  private spawnOverride: { x: number; y: number } | null = null;
  private inputLockUntil = 0;

  private bgm?: Phaser.Sound.BaseSound;

  constructor() {
    super('GovHill');
  }

  init(data: SceneInitData & { returnX?: number; returnY?: number }) {
    if (data?.returnX !== undefined && data?.returnY !== undefined) {
      this.spawnOverride = { x: data.returnX, y: data.returnY };
    } else if (data?.spawnX !== undefined && data?.spawnY !== undefined) {
      this.spawnOverride = { x: data.spawnX, y: data.spawnY };
    } else {
      this.spawnOverride = null;
    }
  }

  create() {
    this.inputLockUntil = this.time.now + 250;

    // ---- World bounds ----
    this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // ---- Backdrop layers ----
    this.drawBackdrop();
    this.drawMarblePlaza();
    this.drawPaths();

    // ---- Buildings (drawn) ----
    BUILDINGS.forEach((b) => {
      if (b.id === 'vision-tower') this.drawVisionTower(b);
      else if (b.id === 'council-hall') this.drawCouncilHall(b);
      else if (b.id === 'mirror-pavilion') this.drawMirrorPavilion(b);
    });

    // ---- Decorative pillars at port ----
    this.drawPortMarkers();

    // ---- Player ----
    this.createCharacterAnims('player');
    // Default spawn: just north of the port (player just disembarked)
    const defaultX = MAP_WIDTH / 2;
    const defaultY = 2200;
    const sx = this.spawnOverride?.x ?? defaultX;
    const sy = this.spawnOverride?.y ?? defaultY;
    this.player = this.physics.add.sprite(sx, sy, 'player', 0);
    this.player.setCollideWorldBounds(true);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(12, 6).setOffset(10, 17);
    this.player.anims.play('player-idle-down');

    // ---- Building collision (invisible static rects covering each building) ----
    const buildingsGroup = this.physics.add.staticGroup();
    BUILDINGS.forEach((b) => {
      // Collide with the upper 70% of building (so player can stand at door)
      const collH = b.height * 0.7;
      const rect = this.add.rectangle(b.worldX, b.worldY - b.height / 2 + collH / 2, b.width, collH, 0x000000, 0);
      buildingsGroup.add(rect);
    });
    this.physics.add.collider(this.player, buildingsGroup);

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    // G1.1 · Multiplayer (via helper)
    this.mp = setupMultiplayer(this, 'GovHill', () => this.player, () => this.currentFacing);

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

    // ---- Port ----
    this.portX = MAP_WIDTH / 2;
    this.portY = MAP_HEIGHT - 80;

    // ---- East Port (to Grand Plaza) ----
    this.eastPortX = MAP_WIDTH - 80;
    this.eastPortY = MAP_HEIGHT / 2 + 200;
    // Draw east port markers + boat
    const epG = this.add.graphics();
    epG.setDepth(1);
    [-60, 60].forEach((dy) => {
      epG.fillStyle(0xe6deca, 1);
      epG.fillRect(this.eastPortX - 60, this.eastPortY + dy - 14, 60, 28);
      epG.lineStyle(2, 0x9a8d6c, 1);
      epG.strokeRect(this.eastPortX - 60, this.eastPortY + dy - 14, 60, 28);
    });
    // Boat (faces east)
    epG.fillStyle(0x4a3e26, 1);
    epG.fillTriangle(
      this.eastPortX - 8, this.eastPortY - 10,
      this.eastPortX - 8, this.eastPortY + 10,
      this.eastPortX + 16, this.eastPortY,
    );
    epG.fillRect(this.eastPortX - 16, this.eastPortY - 8, 24, 16);
    // East port floating marker
    const eastMarker = this.add.text(this.eastPortX - 30, this.eastPortY - 60, '⛵️', {
      fontSize: '16px',
    }).setOrigin(0.5).setDepth(5);
    this.tweens.add({
      targets: eastMarker, y: this.eastPortY - 64,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // East port label
    this.add.text(this.eastPortX - 30, this.eastPortY - 90, '→ 大集会广场', {
      fontFamily: 'serif', fontSize: '11px',
      color: '#f5f0e0', backgroundColor: '#3a4a6acc',
      padding: { left: 5, right: 5, top: 2, bottom: 2 },
    }).setOrigin(0.5).setDepth(5);

    // ---- Guard NPC ----
    this.guardX = MAP_WIDTH / 2 + 80;
    this.guardY = MAP_HEIGHT - 200;
    this.add.circle(this.guardX, this.guardY, 8, 0x9c8a6e).setDepth(2);
    this.add.circle(this.guardX, this.guardY - 10, 6, 0xeacba0).setDepth(2);

    // ---- Building name labels (above each) ----
    BUILDINGS.forEach((b) => {
      this.add.text(b.worldX, b.worldY - b.height / 2 - 20, b.name, {
        fontFamily: 'serif',
        fontSize: '14px',
        color: '#f5f0e0',
        backgroundColor: '#1a141aaa',
        padding: { left: 6, right: 6, top: 2, bottom: 2 },
      }).setOrigin(0.5).setDepth(10);
    });

    // ---- Hints ----
    this.interactHint = this.add.text(0, 0, '[E] 进入', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#000000aa',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.portHint = this.add.text(0, 0, '[E] 返回共创之都', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#3a4a6add',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.guardHint = this.add.text(0, 0, '[E] 守卫', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#000000aa',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.eastPortHint = this.add.text(0, 0, '[E] 前往大集会广场', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#3a4a6add',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    // ---- BGM ----
    if (this.cache.audio.exists('bgm-village')) {
      this.bgm = this.sound.add('bgm-village', { loop: true, volume: BGM_VOLUME });
      this.bgm.play();
    }

    // ---- World map travel listener ----
    const onTravel = (data: { sceneKey: string }) => {
      if (data.sceneKey === 'GovHill') return;
      if (data.sceneKey === 'SproutCity' || data.sceneKey === 'Main') {
        this.exitToPort(data.sceneKey);
      } else if (data.sceneKey === 'GrandPlaza') {
        this.exitToGrandPlaza();
      }
    };
    EventBus.on('world-map-travel', onTravel);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('world-map-travel', onTravel);
      this.bgm?.stop();
    });
  }

  // ============ DRAWING ============

  private drawBackdrop() {
    // Cool stone-blue background gradient (sense of altitude)
    const g = this.add.graphics();
    // Top: cooler / lighter (sky-marble feel)
    g.fillGradientStyle(0xa8b5c2, 0xa8b5c2, 0x6e7888, 0x6e7888, 1);
    g.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    g.setDepth(-10);
  }

  private drawMarblePlaza() {
    // Main marble platform — cream white
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0xefe9d9, 1);
    // Big rounded plaza
    g.fillRoundedRect(120, 240, MAP_WIDTH - 240, MAP_HEIGHT - 380, 60);
    // Subtle outline
    g.lineStyle(3, 0xc0b89d, 1);
    g.strokeRoundedRect(120, 240, MAP_WIDTH - 240, MAP_HEIGHT - 380, 60);

    // Marble veining (decorative dashed lines)
    g.lineStyle(1, 0xd6cfb6, 0.5);
    for (let i = 0; i < 14; i++) {
      const y = 280 + i * (MAP_HEIGHT - 460) / 14;
      g.lineBetween(160, y, MAP_WIDTH - 160, y);
    }
  }

  private drawPaths() {
    // Light path connecting buildings (visual flow)
    const g = this.add.graphics();
    g.setDepth(-3);
    g.lineStyle(28, 0xd6cfb6, 0.85);
    // Vision tower (top) -> Council hall (mid)
    g.lineBetween(800, 600, 800, 920);
    // Council hall -> Mirror pavilion (sw)
    g.lineBetween(700, 1240, 480, 1450);
    // Council hall -> port (south)
    g.lineBetween(800, 1240, 800, 2200);
  }

  private drawVisionTower(b: BuildingTrigger) {
    const g = this.add.graphics();
    g.setDepth(1);
    // Wide circular base (like a stylobate)
    g.fillStyle(0xdcd4b9, 1);
    g.fillCircle(b.worldX, b.worldY + b.height / 2 - 40, b.width / 2 + 30);
    g.lineStyle(2, 0x9a8d6c, 1);
    g.strokeCircle(b.worldX, b.worldY + b.height / 2 - 40, b.width / 2 + 30);

    // Tower body — tall white cylinder (drawn as rect for pixel feel)
    g.fillStyle(0xf5f0e0, 1);
    g.fillRect(b.worldX - b.width / 2, b.worldY - b.height / 2, b.width, b.height - 40);
    g.lineStyle(2, 0x9a8d6c, 1);
    g.strokeRect(b.worldX - b.width / 2, b.worldY - b.height / 2, b.width, b.height - 40);

    // Vertical fluting (column ridges)
    g.lineStyle(1, 0xc0b89d, 0.7);
    for (let i = 1; i < 6; i++) {
      const x = b.worldX - b.width / 2 + (b.width / 6) * i;
      g.lineBetween(x, b.worldY - b.height / 2 + 20, x, b.worldY + b.height / 2 - 60);
    }

    // Triangular pediment top (Greek style)
    g.fillStyle(0xe6deca, 1);
    g.beginPath();
    g.moveTo(b.worldX - b.width / 2 - 12, b.worldY - b.height / 2);
    g.lineTo(b.worldX, b.worldY - b.height / 2 - 56);
    g.lineTo(b.worldX + b.width / 2 + 12, b.worldY - b.height / 2);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0x9a8d6c, 1);
    g.strokePath();

    // Door
    g.fillStyle(0x6b5a3e, 1);
    g.fillRect(b.worldX - 18, b.worldY + b.height / 2 - 60, 36, 60);
    g.lineStyle(2, 0x4a3e26, 1);
    g.strokeRect(b.worldX - 18, b.worldY + b.height / 2 - 60, 36, 60);

    // Tower cap (small dome)
    g.fillStyle(0xb8a472, 1);
    g.fillCircle(b.worldX, b.worldY - b.height / 2 - 70, 14);
  }

  private drawCouncilHall(b: BuildingTrigger) {
    const g = this.add.graphics();
    g.setDepth(1);
    // Stylobate (stepped base)
    g.fillStyle(0xdcd4b9, 1);
    g.fillRect(b.worldX - b.width / 2 - 30, b.worldY + b.height / 2 - 30, b.width + 60, 30);
    g.fillStyle(0xc8c0a3, 1);
    g.fillRect(b.worldX - b.width / 2 - 16, b.worldY + b.height / 2 - 18, b.width + 32, 18);

    // Main hall body
    g.fillStyle(0xf5f0e0, 1);
    g.fillRect(b.worldX - b.width / 2, b.worldY - b.height / 2 + 60, b.width, b.height - 90);
    g.lineStyle(2, 0x9a8d6c, 1);
    g.strokeRect(b.worldX - b.width / 2, b.worldY - b.height / 2 + 60, b.width, b.height - 90);

    // 6 columns at front
    const colCount = 6;
    const colSpacing = (b.width - 40) / (colCount - 1);
    for (let i = 0; i < colCount; i++) {
      const cx = b.worldX - b.width / 2 + 20 + i * colSpacing;
      // Column shaft
      g.fillStyle(0xe6deca, 1);
      g.fillRect(cx - 8, b.worldY - b.height / 2 + 60, 16, b.height - 90);
      // Capital (top)
      g.fillStyle(0xc8c0a3, 1);
      g.fillRect(cx - 12, b.worldY - b.height / 2 + 60, 24, 6);
      // Base (bottom)
      g.fillRect(cx - 12, b.worldY + b.height / 2 - 36, 24, 6);
      // Fluting line
      g.lineStyle(1, 0xc0b89d, 0.6);
      g.lineBetween(cx, b.worldY - b.height / 2 + 70, cx, b.worldY + b.height / 2 - 40);
    }

    // Triangular pediment (Greek temple front)
    g.fillStyle(0xede5cf, 1);
    g.beginPath();
    g.moveTo(b.worldX - b.width / 2 - 16, b.worldY - b.height / 2 + 60);
    g.lineTo(b.worldX, b.worldY - b.height / 2 - 20);
    g.lineTo(b.worldX + b.width / 2 + 16, b.worldY - b.height / 2 + 60);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0x9a8d6c, 1);
    g.strokePath();
    // Pediment medallion
    g.fillStyle(0xb8a472, 1);
    g.fillCircle(b.worldX, b.worldY - b.height / 2 + 30, 10);

    // Central door
    g.fillStyle(0x6b5a3e, 1);
    g.fillRect(b.worldX - 24, b.worldY + b.height / 2 - 70, 48, 40);
    g.lineStyle(2, 0x4a3e26, 1);
    g.strokeRect(b.worldX - 24, b.worldY + b.height / 2 - 70, 48, 40);
    // Door arc detail
    g.lineStyle(2, 0xb8a472, 1);
    g.strokeCircle(b.worldX, b.worldY + b.height / 2 - 70, 24);
  }

  private drawMirrorPavilion(b: BuildingTrigger) {
    const g = this.add.graphics();
    g.setDepth(1);
    // Lower platform
    g.fillStyle(0xdcd4b9, 1);
    g.fillRect(b.worldX - b.width / 2 - 16, b.worldY + b.height / 2 - 18, b.width + 32, 18);

    // Body — smaller, single story
    g.fillStyle(0xf5f0e0, 1);
    g.fillRect(b.worldX - b.width / 2, b.worldY - b.height / 2 + 40, b.width, b.height - 60);
    g.lineStyle(2, 0x9a8d6c, 1);
    g.strokeRect(b.worldX - b.width / 2, b.worldY - b.height / 2 + 40, b.width, b.height - 60);

    // 4 slender columns
    const colCount = 4;
    const colSpacing = (b.width - 30) / (colCount - 1);
    for (let i = 0; i < colCount; i++) {
      const cx = b.worldX - b.width / 2 + 15 + i * colSpacing;
      g.fillStyle(0xe6deca, 1);
      g.fillRect(cx - 5, b.worldY - b.height / 2 + 40, 10, b.height - 60);
      g.fillStyle(0xc8c0a3, 1);
      g.fillRect(cx - 8, b.worldY - b.height / 2 + 40, 16, 4);
      g.fillRect(cx - 8, b.worldY + b.height / 2 - 24, 16, 4);
    }

    // Curved roof (gentle arch — pavilion style)
    g.fillStyle(0xb8a472, 1);
    g.fillEllipse(b.worldX, b.worldY - b.height / 2 + 30, b.width + 24, 50);

    // Door
    g.fillStyle(0x6b5a3e, 1);
    g.fillRect(b.worldX - 16, b.worldY + b.height / 2 - 50, 32, 30);
    g.lineStyle(2, 0x4a3e26, 1);
    g.strokeRect(b.worldX - 16, b.worldY + b.height / 2 - 50, 32, 30);

    // Mirror motif above door (decorative oval)
    g.lineStyle(2, 0xb8a472, 1);
    g.strokeEllipse(b.worldX, b.worldY - 30, 40, 24);
  }

  private drawPortMarkers() {
    // Two stone pillars marking the port (south entry)
    const g = this.add.graphics();
    g.setDepth(1);
    const px = MAP_WIDTH / 2;
    const py = MAP_HEIGHT - 100;
    [-80, 80].forEach((dx) => {
      g.fillStyle(0xe6deca, 1);
      g.fillRect(px + dx - 14, py - 100, 28, 100);
      g.lineStyle(2, 0x9a8d6c, 1);
      g.strokeRect(px + dx - 14, py - 100, 28, 100);
      // Cap
      g.fillStyle(0xc8c0a3, 1);
      g.fillRect(px + dx - 18, py - 100, 36, 8);
      g.fillRect(px + dx - 18, py - 8, 36, 8);
    });
    // Boat hint visual (a stylized boat)
    g.fillStyle(0x4a3e26, 1);
    g.fillTriangle(px - 30, py + 30, px + 30, py + 30, px, py + 50);
    g.fillRect(px - 22, py + 20, 44, 14);
  }

  // ============ ANIMATION SETUP ============

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

  private findClosestBuilding(): BuildingTrigger | null {
    let closest: BuildingTrigger | null = null;
    let minDist = INTERACT_DISTANCE;
    for (const b of BUILDINGS) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.doorX, b.doorY);
      if (d < minDist) { minDist = d; closest = b; }
    }
    return closest;
  }

  private enterBuilding(b: BuildingTrigger) {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(b.sceneKey, {
        returnX: b.doorX,
        returnY: b.doorY + 64,
      });
    });
  }

  private exitToPort(targetSceneKey: 'SproutCity' | 'Main') {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (targetSceneKey === 'SproutCity') {
        // Return to Sprout City's east port (we'll add this in SproutCityScene)
        this.scene.start('SproutCity', {
          returnX: 39 * 32 + 16,  // far east edge
          returnY: 16 * 32 + 16,  // mid-Y
        });
      } else {
        this.scene.start('Main');
      }
    });
  }

  private exitToGrandPlaza() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('GrandPlaza');
    });
  }

  private async triggerGuardDialogue() {
    const info = await fetchUserLevel();
    const level = info?.level ?? 0;
    const lines = this.getGuardLinesForLevel(level);
    EventBus.emit('show-dialogue', {
      name: '🛡️ 议政高地守卫',
      lines,
    });
  }

  /**
   * F5.2: Guard speaks differently based on player's current level.
   * Adapts respect, permissions explanation, and salutation to rank.
   */
  private getGuardLinesForLevel(level: number): string[] {
    switch (level) {
      case 0:
        // L0 新人 — gently informative, sets expectations
        return [
          '"欢迎来到议政高地。"',
          '"——你是新人？没关系，参观无妨。"',
          '"远见塔在北、执政厅居中、明镜阁在西。"',
          '',
          '"不过——投票需 L1 活跃贡献者，"',
          '"提案需 L2 mentor。"',
          '"先去共创之都接些活儿吧。"',
          '（守卫指了指西边的方向）',
        ];

      case 1:
        // L1 活跃贡献者 — recognizes their right to vote
        return [
          '"——这位活跃贡献者，欢迎。"',
          '"按章程，你已可参与投票。"',
          '"执政厅的提案板，欢迎你的声音。"',
          '',
          '"提案权需 L2 mentor——再积些功劳便是。"',
          '（守卫向你致意）',
        ];

      case 2:
        // L2 mentor — full participation
        return [
          '"mentor 大驾光临。"',
          '"远见塔、执政厅、明镜阁——皆可入。"',
          '"投票、提案——你的声音都将被记入。"',
          '',
          '"——议事就在执政厅。请。"',
          '（守卫郑重地向你行礼）',
        ];

      case 3:
        // L3 子项目负责人 — significant deference
        return [
          '"——子项目负责人。这边请。"',
          '"高地上下，你皆有发言权。"',
          '"决议表决时，你的票按章程加权。"',
          '',
          '（守卫退后半步，让出通道）',
          '"——执政厅恭候。"',
        ];

      case 4:
        // L4 联席主席 — top of hierarchy
        return [
          '"——联席主席。"',
          '（守卫双手交叠，深深行礼）',
          '"高地全境，听凭差遣。"',
          '"远见塔、执政厅、明镜阁，三处皆开。"',
          '',
          '"——大事在前，望主席决断。"',
        ];

      default:
        return [
          '"欢迎来到议政高地。"',
          '（守卫向你颔首）',
        ];
    }
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

    // G1.1: track facing + tick remote players
    this.currentFacing = facingFromVelocity(vx, vy, this.currentFacing);
    if (this.mp) this.mp.tick();

    if (vx < 0) {
      this.lastDirection = 'left';
      this.player.setFlipX(true);
      this.player.anims.play('player-walk-right', true);
    } else if (vx > 0) {
      this.lastDirection = 'right';
      this.player.setFlipX(false);
      this.player.anims.play('player-walk-right', true);
    } else if (vy < 0) {
      this.lastDirection = 'up';
      this.player.setFlipX(false);
      this.player.anims.play('player-walk-up', true);
    } else if (vy > 0) {
      this.lastDirection = 'down';
      this.player.setFlipX(false);
      this.player.anims.play('player-walk-down', true);
    } else {
      if (this.lastDirection === 'left') {
        this.player.setFlipX(true);
        this.player.anims.play('player-idle-right', true);
      } else if (this.lastDirection === 'right') {
        this.player.setFlipX(false);
        this.player.anims.play('player-idle-right', true);
      } else {
        this.player.setFlipX(false);
        this.player.anims.play(`player-idle-${this.lastDirection}`, true);
      }
    }

    if (this.time.now < this.inputLockUntil) {
      this.interactHint.setVisible(false);
      this.portHint.setVisible(false);
      this.guardHint.setVisible(false);
      this.eastPortHint.setVisible(false);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
      EventBus.emit('open-world-map', { currentScene: 'GovHill' });
    }
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) {
      EventBus.emit('open-quest-log');
    }
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) {
      EventBus.emit('open-mailbox');
    }

    const distToPort = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.portX, this.portY);
    const nearPort = distToPort < 80;
    const distToEastPort = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.eastPortX, this.eastPortY);
    const nearEastPort = distToEastPort < 80;
    const distToGuard = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.guardX, this.guardY);
    const nearGuard = distToGuard < 48;
    const closestBuilding = this.findClosestBuilding();

    if (nearPort) {
      this.portHint.setPosition(this.portX, this.portY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      this.guardHint.setVisible(false);
      this.eastPortHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        this.exitToPort('SproutCity');
      }
    } else if (nearEastPort) {
      this.eastPortHint.setPosition(this.eastPortX - 30, this.eastPortY - 110).setVisible(true);
      this.portHint.setVisible(false);
      this.guardHint.setVisible(false);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        this.exitToGrandPlaza();
      }
    } else if (nearGuard) {
      this.guardHint.setPosition(this.guardX, this.guardY - 24).setVisible(true);
      this.portHint.setVisible(false);
      this.interactHint.setVisible(false);
      this.eastPortHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        void this.triggerGuardDialogue();
      }
    } else if (closestBuilding) {
      this.portHint.setVisible(false);
      this.guardHint.setVisible(false);
      this.eastPortHint.setVisible(false);
      this.interactHint
        .setText(`[E] 进入 ${closestBuilding.name}`)
        .setPosition(closestBuilding.doorX, closestBuilding.doorY - 28)
        .setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        this.enterBuilding(closestBuilding);
      }
    } else {
      this.interactHint.setVisible(false);
      this.portHint.setVisible(false);
      this.guardHint.setVisible(false);
      this.eastPortHint.setVisible(false);
    }
  }
}
