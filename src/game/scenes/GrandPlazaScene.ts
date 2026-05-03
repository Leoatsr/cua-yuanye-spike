import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 140;
const INTERACT_DISTANCE = 56;
const BGM_VOLUME = 0.22;

// Wave 8.GrandPlaza · 圆形剧场 · 跟其它 scene 同尺寸
const MAP_WIDTH = 1280;
const MAP_HEIGHT = 960;

interface SceneInitData {
  spawnX?: number;
  spawnY?: number;
}

/**
 * 大集会广场 (Grand Plaza) — Phase 4 / C7.
 *
 * Open-air ceremonial plaza for the annual community gathering.
 * Layout:
 *   - South: Port (entry from GovHill)
 *   - Center: Stepped marble plaza with central altar
 *   - North + East + West: Curved tiered seating (like Greek/Roman amphitheater)
 *
 * Drawn entirely with Phaser graphics primitives — no tilemap dependency.
 * In single-player it's an empty venue; comes alive when 100+ players gather.
 */
export class GrandPlazaScene extends Phaser.Scene {
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
  private heraldHint!: Phaser.GameObjects.Text;
  private inscriptionHint!: Phaser.GameObjects.Text;

  // Port (south) returns to GovHill
  private portX = 0;
  private portY = 0;

  // Central altar
  private altarX = 0;
  private altarY = 0;

  // Notice board (north · 议程榜)
  private boardX = 0;
  private boardY = 0;

  // Inscription wall (west · 题字墙)
  private inscriptionX = 0;
  private inscriptionY = 0;

  // Herald NPC (east · 司仪)
  private heraldX = 0;
  private heraldY = 0;

  private spawnOverride: { x: number; y: number } | null = null;
  private inputLockUntil = 0;

  private bgm?: Phaser.Sound.BaseSound;

  constructor() {
    super('GrandPlaza');
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
    this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // ---- Visuals (Wave 8 · 米色羊皮纸 + 16 发散纹) ----
    this.drawBackdrop();
    this.drawSpokes();
    this.drawAmphitheater();
    this.drawCenterPodium();
    this.drawNorthBoard();
    this.drawWestInscription();
    this.drawEastStage();
    this.drawSouthArch();
    this.drawTreesAndFlowers();

    // ---- Player ----
    this.createCharacterAnims('player');
    const defaultX = MAP_WIDTH / 2;
    const defaultY = MAP_HEIGHT - 100;
    const sx = this.spawnOverride?.x ?? defaultX;
    const sy = this.spawnOverride?.y ?? defaultY;
    this.player = this.physics.add.sprite(sx, sy, 'player', 0);
    this.player.setCollideWorldBounds(true);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(12, 6).setOffset(10, 17);
    this.player.anims.play('player-idle-up');

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    // G1.1 · Multiplayer (via helper)
    this.mp = setupMultiplayer(this, 'GrandPlaza', () => this.player, () => this.currentFacing);

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

    // ---- Port (south · 拱门) ----
    this.portX = MAP_WIDTH / 2;
    this.portY = MAP_HEIGHT - 60;

    // ---- Center Podium (中央演讲台) ----
    this.altarX = MAP_WIDTH / 2;
    this.altarY = MAP_HEIGHT / 2;

    // ---- North Board (议程榜) ----
    this.boardX = MAP_WIDTH / 2;
    this.boardY = 60;

    // ---- West Inscription (题字墙) ----
    this.inscriptionX = 80;
    this.inscriptionY = MAP_HEIGHT / 2;

    // ---- East Herald NPC (司仪) ----
    this.heraldX = MAP_WIDTH - 80;
    this.heraldY = MAP_HEIGHT / 2;
    // 司仪 sprite (简单圆 + 头)
    this.add.circle(this.heraldX, this.heraldY, 8, 0x6b3434).setDepth(2);
    this.add.circle(this.heraldX, this.heraldY - 10, 6, 0xeacba0).setDepth(2);
    // 司仪 banner
    const banner = this.add.text(this.heraldX, this.heraldY - 26, '🎺', {
      fontSize: '14px',
    }).setOrigin(0.5).setDepth(3);
    this.tweens.add({
      targets: banner, y: this.heraldY - 30,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ---- Labels ----
    // (大广场标题在公告板顶部 · 不再单独画)

    this.add.text(MAP_WIDTH / 2, this.altarY - 90, '中央演讲台', {
      fontFamily: 'serif', fontSize: '12px',
      color: '#fdf0cf', backgroundColor: '#5d3a1aee',
      padding: { left: 6, right: 6, top: 2, bottom: 2 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    // ---- Hints ----
    this.interactHint = this.add.text(0, 0, '[E]', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#000000aa',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.portHint = this.add.text(0, 0, '[E] 返回议政高地', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#3a4a6add',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.heraldHint = this.add.text(0, 0, '[E] 司仪', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#000000aa',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.inscriptionHint = this.add.text(0, 0, '[E] 看题字', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#ffffff', backgroundColor: '#000000aa',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    // ---- BGM ----
    if (this.cache.audio.exists('bgm-village')) {
      this.bgm = this.sound.add('bgm-village', { loop: true, volume: BGM_VOLUME });
      this.bgm.play();
    }

    // ---- World map travel listener ----
    const onTravel = (data: { sceneKey: string }) => {
      if (data.sceneKey === 'GrandPlaza') return;
      // Returning to other places → exit through port to GovHill first
      if (data.sceneKey === 'GovHill') {
        this.exitToPort();
      } else if (data.sceneKey === 'SproutCity' || data.sceneKey === 'Main') {
        // For now, route through GovHill (player will need another travel)
        this.exitToPort();
      }
    };
    EventBus.on('world-map-travel', onTravel);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('world-map-travel', onTravel);
      this.bgm?.stop();
    });
  }

  // ============ DRAWING ============

  // ============ DRAWING (Wave 8 · 圆形剧场) ============

  /** 草地背景 (替代旧的灰蓝天空) */
  private drawBackdrop() {
    const g = this.add.graphics();
    g.setDepth(-10);
    // 主体草地
    g.fillStyle(0x6b9b3a, 1);
    g.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    // 散点纹理
    g.fillStyle(0x7fb045, 0.6);
    let r = 42;
    for (let i = 0; i < 200; i++) {
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      const x = r % MAP_WIDTH;
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      const y = r % MAP_HEIGHT;
      g.fillCircle(x, y, 1.5);
    }
  }

  /** 16 道发散纹 (米色 · "召集八方") */
  private drawSpokes() {
    const g = this.add.graphics();
    g.setDepth(-8);
    const cx = MAP_WIDTH / 2;
    const cy = MAP_HEIGHT / 2;
    g.lineStyle(4, 0xfdf0cf, 0.7);
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const farX = cx + Math.cos(angle) * 900;
      const farY = cy + Math.sin(angle) * 900;
      g.lineBetween(cx, cy, farX, farY);
    }
    // 外圆环 (草地边界)
    g.lineStyle(4, 0x8b6f4a, 1);
    g.strokeCircle(cx, cy, 420);
  }

  /** 4 阶环形观众席 + 中央广场 + 4 出入口走道 */
  private drawAmphitheater() {
    const g = this.add.graphics();
    g.setDepth(-6);
    const cx = MAP_WIDTH / 2;
    const cy = MAP_HEIGHT / 2;

    // 4 阶观众席 (从外到内 · 颜色由深到浅 · 4 个圆环)
    const tiers = [
      { r: 380, color: 0xfdf0cf },  // 最外圈 米色
      { r: 340, color: 0xead4a0 },  // 第 3 圈 浅黄
      { r: 300, color: 0xdab884 },  // 第 2 圈 中黄
      { r: 260, color: 0xc9a55b },  // 最内圈 深黄
    ];
    tiers.forEach((t) => {
      g.fillStyle(t.color, 1);
      g.fillCircle(cx, cy, t.r);
    });

    // 中央广场 (米色)
    g.fillStyle(0xfdf0cf, 1);
    g.fillCircle(cx, cy, 220);

    // 阶梯环边描线
    g.lineStyle(2, 0x8b6f4a, 0.8);
    [380, 340, 300, 260, 220].forEach((r) => {
      g.strokeCircle(cx, cy, r);
    });

    // === 4 出入口走道 (东南西北 · 切断观众席) ===
    const gateW = 50;
    g.fillStyle(0xfdf0cf, 1);
    // 北
    g.fillRect(cx - gateW, cy - 420, gateW * 2, 200);
    // 南
    g.fillRect(cx - gateW, cy + 220, gateW * 2, 200);
    // 西
    g.fillRect(cx - 420, cy - gateW, 200, gateW * 2);
    // 东
    g.fillRect(cx + 220, cy - gateW, 200, gateW * 2);
    // 走道边线
    g.lineStyle(2, 0x8b6f4a, 0.8);
    [
      [cx - gateW, cy - 420, cx - gateW, cy - 220],
      [cx + gateW, cy - 420, cx + gateW, cy - 220],
      [cx - gateW, cy + 220, cx - gateW, cy + 420],
      [cx + gateW, cy + 220, cx + gateW, cy + 420],
      [cx - 420, cy - gateW, cx - 220, cy - gateW],
      [cx - 420, cy + gateW, cx - 220, cy + gateW],
      [cx + 220, cy - gateW, cx + 420, cy - gateW],
      [cx + 220, cy + gateW, cx + 420, cy + gateW],
    ].forEach((line) => {
      g.lineBetween(line[0], line[1], line[2], line[3]);
    });
  }

  /** 中央演讲台 (主互动 1) · 圆形米黄台 + 麦克风 + CUA 金徽 */
  private drawCenterPodium() {
    const g = this.add.graphics();
    g.setDepth(2);
    const x = MAP_WIDTH / 2;
    const y = MAP_HEIGHT / 2;

    // 圆台底座 (椭圆 · 透视感)
    g.fillStyle(0x8b6f4a, 1);
    g.fillEllipse(x, y + 20, 140, 30);
    // 主台面
    g.fillStyle(0xead4a0, 1);
    g.fillCircle(x, y, 70);
    g.lineStyle(3, 0x8b6f4a, 1);
    g.strokeCircle(x, y, 70);
    // 内圈
    g.fillStyle(0xfdf0cf, 1);
    g.fillCircle(x, y, 50);
    g.lineStyle(2, 0xdaa520, 1);
    g.strokeCircle(x, y, 50);

    // 麦克风立柱
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 3, y - 30, 6, 28);
    // 麦克风头 (椭圆)
    g.fillStyle(0x3a2a1a, 1);
    g.fillEllipse(x, y - 32, 16, 12);
    g.fillStyle(0xdaa520, 1);
    g.fillEllipse(x, y - 32, 12, 8);
    // 装饰 CUA 金徽 (台面中央)
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x, y + 15, 10);
    g.fillStyle(0xc0392b, 1);
    g.fillCircle(x, y + 15, 6);
    g.fillStyle(0xfac775, 1);
    g.fillCircle(x, y + 15, 2);
  }

  /** 北墙议程榜 (主互动 2) · 大公示牌 */
  private drawNorthBoard() {
    const g = this.add.graphics();
    g.setDepth(2);
    const x = this.boardX;
    const y = this.boardY;
    // 木桩底座
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 4, y + 30, 8, 30);
    // 框
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 80, y - 30, 160, 60);
    // 金边
    g.fillStyle(0xdaa520, 1);
    g.fillRect(x - 75, y - 25, 150, 50);
    // 米色羊皮纸面
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 70, y - 20, 140, 40);
    // 标题"年度大会议程"
    this.add.text(x, y - 13, '年度大会议程', {
      fontFamily: 'serif', fontSize: '11px',
      color: '#5d3a1a', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
    // 4 行字
    g.lineStyle(1, 0x6b3434, 0.7);
    for (let i = 0; i < 4; i++) {
      g.lineBetween(x - 60, y - 2 + i * 6, x + 60, y - 2 + i * 6);
    }
  }

  /** 西墙题字墙 (主互动 3) · 米色长壁 + 多行刻字 */
  private drawWestInscription() {
    const g = this.add.graphics();
    g.setDepth(2);
    const x = this.inscriptionX;
    const y = this.inscriptionY;
    // 框 (深棕)
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 30, y - 80, 60, 160);
    // 米色羊皮纸
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(x - 25, y - 75, 50, 150);
    g.lineStyle(1, 0x8b6f4a, 1);
    g.strokeRect(x - 25, y - 75, 50, 150);
    // 标题"题字墙"
    this.add.text(x, y - 65, '题字墙', {
      fontFamily: 'serif', fontSize: '10px',
      color: '#5d3a1a', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
    // 多行刻字 (用线模拟)
    g.lineStyle(1, 0x6b3434, 0.6);
    for (let i = 0; i < 10; i++) {
      g.lineBetween(x - 18, y - 50 + i * 12, x + 18, y - 50 + i * 12);
    }
  }

  /** 东方表演舞台 (装饰 · 不互动 · 跟司仪 NPC 共享方位) */
  private drawEastStage() {
    const g = this.add.graphics();
    g.setDepth(2);
    // 舞台位置在司仪后方一点
    const x = MAP_WIDTH - 50;
    const y = MAP_HEIGHT / 2 + 60;
    // 红舞台底座
    g.fillStyle(0x6b3434, 1);
    g.fillRect(x - 25, y - 50, 50, 60);
    g.lineStyle(2, 0x4a1a1a, 1);
    g.strokeRect(x - 25, y - 50, 50, 60);
    // 戏布波浪顶
    g.fillStyle(0xa32d2d, 1);
    g.fillTriangle(x - 25, y - 50, x - 15, y - 56, x - 5, y - 50);
    g.fillTriangle(x - 5, y - 50, x + 5, y - 56, x + 15, y - 50);
    g.fillTriangle(x + 15, y - 50, x + 5, y - 56, x + 25, y - 50);
    // 金徽
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(x, y - 20, 6);
  }

  /** 南门拱门 (出口·返回议政高地) */
  private drawSouthArch() {
    const g = this.add.graphics();
    g.setDepth(1);
    const x = this.portX;
    const y = this.portY;
    // 双米色柱
    [-50, 50].forEach((dx) => {
      g.fillStyle(0xfdf0cf, 1);
      g.fillRect(x + dx - 12, y - 60, 24, 60);
      g.lineStyle(2, 0x8b6f4a, 1);
      g.strokeRect(x + dx - 12, y - 60, 24, 60);
      // 顶帽
      g.fillStyle(0xdaa520, 1);
      g.fillRect(x + dx - 16, y - 66, 32, 6);
    });
    // 顶座 (拱门顶 · 连接两柱)
    g.fillStyle(0xdaa520, 1);
    g.fillRect(x - 60, y - 70, 120, 8);
    g.lineStyle(2, 0x8b6f4a, 1);
    g.strokeRect(x - 60, y - 70, 120, 8);
    // 拱门牌"通往议政高地"
    this.add.text(x, y - 80, '↓ 议政高地', {
      fontFamily: 'serif', fontSize: '11px',
      color: '#5d3a1a', backgroundColor: '#fdf0cfee',
      padding: { left: 5, right: 5, top: 1, bottom: 1 },
    }).setOrigin(0.5).setDepth(5);
  }

  /** 4 角树 + 4 处花丛 */
  private drawTreesAndFlowers() {
    const g = this.add.graphics();
    g.setDepth(0);
    // 4 角树
    [
      { x: 100, y: 100 },
      { x: MAP_WIDTH - 100, y: 100 },
      { x: 100, y: MAP_HEIGHT - 100 },
      { x: MAP_WIDTH - 100, y: MAP_HEIGHT - 100 },
    ].forEach((t) => {
      g.fillStyle(0x3b6d11, 1);
      g.fillCircle(t.x, t.y, 26);
      g.fillStyle(0x639b22, 1);
      g.fillCircle(t.x, t.y - 4, 20);
      g.fillStyle(0x5d3a1a, 1);
      g.fillRect(t.x - 5, t.y + 15, 10, 22);
    });
    // 4 处花丛
    [
      { x: 200, y: 200 },
      { x: MAP_WIDTH - 200, y: 200 },
      { x: 200, y: MAP_HEIGHT - 200 },
      { x: MAP_WIDTH - 200, y: MAP_HEIGHT - 200 },
    ].forEach((f) => {
      const colors = [0xef5050, 0xfac775, 0x4a8ad5, 0xdaa520];
      colors.forEach((c, i) => {
        const ox = (i % 2) * 14 - 7;
        const oy = Math.floor(i / 2) * 14 - 7;
        g.fillStyle(c, 1);
        g.fillCircle(f.x + ox, f.y + oy, 5);
      });
    });
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

  private exitToPort() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Return to GovHill east port (we'll add this in GovHillScene)
      this.scene.start('GovHill', {
        spawnX: 1500,             // east edge of GovHill
        spawnY: 1800,
      });
    });
  }

  private triggerHeraldDialogue() {
    EventBus.emit('show-dialogue', {
      name: '🎺 司仪',
      lines: [
        '"欢迎来到大集会广场——CUA 一年一度的会场。"',
        '"中央演讲台是仪式核心。每到岁末，全社区在此聚首。"',
        '"四阶环形观众席可容纳数百人，远道而来者皆能落座。"',
        '"——目前是空场。但当真到那一日，这里会满。"',
        '（司仪的银号闪过一道光）',
        '',
        '"按章程，年度大会需 L4 联席主席召集。"',
        '"——你若有志，请先去远见塔看路线图。"',
      ],
    });
  }

  private triggerAltarDialogue() {
    EventBus.emit('show-dialogue', {
      name: '🎤 中央演讲台',
      lines: [
        '（圆形演讲台 · 一支立式麦克风 · 中央嵌着 CUA 金徽）',
        '',
        '"年度大会的演讲，由社区代表轮流上台。"',
        '"提案审定者立于此处，',
        '  审议已决之事，公布章程之变。"',
        '',
        '当前演讲：暂无（无现役议题）',
        '',
        '（你环顾四周空旷的观众席——）',
        '总有一天，这里会站满人。',
        '──',
        '"按章程，需 L4 联席主席方可登台。"',
      ],
    });
  }

  private triggerBoardDialogue() {
    EventBus.emit('show-dialogue', {
      name: '📋 年度大会议程',
      lines: [
        '— CUA 年度大会 · 流程 —',
        '',
        '一、回顾：过往一年的贡献成就',
        '二、决议：理事会通过的提案公布',
        '三、嘉誉：刻石授名 · 新晋 L4 入名',
        '四、展望：来年路线图揭幕',
        '',
        '"每年岁末，皆于此地举行。"',
        '',
        '（公告底部，大字写着）',
        '— 下次大会日期：未定 —',
      ],
    });
  }

  private triggerInscriptionDialogue() {
    EventBus.emit('show-dialogue', {
      name: '📜 题字墙',
      lines: [
        '（米色羊皮纸长壁 · 上面一行行刻着名字与年份）',
        '',
        '"每届大会授名者，皆刻于此。"',
        '',
        '── 已刻 ──',
        '・暂无（系统初启）',
        '',
        '"等到第一届大会召开，',
        ' 第一行字会出现在最上方。"',
        '──',
        '"刻一字，立一名——百年之后，',
        ' 来人仍可读到你的名字。"',
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
      this.interactHint.setVisible(false);
      this.portHint.setVisible(false);
      this.heraldHint.setVisible(false);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
      EventBus.emit('open-world-map', { currentScene: 'GrandPlaza' });
    }
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) {
      EventBus.emit('open-quest-log');
    }
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) {
      EventBus.emit('open-mailbox');
    }

    const distPort = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.portX, this.portY);
    const distAltar = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.altarX, this.altarY);
    const distBoard = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boardX, this.boardY);
    const distHerald = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.heraldX, this.heraldY);
    const distInscription = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.inscriptionX, this.inscriptionY);

    const nearPort = distPort < 80;
    const nearAltar = distAltar < INTERACT_DISTANCE * 1.4;
    const nearBoard = distBoard < INTERACT_DISTANCE * 1.4;
    const nearHerald = distHerald < INTERACT_DISTANCE;
    const nearInscription = distInscription < INTERACT_DISTANCE * 1.4;

    const hideAll = () => {
      this.portHint.setVisible(false);
      this.heraldHint.setVisible(false);
      this.interactHint.setVisible(false);
      this.inscriptionHint.setVisible(false);
    };

    if (nearPort) {
      hideAll();
      this.portHint.setPosition(this.portX, this.portY - 90).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exitToPort();
    } else if (nearAltar) {
      hideAll();
      this.interactHint.setText('[E] 看演讲台').setPosition(this.altarX, this.altarY - 60).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerAltarDialogue();
    } else if (nearBoard) {
      hideAll();
      this.interactHint.setText('[E] 看议程').setPosition(this.boardX, this.boardY + 70).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBoardDialogue();
    } else if (nearInscription) {
      hideAll();
      this.inscriptionHint.setPosition(this.inscriptionX + 60, this.inscriptionY).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerInscriptionDialogue();
    } else if (nearHerald) {
      hideAll();
      this.heraldHint.setPosition(this.heraldX, this.heraldY - 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerHeraldDialogue();
    } else {
      hideAll();
    }
  }
}
