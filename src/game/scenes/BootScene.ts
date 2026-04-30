import * as Phaser from 'phaser';

/**
 * BootScene · 资源预加载 + 路由调度
 *
 * Wave 4.B 升级:
 *   ✅ 解析 URL query string ?scene=XXX
 *   ✅ 检查 scene key 合法性（白名单）
 *   ✅ 切到目标 scene · 否则默认 Main
 *   ✅ 清掉 query string（避免刷新重复触发）
 */

// 合法 scene key 白名单（只允许跳转到这些 · 防止恶意 URL）
const VALID_SCENE_KEYS = new Set([
  'Main',
  'SproutCity',
  'GovHill',
  'GrandPlaza',
]);

const DEFAULT_SCENE = 'Main';

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
    const targetScene = this.resolveTargetScene();
    this.scene.start(targetScene);
  }

  /**
   * 解析 URL query string ?scene=XXX
   *
   * 流程:
   *   1. 读 window.location.search 拿 scene 参数
   *   2. 验证是否在白名单
   *   3. 清掉 query string（避免刷新重复触发）
   *   4. 返回目标 scene key（默认 'Main'）
   */
  private resolveTargetScene(): string {
    if (typeof window === 'undefined') return DEFAULT_SCENE;

    try {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('scene');

      if (!requested) return DEFAULT_SCENE;

      // 白名单验证
      if (!VALID_SCENE_KEYS.has(requested)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[BootScene] Invalid scene key in URL: "${requested}" · falling back to ${DEFAULT_SCENE}`,
        );
        this.clearQueryString();
        return DEFAULT_SCENE;
      }

      // eslint-disable-next-line no-console
      console.log(`[BootScene] Routing to scene from URL: ${requested}`);

      // 清 query string（用 history.replaceState · 避免刷新重复跳转）
      this.clearQueryString();

      return requested;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[BootScene] Failed to parse URL query:', err);
      return DEFAULT_SCENE;
    }
  }

  /**
   * 清掉 ?scene=XXX query string
   *
   * 用 history.replaceState · 不触发 React Router 重新渲染
   */
  private clearQueryString() {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('scene');
      window.history.replaceState({}, '', url.toString());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[BootScene] Failed to clear query string:', err);
    }
  }
}
