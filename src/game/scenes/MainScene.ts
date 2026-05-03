import { attachMinimap } from '../minimap-bridge';
import * as Phaser from 'phaser';
import { bgmManager } from '../bgmManager';
import { NPC } from '../entities/NPC';
import { SignPost } from '../entities/SignPost';
import { EventBus } from '../EventBus';
import type { InteriorConfig } from './InteriorScene';
import { getFaceLocal, type FaceData } from '../../lib/faceStore';
import { applyFaceToSprite } from '../faceRenderer';
import { presence } from '../../lib/realtimePresence';
import { setupMultiplayer, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 140;
const INTERACT_DISTANCE = 48;
const BGM_VOLUME = 0.3;
const SFX_VOLUME = 0.5;

const STORAGE_KEY_QUESTS = 'cua-yuanye-quests-v2';
const STORAGE_KEY_FLOWERS = 'cua-yuanye-flowers-v1';
const STORAGE_KEY_EGGS = 'cua-yuanye-eggs-v1';
const STORAGE_KEY_CORNERS = 'cua-yuanye-corners-v1';
const STORAGE_KEY_BADGE = 'cua-yuanye-badge-v1';
const STORAGE_KEY_ERRANDS = 'cua-yuanye-errands-v1';
const STORAGE_KEY_LIBRARIAN_PAGES = 'cua-yuanye-librarian-pages-v1';

/**
 * Configuration for Axiang's cottage interior.
 * Adding more cottages = adding more configs like this and more enter points
 * in the door-detection block of update().
 */
// @ts-expect-error - kept for Wave 10 rollback to tilemap interior path
const AXIANG_COTTAGE_CONFIG: InteriorConfig = {
  mapKey: 'axiang-cottage',
  tilesetKey: 'tiles-interior',
  tilesetName: 'tiles-interior',
  // Spawn near the door mat at the bottom (just inside the door)
  spawnTileX: 6,
  spawnTileY: 6,
  // Exit point — the door mat tile
  exitTileX: 6,
  exitTileY: 7,
  displayName: '阿降的小屋',
  npcs: [
    {
      textureKey: 'axiang',
      name: '老村长 · 阿降',
      questId: 'axiang',
      // Place him next to the table, facing down toward the door
      tileX: 7,
      tileY: 5,
      facing: 'down',
      dialogue: [
        '哦，进来了。这屋子不大，随便看看。',
        '（阿降坐在桌前，桌上摊着几张地图）',
        '"你看这个——这是萌芽镇的全图。"',
        '"东南角的水池，是镇子的眼。"',
        '"西边的铁匠铺，将来要扩成工坊。"',
        '"上面的典籍阁，会成为镇子的脑。"',
        '...这镇子还小。但它会长大的。',
      ],
    },
  ],
};

/**
 * Librarian's library — scholarly room with bookshelf walls and a green rug.
 */
// @ts-expect-error - kept for Wave 10 rollback to tilemap interior path
const LIBRARIAN_LIBRARY_CONFIG: InteriorConfig = {
  mapKey: 'librarian-library',
  tilesetKey: 'tiles-interior',
  tilesetName: 'tiles-interior',
  spawnTileX: 6,
  spawnTileY: 6,
  exitTileX: 6,
  exitTileY: 7,
  displayName: '典籍阁',
  npcs: [
    {
      textureKey: 'librarian',
      name: '图书管理员 · 蓁',
      questId: 'librarian',
      // She stands near the reading table on the green rug
      tileX: 5,
      tileY: 5,
      facing: 'down',
      dialogue: [
        '...你来了。',
        '（蓁抬起头，手上还拿着一本书）',
        '"这里的书，比萌芽镇的人还多。"',
        '"每一本都在等一个读者，每一个读者也在等一本书。"',
        '"等典籍阁全开放的时候，你的名字也会在某一卷的扉页上。"',
        '...慢慢看吧。',
      ],
    },
  ],
};

/**
 * Blacksmith's forge — stone-floored workshop with forge, anvil, and benches.
 */
// @ts-expect-error - kept for Wave 10 rollback to tilemap interior path
const BLACKSMITH_FORGE_CONFIG: InteriorConfig = {
  mapKey: 'blacksmith-forge',
  tilesetKey: 'tiles-interior',
  tilesetName: 'tiles-interior',
  spawnTileX: 6,
  spawnTileY: 6,
  exitTileX: 6,
  exitTileY: 7,
  displayName: '铁匠铺',
  npcs: [
    {
      textureKey: 'blacksmith',
      name: '铁匠 · 老周',
      questId: 'blacksmith',
      // Standing next to the anvil, facing right toward where he'd swing
      tileX: 4,
      tileY: 5,
      facing: 'right',
      dialogue: [
        '哎呀，进屋了？正好——',
        '（老周拍了拍铁砧）"看见这家伙没？俺这一辈子的伙计。"',
        '"炉子还在烧着——以后这工坊全开起来，你想要啥铁器，俺都能给你打。"',
        '"剑、犁、铁锅、门钉......只要你说得出。"',
        '不过现在嘛——还差几样工具。等萌芽镇再热闹热闹再说。',
      ],
    },
  ],
};

interface Interactable {
  x: number;
  y: number;
  triggerDialogue: () => void;
}

type ErrandStatus = 'locked' | 'available' | 'inProgress' | 'completed';

interface ErrandState {
  blacksmith: ErrandStatus;
  merchant: ErrandStatus;
  librarian: ErrandStatus;
  fisher: ErrandStatus;
}

function getDoneQuestIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUESTS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Array<{ id: string; done: boolean }>;
    return new Set(parsed.filter((q) => q.done).map((q) => q.id));
  } catch { return new Set(); }
}

function getCompletedSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

function hasBadge(): boolean {
  return localStorage.getItem(STORAGE_KEY_BADGE) === '1';
}

function loadErrands(): ErrandState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ERRANDS);
    if (raw) return JSON.parse(raw) as ErrandState;
  } catch { /* ignore */ }
  return { blacksmith: 'locked', merchant: 'locked', librarian: 'locked', fisher: 'locked' };
}

function saveErrands(state: ErrandState) {
  localStorage.setItem(STORAGE_KEY_ERRANDS, JSON.stringify(state));
}

interface FlowerSpot {
  x: number;
  y: number;
  id: string;
  sprite?: Phaser.GameObjects.Text;
}

interface EasterEgg {
  x: number;
  y: number;
  id: string;
  name: string;
  discoveryToast: string;
  dialogue: string[];
  iconRef?: Phaser.GameObjects.Text | Phaser.Physics.Arcade.Sprite;
}

interface MapCorner {
  x: number;
  y: number;
  id: string;
  reached: boolean;
}

export class MainScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerFace: ReturnType<typeof applyFaceToSprite> | null = null;
  private mp: MultiplayerHandle | null = null;
  private currentFacing: 'up' | 'down' | 'left' | 'right' = 'down';
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private eKey!: Phaser.Input.Keyboard.Key;
  private mKey!: Phaser.Input.Keyboard.Key;
  private jKey!: Phaser.Input.Keyboard.Key;
  private kKey!: Phaser.Input.Keyboard.Key;
  private lastDirection: 'down' | 'left' | 'right' | 'up' = 'down';

  private npcs: Record<string, NPC> = {};
  private signposts: SignPost[] = [];
  private interactHint!: Phaser.GameObjects.Text;

  private flowerSpots: FlowerSpot[] = [];
  private easterEggs: EasterEgg[] = [];
  private corners: MapCorner[] = [];
  private cat?: Phaser.Physics.Arcade.Sprite;

  // Errand-related
  private errands: ErrandState = loadErrands();
  private oreSprite?: Phaser.GameObjects.Image;
  private oreInteractable?: Interactable;
  private fisherSitStart: number | null = null;   // ms timestamp when sit started
  private librarianPageCount = 0;                  // increments per dialogue

  private bgm?: Phaser.Sound.BaseSound;
  private bgmStarted = false;
  private sfxDialogue?: Phaser.Sound.BaseSound;
  private sfxHandlerBound = false;

  // For returning from interior — set in init()
  private spawnOverride: { x: number; y: number } | null = null;
  // Door interaction — set in create() after player exists
  private doorHint!: Phaser.GameObjects.Text;
  // Lock input briefly after returning from interior
  private inputLockUntil = 0;

  constructor() {
    super('Main');
  }

  init(data?: { returnX?: number; returnY?: number }) {
    if (data && typeof data.returnX === 'number' && typeof data.returnY === 'number') {
      this.spawnOverride = { x: data.returnX, y: data.returnY };
    } else {
      this.spawnOverride = null;
    }
    // Reset state for re-entry from interior
    this.npcs = {};
    this.signposts = [];
    this.flowerSpots = [];
    this.easterEggs = [];
    this.corners = [];
    this.bgmStarted = false;
  }

  create() {
    attachMinimap(this, 'MainScene');
    // ---- Tilemap ----
    const map = this.make.tilemap({ key: 'sproutown' });
    const tileset = map.addTilesetImage('tiles', 'tiles');
    if (!tileset) { console.error('Failed to load tileset'); return; }

    const groundLayer = map.createLayer('Ground', tileset);
    const decorLayer = map.createLayer('Decorations', tileset);
    const obstacleLayer = map.createLayer('Obstacles', tileset);
    void groundLayer; void decorLayer;

    if (!obstacleLayer) { console.error('Failed to create layers'); return; }
    obstacleLayer.setCollisionByProperty({ collides: true });
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // ---- Animations ----
    const characterTextures = ['player', 'axiang', 'librarian', 'blacksmith', 'merchant', 'fisher'];
    characterTextures.forEach((t) => this.createCharacterAnims(t));
    this.createCatAnims();

    // ---- Player ----
    // If returning from an interior, spawn at the returnX/Y. Otherwise use default.
    const spawnX = this.spawnOverride?.x ?? Math.floor(map.widthInPixels / 2);
    const spawnY = this.spawnOverride?.y ?? (Math.floor(map.heightInPixels / 2) + 32);
    this.player = this.physics.add.sprite(spawnX, spawnY, 'player', 0);
    this.player.setCollideWorldBounds(true);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(12, 6).setOffset(10, 17);
    this.player.anims.play('player-idle-down');
    this.physics.add.collider(this.player, obstacleLayer);

    // F6.0: apply face customization
    this.playerFace = applyFaceToSprite(this, this.player, getFaceLocal());
    const onFaceUpdate = (newFace: FaceData) => {
      if (this.playerFace) this.playerFace.reapply(newFace);
      // G1.0: also broadcast new face to other players
      presence.updateMeta({ face: newFace });
    };
    EventBus.on('face-updated', onFaceUpdate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('face-updated', onFaceUpdate);
      if (this.playerFace) {
        this.playerFace.destroy();
        this.playerFace = null;
      }
    });

    // G1.0 · Multiplayer setup (via helper)
    this.mp = setupMultiplayer(this, 'Main', () => this.player, () => this.currentFacing);

    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(2);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.eKey = this.input.keyboard!.addKey('E');
    this.mKey = this.input.keyboard!.addKey('M');
    this.jKey = this.input.keyboard!.addKey('J');
    this.kKey = this.input.keyboard!.addKey('K');

    const tile = (tx: number, ty: number) => ({ x: tx * 32 + 16, y: ty * 32 + 16 });

    // ---- NPCs ----
    // Note: Axiang stands at (13, 6) — one tile south of the cottage door at (13, 5).
    // The door tile (13, 5) is empty so the player can walk up to it and press E to enter.
    this.npcs.axiang = new NPC(this, {
      ...tile(13, 6),
      key: 'axiang', name: '老村长 · 阿降', texture: 'axiang',
      questId: 'axiang', facing: 'down',
      dialogue: () => this.getAxiangDialogue(),
    });
    this.physics.add.collider(this.player, this.npcs.axiang);

    this.npcs.librarian = new NPC(this, {
      ...tile(21, 6),  // moved from (21, 5) — door is at (21, 5)
      key: 'librarian', name: '图书管理员 · 蓁', texture: 'librarian',
      questId: 'librarian', facing: 'down',
      dialogue: () => this.getLibrarianDialogue(),
    });
    this.physics.add.collider(this.player, this.npcs.librarian);

    this.npcs.blacksmith = new NPC(this, {
      ...tile(5, 15),  // moved from (5, 14) — door is at (5, 14)
      key: 'blacksmith', name: '铁匠 · 老周', texture: 'blacksmith',
      questId: 'blacksmith', facing: 'right',
      dialogue: () => this.getBlacksmithDialogue(),
    });
    this.physics.add.collider(this.player, this.npcs.blacksmith);

    this.npcs.merchant = new NPC(this, {
      ...tile(15, 14),
      key: 'merchant', name: '商人 · 阿满', texture: 'merchant',
      questId: 'merchant', facing: 'down',
      dialogue: () => this.getMerchantDialogue(),
    });
    this.physics.add.collider(this.player, this.npcs.merchant);

    this.npcs.fisher = new NPC(this, {
      ...tile(24, 17),
      key: 'fisher', name: '钓鱼老人 · 默', texture: 'fisher',
      questId: 'fisher', facing: 'up',
      dialogue: () => this.getFisherDialogue(),
    });
    this.physics.add.collider(this.player, this.npcs.fisher);

    // F6.0: 魔镜匠 — emits open-face-customizer event when interacted.
    // The React panel renders on top of any dialogue; closing the panel
    // returns to the dialogue (if still showing) which the player can then close.
    this.npcs.mirror = new NPC(this, {
      ...tile(10, 14),
      key: 'mirror', name: '魔镜匠 · 司影', texture: 'merchant',
      questId: 'mirror', facing: 'down',
      dialogue: () => {
        EventBus.emit('open-face-customizer');
        return [
          '（你照向魔镜匠递来的铜镜——形象由你定夺）',
        ];
      },
    });
    this.physics.add.collider(this.player, this.npcs.mirror);

    // Update NPC marks based on errand status
    this.refreshAllNpcMarks();

    // ---- Signpost ----
    this.signposts.push(new SignPost(this, {
      ...tile(11, 11),
      name: '萌芽镇 · 告示板',
      questId: 'signpost',
      dialogue: [
        '【萌芽镇 · 公告板】',
        '欢迎来到 CUA 基地！',
        '这是一个还在搭建中的小镇——每天都有新的角色加入。',
        '想成为镇民的一员？听说要先和老村长阿降聊聊。',
        '近期计划：开放典籍阁、铁匠铺、杂货铺、湖边钓鱼任务。',
        '— 萌芽镇议事会',
      ],
    }));

    // ---- Flowers ----
    const pickedFlowers = getCompletedSet(STORAGE_KEY_FLOWERS);
    [
      { tx: 4, ty: 4, id: 'flower-nw' },
      { tx: 24, ty: 5, id: 'flower-ne' },
      { tx: 22, ty: 14, id: 'flower-east' },
    ].forEach((loc) => {
      if (pickedFlowers.has(loc.id)) return;
      const wx = loc.tx * 32 + 16;
      const wy = loc.ty * 32 + 16;
      const flower = this.add.text(wx, wy - 4, '🌸', { fontSize: '14px' })
        .setOrigin(0.5).setDepth(5);
      this.tweens.add({
        targets: flower, y: wy - 8,
        duration: 1200, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.flowerSpots.push({ x: wx, y: wy, id: loc.id, sprite: flower });
    });

    // ---- Easter eggs ----
    const foundEggs = getCompletedSet(STORAGE_KEY_EGGS);

    this.addEasterEggMarker({
      ...tile(2, 2), id: 'egg-tree',
      name: '一棵特别的树', discoveryToast: '听到树的低语',
      dialogue: ['（你凑近这棵树）', '树皮上似乎有刻痕——是某种古老的符号。', '"传说这树曾结过会发光的果子..."', '（也许哪天会再次结果）'],
      icon: '🌟', alreadyFound: foundEggs.has('egg-tree'),
    });
    this.addEasterEggMarker({
      ...tile(26, 15), id: 'egg-bottle',
      name: '漂流瓶', discoveryToast: '捞到了一个漂流瓶',
      dialogue: ['（你从水边捞起一个瓶子）', '里面是张空白的纸条。', '...或许是哪天有人会写下什么吧。'],
      icon: '🍶', alreadyFound: foundEggs.has('egg-bottle'),
    });
    this.addEasterEggMarker({
      ...tile(18, 11), id: 'egg-stone',
      name: '萌芽镇石碑', discoveryToast: '读到了镇子的来历',
      dialogue: ['【萌芽镇成立于 v0.1】', '由 CUA 社区共建', '"愿每一份贡献，都被看见。"'],
      icon: '🗿', alreadyFound: foundEggs.has('egg-stone'),
    });

    const catPos = tile(8, 17);
    this.cat = this.physics.add.sprite(catPos.x, catPos.y, 'cat', 0);
    this.cat.anims.play('cat-idle');
    this.cat.setDepth(5);
    const catBody = this.cat.body as Phaser.Physics.Arcade.Body;
    catBody.setSize(8, 6).setOffset(4, 8);
    catBody.setImmovable(true);

    this.easterEggs.push({
      x: this.cat.x, y: this.cat.y, id: 'egg-cat',
      name: '一只小猫', discoveryToast: '猫蹭了蹭你',
      dialogue: ['（一只小猫慢慢走过来，蹭了蹭你的腿）', '"喵~"', '（它似乎认得你）'],
      iconRef: this.cat,
    });

    // ---- Map corners ----
    this.corners = [
      { ...tile(2, 2),   id: 'corner-nw', reached: false },
      { ...tile(27, 2),  id: 'corner-ne', reached: false },
      { ...tile(2, 17),  id: 'corner-sw', reached: false },
      { ...tile(27, 17), id: 'corner-se', reached: false },
    ];
    const reachedCorners = getCompletedSet(STORAGE_KEY_CORNERS);
    this.corners.forEach((c) => { if (reachedCorners.has(c.id)) c.reached = true; });

    // ---- Interact hint ----
    this.interactHint = this.add
      .text(0, 0, '[E] 互动', {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: '#ffffff', backgroundColor: '#000000aa',
        padding: { left: 4, right: 4, top: 2, bottom: 2 },
      })
      .setOrigin(0.5).setVisible(false).setDepth(100);

    // ---- Door hint (for entering buildings) ----
    this.doorHint = this.add
      .text(0, 0, '[E] 进入', {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: '#ffffff', backgroundColor: '#5a3020dd',
        padding: { left: 6, right: 6, top: 3, bottom: 3 },
      })
      .setOrigin(0.5).setVisible(false).setDepth(100);

    // ---- West-edge gateway marker (visual signpost for "前往共创之都") ----
    // The tile at (1, 10) was opened in the map JSON. Add a "🏛️" floating
    // marker so the player knows this is a way out.
    const gateX = 1 * 32 + 16;
    const gateY = 10 * 32 + 16;
    const gateMarker = this.add.text(gateX, gateY - 16, '🏛️', {
      fontSize: '16px',
    }).setOrigin(0.5).setDepth(5);
    this.tweens.add({
      targets: gateMarker, y: gateY - 20,
      duration: 1400, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ---- C10 · Player's home marker (between AXIANG and 典籍阁) ----
    const homeX = 17 * 32 + 16;
    const homeY = 5 * 32 + 16;
    // Draw a small cabin sprite at this position
    const homeG = this.add.graphics();
    homeG.setDepth(2);
    // Cabin body (warm brown wood)
    homeG.fillStyle(0x8a6f4a, 1);
    homeG.fillRect(homeX - 14, homeY - 6, 28, 22);
    homeG.lineStyle(2, 0x4a3826, 1);
    homeG.strokeRect(homeX - 14, homeY - 6, 28, 22);
    // Roof (red, triangle)
    homeG.fillStyle(0x9a4a3a, 1);
    homeG.fillTriangle(homeX - 18, homeY - 6, homeX + 18, homeY - 6, homeX, homeY - 22);
    homeG.lineStyle(2, 0x4a2818, 1);
    homeG.strokeTriangle(homeX - 18, homeY - 6, homeX + 18, homeY - 6, homeX, homeY - 22);
    // Door
    homeG.fillStyle(0x4a3826, 1);
    homeG.fillRect(homeX - 4, homeY + 4, 8, 12);
    // Window
    homeG.fillStyle(0xb8c8d8, 0.9);
    homeG.fillRect(homeX - 10, homeY - 2, 6, 6);
    homeG.lineStyle(1, 0x4a3826, 1);
    homeG.strokeRect(homeX - 10, homeY - 2, 6, 6);
    // Floating "🏠 自家小屋" label
    const homeMarker = this.add.text(homeX, homeY - 36, '🏠 自家小屋', {
      fontFamily: 'serif', fontSize: '11px',
      color: '#f5f0e0', backgroundColor: '#4a2818cc',
      padding: { left: 5, right: 5, top: 2, bottom: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.tweens.add({
      targets: homeMarker, y: homeY - 40,
      duration: 1400, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // If returning from interior or city, fade in (and lock input briefly)
    if (this.spawnOverride) {
      this.cameras.main.fadeIn(300, 0, 0, 0);
      this.inputLockUntil = this.time.now + 250;
    }

    // ---- BGM ----
    if (this.cache.audio.exists('bgm-village')) {
      // Wave 10.bgm-fix: 走全局单例 · 不再每个 scene 自己 add
      bgmManager.play(this, 'bgm-village', BGM_VOLUME);
      const onStartBgm = () => this.tryStartBgm();
      EventBus.on('start-bgm', onStartBgm);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        EventBus.off('start-bgm', onStartBgm);
      });
    }

    if (this.cache.audio.exists('sfx-dialogue')) {
      this.sfxDialogue = this.sound.add('sfx-dialogue', { volume: SFX_VOLUME });
    }

    if (!this.sfxHandlerBound) {
      EventBus.on('dialogue-advance', this.playDialogueSfx, this);
      this.sfxHandlerBound = true;
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('dialogue-advance', this.playDialogueSfx, this);
      this.sfxHandlerBound = false;
    });

    // ---- Listen for badge earned: unlock errands ----
    const onBadgeEarned = () => {
      this.unlockErrands();
    };
    EventBus.on('badge-earned', onBadgeEarned);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('badge-earned', onBadgeEarned);
    });

    // ---- Listen for world-map travel ----
    const onTravel = (data: { sceneKey: string }) => {
      if (data.sceneKey === 'Main') return; // already here
      if (data.sceneKey === 'SproutCity') {
        this.travelToSproutCity();
      }
    };
    EventBus.on('world-map-travel', onTravel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('world-map-travel', onTravel);
    });

    // If badge already earned (returning player), unlock immediately
    if (hasBadge()) {
      this.unlockErrands(false); // silent unlock, no toast
    }
  }

  // ====================================================================
  // ERRAND SYSTEM
  // ====================================================================

  private unlockErrands(announce = true) {
    let changed = false;
    (['blacksmith', 'merchant', 'librarian', 'fisher'] as const).forEach((k) => {
      if (this.errands[k] === 'locked') {
        this.errands[k] = 'available';
        changed = true;
      }
    });
    if (changed) saveErrands(this.errands);
    this.refreshAllNpcMarks();

    if (announce && changed) {
      EventBus.emit('easter-egg', {
        eggId: 'errands-unlocked',
        text: '镇民身份解锁了新任务',
      });
    }
  }

  private refreshAllNpcMarks() {
    (['blacksmith', 'merchant', 'librarian', 'fisher'] as const).forEach((k) => {
      const status = this.errands[k];
      const npc = this.npcs[k];
      if (!npc) return;
      switch (status) {
        case 'locked':
          npc.setMark('!');         // before badge: friendly chat
          break;
        case 'available':
          npc.setMark('?');         // task available
          break;
        case 'inProgress':
          npc.setMark('…');         // in progress
          break;
        case 'completed':
          npc.setMark(null);        // no mark
          break;
      }
    });
  }

  private setErrandStatus(npc: keyof ErrandState, status: ErrandStatus) {
    this.errands[npc] = status;
    saveErrands(this.errands);
    this.refreshAllNpcMarks();
  }

  private grantTitle(id: string, label: string, giver: string) {
    EventBus.emit('title-earned', { id, label, giver });
  }

  // ====================================================================
  // DIALOGUE GENERATORS
  // ====================================================================

  private getAxiangDialogue(): string[] {
    const done = getDoneQuestIds();
    const explorationQuests = ['signpost', 'librarian', 'blacksmith', 'merchant', 'fisher', 'flowers', 'corners'];
    const explorationDone = explorationQuests.filter((id) => done.has(id)).length;
    const allOthersDone = explorationDone === explorationQuests.length;
    const finalDone = done.has('axiang-final');

    // ---- Errand-related: merchant's errand sends player to Axiang ----
    if (this.errands.merchant === 'inProgress') {
      // Mark merchant errand "village-elder leg" complete by setting a flag
      this.errands.merchant = 'inProgress'; // stays inProgress until merchant confirms
      // We'll embed a flag in localStorage: visited-axiang-for-merchant
      localStorage.setItem('cua-yuanye-merchant-errand-visited', '1');
      return [
        '哎，又是你？',
        '（你向阿降转达了商人的话——问"今天市集开不开"）',
        '阿降笑了笑，"开啊，开了一辈子。回去告诉阿满，让他放心。"',
        '（你记下了这句话，准备回去复命）',
      ];
    }

    if (finalDone) {
      return [
        '哦，是你啊。',
        '萌芽镇最近怎么样？又来一位新朋友了？',
        '（阿降露出温和的笑）',
        '记住，这镇子的故事，是你们一起写的。',
      ];
    }

    if (allOthersDone) {
      return [
        '哦？你回来了。',
        '我听说了——告示板、典籍阁、铁匠铺、杂货摊...湖边，你都去过了。',
        '还采了花，走了镇子的四个角。这一圈下来，不容易。',
        '从今天起，你就是萌芽镇的人了。',
        '（阿降郑重地把手放在你肩上）',
        '欢迎，新镇民。这只是一个开始。',
      ];
    }

    if (explorationDone >= 4) {
      return [
        '哎呀，是你！听说你在镇子里转了好几圈了。',
        `已经见过 ${explorationDone} 处地方了？这速度，比我想象中快。`,
        '不过别急——你还没走完所有该走的路。',
        '继续吧。等你都看过了，再回来找我。',
      ];
    }

    if (explorationDone >= 1) {
      return [
        '哦？又来了一位新朋友。',
        '欢迎来到萌芽镇——这是CUA 基地的第一站。',
        '这里的每个人，都是从这里开始的。',
        '右上角的清单是给你的——慢慢来，走一遍就好。',
      ];
    }

    return [
      '哦？又来了一位新朋友。',
      '欢迎来到萌芽镇——这是CUA 基地的第一站。',
      '这里的每个人，都是从这里开始的。',
      '不妨四处转转，跟大家聊聊？广场中央那块告示板也别错过。',
      '（右上角有一份清单。九件事，一件一件来。）',
    ];
  }

  private getBlacksmithDialogue(): string[] {
    const status = this.errands.blacksmith;

    if (status === 'locked') {
      return [
        '哈哈哈！来啦小伙子！',
        '小心点，我这火炉一会儿烧得比晌午的太阳还旺！',
        '不过别紧张，今天没活儿。要不要看我打铁？',
        '...好吧，等炉子修好再说。这萌芽镇的工坊，刚刚搭起来呢。',
      ];
    }

    if (status === 'available') {
      // Spawn ore on map
      this.spawnOre();
      this.setErrandStatus('blacksmith', 'inProgress');
      return [
        '哦，是镇民来了！正好——',
        '我这炉子缺一块矿石垫底。听说镇外的小路边有，',
        '你帮我捡一块回来呗？我看到了就在镇子东南角，水塘旁边那一小堆。',
        '（你接到了任务："找一块矿石给老周"）',
      ];
    }

    if (status === 'inProgress') {
      // Check if player has picked up the ore
      const oreCollected = localStorage.getItem('cua-yuanye-ore-collected') === '1';
      if (oreCollected) {
        this.setErrandStatus('blacksmith', 'completed');
        this.grantTitle('helper', '铁匠的助手', '老周');
        localStorage.removeItem('cua-yuanye-ore-collected');
        return [
          '哎呀！正是这块！',
          '（老周接过矿石，抚摸了一下）',
          '"好东西。这下我的炉子有底气了。"',
          '从今天起，你就是俺老周的助手了。需要打把铁器，随时来！',
          '（你获得了称号：「铁匠的助手」）',
        ];
      }
      return [
        '炉子还等着那块矿石呢——',
        '镇子东南角，水塘附近。你再去找找？',
      ];
    }

    // completed
    return [
      '嘿！俺的助手回来啦！',
      '（老周哈哈大笑，给你拍了拍肩）',
      '炉子正好烧着呢——下次有活儿，叫上你。',
    ];
  }

  private getMerchantDialogue(): string[] {
    const status = this.errands.merchant;

    if (status === 'locked') {
      return [
        '哎呀，新面孔！来来来，看看我的货~',
        '（你环顾四周，发现摊位上空空如也）',
        '...嗯，最近货还在路上。预计下次更新到。',
        '不过我能告诉你一个秘密：这镇子上每个人，都有自己的故事。',
        '多跟他们聊聊。这里的"价值"，可不止用银两衡量。',
      ];
    }

    if (status === 'available') {
      this.setErrandStatus('merchant', 'inProgress');
      return [
        '咦，镇民来了！正好有事麻烦你——',
        '我这两天担心市集开不开，可阿降那老头不爱写信。',
        '能帮我跑一趟，问问他今天市集开不开？',
        '（你接到了任务："替阿满问问村长"）',
      ];
    }

    if (status === 'inProgress') {
      const visited = localStorage.getItem('cua-yuanye-merchant-errand-visited') === '1';
      if (visited) {
        this.setErrandStatus('merchant', 'completed');
        this.grantTitle('messenger', '可靠的信使', '阿满');
        localStorage.removeItem('cua-yuanye-merchant-errand-visited');
        return [
          '哦？阿降说市集照开？',
          '（阿满松了一口气）',
          '"那就好那就好。这老头嘴硬心软，知道他不会真停的。"',
          '谢谢你跑这一趟！下次进货，给你打折。',
          '（你获得了称号：「可靠的信使」）',
        ];
      }
      return [
        '阿降那边怎么说？',
        '（阿满探头问）你还没跑去问过吗？',
      ];
    }

    return [
      '嘿，老朋友！',
      '货还在路上，等我开张了请你第一个进货~',
    ];
  }

  private getLibrarianDialogue(): string[] {
    const status = this.errands.librarian;

    if (status === 'locked') {
      return [
        '...',
        '（她抬起头，似乎在打量你）',
        '欢迎来到典籍阁。如果你需要安静的地方读书，这里随时为你开放。',
        '不过最近的书架空了几个格子... 似乎在等什么人来填上。',
      ];
    }

    if (status === 'available') {
      this.setErrandStatus('librarian', 'inProgress');
      this.librarianPageCount = 0;
      return [
        '...你想读书？',
        '（她从架子上取下一本旧书，递给你）',
        '"这本书，麻烦你帮我翻到第三页。"',
        '"我手里这一摞还没整理完。"',
        '（提示：再来找她两次，模拟"翻页"的过程）',
      ];
    }

    if (status === 'inProgress') {
      this.librarianPageCount += 1;
      localStorage.setItem(STORAGE_KEY_LIBRARIAN_PAGES, String(this.librarianPageCount));

      if (this.librarianPageCount === 1) {
        return [
          '（你翻开第一页——是个手绘的小镇地图）',
          '"嗯，第一页。还有两页。"',
        ];
      }
      if (this.librarianPageCount === 2) {
        return [
          '（你翻到第二页——是一首没写完的诗）',
          '"再翻一次。"',
        ];
      }
      // page 3
      this.setErrandStatus('librarian', 'completed');
      this.grantTitle('reader', '典籍阁的读者', '蓁');
      return [
        '（你翻到第三页——空白）',
        '"嗯，就是这一页。"',
        '"下一本书写到这里时，我会请你来续写。"',
        '（你获得了称号：「典籍阁的读者」）',
      ];
    }

    return [
      '...你回来了。',
      '（她对你点了点头，没有抬头）',
      '"书架的第三格，今天有空位。"',
    ];
  }

  private getFisherDialogue(): string[] {
    const status = this.errands.fisher;

    if (status === 'locked') {
      return [
        '...',
        '（老人盯着水面，没有回头）',
        '"急的人，钓不到鱼。"',
        '"耐心，是这片土地最便宜、也最贵的东西。"',
        '...慢慢来吧，年轻人。',
      ];
    }

    if (status === 'available') {
      this.setErrandStatus('fisher', 'inProgress');
      this.fisherSitStart = this.time.now;
      return [
        '...',
        '（老人慢慢转过头）',
        '"你想试试钓鱼？"',
        '"那就在这里坐 15 秒。什么都不要做。"',
        '（任务开始：原地不动 15 秒）',
      ];
    }

    if (status === 'inProgress') {
      // Check if player has been near the fisher long enough
      const elapsed = this.fisherSitStart === null ? 0 : (this.time.now - this.fisherSitStart);
      if (elapsed >= 15000) {
        this.setErrandStatus('fisher', 'completed');
        this.grantTitle('patient', '耐心者', '默');
        this.fisherSitStart = null;
        return [
          '（老人慢慢点头）',
          '"15 秒。你做到了。"',
          '"很多人坐不住——不是因为没耐心，是因为他们觉得这是浪费。"',
          '"耐心不是浪费。耐心是看见。"',
          '（你获得了称号：「耐心者」）',
        ];
      }
      const remaining = Math.ceil((15000 - elapsed) / 1000);
      return [
        '（老人不说话，但你能感觉到他在等）',
        `还差 ${remaining} 秒...`,
      ];
    }

    return [
      '（老人微微点头，又转回去看水面）',
      '"水面上的涟漪——记得吗？"',
    ];
  }

  // ====================================================================
  // ORE SPRITE (for blacksmith errand)
  // ====================================================================

  private spawnOre() {
    if (this.oreSprite) return;
    // Place ore near the pond's south edge (sand area, not blocked)
    const wx = 25 * 32 + 16;
    const wy = 18 * 32 + 16;
    this.oreSprite = this.add.image(wx, wy, 'ore').setDepth(5);

    // Faint glow tween
    this.tweens.add({
      targets: this.oreSprite,
      alpha: 0.6,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Add to interaction list
    this.oreInteractable = {
      x: wx,
      y: wy,
      triggerDialogue: () => this.collectOre(),
    };
  }

  private collectOre() {
    if (!this.oreSprite) return;
    localStorage.setItem('cua-yuanye-ore-collected', '1');
    this.tweens.add({
      targets: this.oreSprite,
      y: this.oreSprite.y - 16,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        this.oreSprite?.destroy();
        this.oreSprite = undefined;
        this.oreInteractable = undefined;
      },
    });
    EventBus.emit('show-dialogue', {
      name: '一块沉甸甸的矿石',
      lines: [
        '（你弯腰捡起这块带金色矿脉的石头）',
        '它比看起来重——老周应该会喜欢。',
        '回去找老周吧。',
      ],
    });
  }

  // ====================================================================
  // EASTER EGGS / FLOWERS (unchanged from Zip A)
  // ====================================================================

  private addEasterEggMarker(opts: {
    x: number; y: number; id: string;
    name: string; discoveryToast: string;
    dialogue: string[]; icon: string;
    alreadyFound: boolean;
  }) {
    const iconText = this.add.text(opts.x, opts.y - 18, opts.icon, {
      fontSize: '14px',
    }).setOrigin(0.5).setDepth(5);
    iconText.setAlpha(opts.alreadyFound ? 0.4 : 0.85);
    this.tweens.add({
      targets: iconText, y: opts.y - 22,
      duration: 1400, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.easterEggs.push({
      x: opts.x, y: opts.y, id: opts.id,
      name: opts.name, discoveryToast: opts.discoveryToast,
      dialogue: opts.dialogue, iconRef: iconText,
    });
  }

  private playDialogueSfx() {
    if (this.sfxDialogue) {
      this.sound.play('sfx-dialogue', { volume: SFX_VOLUME });
    }
  }

  private tryStartBgm() {
    if (this.bgmStarted || !this.bgm) return;
    this.bgm.play();
    this.bgmStarted = true;
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

  private createCatAnims() {
    if (this.anims.exists('cat-idle')) return;
    this.anims.create({
      key: 'cat-idle',
      frames: this.anims.generateFrameNumbers('cat', { start: 0, end: 3 }),
      frameRate: 4, repeat: -1,
    });
  }

  private findClosestInteractable(): Interactable | null {
    let closest: Interactable | null = null;
    let closestDist = INTERACT_DISTANCE;

    const candidates: Interactable[] = [];
    Object.values(this.npcs).forEach((n) => candidates.push(n));
    this.signposts.forEach((s) => candidates.push(s));

    this.easterEggs.forEach((e) => {
      candidates.push({
        x: e.x, y: e.y,
        triggerDialogue: () => this.triggerEasterEgg(e),
      });
    });

    this.flowerSpots.forEach((f) => {
      candidates.push({
        x: f.x, y: f.y,
        triggerDialogue: () => this.pickFlower(f),
      });
    });

    if (this.oreInteractable) {
      candidates.push(this.oreInteractable);
    }

    for (const c of candidates) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y);
      if (d < closestDist) {
        closestDist = d;
        closest = c;
      }
    }
    return closest;
  }

  private triggerEasterEgg(egg: EasterEgg) {
    EventBus.emit('easter-egg', { eggId: egg.id, text: egg.discoveryToast });
    if (egg.iconRef && egg.iconRef instanceof Phaser.GameObjects.Text) {
      this.tweens.add({ targets: egg.iconRef, alpha: 0.4, duration: 400 });
    }
    EventBus.emit('show-dialogue', { name: egg.name, lines: egg.dialogue });
  }

  private pickFlower(flower: FlowerSpot) {
    const picked = getCompletedSet(STORAGE_KEY_FLOWERS);
    if (picked.has(flower.id)) {
      EventBus.emit('show-dialogue', {
        name: '空空的花丛',
        lines: ['（这里的花已经被你摘过了）'],
      });
      return;
    }
    EventBus.emit('flower-picked', { flowerId: flower.id });
    if (flower.sprite) {
      this.tweens.add({
        targets: flower.sprite,
        alpha: 0, y: flower.sprite.y - 12, duration: 600,
        onComplete: () => flower.sprite?.destroy(),
      });
    }
    flower.sprite = undefined;
    EventBus.emit('show-dialogue', {
      name: '一朵粉色小花',
      lines: ['（你小心地摘下了一朵花）', '它会在你的口袋里藏一阵子。'],
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

    // G1.0: track current facing for broadcast
    if (Math.abs(vx) > Math.abs(vy)) {
      if (vx > 0) this.currentFacing = 'right';
      else if (vx < 0) this.currentFacing = 'left';
    } else if (Math.abs(vy) > 0) {
      if (vy > 0) this.currentFacing = 'down';
      else this.currentFacing = 'up';
    }

    // F6.0: sync hair graphics to follow player
    if (this.playerFace) {
      this.playerFace.syncToSprite(this.player);
    }

    // G1.0: tick remote players (lerp interpolation + animation)
    if (this.mp) this.mp.tick();

    // ---- Fisher errand: reset timer if player walks away ----
    if (this.errands.fisher === 'inProgress' && this.fisherSitStart !== null) {
      const fisherNpc = this.npcs.fisher;
      if (fisherNpc) {
        const distFromFisher = Phaser.Math.Distance.Between(
          this.player.x, this.player.y, fisherNpc.x, fisherNpc.y
        );
        if (distFromFisher > 80) {
          // Reset timer if player wanders too far
          this.fisherSitStart = this.time.now;
        }
      }
    }

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

    // ---- Corner detection ----
    for (const corner of this.corners) {
      if (corner.reached) continue;
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, corner.x, corner.y
      );
      if (d < 56) {
        corner.reached = true;
        EventBus.emit('corner-reached', { cornerId: corner.id });
      }
    }

    // Lock input briefly after returning from interior
    if (this.time.now < this.inputLockUntil) {
      this.interactHint.setVisible(false);
      this.doorHint.setVisible(false);
      return;
    }

    // ---- M key opens world map ----
    if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
      EventBus.emit('open-world-map', { currentScene: 'Main' });
    }

    // ---- J key opens quest log ----
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) {
      EventBus.emit('open-quest-log');
    }

    // ---- K key opens mailbox ----
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) {
      EventBus.emit('open-mailbox');
    }

    // ---- Door check: each cottage has a door tile in front of its wall ----
    // Door = the empty tile right below the wall row, between the building's columns.
    // We check distance to each door and pick the closest if any are within range.
    const doors: Array<{
      x: number; y: number;
      label: string;
      enter: () => void;
    }> = [
      {
        x: 13 * 32 + 16, y: 5 * 32 + 16,
        label: '[E] 进入阿降的小屋',
        enter: () => {
          // Wave 10.villagehead - bypass InteriorScene
          const returnX = this.player.x;
          const returnY = this.player.y;
          this.scene.start('VillageHead', { returnX, returnY });
        },
      },
      {
        x: 21 * 32 + 16, y: 5 * 32 + 16,
        label: '[E] 进入典籍阁',
        enter: () => {
          // Wave 10.library - bypass InteriorScene
          const returnX = this.player.x;
          const returnY = this.player.y;
          this.scene.start('Library', { returnX, returnY });
        },
      },
      {
        x: 5 * 32 + 16, y: 14 * 32 + 16,
        label: '[E] 进入铁匠铺',
        enter: () => {
          // Wave 10.blacksmith
          const returnX = this.player.x;
          const returnY = this.player.y;
          this.scene.start('Blacksmith', { returnX, returnY });
        },
      },
      {
        // West-edge gateway to Sprout City
        x: 1 * 32 + 16, y: 10 * 32 + 16,
        label: '[E] 前往共创之都',
        enter: () => this.travelToSproutCity(),
      },
      {
        // C10 — Player's own home, between AXIANG_COTTAGE (13,5) and 典籍阁 (21,5)
        x: 17 * 32 + 16, y: 5 * 32 + 16,
        label: '[E] 回家',
        enter: () => this.enterHome(),
      },
    ];

    let nearestDoor: typeof doors[0] | null = null;
    let nearestDoorDist = 36; // detection radius
    for (const door of doors) {
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, door.x, door.y
      );
      if (d < nearestDoorDist) {
        nearestDoorDist = d;
        nearestDoor = door;
      }
    }

    // ---- Proximity (NPCs etc) ----
    const closest = this.findClosestInteractable();

    if (nearestDoor) {
      // Door takes precedence so players can always enter
      this.doorHint
        .setText(nearestDoor.label)
        .setPosition(nearestDoor.x, nearestDoor.y - 24)
        .setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        nearestDoor.enter();
      }
    } else if (closest) {
      this.doorHint.setVisible(false);
      this.interactHint
        .setPosition(closest.x, closest.y - 28)
        .setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        closest.triggerDialogue();
      }
    } else {
      this.interactHint.setVisible(false);
      this.doorHint.setVisible(false);
    }
  }

  /**
   * Generic interior entry. Pass the InteriorConfig and the y-tile to put the
   * player at when they come back outside (one tile south of the door).
   */
  // @ts-expect-error - kept for Wave 10 rollback to tilemap interior path
  private enterInterior(config: InteriorConfig, returnTileY: number) {
    const returnX = this.player.x;
    const returnY = returnTileY * 32 + 16;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Interior', {
        config,
        returnX,
        returnY,
      });
    });
  }

  /**
   * C10 — Enter the player's own home (HomeScene).
   * Returns the player to the cabin door at tile (17, 6).
   */
  private enterHome() {
    const returnX = 17 * 32 + 16;
    const returnY = 6 * 32 + 16;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Home', { returnX, returnY });
    });
  }

  /**
   * Travel to Sprout City via the west gateway.
   * The player appears at Sprout City's south arch (just inside).
   */
  private travelToSproutCity() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('SproutCity');
    });
  }
}
