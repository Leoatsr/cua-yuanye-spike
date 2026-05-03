import { attachMinimap } from '../minimap-bridge';
import * as Phaser from 'phaser';
import { NPC } from '../entities/NPC';
import { EventBus } from '../EventBus';
import type { InteriorConfig } from './InteriorScene';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 140;
const INTERACT_DISTANCE = 48;
const BGM_VOLUME = 0.3;
const SFX_VOLUME = 0.5;

/**
 * 百晓居 (Baixiao-ju) interior — the first opened workshop.
 * Gaoliang (高粱) is the lead, sitting in the central study aisle.
 */
const BAIXIAO_JU_CONFIG: InteriorConfig = {
  mapKey: 'baixiao-ju',
  tilesetKey: 'tiles-interior',
  tilesetName: 'tiles-interior',
  spawnTileX: 7,
  spawnTileY: 8,    // just north of the door mat (door is at y=8-9, exit at y=8)
  exitTileX: 7,
  exitTileY: 9,
  displayName: '百科工坊',
  npcs: [
    {
      textureKey: 'librarian',  // reuse purple-robed librarian sprite for now
      name: '百科工坊首席 · 高粱',
      questId: 'gaoliang',
      tileX: 7,
      tileY: 5,
      facing: 'down',
      dialogue: [
        '哎，进来了。',
        '（高粱抬起头，从一摞文献里探出来）',
        '"我是高粱。这里——百科工坊——是百科板块的工坊。"',
        '"我们做的事情很朴素：一篇一篇地把 AI 行业的知识结构化、入库、维护。"',
        '"听起来不性感，但每一篇论文入库，都是 CUA 知识地图上多出的一颗星。"',
        '...',
        '"想试试？这里有几个真实任务在等人。按 J 键打开任务日志。"',
        '"挑一个开始吧。每一份贡献，都会被看见。"',
      ],
    },
  ],
};

/**
 * Workshop definition — for those that aren't enterable yet, a "Coming Soon"
 * dialogue is shown. For those with `interiorConfig`, pressing E enters them.
 */
interface WorkshopDef {
  id: string;
  name: string;
  doorTileX: number;
  doorTileY: number;
  description: string;
  /** If present, this workshop is enterable. Otherwise it's still 🚧. */
  interiorConfig?: InteriorConfig;
  /** C5b1: alternative — open a custom Phaser scene instead of using InteriorScene. */
  customSceneKey?: string;
}

/**
 * The 9 workshops, mapped to CUA's 9 working groups.
 * door tiles are one tile south of the workshop's wall row.
 */
const WORKSHOPS: WorkshopDef[] = [
  { id: 'kaiyuan',    name: '开源工坊',  doorTileX: 5,  doorTileY: 6,  description: '共创板块 · 开源协作中心。CUA 开源项目在这里被构建、维护、推动。',
    customSceneKey: 'KaiyuanLou' },
  { id: 'shengwen',   name: '播客工坊',  doorTileX: 19, doorTileY: 6,  description: '降噪板块 · 录音室与对话台。对谈、采访、圆桌输出行业洞察。',
    customSceneKey: 'ShengwenTai' },
  { id: 'duliang',    name: '测评工坊',  doorTileX: 33, doorTileY: 6,  description: '共创板块 · AI 技术与产品测试评估的标准制定。',
    customSceneKey: 'DuliangGe' },
  { id: 'yincai',     name: '招聘工坊',  doorTileX: 5,  doorTileY: 14, description: '链接板块 · 行业人才与社区贡献者的对接枢纽。',
    customSceneKey: 'YincaiFang' },
  { id: 'sisuan',     name: '数据工坊',  doorTileX: 33, doorTileY: 14, description: '降噪板块 · 人才/论文/项目数据收集清洗的中心。',
    customSceneKey: 'SisuanSuo' },
  { id: 'yishi',      name: '会议工坊',  doorTileX: 5,  doorTileY: 23, description: '链接板块 · 线上线下技术交流的策划基地。',
    customSceneKey: 'YishiTing' },
  // 百科工坊 — first OPENED workshop
  { id: 'baixiao',    name: '百科工坊',  doorTileX: 19, doorTileY: 23, description: '降噪板块 · CUA 行业百科知识沉淀的总编室。',
    interiorConfig: BAIXIAO_JU_CONFIG },
  { id: 'wangqi',     name: '内参工坊',  doorTileX: 33, doorTileY: 23, description: '降噪板块 · 深度行业调研与趋势分析的报告厅。',
    customSceneKey: 'WangqiLou' },
  { id: 'gongde',     name: '生态工坊',  doorTileX: 19, doorTileY: 26, description: '共创板块 · 系统软件生态开放度追踪与维护。',
    customSceneKey: 'GongdeTang' },
];

interface SceneInitData {
  /** Where the player should appear on entering Sprout City */
  spawnX?: number;
  spawnY?: number;
}

interface Interactable {
  x: number;
  y: number;
  triggerDialogue: () => void;
}

export class SproutCityScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
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

  /** Each workshop has a "Coming Soon" trigger zone at its door */
  private workshopTriggers: Array<{
    workshop: WorkshopDef;
    worldX: number;
    worldY: number;
  }> = [];

  /** Decorative NPCs — initially empty (the city is mostly empty). */
  private npcs: NPC[] = [];

  private interactHint!: Phaser.GameObjects.Text;
  private archHint!: Phaser.GameObjects.Text;
  private portHint!: Phaser.GameObjects.Text;

  // Arch back to Sproutown — 2 tiles wide at (19, 28) and (20, 28)
  private archCenterX = 0;
  private archCenterY = 0;

  // East port — to GovHill (议政高地)
  private eastPortX = 0;
  private eastPortY = 0;

  // BGM
  private bgm?: Phaser.Sound.BaseSound;

  // SFX
  private sfxHandlerBound = false;

  // Custom spawn (set by init() if returning from somewhere specific)
  private spawnOverride: { x: number; y: number } | null = null;

  // Lock input on entry
  private inputLockUntil = 0;

  constructor() {
    super('SproutCity');
  }

  init(data: SceneInitData & { returnX?: number; returnY?: number }) {
    // Coming from InteriorScene? returnX/Y takes precedence over spawnX/Y
    if (data?.returnX !== undefined && data?.returnY !== undefined) {
      this.spawnOverride = { x: data.returnX, y: data.returnY };
    } else if (data?.spawnX !== undefined && data?.spawnY !== undefined) {
      this.spawnOverride = { x: data.spawnX, y: data.spawnY };
    } else {
      this.spawnOverride = null;
    }
    // Reset state
    this.npcs = [];
    this.workshopTriggers = [];
  }

  create() {
    attachMinimap(this, 'SproutCity');
    this.inputLockUntil = this.time.now + 250;

    // ---- Tilemap ----
    const map = this.make.tilemap({ key: 'sproutcity' });
    const tileset = map.addTilesetImage('tiles-city', 'tiles-city');
    if (!tileset) {
      console.error('Failed to load tileset tiles-city');
      return;
    }

    const groundLayer = map.createLayer('Ground', tileset);
    const decorLayer = map.createLayer('Decorations', tileset);
    const obstacleLayer = map.createLayer('Obstacles', tileset);
    void groundLayer; void decorLayer;

    if (!obstacleLayer) {
      console.error('Failed to create obstacle layer');
      return;
    }

    obstacleLayer.setCollisionByProperty({ collides: true });
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // ---- Animations (player only, NPCs add their own as needed) ----
    this.createCharacterAnims('player');

    // ---- Player ----
    // Default spawn: just inside the south arch (player just walked through it)
    const defaultX = 19 * 32 + 32;        // between tile 19 and 20 (the arch)
    const defaultY = 27 * 32 + 16;        // one tile north of arch
    const spawnX = this.spawnOverride?.x ?? defaultX;
    const spawnY = this.spawnOverride?.y ?? defaultY;

    this.player = this.physics.add.sprite(spawnX, spawnY, 'player', 0);
    this.player.setCollideWorldBounds(true);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(12, 6).setOffset(10, 17);
    this.player.anims.play('player-idle-down');
    this.physics.add.collider(this.player, obstacleLayer);

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    // G1.1 · Multiplayer (via helper)
    this.mp = setupMultiplayer(this, 'SproutCity', () => this.player, () => this.currentFacing);

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

    // ---- Workshop triggers ----
    WORKSHOPS.forEach((ws) => {
      const wx = ws.doorTileX * 32 + 16;
      const wy = ws.doorTileY * 32 + 16;
      this.workshopTriggers.push({
        workshop: ws,
        worldX: wx,
        worldY: wy,
      });
      // Wave 7.I/J · 删除 🚧 floating marker · 9 工坊都已 enterable
    });

    // ---- Arch back to Sproutown ----
    this.archCenterX = 19 * 32 + 32;  // between tile 19 and 20
    this.archCenterY = 28 * 32 + 16;  // arch row

    // ---- East port to GovHill ----
    // Far east edge of the city at mid-Y
    this.eastPortX = 39 * 32 + 16;
    this.eastPortY = 16 * 32 + 16;
    // Visual: stone pillars + boat
    const portG = this.add.graphics();
    portG.setDepth(1);
    portG.fillStyle(0xe6deca, 1);
    portG.fillRect(this.eastPortX - 14, this.eastPortY - 60, 28, 60);
    portG.fillRect(this.eastPortX - 14, this.eastPortY + 20, 28, 60);
    portG.lineStyle(2, 0x9a8d6c, 1);
    portG.strokeRect(this.eastPortX - 14, this.eastPortY - 60, 28, 60);
    portG.strokeRect(this.eastPortX - 14, this.eastPortY + 20, 28, 60);
    // Boat (sits at port edge)
    portG.fillStyle(0x4a3e26, 1);
    portG.fillTriangle(this.eastPortX + 20, this.eastPortY - 12, this.eastPortX + 20, this.eastPortY + 12, this.eastPortX + 44, this.eastPortY);
    portG.fillRect(this.eastPortX + 14, this.eastPortY - 8, 22, 16);
    // Floating port marker
    const portMarker = this.add.text(this.eastPortX, this.eastPortY - 80, '⛵️', {
      fontSize: '16px',
    }).setOrigin(0.5).setDepth(5);
    this.tweens.add({
      targets: portMarker, y: this.eastPortY - 84,
      duration: 1400, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ---- Hints ----
    this.interactHint = this.add
      .text(0, 0, '[E] 互动', {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: '#ffffff', backgroundColor: '#000000aa',
        padding: { left: 4, right: 4, top: 2, bottom: 2 },
      }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.archHint = this.add
      .text(0, 0, '[E] 返回萌芽镇', {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: '#ffffff', backgroundColor: '#5a3020dd',
        padding: { left: 6, right: 6, top: 3, bottom: 3 },
      }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.portHint = this.add
      .text(0, 0, '[E] 前往议政高地', {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: '#ffffff', backgroundColor: '#3a4a6add',
        padding: { left: 6, right: 6, top: 3, bottom: 3 },
      }).setOrigin(0.5).setVisible(false).setDepth(100);

    // ---- BGM (same village BGM for now — could swap for city-specific later) ----
    if (this.cache.audio.exists('bgm-village')) {
      this.bgm = this.sound.add('bgm-village', { loop: true, volume: BGM_VOLUME });
      // Start immediately if entering from Sproutown (audio already unlocked)
      this.bgm.play();
    }

    if (!this.sfxHandlerBound && this.cache.audio.exists('sfx-dialogue')) {
      EventBus.on('dialogue-advance', this.playDialogueSfx, this);
      this.sfxHandlerBound = true;
    }

    // ---- World map travel listener ----
    const onTravel = (data: { sceneKey: string }) => {
      if (data.sceneKey === 'SproutCity') return; // already here
      if (data.sceneKey === 'Main') {
        this.exitToSproutown();
      } else if (data.sceneKey === 'GovHill') {
        this.exitToGovHill();
      }
    };
    EventBus.on('world-map-travel', onTravel);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('dialogue-advance', this.playDialogueSfx, this);
      EventBus.off('world-map-travel', onTravel);
      this.sfxHandlerBound = false;
      // Wave 7.H.1.5 · cleanup fountain tweens
      if (this.fountainTweens) {
        this.fountainTweens.forEach(t => t.stop());
        this.fountainTweens = [];
      }
    });

    // ---- Wave 7.H.1.5 · 实时喷泉 (3 柱水柱) ----
    this.createFountain();

    // ---- World map (M key) → emit event to React ----
    // The React WorldMap component will listen for this and show the UI.
  }

  // Wave 7.H.1.5 · 喷泉 tween 清单（用于 shutdown 清理）
  private fountainTweens: Phaser.Tweens.Tween[] = [];

  /**
   * 在中央广场水池上方画 3 柱水柱 · 每柱 sin 起伏循环
   * 水池中心 = (col 19.5, row 13.5) = (640, 448)
   */
  private createFountain() {
    const cx = 19.5 * 32 + 16;  // 640
    const cy = 13.5 * 32 + 16;  // 448
    const baseY = cy - 8;       // 水柱底部位置（水面上方一点）

    // 3 柱配置：[偏移X, 最大高度, 宽度, 颜色]
    const columns = [
      { dx: -16, maxH: 18, w: 4, color: 0xb0e0f0, alpha: 0.85 },  // 左矮
      { dx: 0,   maxH: 30, w: 5, color: 0xc8eaf5, alpha: 0.95 },  // 中高
      { dx: 16,  maxH: 18, w: 4, color: 0xb0e0f0, alpha: 0.85 },  // 右矮
    ];

    columns.forEach((c, i) => {
      const g = this.add.graphics();
      g.setDepth(50);  // 高于水池 + 路 + player

      // 用 phase offset 让 3 柱起伏不同步
      const phaseOffset = i * 200;
      const animState = { h: 0 };

      // 持续渲染：每帧根据 animState.h 重画
      this.events.on('update', () => {
        g.clear();
        const h = animState.h;
        if (h <= 0) return;
        // 主水柱（实心）
        g.fillStyle(c.color, c.alpha);
        g.fillRect(cx + c.dx - c.w / 2, baseY - h, c.w, h);
        // 顶部水珠（圆点）
        g.fillStyle(0xffffff, 1);
        g.fillCircle(cx + c.dx, baseY - h - 1, c.w / 2 - 0.5);
        // 落下水珠（在水柱下半部位置闪点）
        g.fillStyle(0xe0f4f8, 0.6);
        g.fillRect(cx + c.dx - c.w / 2 - 1, baseY - h * 0.4, 1, 2);
        g.fillRect(cx + c.dx + c.w / 2, baseY - h * 0.6, 1, 2);
      });

      // sin 起伏 tween · h 在 [maxH*0.4, maxH] 之间循环
      const tween = this.tweens.add({
        targets: animState,
        h: c.maxH,
        duration: 900,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: phaseOffset,
      });
      this.fountainTweens.push(tween);
    });
  }

  private playDialogueSfx() {
    this.sound.play('sfx-dialogue', { volume: SFX_VOLUME });
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

  private findClosestInteractable(): Interactable | null {
    let closest: Interactable | null = null;
    let closestDist = INTERACT_DISTANCE;
    for (const n of this.npcs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.x, n.y);
      if (d < closestDist) { closestDist = d; closest = n; }
    }
    return closest;
  }

  private findClosestWorkshop(): typeof this.workshopTriggers[0] | null {
    let closest: typeof this.workshopTriggers[0] | null = null;
    let closestDist = INTERACT_DISTANCE;
    for (const t of this.workshopTriggers) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, t.worldX, t.worldY);
      if (d < closestDist) { closestDist = d; closest = t; }
    }
    return closest;
  }

  private triggerWorkshop(t: { workshop: WorkshopDef; worldX: number; worldY: number }) {
    if (t.workshop.interiorConfig) {
      // Enter the workshop interior (InteriorScene path)
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('Interior', {
          config: t.workshop.interiorConfig,
          returnX: t.worldX,
          returnY: t.worldY + 32,
          returnSceneKey: 'SproutCity',
        });
      });
    } else if (t.workshop.customSceneKey) {
      // Enter custom workshop scene (C5b1+: graphics-based workshops)
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(t.workshop.customSceneKey!, {
          returnX: t.worldX,
          returnY: t.worldY + 32,
        });
      });
    } else {
      // Show Coming Soon dialogue
      EventBus.emit('show-dialogue', {
        name: `🚧 ${t.workshop.name} · 筹建中`,
        lines: [
          `这里将是 "${t.workshop.name}"。`,
          t.workshop.description,
          '工坊还在筹建中——但用不了多久。',
          '（Coming Soon · 期待与你在这里相见）',
        ],
      });
    }
  }

  private exitToSproutown() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Send player back to Sproutown's west gate (the tile we cleared at (1, 10))
      // Spawn slightly east of the gate so they don't immediately re-trigger it.
      this.scene.start('Main', {
        returnX: 3 * 32 + 16,
        returnY: 10 * 32 + 16,
      });
    });
  }

  private exitToGovHill() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('GovHill');
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

    // Lock input briefly after entering
    if (this.time.now < this.inputLockUntil) {
      this.interactHint.setVisible(false);
      this.archHint.setVisible(false);
      return;
    }

    // ---- M key opens world map ----
    if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
      EventBus.emit('open-world-map', { currentScene: 'SproutCity' });
    }

    // ---- J key opens quest log ----
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) {
      EventBus.emit('open-quest-log');
    }

    // ---- K key opens mailbox ----
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) {
      EventBus.emit('open-mailbox');
    }

    // ---- Arch detection (back to Sproutown) ----
    const distToArch = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, this.archCenterX, this.archCenterY
    );
    const nearArch = distToArch < 36;

    // ---- East port detection (to GovHill) ----
    const distToPort = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, this.eastPortX, this.eastPortY
    );
    const nearPort = distToPort < 56;

    // ---- Workshop detection ----
    const closestWs = this.findClosestWorkshop();

    // ---- NPC detection ----
    const closestNpc = this.findClosestInteractable();

    if (nearArch) {
      this.archHint
        .setPosition(this.archCenterX, this.archCenterY - 28)
        .setVisible(true);
      this.interactHint.setVisible(false);
      this.portHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        this.exitToSproutown();
      }
    } else if (nearPort) {
      this.portHint
        .setPosition(this.eastPortX, this.eastPortY - 100)
        .setVisible(true);
      this.archHint.setVisible(false);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        this.exitToGovHill();
      }
    } else if (closestWs) {
      this.archHint.setVisible(false);
      this.portHint.setVisible(false);
      const verb = (closestWs.workshop.interiorConfig || closestWs.workshop.customSceneKey) ? '进入' : '看看';
      this.interactHint
        .setText(`[E] ${verb} ${closestWs.workshop.name}`)
        .setPosition(closestWs.worldX, closestWs.worldY - 28)
        .setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        this.triggerWorkshop(closestWs);
      }
    } else if (closestNpc) {
      this.archHint.setVisible(false);
      this.portHint.setVisible(false);
      this.interactHint
        .setText('[E] 互动')
        .setPosition(closestNpc.x, closestNpc.y - 28)
        .setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        closestNpc.triggerDialogue();
      }
    } else {
      this.interactHint.setVisible(false);
      this.archHint.setVisible(false);
      this.portHint.setVisible(false);
    }
  }
}
