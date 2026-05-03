import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { fetchUserLevel } from '../../lib/levelStore';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 140;
const INTERACT_DISTANCE = 56;
const BGM_VOLUME = 0.25;

/**
 * 璁斂楂樺湴 (Governance Hill) 鈥?Phase 4 governance center.
 *
 * Layout (south to north):
 *   - Port (south, entry from Sprout City)
 *   - Stone steps leading up
 *   - Mirror Pavilion (west, lower platform)
 *   - Council Hall (center, main plaza)
 *   - Vision Tower (north, highest peak)
 *
 * Visual style: B2 Greek council 鈥?white marble, stone columns,
 * pediments. Drawn entirely with Phaser graphics primitives
 * (no tilemap dependency) so it renders without external assets.
 */

// Wave 8.GovHill · 改造：缩小到共创之都同尺寸
const MAP_WIDTH = 1280;
const MAP_HEIGHT = 960;

interface BuildingTrigger {
  id: 'vision-tower' | 'council-hall' | 'mirror-pavilion';
  name: string;
  description: string;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  /** Door point 鈥?where player enters when pressing E */
  doorX: number;
  doorY: number;
  sceneKey: string;
}

const BUILDINGS: BuildingTrigger[] = [
  {
    id: 'vision-tower',
    name: '远见塔',
    description: '远瞻天下、规划长程。CUA 路线图的公示之地。',
    worldX: 256, worldY: 200,
    width: 180, height: 220,
    doorX: 256, doorY: 310,
    sceneKey: 'VisionTower',
  },
  {
    id: 'council-hall',
    name: '理事会',
    description: '提案、辩论、决议。CUA 议事的中枢。',
    worldX: 640, worldY: 180,
    width: 220, height: 260,
    doorX: 640, doorY: 310,
    sceneKey: 'CouncilHall',
  },
  {
    id: 'mirror-pavilion',
    name: '明镜阁',
    description: '监察、申诉、复议。让贡献的天平回归公允。',
    worldX: 1024, worldY: 200,
    width: 180, height: 220,
    doorX: 1024, doorY: 310,
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

  // East port 鈥?to GrandPlaza (澶ч泦浼氬箍鍦?
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
    const defaultY = 850;
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
    // G1.1 路 Multiplayer (via helper)
    this.mp = setupMultiplayer(this, 'GovHill', () => this.player, () => this.currentFacing);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.5);
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
    this.eastPortY = MAP_HEIGHT / 2;
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
    const eastMarker = this.add.text(this.eastPortX - 30, this.eastPortY - 60, '鉀碉笍', {
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
    this.guardX = MAP_WIDTH / 2 + 120;
    this.guardY = MAP_HEIGHT / 2 + 80;
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

  // ============ DRAWING (Wave 8.GovHill · 落地页米色风) ============

  /** 草地背景 (替代旧的灰蓝大理石) */
  private drawBackdrop() {
    const g = this.add.graphics();
    g.setDepth(-10);
    // 主体草地
    g.fillStyle(0x6b9b3a, 1);
    g.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    // 散点纹理
    g.fillStyle(0x7fb045, 0.6);
    const seed = 42;
    let r = seed;
    for (let i = 0; i < 200; i++) {
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      const x = r % MAP_WIDTH;
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      const y = r % MAP_HEIGHT;
      g.fillCircle(x, y, 1.5);
    }
  }

  /** 中央米色广场 + 议政纪念碑 */
  private drawMarblePlaza() {
    const g = this.add.graphics();
    g.setDepth(-5);
    // 广场位置：地图中下部 (在 3 建筑下方 · 玩家走过路过)
    const px = MAP_WIDTH / 2;
    const py = MAP_HEIGHT / 2 + 80;
    const pw = 480;
    const ph = 200;
    // 米色石板底
    g.fillStyle(0xf0e8d0, 1);
    g.fillRect(px - pw / 2, py - ph / 2, pw, ph);
    g.lineStyle(3, 0xc9b886, 1);
    g.strokeRect(px - pw / 2, py - ph / 2, pw, ph);
    // 内嵌虚线纹饰 (上下边)
    g.lineStyle(1, 0xc9b886, 0.6);
    for (let x = px - pw / 2 + 20; x < px + pw / 2 - 20; x += 16) {
      g.lineBetween(x, py - ph / 2 + 15, x + 10, py - ph / 2 + 15);
      g.lineBetween(x, py + ph / 2 - 15, x + 10, py + ph / 2 - 15);
    }
    for (let y = py - ph / 2 + 20; y < py + ph / 2 - 20; y += 16) {
      g.lineBetween(px - pw / 2 + 15, y, px - pw / 2 + 15, y + 10);
      g.lineBetween(px + pw / 2 - 15, y, px + pw / 2 - 15, y + 10);
    }

    // ===== 议政纪念碑 (广场北侧 · drawSteleAndDeco) =====
    this.drawSteleAndDeco();
  }

  /** 议政纪念碑 + 双红旗柱 + 守卫 NPC 区 */
  private drawSteleAndDeco() {
    const g = this.add.graphics();
    g.setDepth(2);
    const px = MAP_WIDTH / 2;
    const py = MAP_HEIGHT / 2 + 50;

    // 纪念碑底座
    g.fillStyle(0x8b6f4a, 1);
    g.fillRect(px - 60, py + 30, 120, 20);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(px - 60, py + 30, 120, 20);

    // 主碑 (米色石身)
    g.fillStyle(0xd4c69a, 1);
    g.fillRect(px - 30, py - 80, 60, 110);
    g.fillStyle(0xb8a472, 1);
    g.fillRect(px - 30, py - 30, 60, 60);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(px - 30, py - 80, 60, 110);

    // 顶座
    g.fillStyle(0x8b6f4a, 1);
    g.fillRect(px - 40, py - 90, 80, 15);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(px - 40, py - 90, 80, 15);

    // 碑面"议政"两字 (大方块 · 实际上由后续 add.text 渲染)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(px - 8, py - 60, 16, 16);
    g.fillRect(px - 8, py - 36, 16, 16);

    // 真实文字"议 政"
    this.add.text(px, py - 52, '议', {
      fontFamily: 'serif', fontSize: '14px',
      color: '#fdf0cf', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
    this.add.text(px, py - 28, '政', {
      fontFamily: 'serif', fontSize: '14px',
      color: '#fdf0cf', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    // ===== 双红旗柱 (广场两侧) =====
    [px - 300, px + 300].forEach((fx) => {
      // 底座
      g.fillStyle(0x5d3a1a, 1);
      g.fillRect(fx - 12, py + 40, 24, 12);
      // 旗杆
      g.fillStyle(0x3a2a1a, 1);
      g.fillRect(fx - 2, py - 60, 4, 100);
      // 顶端金球
      g.fillStyle(0xdaa520, 1);
      g.fillCircle(fx, py - 64, 6);
      // 红旗
      g.fillStyle(0xa32d2d, 1);
      g.fillRect(fx + 2, py - 56, 48, 36);
      // 旗高光
      g.fillStyle(0xc94545, 1);
      g.fillRect(fx + 2, py - 56, 48, 6);
      // 金徽 (圆形)
      g.fillStyle(0xdaa520, 1);
      g.fillCircle(fx + 26, py - 38, 8);
      g.fillStyle(0xa32d2d, 1);
      g.fillCircle(fx + 26, py - 38, 5);
      g.fillStyle(0xfac775, 1);
      g.fillCircle(fx + 26, py - 38, 2);
    });
  }

  /** 路径 (米黄石板) */
  private drawPaths() {
    const g = this.add.graphics();
    g.setDepth(-3);
    // 路径配色 (米黄石板)
    const pathColor = 0xd4c69a;
    const pathEdge = 0xb8a472;

    // 横向主路 (中线)
    g.fillStyle(pathColor, 1);
    g.fillRect(60, MAP_HEIGHT / 2 - 20, MAP_WIDTH - 120, 40);
    g.lineStyle(2, pathEdge, 1);
    g.lineBetween(60, MAP_HEIGHT / 2 - 20, MAP_WIDTH - 60, MAP_HEIGHT / 2 - 20);
    g.lineBetween(60, MAP_HEIGHT / 2 + 20, MAP_WIDTH - 60, MAP_HEIGHT / 2 + 20);

    // 北路 (中央 · 通到 3 建筑下方 · 玩家从南门来)
    g.fillStyle(pathColor, 1);
    g.fillRect(MAP_WIDTH / 2 - 20, MAP_HEIGHT / 2 + 20, 40, MAP_HEIGHT - MAP_HEIGHT / 2 - 80);
    g.lineStyle(2, pathEdge, 1);
    g.lineBetween(MAP_WIDTH / 2 - 20, MAP_HEIGHT / 2 + 20, MAP_WIDTH / 2 - 20, MAP_HEIGHT - 60);
    g.lineBetween(MAP_WIDTH / 2 + 20, MAP_HEIGHT / 2 + 20, MAP_WIDTH / 2 + 20, MAP_HEIGHT - 60);

    // 北门进入路 (通到 3 建筑前)
    g.fillStyle(pathColor, 1);
    g.fillRect(MAP_WIDTH / 2 - 20, 60, 40, MAP_HEIGHT / 2 - 60);
    g.lineStyle(2, pathEdge, 1);
    g.lineBetween(MAP_WIDTH / 2 - 20, 60, MAP_WIDTH / 2 - 20, MAP_HEIGHT / 2);
    g.lineBetween(MAP_WIDTH / 2 + 20, 60, MAP_WIDTH / 2 + 20, MAP_HEIGHT / 2);

    // 3 条支路 (从横向主路通往各建筑门)
    BUILDINGS.forEach((b) => {
      g.fillStyle(pathColor, 1);
      g.fillRect(b.doorX - 16, b.doorY, 32, MAP_HEIGHT / 2 - b.doorY);
      g.lineStyle(2, pathEdge, 1);
      g.lineBetween(b.doorX - 16, b.doorY, b.doorX - 16, MAP_HEIGHT / 2);
      g.lineBetween(b.doorX + 16, b.doorY, b.doorX + 16, MAP_HEIGHT / 2);
    });

    // ===== 边缘装饰 (4 棵树 + 4 处花丛) =====
    this.drawTreesAndFlowers();
  }

  /** 边缘装饰 树 + 花 */
  private drawTreesAndFlowers() {
    const g = this.add.graphics();
    g.setDepth(0);

    // 4 棵树 (左下 2 + 右下 2)
    const treePos = [
      { x: 100, y: MAP_HEIGHT - 220 },
      { x: 130, y: MAP_HEIGHT - 100 },
      { x: MAP_WIDTH - 100, y: MAP_HEIGHT - 220 },
      { x: MAP_WIDTH - 130, y: MAP_HEIGHT - 100 },
    ];
    treePos.forEach((t) => {
      // 树冠 (深绿)
      g.fillStyle(0x3b6d11, 1);
      g.fillCircle(t.x, t.y, 26);
      // 树冠高光 (浅绿)
      g.fillStyle(0x639b22, 1);
      g.fillCircle(t.x, t.y - 4, 20);
      // 树干 (棕)
      g.fillStyle(0x5d3a1a, 1);
      g.fillRect(t.x - 5, t.y + 15, 10, 22);
    });

    // 4 处花丛
    const flowerPos = [
      { x: 280, y: MAP_HEIGHT - 230 },
      { x: 460, y: MAP_HEIGHT - 280 },
      { x: MAP_WIDTH - 280, y: MAP_HEIGHT - 230 },
      { x: MAP_WIDTH - 460, y: MAP_HEIGHT - 280 },
    ];
    const flowerColors = [0xef5050, 0xfac775, 0x4a8ad5, 0xdaa520];
    flowerPos.forEach((f) => {
      flowerColors.forEach((c, i) => {
        const ox = (i % 2) * 14 - 7;
        const oy = Math.floor(i / 2) * 14 - 7;
        g.fillStyle(c, 1);
        g.fillCircle(f.x + ox, f.y + oy, 5);
        g.fillStyle(0xfdf0cf, 1);
        g.fillCircle(f.x + ox, f.y + oy, 1.5);
      });
    });
  }

  /** 远见塔 (左 · 紫顶圆形) */
  private drawVisionTower(b: BuildingTrigger) {
    const g = this.add.graphics();
    g.setDepth(1);

    const x = b.worldX;
    const y = b.worldY;
    const w = b.width;
    const h = b.height;

    // 主体 (米色羊皮纸)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - w / 2, y - h / 2 + 30, w, h - 30);
    g.lineStyle(3, 0x5d3a1a, 1);
    g.strokeRect(x - w / 2, y - h / 2 + 30, w, h - 30);

    // 紫顶 (圆顶 · 用 fillEllipse · 已知此 API 在该 scene 有效)
    g.fillStyle(0x4a3a6a, 1);
    g.fillEllipse(x, y - h / 2 + 30, w + 20, 60);
    // 紫顶高光
    g.fillStyle(0x6a5a8a, 1);
    g.fillEllipse(x, y - h / 2 + 24, w + 14, 24);

    // 4 根白柱
    const cols = 4;
    for (let i = 0; i < cols; i++) {
      const cx = x - w / 2 + 12 + i * (w - 24) / (cols - 1);
      g.fillStyle(0xfdf0cf, 1);
      g.fillRect(cx - 4, y - h / 2 + 38, 8, h - 80);
      g.lineStyle(1, 0x8b6f4a, 0.6);
      g.strokeRect(cx - 4, y - h / 2 + 38, 8, h - 80);
    }

    // 门 (棕色)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 18, y + h / 2 - 50, 36, 50);
    g.lineStyle(2, 0x3a2a1a, 1);
    g.strokeRect(x - 18, y + h / 2 - 50, 36, 50);
    // 门把手 (金)
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x + 10, y + h / 2 - 25, 2);
  }

  /** 理事会 (中 · 红顶平顶 · 稍大) */
  private drawCouncilHall(b: BuildingTrigger) {
    const g = this.add.graphics();
    g.setDepth(1);

    const x = b.worldX;
    const y = b.worldY;
    const w = b.width;
    const h = b.height;

    // 主体 (米色羊皮纸)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - w / 2, y - h / 2 + 30, w, h - 30);
    g.lineStyle(3, 0x5d3a1a, 1);
    g.strokeRect(x - w / 2, y - h / 2 + 30, w, h - 30);

    // 红顶 (平顶 · 矩形 + 屋脊高光)
    g.fillStyle(0x6b3434, 1);
    g.fillRect(x - w / 2 - 12, y - h / 2, w + 24, 36);
    g.fillStyle(0x854444, 1);
    g.fillRect(x - w / 2 - 12, y - h / 2, w + 24, 8);
    g.lineStyle(2, 0x5d3a1a, 1);
    g.strokeRect(x - w / 2 - 12, y - h / 2, w + 24, 36);

    // 屋脊金徽
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x, y - h / 2 + 18, 8);
    g.fillStyle(0x6b3434, 1);
    g.fillCircle(x, y - h / 2 + 18, 5);
    g.fillStyle(0xfac775, 1);
    g.fillCircle(x, y - h / 2 + 18, 2);

    // 6 根白柱
    const cols = 6;
    for (let i = 0; i < cols; i++) {
      const cx = x - w / 2 + 16 + i * (w - 32) / (cols - 1);
      g.fillStyle(0xfdf0cf, 1);
      g.fillRect(cx - 4, y - h / 2 + 40, 8, h - 90);
      g.lineStyle(1, 0x8b6f4a, 0.6);
      g.strokeRect(cx - 4, y - h / 2 + 40, 8, h - 90);
    }

    // 大门 (中央 · 双开)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 30, y + h / 2 - 60, 60, 60);
    g.lineStyle(2, 0x3a2a1a, 1);
    g.strokeRect(x - 30, y + h / 2 - 60, 60, 60);
    // 门中线 (双开门示意)
    g.lineStyle(1, 0x3a2a1a, 1);
    g.lineBetween(x, y + h / 2 - 60, x, y + h / 2);
    // 双门把手 (金)
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x - 8, y + h / 2 - 30, 2);
    g.fillCircle(x + 8, y + h / 2 - 30, 2);
  }

  /** 明镜阁 (右 · 青顶圆形) */
  private drawMirrorPavilion(b: BuildingTrigger) {
    const g = this.add.graphics();
    g.setDepth(1);

    const x = b.worldX;
    const y = b.worldY;
    const w = b.width;
    const h = b.height;

    // 主体 (米色羊皮纸)
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - w / 2, y - h / 2 + 30, w, h - 30);
    g.lineStyle(3, 0x5d3a1a, 1);
    g.strokeRect(x - w / 2, y - h / 2 + 30, w, h - 30);

    // 青顶 (圆顶)
    g.fillStyle(0x2a4a4a, 1);
    g.fillEllipse(x, y - h / 2 + 30, w + 20, 60);
    // 青顶高光
    g.fillStyle(0x4a6a6a, 1);
    g.fillEllipse(x, y - h / 2 + 24, w + 14, 24);

    // 4 根白柱
    const cols = 4;
    for (let i = 0; i < cols; i++) {
      const cx = x - w / 2 + 12 + i * (w - 24) / (cols - 1);
      g.fillStyle(0xfdf0cf, 1);
      g.fillRect(cx - 4, y - h / 2 + 38, 8, h - 80);
      g.lineStyle(1, 0x8b6f4a, 0.6);
      g.strokeRect(cx - 4, y - h / 2 + 38, 8, h - 80);
    }

    // 门
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 18, y + h / 2 - 50, 36, 50);
    g.lineStyle(2, 0x3a2a1a, 1);
    g.strokeRect(x - 18, y + h / 2 - 50, 36, 50);
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x + 10, y + h / 2 - 25, 2);

    // 装饰镜 (门上方 · 椭圆)
    g.lineStyle(2, 0x4a8ad5, 1);
    g.strokeEllipse(x, y + h / 2 - 80, 30, 18);
  }

  /** 南门标记 (港口意象 → 改成简洁石柱) */
  private drawPortMarkers() {
    const g = this.add.graphics();
    g.setDepth(1);
    const px = MAP_WIDTH / 2;
    const py = MAP_HEIGHT - 100;
    [-50, 50].forEach((dx) => {
      // 石柱
      g.fillStyle(0xfdf0cf, 1);
      g.fillRect(px + dx - 10, py - 40, 20, 40);
      g.lineStyle(2, 0x5d3a1a, 1);
      g.strokeRect(px + dx - 10, py - 40, 20, 40);
      // 顶帽
      g.fillStyle(0xdaa520, 1);
      g.fillRect(px + dx - 14, py - 44, 28, 6);
    });
    // 路标牌
    this.add.text(px, py - 60, '↓ 萌芽镇', {
      fontFamily: 'serif', fontSize: '12px',
      color: '#5d3a1a', backgroundColor: '#fdf0cfee',
      padding: { left: 6, right: 6, top: 2, bottom: 2 },
    }).setOrigin(0.5).setDepth(5);
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
      name: '馃洝锔?璁斂楂樺湴瀹堝崼',
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
        return [
          '"欢迎来到议政高地。"',
          '"——你是新人？没关系，参观无妨。"',
          '"远见塔在北、理事会居中、明镜阁在西。"',
          '',
          '"不过——投票需 L1 活跃贡献者，"',
          '"提案需 L2 mentor。"',
          '"先去共创之都接些活儿吧。"',
          '（守卫指了指西边的方向）',
        ];
      case 1:
        return [
          '"——这位活跃贡献者，欢迎。"',
          '"按章程，你已可参与投票。"',
          '"理事会的提案栏，欢迎你的声音。"',
          '',
          '"提案权需 L2 mentor——再积些功劳便是。"',
          '（守卫向你致意）',
        ];
      case 2:
        return [
          '"mentor 大驾光临。"',
          '"远见塔、理事会、明镜阁——皆可入。"',
          '"投票、提案——你的声音都将被记入。"',
          '',
          '"——议事就在理事会。请。"',
          '（守卫郑重地向你行礼）',
        ];
      case 3:
        return [
          '"——子项目负责人。这边请。"',
          '"高地上下，你皆有发言权。"',
          '"决议表决时，你的票按章程加权。"',
          '',
          '（守卫退后半步，让出通道）',
          '"——理事会恭候。"',
        ];
      case 4:
        return [
          '"——联席主席。"',
          '（守卫双手交叉，深深行礼）',
          '"高地全员，听凭差遣。"',
          '"远见塔、理事会、明镜阁，三处皆开。"',
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

