import * as Phaser from 'phaser';
import { NPC } from '../entities/NPC';
import { EventBus } from '../EventBus';
import { setupMultiplayer, facingFromVelocity, type MultiplayerHandle } from './multiplayerHelper';

const PLAYER_SPEED = 140;
const INTERACT_DISTANCE = 48;

/**
 * Configuration for one interior building.
 * Define one of these per cottage you want to make enterable.
 */
export interface InteriorConfig {
  /** Key matching the Tiled JSON loaded in BootScene (e.g. 'axiang-cottage') */
  mapKey: string;
  /** Tileset key — interior tilesets share one image */
  tilesetKey: string;          // 'tiles-interior'
  tilesetName: string;         // 'tiles-interior'
  /** Where the player appears when entering (in tile coords) */
  spawnTileX: number;
  spawnTileY: number;
  /** The exit tile range — when player walks onto these tiles, can press E to leave */
  exitTileX: number;
  exitTileY: number;
  /** Display name (shown in dialogue if any) */
  displayName: string;
  /** NPC configs — each gets created when the scene starts */
  npcs: Array<{
    textureKey: string;
    name: string;
    questId?: string;
    tileX: number;
    tileY: number;
    facing?: 'down' | 'up' | 'left' | 'right';
    dialogue: string[] | (() => string[]);
  }>;
}

interface SceneInitData {
  config: InteriorConfig;
  /** World coords to return to when exiting */
  returnX: number;
  returnY: number;
  /** Which scene to return to. Defaults to 'Main' for backward compatibility. */
  returnSceneKey?: 'Main' | 'SproutCity';
}

interface Interactable {
  x: number;
  y: number;
  triggerDialogue: () => void;
}

export class InteriorScene extends Phaser.Scene {
  private config!: InteriorConfig;
  private returnX!: number;
  private returnY!: number;
  private returnSceneKey: 'Main' | 'SproutCity' = 'Main';

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
  private jKey!: Phaser.Input.Keyboard.Key;
  private kKey!: Phaser.Input.Keyboard.Key;
  private lastDirection: 'down' | 'left' | 'right' | 'up' = 'down';

  private npcs: NPC[] = [];
  private interactHint!: Phaser.GameObjects.Text;
  private exitHint!: Phaser.GameObjects.Text;

  // Exit zone — when player is near, can press E to leave.
  // We compute this from config.exitTile{X,Y} on init.
  private exitWorldX = 0;
  private exitWorldY = 0;

  // SFX (re-bind in each scene)
  private sfxHandlerBound = false;

  // Lock input briefly after entering to avoid the same E press triggering exit
  private inputLockUntil = 0;

  constructor() {
    super('Interior');
  }

  init(data: SceneInitData) {
    this.config = data.config;
    this.returnX = data.returnX;
    this.returnY = data.returnY;
    this.returnSceneKey = data.returnSceneKey ?? 'Main';
    // Lock input for 200ms after entering (avoid the same E press registered twice)
    this.inputLockUntil = 0; // will be set in create() using time.now
    // Reset state for re-entry
    this.npcs = [];
  }

  create() {
    this.inputLockUntil = this.time.now + 250;

    // ---- Tilemap ----
    const map = this.make.tilemap({ key: this.config.mapKey });
    const tileset = map.addTilesetImage(this.config.tilesetName, this.config.tilesetKey);
    if (!tileset) {
      console.error(`Failed to load tileset ${this.config.tilesetName}`);
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

    // ---- Animations ----
    // Player anims should already exist (created in MainScene), but in case
    // someone enters interior first without going through main, recreate.
    const characterTextures = ['player'];
    this.config.npcs.forEach((n) => characterTextures.push(n.textureKey));
    characterTextures.forEach((t) => this.createCharacterAnims(t));

    // ---- Player ----
    const spawnX = this.config.spawnTileX * 32 + 16;
    const spawnY = this.config.spawnTileY * 32 + 16;
    this.player = this.physics.add.sprite(spawnX, spawnY, 'player', 0);
    this.player.setCollideWorldBounds(true);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(12, 6).setOffset(10, 17);
    this.player.anims.play('player-idle-down');
    this.physics.add.collider(this.player, obstacleLayer);

    // ---- Camera ----
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    // G1.1 · Multiplayer (via helper)
    this.mp = setupMultiplayer(this, 'Interior', () => this.player, () => this.currentFacing);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(2);
    // Fade in
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // ---- Input ----
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.eKey = this.input.keyboard!.addKey('E');
    this.jKey = this.input.keyboard!.addKey('J');
    this.kKey = this.input.keyboard!.addKey('K');

    // ---- NPCs ----
    this.config.npcs.forEach((npcCfg) => {
      const npc = new NPC(this, {
        key: npcCfg.textureKey,
        name: npcCfg.name,
        x: npcCfg.tileX * 32 + 16,
        y: npcCfg.tileY * 32 + 16,
        texture: npcCfg.textureKey,
        questId: npcCfg.questId,
        dialogue: npcCfg.dialogue,
        facing: npcCfg.facing ?? 'down',
      });
      this.physics.add.collider(this.player, npc);
      this.npcs.push(npc);
    });

    // ---- Exit position ----
    this.exitWorldX = this.config.exitTileX * 32 + 16;
    this.exitWorldY = this.config.exitTileY * 32 + 16;

    // ---- Hints ----
    this.interactHint = this.add
      .text(0, 0, '[E] 互动', {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: '#ffffff', backgroundColor: '#000000aa',
        padding: { left: 4, right: 4, top: 2, bottom: 2 },
      }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.exitHint = this.add
      .text(0, 0, '[E] 离开', {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: '#ffffff', backgroundColor: '#5a3020dd',
        padding: { left: 6, right: 6, top: 3, bottom: 3 },
      }).setOrigin(0.5).setVisible(false).setDepth(100);

    // ---- SFX bridging (dialogue tick still works in interior) ----
    if (!this.sfxHandlerBound && this.cache.audio.exists('sfx-dialogue')) {
      EventBus.on('dialogue-advance', this.playDialogueSfx, this);
      this.sfxHandlerBound = true;
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('dialogue-advance', this.playDialogueSfx, this);
      this.sfxHandlerBound = false;
    });
  }

  private playDialogueSfx() {
    this.sound.play('sfx-dialogue', { volume: 0.5 });
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

  private exitToOutdoor() {
    // Fade out and switch back to MainScene
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(this.returnSceneKey, { returnX: this.returnX, returnY: this.returnY });
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

    // Animation
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
    if (this.time.now < this.inputLockUntil) return;

    // ---- J key opens quest log ----
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) {
      EventBus.emit('open-quest-log');
    }

    // ---- K key opens mailbox ----
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) {
      EventBus.emit('open-mailbox');
    }

    // ---- Check for exit proximity ----
    const distToExit = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, this.exitWorldX, this.exitWorldY
    );
    const nearExit = distToExit < 36;

    // ---- Check for NPC interactions ----
    const closestNpc = this.findClosestInteractable();

    // Exit takes precedence over NPCs (so the door mat works even if an NPC is nearby)
    if (nearExit) {
      this.exitHint.setPosition(this.exitWorldX, this.exitWorldY - 28).setVisible(true);
      this.interactHint.setVisible(false);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        this.exitToOutdoor();
      }
    } else if (closestNpc) {
      this.exitHint.setVisible(false);
      this.interactHint.setPosition(closestNpc.x, closestNpc.y - 28).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        closestNpc.triggerDialogue();
      }
    } else {
      this.interactHint.setVisible(false);
      this.exitHint.setVisible(false);
    }
  }
}
