import * as Phaser from 'phaser';
import { NPC } from '../entities/NPC';
import { SignPost } from '../entities/SignPost';
import { EventBus } from '../EventBus';

const PLAYER_SPEED = 140;
const INTERACT_DISTANCE = 48;
const BGM_VOLUME = 0.3;
const SFX_VOLUME = 0.5;

interface Interactable {
  x: number;
  y: number;
  triggerDialogue: () => void;
  config: { name: string };
}

export class MainScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private eKey!: Phaser.Input.Keyboard.Key;
  private lastDirection: 'down' | 'left' | 'right' | 'up' = 'down';

  private npcs: NPC[] = [];
  private signposts: SignPost[] = [];
  private interactHint!: Phaser.GameObjects.Text;

  // BGM
  private bgm?: Phaser.Sound.BaseSound;
  private bgmStarted = false;

  // SFX
  private sfxDialogue?: Phaser.Sound.BaseSound;
  private sfxHandlerBound = false;

  constructor() {
    super('Main');
  }

  create() {
    // ---- Tilemap ----
    const map = this.make.tilemap({ key: 'sproutown' });
    const tileset = map.addTilesetImage('tiles', 'tiles');
    if (!tileset) {
      // eslint-disable-next-line no-console
      console.error('Failed to load tileset "tiles"');
      return;
    }

    const groundLayer = map.createLayer('Ground', tileset);
    const decorLayer = map.createLayer('Decorations', tileset);
    const obstacleLayer = map.createLayer('Obstacles', tileset);
    void groundLayer; void decorLayer;

    if (!obstacleLayer) {
      // eslint-disable-next-line no-console
      console.error('Failed to create one or more tile layers');
      return;
    }

    obstacleLayer.setCollisionByProperty({ collides: true });

    // Water also collides (set in map JSON)
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // ---- Animations ----
    const characterTextures = [
      'player', 'axiang', 'librarian', 'blacksmith', 'merchant', 'fisher',
    ];
    characterTextures.forEach((t) => this.createCharacterAnims(t));

    // ---- Player ----
    this.player = this.physics.add.sprite(
      Math.floor(map.widthInPixels / 2),
      Math.floor(map.heightInPixels / 2) + 32,
      'player',
      0
    );
    this.player.setCollideWorldBounds(true);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(12, 6).setOffset(10, 17);
    this.player.anims.play('player-idle-down');

    this.physics.add.collider(this.player, obstacleLayer);

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(2);

    // ---- Input ----
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.eKey = this.input.keyboard!.addKey('E');

    // ---- NPCs ----
    // Tile coords reminder: each tile is 32×32, so center of tile (tx, ty) is
    // at world coords (tx*32 + 16, ty*32 + 16).
    const tile = (tx: number, ty: number) => ({ x: tx * 32 + 16, y: ty * 32 + 16 });

    const npcConfigs = [
      // Axiang at his cottage door (tile row 5, just below the cottage at rows 3-4)
      {
        ...tile(13, 5),
        key: 'axiang', name: '老村长 · 阿降', texture: 'axiang',
        questId: 'axiang',
        facing: 'down' as const,
        dialogue: [
          '哦？又来了一位新朋友。',
          '欢迎来到萌芽镇——这是源野物语的第一站。',
          '这里的每个人，都是从这里开始的。',
          '不妨四处转转，跟大家聊聊？广场中央那块告示板也别错过。',
        ],
      },
      // Librarian at her library door
      {
        ...tile(21, 5),
        key: 'librarian', name: '图书管理员 · 蓁', texture: 'librarian',
        questId: 'librarian',
        facing: 'down' as const,
        dialogue: [
          '...',
          '（她抬起头，似乎在打量你）',
          '欢迎来到典籍阁。如果你需要安静的地方读书，这里随时为你开放。',
          '不过最近的书架空了几个格子... 似乎在等什么人来填上。',
        ],
      },
      // Blacksmith at his forge
      {
        ...tile(5, 14),
        key: 'blacksmith', name: '铁匠 · 老周', texture: 'blacksmith',
        questId: 'blacksmith',
        facing: 'right' as const,
        dialogue: [
          '哈哈哈！来啦小伙子！',
          '小心点，我这火炉一会儿烧得比晌午的太阳还旺！',
          '不过别紧张，今天没活儿。要不要看我打铁？',
          '...好吧，等炉子修好再说。这萌芽镇的工坊，刚刚搭起来呢。',
        ],
      },
      // Merchant at his stall
      {
        ...tile(15, 14),
        key: 'merchant', name: '商人 · 阿满', texture: 'merchant',
        questId: 'merchant',
        facing: 'down' as const,
        dialogue: [
          '哎呀，新面孔！来来来，看看我的货~',
          '（你环顾四周，发现摊位上空空如也）',
          '...嗯，最近货还在路上。预计下次更新到。',
          '不过我能告诉你一个秘密：这镇子上每个人，都有自己的故事。',
          '多跟他们聊聊。这里的"价值"，可不止用银两衡量。',
        ],
      },
      // Fisher at the pond
      {
        ...tile(24, 17),
        key: 'fisher', name: '钓鱼老人 · 默', texture: 'fisher',
        questId: 'fisher',
        facing: 'up' as const,  // looking at the pond
        dialogue: [
          '...',
          '（老人盯着水面，没有回头）',
          '"急的人，钓不到鱼。"',
          '"耐心，是这片土地最便宜、也最贵的东西。"',
          '...慢慢来吧，年轻人。',
        ],
      },
    ];

    npcConfigs.forEach((cfg) => {
      const npc = new NPC(this, cfg);
      this.physics.add.collider(this.player, npc);
      this.npcs.push(npc);
    });

    // ---- Signpost (interactive bulletin board) ----
    const signpostConfig = {
      ...tile(11, 11),
      name: '萌芽镇 · 告示板',
      questId: 'signpost',
      dialogue: [
        '【萌芽镇 · 公告板】',
        '欢迎来到 CUA 源野物语！',
        '这是一个还在搭建中的小镇——每天都有新的角色加入。',
        '想成为镇民的一员？听说要先和老村长阿降聊聊。',
        '近期计划：开放典籍阁、铁匠铺、杂货铺、湖边钓鱼任务。',
        '— 萌芽镇议事会',
      ],
    };
    this.signposts.push(new SignPost(this, signpostConfig));

    // ---- Interact hint ----
    this.interactHint = this.add
      .text(0, 0, '[E] 互动', {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { left: 4, right: 4, top: 2, bottom: 2 },
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth(100);

    // ---- BGM ----
    if (this.cache.audio.exists('bgm-village')) {
      this.bgm = this.sound.add('bgm-village', {
        loop: true,
        volume: BGM_VOLUME,
      });

      // Listen for the title screen's "start-bgm" event.
      // The user has clicked through the title, audio context is unlocked.
      const onStartBgm = () => this.tryStartBgm();
      EventBus.on('start-bgm', onStartBgm);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        EventBus.off('start-bgm', onStartBgm);
      });
    }

    // ---- SFX: dialogue tick ----
    if (this.cache.audio.exists('sfx-dialogue')) {
      this.sfxDialogue = this.sound.add('sfx-dialogue', { volume: SFX_VOLUME });
    }

    // Listen to dialogue events from React, play SFX on each line advance
    if (!this.sfxHandlerBound) {
      EventBus.on('dialogue-advance', this.playDialogueSfx, this);
      this.sfxHandlerBound = true;
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('dialogue-advance', this.playDialogueSfx, this);
      this.sfxHandlerBound = false;
    });
  }

  private playDialogueSfx() {
    if (this.sfxDialogue && !this.sfxDialogue.isPlaying) {
      this.sfxDialogue.play();
    } else if (this.sfxDialogue) {
      // Allow overlapping plays if user clicks fast
      this.sound.play('sfx-dialogue', { volume: SFX_VOLUME });
    }
  }

  private tryStartBgm() {
    if (this.bgmStarted || !this.bgm) return;
    this.bgm.play();
    this.bgmStarted = true;
  }

  private createCharacterAnims(textureKey: string) {
    const animations: Array<{ name: string; start: number; end: number; rate: number }> = [
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
        frames: this.anims.generateFrameNumbers(textureKey, {
          start: a.start, end: a.end,
        }),
        frameRate: a.rate,
        repeat: -1,
      });
    });
  }

  /**
   * Find the closest interactable (NPC or signpost) within range.
   */
  private findClosestInteractable(): Interactable | null {
    let closest: Interactable | null = null;
    let closestDist = INTERACT_DISTANCE;

    const candidates: Interactable[] = [
      ...this.npcs,
      ...this.signposts,
    ];

    for (const c of candidates) {
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, c.x, c.y
      );
      if (d < closestDist) {
        closestDist = d;
        closest = c;
      }
    }
    return closest;
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

    if (vx !== 0 && vy !== 0) {
      vx *= 0.707; vy *= 0.707;
    }

    this.player.setVelocity(vx, vy);

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

    // ---- Proximity check (any NPC or signpost) ----
    const closest = this.findClosestInteractable();
    if (closest) {
      this.interactHint
        .setPosition(closest.x, closest.y - 28)
        .setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        closest.triggerDialogue();
      }
    } else {
      this.interactHint.setVisible(false);
    }
  }
}
