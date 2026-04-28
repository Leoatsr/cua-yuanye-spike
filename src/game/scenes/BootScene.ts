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

    // ---- Character spritesheets (Cute Fantasy: 6 cols × 10 rows of 32×32) ----
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

    // ---- Cat (16×16, 4 idle frames) ----
    this.load.spritesheet('cat', 'assets/sprites/cat.png', {
      frameWidth: 16, frameHeight: 16,
    });

    // ---- Ore (16×16 single image) ----
    this.load.image('ore', 'assets/sprites/ore.png');

    // ---- Tilemap ----
    this.load.image('tiles', 'assets/tilesets/tiles.png');
    this.load.tilemapTiledJSON('sproutown', 'assets/maps/sproutown.json');

    // ---- City tileset and map ----
    this.load.image('tiles-city', 'assets/tilesets/tiles-city.png');
    this.load.tilemapTiledJSON('sproutcity', 'assets/maps/sproutcity.json');

    // ---- Interior tilesets and maps ----
    this.load.image('tiles-interior', 'assets/tilesets/tiles-interior.png');
    this.load.tilemapTiledJSON('axiang-cottage', 'assets/maps/axiang-cottage.json');
    this.load.tilemapTiledJSON('librarian-library', 'assets/maps/librarian-library.json');
    this.load.tilemapTiledJSON('blacksmith-forge', 'assets/maps/blacksmith-forge.json');
    this.load.tilemapTiledJSON('baixiao-ju', 'assets/maps/baixiao-ju.json');

    // ---- Audio ----
    this.load.audio('bgm-village', 'assets/audio/bgm-village.mp3');
    this.load.audio('sfx-dialogue', 'assets/audio/sfx-dialogue.mp3');
  }

  create() {
    this.scene.start('Main');
  }
}
