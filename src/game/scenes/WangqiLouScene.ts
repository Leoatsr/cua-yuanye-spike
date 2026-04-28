import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 130;
const INTERACT_DISTANCE = 56;

const ROOM_WIDTH = 720;
const ROOM_HEIGHT = 520;

interface SceneInitData {
  returnX?: number;
  returnY?: number;
}

/**
 * 望气楼 (Wangqi Lou) — 内参工作组工坊室内
 *
 * Theme: Intelligence / industry insights observatory.
 * Visual: World map with pinned events, telescope, encrypted vault, intel desk.
 */
export class WangqiLouScene extends Phaser.Scene {
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

  private mapX = 0;
  private mapY = 0;
  private telescopeX = 0;
  private telescopeY = 0;
  private vaultX = 0;
  private vaultY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('WangqiLou');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Floor (rich navy with brass trim, observatory feel) ----
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x0a0e1f, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    g.fillStyle(0x1a2540, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(3, 0xb8a472, 0.7);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    // Compass rose at center floor
    g.lineStyle(1, 0xb8a472, 0.4);
    const cx = ROOM_WIDTH / 2;
    const cy = ROOM_HEIGHT / 2 + 20;
    g.strokeCircle(cx, cy, 80);
    g.strokeCircle(cx, cy, 60);
    [0, 1, 2, 3].forEach((i) => {
      const a = (i / 4) * Math.PI * 2;
      g.lineBetween(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40,
        cx + Math.cos(a) * 80, cy + Math.sin(a) * 80);
    });
    [0, 1, 2, 3].forEach((i) => {
      const a = ((i / 4) * Math.PI * 2) + Math.PI / 4;
      g.lineBetween(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30,
        cx + Math.cos(a) * 60, cy + Math.sin(a) * 60);
    });

    // ---- North wall (brass trim) ----
    g.fillStyle(0x4a3826, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);
    g.fillStyle(0xb8a472, 0.6);
    g.fillRect(60, 72, ROOM_WIDTH - 120, 2);

    // ---- World map with pins (north — main feature) ----
    this.mapX = ROOM_WIDTH / 2;
    this.mapY = 130;
    this.drawWorldMap(this.mapX, this.mapY);

    // ---- Telescope (west — pointed at window) ----
    this.telescopeX = 140;
    this.telescopeY = ROOM_HEIGHT / 2;
    this.drawTelescope(this.telescopeX, this.telescopeY);

    // ---- Encrypted vault (east) ----
    this.vaultX = ROOM_WIDTH - 130;
    this.vaultY = ROOM_HEIGHT / 2;
    this.drawVault(this.vaultX, this.vaultY);

    // ---- Intel analysis desks ----
    this.drawIntelDesk(ROOM_WIDTH / 2 - 90, ROOM_HEIGHT / 2 + 100);
    this.drawIntelDesk(ROOM_WIDTH / 2 + 90, ROOM_HEIGHT / 2 + 100);

    // ---- Player ----
    this.createCharacterAnims('player');
    this.player = this.physics.add.sprite(ROOM_WIDTH / 2, ROOM_HEIGHT - 110, 'player', 0);
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

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    // G1.1 · Multiplayer (via helper)
    this.mp = setupMultiplayer(this, 'WangqiLou', () => this.player, () => this.currentFacing);

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

    // ---- Exit ----
    this.exitX = ROOM_WIDTH / 2;
    this.exitY = ROOM_HEIGHT - 70;
    const doorG = this.add.graphics();
    doorG.fillStyle(0x4a3826, 1);
    doorG.fillRect(this.exitX - 22, this.exitY - 30, 44, 56);
    doorG.lineStyle(2, 0x2a1e10, 1);
    doorG.strokeRect(this.exitX - 22, this.exitY - 30, 44, 56);
    doorG.fillStyle(0xb8a472, 1);
    doorG.fillCircle(this.exitX + 12, this.exitY, 3);

    // ---- Title ----
    this.add.text(ROOM_WIDTH / 2, 30, '— 望气楼 · 内参工作组 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#fbbf24', backgroundColor: '#0a0e1faa',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    this.exitHint = this.add.text(0, 0, '[E] 离开', {
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

  private drawWorldMap(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Frame (brass)
    g.fillStyle(0xb8a472, 1);
    g.fillRect(x - 220, y - 50, 440, 100);
    g.lineStyle(3, 0x6b5230, 1);
    g.strokeRect(x - 220, y - 50, 440, 100);
    // Map paper (aged sepia)
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 212, y - 42, 424, 84);

    // Continent shapes (rough silhouettes)
    g.fillStyle(0x9a8350, 0.7);
    // North America (left)
    g.fillTriangle(x - 200, y - 25, x - 165, y - 35, x - 145, y);
    g.fillRect(x - 200, y - 25, 60, 25);
    // South America
    g.fillTriangle(x - 175, y + 5, x - 160, y + 10, x - 165, y + 35);
    // Europe + Asia (continuous blob)
    g.fillRect(x - 100, y - 30, 100, 30);
    g.fillTriangle(x, y, x + 40, y + 15, x + 30, y - 20);
    g.fillRect(x + 30, y - 25, 50, 30);
    // Africa
    g.fillRect(x - 80, y, 25, 35);
    g.fillTriangle(x - 80, y + 35, x - 55, y + 35, x - 70, y + 42);
    // Australia
    g.fillTriangle(x + 80, y + 25, x + 110, y + 25, x + 95, y + 35);

    // 8 pinned events (red/yellow/blue thumbtacks)
    const pins: Array<[number, number, number, string]> = [
      [-160, -10, 0xff3030, 'AI'],     // San Francisco
      [-150, 25, 0xfbbf24, 'CN'],      // Latin America
      [-50, -5, 0x60a5fa, 'EU'],       // London
      [40, -10, 0xff3030, 'CN'],       // Beijing
      [60, 5, 0xfbbf24, 'JP'],         // Tokyo
      [70, 25, 0xfbbf24, 'IN'],        // Bangalore
      [-65, 15, 0x60a5fa, 'EU'],       // Africa
      [95, 30, 0xff3030, 'AU'],        // Australia
    ];
    pins.forEach(([dx, dy, color]) => {
      // Pin shadow
      g.fillStyle(0x000000, 0.2);
      g.fillCircle(x + dx + 1, y + dy + 1, 4);
      // Pin head
      g.fillStyle(color, 1);
      g.fillCircle(x + dx, y + dy, 3.5);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(x + dx - 1, y + dy - 1, 1.5);
      // Connecting string to bottom-left list
      g.lineStyle(0.5, color, 0.5);
      g.lineBetween(x + dx, y + dy, x - 200, y + 38 - (pins.indexOf(pins.find(([a, b]) => a === dx && b === dy)!) * 0.5));
    });

    // Compass rose (top-left of map)
    g.lineStyle(1, 0x6b5230, 1);
    g.strokeCircle(x - 195, y - 30, 8);
    g.lineBetween(x - 195, y - 38, x - 195, y - 22);
    g.lineBetween(x - 203, y - 30, x - 187, y - 30);
  }

  private drawTelescope(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Tripod base
    g.lineStyle(3, 0x4a3826, 1);
    g.lineBetween(x - 18, y + 36, x, y);
    g.lineBetween(x + 18, y + 36, x, y);
    g.lineBetween(x - 8, y + 36, x, y + 4);
    // Mount (brass)
    g.fillStyle(0xb8a472, 1);
    g.fillCircle(x, y, 8);
    g.lineStyle(2, 0x6b5230, 1);
    g.strokeCircle(x, y, 8);
    // Telescope tube (long, pointing up-right)
    g.fillStyle(0x4a3826, 1);
    g.fillRect(x - 4, y - 50, 8, 50);
    g.lineStyle(2, 0x2a1e10, 1);
    g.strokeRect(x - 4, y - 50, 8, 50);
    // Telescope segments (brass rings)
    g.fillStyle(0xb8a472, 1);
    g.fillRect(x - 6, y - 50, 12, 4);
    g.fillRect(x - 6, y - 30, 12, 3);
    g.fillRect(x - 6, y - 14, 12, 3);
    // Eyepiece
    g.fillStyle(0x18121a, 1);
    g.fillCircle(x, y - 54, 4);
    g.lineStyle(1, 0xb8a472, 1);
    g.strokeCircle(x, y - 54, 4);

    // Window behind (showing stars)
    const wg = this.add.graphics();
    wg.setDepth(1);
    wg.fillStyle(0x0a0e1f, 1);
    wg.fillRect(x - 30, y - 88, 60, 38);
    wg.lineStyle(2, 0x4a3826, 1);
    wg.strokeRect(x - 30, y - 88, 60, 38);
    // Stars
    wg.fillStyle(0xffe0a0, 1);
    [[-22, -78], [-12, -82], [0, -76], [10, -84], [18, -78], [22, -68], [-18, -64], [4, -70], [14, -62]].forEach(([sx, sy]) => {
      wg.fillCircle(x + sx, y + sy, 0.8);
    });
    // Moon
    wg.fillStyle(0xede5cf, 0.9);
    wg.fillCircle(x + 20, y - 70, 6);
    wg.fillStyle(0x0a0e1f, 1);
    wg.fillCircle(x + 22, y - 71, 5);
  }

  private drawVault(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Vault body (heavy iron)
    g.fillStyle(0x2a2e36, 1);
    g.fillRect(x - 36, y - 50, 72, 100);
    g.lineStyle(3, 0x18181a, 1);
    g.strokeRect(x - 36, y - 50, 72, 100);
    // Inner vault door
    g.fillStyle(0x4a4d56, 1);
    g.fillRect(x - 30, y - 44, 60, 88);
    g.lineStyle(2, 0x18181a, 1);
    g.strokeRect(x - 30, y - 44, 60, 88);
    // Big circular dial (brass)
    g.fillStyle(0xb8a472, 1);
    g.fillCircle(x, y, 14);
    g.lineStyle(2, 0x6b5230, 1);
    g.strokeCircle(x, y, 14);
    // Dial markings (4 directions + sub)
    g.lineStyle(1, 0x6b5230, 1);
    [0, 1, 2, 3].forEach((i) => {
      const a = (i / 4) * Math.PI * 2;
      g.lineBetween(x + Math.cos(a) * 10, y + Math.sin(a) * 10,
        x + Math.cos(a) * 14, y + Math.sin(a) * 14);
    });
    [0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 16;
      g.lineBetween(x + Math.cos(a) * 12, y + Math.sin(a) * 12,
        x + Math.cos(a) * 14, y + Math.sin(a) * 14);
    });
    // Pointer (red mark at top)
    g.fillStyle(0xff3030, 1);
    g.fillTriangle(x - 2, y - 16, x + 2, y - 16, x, y - 12);
    // Handle (vertical bar)
    g.fillStyle(0x18181a, 1);
    g.fillRect(x - 2, y + 16, 4, 24);
    g.fillStyle(0xb8a472, 1);
    g.fillCircle(x, y + 18, 3);
    g.fillCircle(x, y + 38, 3);
    // Small label (TOP SECRET)
    g.fillStyle(0xff3030, 1);
    g.fillRect(x - 18, y - 38, 36, 6);
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 16, y - 36, 32, 2);
  }

  private drawIntelDesk(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // Desk (dark wood)
    g.fillStyle(0x4a3826, 1);
    g.fillRect(x - 32, y - 14, 64, 28);
    g.lineStyle(2, 0x2a1e10, 1);
    g.strokeRect(x - 32, y - 14, 64, 28);
    // Reports stacked
    g.fillStyle(0xede5cf, 1);
    g.fillRect(x - 22, y - 10, 18, 14);
    g.fillRect(x - 20, y - 12, 18, 14);
    g.lineStyle(1, 0x6b5230, 0.6);
    g.strokeRect(x - 22, y - 10, 18, 14);
    g.strokeRect(x - 20, y - 12, 18, 14);
    // Confidential stamp (red ring)
    g.lineStyle(1, 0xff3030, 0.7);
    g.strokeCircle(x - 11, y - 5, 5);
    // Magnifying glass
    g.lineStyle(2, 0xb8a472, 1);
    g.strokeCircle(x + 12, y - 4, 6);
    g.lineBetween(x + 16, y, x + 22, y + 6);
    // Quill pen
    g.lineStyle(2, 0x18121a, 1);
    g.lineBetween(x + 4, y + 8, x + 20, y - 8);
    // Legs
    g.fillStyle(0x2a1e10, 1);
    g.fillRect(x - 30, y + 14, 4, 24);
    g.fillRect(x + 26, y + 14, 4, 24);
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
      this.scene.start('SproutCity', { spawnX: this.returnX, spawnY: this.returnY });
    });
  }

  private triggerMap() {
    EventBus.emit('show-dialogue', {
      name: '🗺️ 世界形势图',
      lines: [
        '（巨大的世界地图，8 处用彩色图钉标着事件）',
        '',
        '红钉：突发事件 / 行业地震',
        '黄钉：值得跟进的趋势',
        '蓝钉：长期观察对象',
        '',
        '"望气——观天下之气，知风之所向。"',
        '',
        '"不站队、不站票——只观察、只记录、只输出。"',
        '"内参周报每周一发布。"',
      ],
    });
  }

  private triggerTelescope() {
    EventBus.emit('show-dialogue', {
      name: '🔭 望远镜',
      lines: [
        '（穿过眼罩，看见窗外群星）',
        '',
        '"夜空里能看到的，比白天多。"',
        '"行业里值得看的，也比表面多。"',
        '',
        '"望气——古时候是看星象。"',
        '"现在，是看 GitHub Trending、看公司财报、看技术博客。"',
        '',
        '"——风起于青萍之末。"',
      ],
    });
  }

  private triggerVault() {
    EventBus.emit('show-dialogue', {
      name: '🔐 加密保险柜',
      lines: [
        '（厚重的铁柜，红色"绝密"标签）',
        '',
        '"内参源材料、未公开访谈、敏感情报——都在这里。"',
        '',
        '"打开需 3 把钥匙：" ',
        '─ 工作组长 (1 把)',
        '─ 当值分析师 (1 把)',
        '─ 来源代号 (1 把 · 知情者本人)',
        '',
        '"——非紧急时，谁也不动这个柜子。"',
        '（红色指针纹丝不动）',
      ],
    });
  }

  // ============ UPDATE ============

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

    if (Phaser.Input.Keyboard.JustDown(this.mKey)) EventBus.emit('open-world-map', { currentScene: 'SproutCity' });
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) EventBus.emit('open-quest-log');
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) EventBus.emit('open-mailbox');

    const distExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitX, this.exitY);
    const distMap = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.mapX, this.mapY);
    const distTel = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.telescopeX, this.telescopeY);
    const distVault = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.vaultX, this.vaultY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distMap < INTERACT_DISTANCE * 1.8) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看世界图').setPosition(this.mapX, this.mapY - 60).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerMap();
    } else if (distTel < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 用望远镜').setPosition(this.telescopeX, this.telescopeY - 80).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerTelescope();
    } else if (distVault < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看保险柜').setPosition(this.vaultX, this.vaultY - 70).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerVault();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
