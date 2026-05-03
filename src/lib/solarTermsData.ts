/**
 * 24 节气数据 · 含描述
 *
 * Wave 3.B
 * 节气名字来自 timeStore.ts SOLAR_TERMS · 这里加描述
 */

export type Season = '春' | '夏' | '秋' | '冬';

export interface SolarTermDef {
  name: string;
  season: Season;
  /** 1-2 句的诗意描述 */
  desc: string;
  /** 物候特征 */
  feature: string;
  /** emoji 图标 */
  icon: string;
}

export const SOLAR_TERMS: SolarTermDef[] = [
  // 春
  { name: '立春', season: '春', desc: '万物起于始 · 草木欲萌发', feature: '东风解冻 · 蛰虫始振', icon: '🌱' },
  { name: '雨水', season: '春', desc: '润物细无声 · 春雨贵如油', feature: '獭祭鱼 · 鸿雁北归', icon: '💧' },
  { name: '惊蛰', season: '春', desc: '春雷惊百虫 · 万物复苏', feature: '桃始华 · 仓庚鸣', icon: '⚡' },
  { name: '春分', season: '春', desc: '昼夜均而寒暑平 · 燕子归来', feature: '玄鸟至 · 雷乃发声', icon: '🌸' },
  { name: '清明', season: '春', desc: '气清景明 · 万物皆显', feature: '桐始华 · 田鼠化鴽', icon: '🌿' },
  { name: '谷雨', season: '春', desc: '雨生百谷 · 春耕正当时', feature: '萍始生 · 鸣鸠拂羽', icon: '🌾' },
  // 夏
  { name: '立夏', season: '夏', desc: '万物至此皆长大 · 蛙鸣初闻', feature: '蝼蝈鸣 · 蚯蚓出', icon: '☀' },
  { name: '小满', season: '夏', desc: '麦穗渐满未盈 · 物盛而未极', feature: '苦菜秀 · 靡草死', icon: '🌽' },
  { name: '芒种', season: '夏', desc: '有芒之谷可种 · 农忙时节', feature: '螳螂生 · 鵙始鸣', icon: '🌾' },
  { name: '夏至', season: '夏', desc: '日永星火 · 阳气至极', feature: '鹿角解 · 蝉始鸣', icon: '🌞' },
  { name: '小暑', season: '夏', desc: '温风至 · 蟋蟀居壁', feature: '温风至 · 蟋蟀居壁', icon: '🔥' },
  { name: '大暑', season: '夏', desc: '盛暑炎热 · 一年最热时', feature: '腐草为萤 · 土润溽暑', icon: '🌡' },
  // 秋
  { name: '立秋', season: '秋', desc: '凉风至 · 暑气将退', feature: '凉风至 · 白露降', icon: '🍂' },
  { name: '处暑', season: '秋', desc: '暑气止于此 · 秋意渐浓', feature: '鹰乃祭鸟 · 天地始肃', icon: '🌾' },
  { name: '白露', season: '秋', desc: '露凝而白 · 秋夜渐凉', feature: '鸿雁来 · 玄鸟归', icon: '💎' },
  { name: '秋分', season: '秋', desc: '昼夜均寒暑平 · 月圆桂香', feature: '雷始收声 · 蛰虫坯户', icon: '🍁' },
  { name: '寒露', season: '秋', desc: '露气寒冽 · 将凝为霜', feature: '鸿雁来宾 · 雀入大水为蛤', icon: '❄' },
  { name: '霜降', season: '秋', desc: '气肃而凝 · 露结为霜', feature: '豺乃祭兽 · 草木黄落', icon: '🍂' },
  // 冬
  { name: '立冬', season: '冬', desc: '万物收藏 · 入闭藏之时', feature: '水始冰 · 地始冻', icon: '🥬' },
  { name: '小雪', season: '冬', desc: '寒未深 · 雪未大', feature: '虹藏不见 · 闭塞而成冬', icon: '🌨' },
  { name: '大雪', season: '冬', desc: '至此而雪盛 · 天地冰封', feature: '鹖鴠不鸣 · 虎始交', icon: '❄' },
  { name: '冬至', season: '冬', desc: '阴极阳生 · 一年至寒', feature: '蚯蚓结 · 麋角解', icon: '☃' },
  { name: '小寒', season: '冬', desc: '寒气始至未达极 · 三九严寒', feature: '雁北乡 · 鹊始巢', icon: '🥶' },
  { name: '大寒', season: '冬', desc: '寒气最盛 · 一年最冷时', feature: '鸡乳 · 征鸟厉疾', icon: '🧊' },
];

export const SEASON_TONE: Record<Season, 'spring' | 'gold' | 'jade' | ''> = {
  春: 'spring',
  夏: 'gold',
  秋: '',
  冬: 'jade',
};

export const SEASON_BG: Record<Season, string> = {
  春: 'rgba(127, 192, 144, 0.15)',  // 嫩绿
  夏: 'rgba(218, 165, 32, 0.15)',   // 金黄
  秋: 'rgba(166, 70, 52, 0.15)',    // 橙红
  冬: 'rgba(144, 192, 224, 0.15)',  // 浅蓝
};
