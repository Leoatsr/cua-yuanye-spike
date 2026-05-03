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
 * 司算所 (Sisuan Suo) — 数据工作组工坊室内
 *
 * Theme: Data analytics center.
 * Visual: huge wall of dashboards, server farm, SQL query terminal.
 */
export class SisuanSuoScene extends Phaser.Scene {
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

  private bigBoardX = 0;
  private bigBoardY = 0;
  private terminalX = 0;
  private terminalY = 0;
  private serverFarmX = 0;
  private serverFarmY = 0;

  private returnX = 0;
  private returnY = 0;
  private inputLockUntil = 0;

  constructor() {
    super('SisuanSuo');
  }

  init(data: SceneInitData) {
    this.returnX = data.returnX ?? 0;
    this.returnY = data.returnY ?? 0;
  }

  create() {
    this.inputLockUntil = this.time.now + 250;
    this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // ---- Floor (Wave 7.K · 落地页米色) ----
    const g = this.add.graphics();
    g.setDepth(-5);
    g.fillStyle(0x8b4513, 1);
    g.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    g.fillStyle(0xfdf0cf, 1);
    g.fillRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    g.lineStyle(3, 0x5d3a1a, 1);
    g.strokeRect(60, 70, ROOM_WIDTH - 120, ROOM_HEIGHT - 130);
    // 横向木板缝
    g.lineStyle(1, 0xc9a55b, 0.3);
    for (let y = 102; y < ROOM_HEIGHT - 60; y += 64) {
      g.lineBetween(64, y, ROOM_WIDTH - 64, y);
    }

    // ---- 北墙顶梁 (Wave 7.K · 暖木) ----
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(60, 60, ROOM_WIDTH - 120, 14);

    // ---- Wave 7.K 主道具：KPI 大屏 (北墙居中 · 占 bigBoardX/Y) ----
    this.bigBoardX = ROOM_WIDTH / 2;
    this.bigBoardY = 120;
    this.drawBigBoard(this.bigBoardX, this.bigBoardY);

    // ---- Wave 7.K 数据中心走廊：左右各 2 排服务器机架 (B 布局) ----
    // 左侧 2 排 (内+外 · 形成走廊感)
    this.drawServerFarm(110, ROOM_HEIGHT / 2 + 10);  // 左外
    this.drawServerFarm(180, ROOM_HEIGHT / 2 + 10);  // 左内
    // 右侧 2 排
    this.drawServerFarm(ROOM_WIDTH - 180, ROOM_HEIGHT / 2 + 10);  // 右内
    this.drawServerFarm(ROOM_WIDTH - 110, ROOM_HEIGHT / 2 + 10);  // 右外
    // 互动点设在右外（serverFarmX/Y · 玩家走到东墙触发）
    this.serverFarmX = ROOM_WIDTH - 110;
    this.serverFarmY = ROOM_HEIGHT / 2 + 10;

    // ---- Wave 7.K 中央桌：数据笔记 (走廊正中 · 占 terminalX/Y) ----
    this.terminalX = ROOM_WIDTH / 2;
    this.terminalY = ROOM_HEIGHT / 2 + 30;
    this.drawTerminal(this.terminalX, this.terminalY);

    // (drawAnalystDesk 留着但不调 · 旧函数保留兼容)

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
    this.mp = setupMultiplayer(this, 'SisuanSuo', () => this.player, () => this.currentFacing);

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
    this.add.text(ROOM_WIDTH / 2, 80, '— 数据工坊 —', {
      fontFamily: 'serif', fontSize: '15px',
      color: '#3c3489', backgroundColor: '#fdf0cfee',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(10);

    this.exitHint = this.add.text(0, 0, '[E] 离开', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#fdf0cf', backgroundColor: '#5d3a1add',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.interactHint = this.add.text(0, 0, '[E]', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#fdf0cf', backgroundColor: '#5d3a1add',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5).setVisible(false).setDepth(100);
  }

  // ============ DRAWING (Wave 7.K · 数据中心走廊布局 · 保留方法名) ============

  /** 主道具：KPI 大屏 (北墙居中 · 占 bigBoardX/Y · 紫主题) */
  private drawBigBoard(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 暖木外框
    g.fillStyle(0x5d3a1a, 1);
    g.fillRect(x - 88, y - 28, 176, 56);
    // 紫主题色边
    g.fillStyle(0x7857c0, 1);
    g.fillRect(x - 84, y - 24, 168, 48);
    // 深背景屏 (黑底)
    g.fillStyle(0x1a1024, 1);
    g.fillRect(x - 80, y - 20, 160, 40);
    // 顶部紫色标签条
    g.fillStyle(0xafa9ec, 1);
    g.fillRect(x - 80, y - 20, 160, 4);
    // 大数字 "12K" 用色块仿
    g.fillStyle(0xafa9ec, 1);
    // 1
    g.fillRect(x - 50, y - 12, 4, 22);
    // 2
    g.fillRect(x - 38, y - 12, 14, 4);
    g.fillRect(x - 26, y - 8, 4, 8);
    g.fillRect(x - 38, y - 2, 14, 4);
    g.fillRect(x - 38, y, 4, 6);
    g.fillRect(x - 38, y + 6, 14, 4);
    // K
    g.fillRect(x - 16, y - 12, 4, 22);
    g.fillRect(x - 12, y - 4, 4, 4);
    g.fillRect(x - 8, y - 8, 4, 4);
    g.fillRect(x - 4, y - 12, 4, 4);
    g.fillRect(x - 8, y, 4, 4);
    g.fillRect(x - 4, y + 4, 4, 4);
    // 趋势线 (右半)
    g.lineStyle(2, 0x97c459, 1);
    const pts: [number, number][] = [[x + 6, y + 8], [x + 18, y + 4], [x + 30, y - 2], [x + 42, y - 6], [x + 54, y - 10], [x + 66, y - 14]];
    for (let i = 0; i < pts.length - 1; i++) {
      g.lineBetween(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
    // 趋势点
    g.fillStyle(0x97c459, 1);
    pts.forEach(p => g.fillCircle(p[0], p[1], 1.5));
    // 底部状态条 4 个数字
    for (let i = 0; i < 4; i++) {
      const cx = x - 60 + i * 40;
      g.fillStyle(0xafa9ec, 0.6);
      g.fillRect(cx, y + 14, 28, 4);
    }
  }

  /** 中央桌：数据笔记 (走廊正中 · 占 terminalX/Y) */
  private drawTerminal(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 桌面 (暖木)
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x - 50, y - 18, 100, 36);
    g.fillStyle(0xa0673b, 1);
    g.fillRect(x - 48, y - 16, 96, 32);
    // 笔记本电脑 (打开)
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 24, y - 12, 48, 22);
    g.fillStyle(0x1a1024, 1);
    g.fillRect(x - 22, y - 10, 44, 18);
    // 屏幕：数据图表
    // 左：紫色柱 3 根
    g.fillStyle(0x7857c0, 1);
    g.fillRect(x - 18, y, 3, 6);
    g.fillRect(x - 12, y - 4, 3, 10);
    g.fillRect(x - 6, y - 6, 3, 12);
    // 右：趋势线小图
    g.lineStyle(1, 0x97c459, 1);
    g.lineBetween(x + 2, y + 4, x + 8, y);
    g.lineBetween(x + 8, y, x + 14, y - 4);
    g.lineBetween(x + 14, y - 4, x + 20, y - 6);
    // 桌面右侧：咖啡杯
    g.fillStyle(0xfdf0cf, 1);
    g.fillCircle(x + 36, y - 4, 4);
    g.fillStyle(0x854f0b, 1);
    g.fillCircle(x + 36, y - 4, 2.5);
    // 桌脚
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(x - 48, y + 18, 4, 14);
    g.fillRect(x + 44, y + 18, 4, 14);
  }

  /** 服务器机架 (单个 · 走廊用 · 32×64px · 占 serverFarmX/Y 互动点指向最右那台) */
  private drawServerFarm(x: number, y: number) {
    const g = this.add.graphics();
    g.setDepth(2);
    // 机柜外壳 (暗灰)
    g.fillStyle(0x2c2c2a, 1);
    g.fillRect(x - 18, y - 36, 36, 72);
    g.lineStyle(1, 0x5f5e5a, 1);
    g.strokeRect(x - 18, y - 36, 36, 72);
    // 8 层服务器单元
    for (let i = 0; i < 8; i++) {
      const sy = y - 32 + i * 8;
      g.fillStyle(0x444441, 1);
      g.fillRect(x - 16, sy, 32, 6);
      // LED (紫/绿/橙 循环)
      const ledColor = (i % 3 === 0) ? 0xafa9ec : (i % 3 === 1 ? 0x97c459 : 0xef9f27);
      g.fillStyle(ledColor, 1);
      g.fillCircle(x - 12, sy + 3, 1);
      g.fillCircle(x - 8, sy + 3, 1);
      // 通风口
      g.lineStyle(1, 0x2c2c2a, 1);
      for (let v = 0; v < 3; v++) {
        g.lineBetween(x + v * 4, sy + 1, x + v * 4, sy + 5);
      }
    }
    // 顶部品牌条 (紫)
    g.fillStyle(0x7857c0, 1);
    g.fillRect(x - 18, y - 36, 36, 4);
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

  private triggerBoard() {
    EventBus.emit('show-dialogue', {
      name: '📊 KPI 大屏',
      lines: [
        '（紫框大屏 · 大数字 12K + 趋势线上扬）',
        '',
        '"12,000 ——这是 CUA 本月新增贡献条目数。"',
        '"上月 9,847 · 增长率 +21.8%。"',
        '',
        '"数据不会撒谎——但要看人怎么读。"',
        '（大屏右下角小字写着：每小时刷新一次）',
      ],
    });
  }

  private triggerTerminal() {
    EventBus.emit('show-dialogue', {
      name: '📓 数据笔记',
      lines: [
        '（桌上摊开的笔记本电脑显示着分析图）',
        '',
        '"读数据 · 不要从结论开始，从分布开始。"',
        '"找异常 · 比找规律更有价值。"',
        '"做对比 · 永远要有 baseline。"',
        '',
        '（咖啡杯旁还压着一份草稿）"周报 v3。"',
      ],
    });
  }

  private triggerServerFarm() {
    EventBus.emit('show-dialogue', {
      name: '🗄️ 服务器集群',
      lines: [
        '（左右各 2 排机柜 · LED 紫绿橙交替闪烁）',
        '',
        '"这是 CUA 数据基础设施。"',
        '"PostgreSQL 主从 / Redis 缓存 / ClickHouse 分析。"',
        '',
        '"——你玩游戏的每一次贡献，都在这里留下记录。"',
        '（紫灯持续亮 · 偶尔一下绿灯闪过）',
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
    const distBoard = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.bigBoardX, this.bigBoardY);
    const distTerm = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.terminalX, this.terminalY);
    const distFarm = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.serverFarmX, this.serverFarmY);

    if (distExit < 56) {
      this.exitHint.setPosition(this.exitX, this.exitY - 36).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.exit();
    } else if (distBoard < INTERACT_DISTANCE * 1.5) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看 KPI').setPosition(this.bigBoardX, this.bigBoardY + 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerBoard();
    } else if (distTerm < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看数据笔记').setPosition(this.terminalX, this.terminalY - 36).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerTerminal();
    } else if (distFarm < INTERACT_DISTANCE) {
      this.exitHint.setVisible(false);
      this.interactHint.setText('[E] 看服务器').setPosition(this.serverFarmX, this.serverFarmY - 50).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.triggerServerFarm();
    } else {
      this.exitHint.setVisible(false);
      this.interactHint.setVisible(false);
    }
  }
}
