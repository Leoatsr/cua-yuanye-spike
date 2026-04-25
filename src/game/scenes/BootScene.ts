import * as Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.on('progress', (p: number) => {
      // eslint-disable-next-line no-console
      console.log(`Loading: ${Math.round(p * 100)}%`);
    });

    // ---- Character sprites (Cute Fantasy: 6 cols × 10 rows of 32×32) ----
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 32, frameHeight: 32,
    });
    this.load.spritesheet('axiang', 'assets/sprites/npc-axiang.png', {
      frameWidth: 32, frameHeight: 32,
    });
    this.load.spritesheet('librarian', 'assets/sprites/npc-librarian.png', {
      frameWidth: 32, frameHeight: 32,
    });
    this.load.spritesheet('blacksmith', 'assets/sprites/npc-blacksmith.png', {
      frameWidth: 32, frameHeight: 32,
    });
    this.load.spritesheet('merchant', 'assets/sprites/npc-merchant.png', {
      frameWidth: 32, frameHeight: 32,
    });
    this.load.spritesheet('fisher', 'assets/sprites/npc-fisher.png', {
      frameWidth: 32, frameHeight: 32,
    });

    // ---- Tilemap ----
    this.load.image('tiles', 'assets/tilesets/tiles.png');
    this.load.tilemapTiledJSON('sproutown', 'assets/maps/sproutown.json');

    // ---- Audio ----
    this.load.audio('bgm-village', 'assets/audio/bgm-village.mp3');
    this.load.audio('sfx-dialogue', 'assets/audio/sfx-dialogue.mp3');
  }

  create() {
    this.scene.start('Main');
  }
}
