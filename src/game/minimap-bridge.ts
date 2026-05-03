/**
 * Minimap Bridge (Wave 7.K · 真实化小地图)
 *
 * 用法：每个 scene 在 create() 末尾加一行：
 *   attachMinimap(this, 'MainScene');
 *
 * 然后该 scene 每 200ms 自动 emit 'minimap-update' 给 React HUD。
 * 不修改 scene 业务逻辑 · 通过 events.on('postupdate') 钩子。
 */
import * as Phaser from 'phaser';
import { EventBus } from './EventBus';

export interface Landmark {
  x: number;       // 世界坐标 px (会自动转 %)
  y: number;
  w: number;
  h: number;
  color: string;
  label?: string;  // 短标签 (1-2 字)
}

export interface MinimapPayload {
  sceneName: string;     // 显示在 minimap 标题栏
  worldWidth: number;    // 世界 px 宽 (用于算 % 坐标)
  worldHeight: number;
  player: { x: number; y: number };
  landmarks: Landmark[];
  road?: { y: number; color?: string };  // 横向路 (萌芽镇有)
}

// ============ 各 scene 的 landmarks 配置 ============

/**
 * MainScene (萌芽镇 · sproutown.json · 30x20 tiles · 32px)
 * 世界尺寸：960 × 640
 * 玩家从这里出发 · 进家 / 进共创之都 / 进 8 工坊 (跳到 SproutCity)
 *
 * 关键地标 (基于 sproutown.json tilemap 的大致位置)：
 * - 家 · 西北
 * - 通往共创之都门 · 北中
 * - 几个 NPC 屋子
 * - 中央广场
 */
const MAINSCENE_LANDMARKS: Landmark[] = [
  // 家 (左上角)
  { x: 96,  y: 128, w: 96, h: 96, color: '#daa520', label: '家' },
  // 通往共创之都 (北中央 · 进城门)
  { x: 432, y: 32,  w: 96, h: 64, color: '#8b4513', label: '城' },
  // 几个 NPC 屋子 (右半)
  { x: 640, y: 192, w: 64, h: 64, color: '#cd853f' },
  { x: 768, y: 320, w: 64, h: 64, color: '#cd853f' },
  // 集市广场 (中央偏南)
  { x: 416, y: 384, w: 128, h: 96, color: '#a0522d', label: '市' },
];

const MAINSCENE_ROAD = { y: 280, color: '#8b6f4a' };  // 中横道

/**
 * SproutCityScene (共创之都 · sproutcity.json · 40x30 tiles · 32px)
 * 世界尺寸：1280 × 960
 * 9 工坊位置 (从 SproutCityScene.ts 的 WORKSHOPS 推断 · 基于 doorTile 大致位置)
 */
const SPROUTCITY_LANDMARKS: Landmark[] = [
  // 共创板块 3 工坊 (上)
  { x: 5*32,  y: 6*32,  w: 96, h: 64, color: '#8b5a2b',  label: '开源' },
  { x: 33*32, y: 6*32,  w: 96, h: 64, color: '#bfa66a',  label: '测评' },
  { x: 19*32, y: 26*32, w: 96, h: 64, color: '#3b6d11',  label: '生态' },
  // 降噪板块 3 工坊
  { x: 19*32, y: 6*32,  w: 96, h: 64, color: '#c0392b',  label: '播客' },
  { x: 33*32, y: 14*32, w: 96, h: 64, color: '#7857c0',  label: '数据' },
  { x: 33*32, y: 23*32, w: 96, h: 64, color: '#5a5550',  label: '内参' },
  // 降噪板块 · 百科
  { x: 19*32, y: 23*32, w: 96, h: 64, color: '#2e6cb8',  label: '百科' },
  // 链接板块 2 工坊
  { x: 5*32,  y: 14*32, w: 96, h: 64, color: '#daa520',  label: '招聘' },
  { x: 5*32,  y: 23*32, w: 96, h: 64, color: '#1d9e75',  label: '会议' },
  // 中央喷泉
  { x: 19*32, y: 14*32, w: 64, h: 64, color: '#85b7eb',  label: '泉' },
];

/**
 * HomeScene (家 · home.json · 20x15 tiles · 32px)
 * 世界尺寸：640 × 480 (估)
 * 简单房间 · 主要是玩家可见
 */
const HOME_LANDMARKS: Landmark[] = [
  // 床
  { x: 96,  y: 96,  w: 96, h: 64, color: '#a0522d', label: '床' },
  // 餐桌
  { x: 320, y: 192, w: 96, h: 64, color: '#cd853f' },
  // 出口 (南墙门)
  { x: 304, y: 416, w: 32, h: 32, color: '#5d3a1a', label: '门' },
];

// ============ Scene name → landmarks 映射 ============

const LANDMARKS_BY_SCENE: Record<string, Landmark[]> = {
  MainScene: MAINSCENE_LANDMARKS,
  SproutCity: SPROUTCITY_LANDMARKS,
  HomeScene: HOME_LANDMARKS,
};

const ROADS_BY_SCENE: Record<string, { y: number; color?: string }> = {
  MainScene: MAINSCENE_ROAD,
};

const DISPLAY_NAME_BY_SCENE: Record<string, string> = {
  MainScene: '萌芽镇',
  SproutCity: '共创之都',
  HomeScene: '家',
  KaiyuanLou: '开源工坊',
  ShengwenTai: '播客工坊',
  DuliangGe: '测评工坊',
  YincaiFang: '招聘工坊',
  SisuanSuo: '数据工坊',
  YishiTing: '会议工坊',
  WangqiLou: '内参工坊',
  GongdeTang: '生态工坊',
  InteriorScene: '室内',
  GovHill: '政务山',
  VisionTower: '望气塔',
  CouncilHall: '议政厅',
  MirrorPavilion: '镜阁',
  GrandPlaza: '大广场',
};

// ============ 主 attach 函数 ============

const THROTTLE_MS = 200;  // 每 200ms emit 一次 · 5fps 给 minimap 够用

/**
 * 在 scene 的 create() 末尾调用：
 *   attachMinimap(this, 'MainScene');
 *
 * 它会注册一个 'postupdate' 钩子 · 每 200ms 自动 emit 'minimap-update' 事件给 React HUD。
 * 不需要改 scene 的 update() 业务逻辑。
 */
export function attachMinimap(scene: Phaser.Scene, sceneName: string): void {
  let lastEmit = 0;

  // 即时 emit 一次 (玩家刚进 scene 就该看到正确的图)
  setTimeout(() => emitOnce(scene, sceneName), 50);

  scene.events.on('postupdate', () => {
    const now = scene.time.now;
    if (now - lastEmit < THROTTLE_MS) return;
    lastEmit = now;
    emitOnce(scene, sceneName);
  });

  // scene shutdown 时不需要 .off · 因为 scene.events 会自己清理 (Phaser 内置行为)
}

function emitOnce(scene: Phaser.Scene, sceneName: string): void {
  // 通过 (scene as any).player 拿玩家 · 因为各 scene 的 player 类型不一致
  const player = (scene as any).player as Phaser.Physics.Arcade.Sprite | undefined;
  if (!player) return;

  // 世界尺寸：优先 physics.world.bounds · 兜底 cameras.main.bounds
  const bounds = scene.physics?.world?.bounds;
  const worldWidth = bounds?.width || scene.cameras.main.width;
  const worldHeight = bounds?.height || scene.cameras.main.height;

  const landmarks = LANDMARKS_BY_SCENE[sceneName] || [];
  const road = ROADS_BY_SCENE[sceneName];
  const displayName = DISPLAY_NAME_BY_SCENE[sceneName] || sceneName;

  const payload: MinimapPayload = {
    sceneName: displayName,
    worldWidth,
    worldHeight,
    player: { x: player.x, y: player.y },
    landmarks,
    ...(road && { road }),
  };

  EventBus.emit('minimap-update', payload);
}
