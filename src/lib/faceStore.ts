import { getSupabase } from './supabase';
import { reportError } from './sentry';
import { EventBus } from '../game/EventBus';

/**
 * F6.0 · 捏脸数据存储
 *
 * 3 个维度，每维度 4 个选项：
 *   - hairstyle:    0=无 (光头) / 1=短发 / 2=中分 / 3=马尾
 *   - hair_color:   0=黑 / 1=棕 / 2=金 / 3=灰
 *   - outfit_color: 0=蓝 / 1=红 / 2=绿 / 3=紫
 *
 * 默认值 (0,0,0) = 光头黑发蓝衣
 * 4 × 4 × 4 = 64 种组合
 */

export interface FaceData {
  hairstyle: 0 | 1 | 2 | 3;
  hair_color: 0 | 1 | 2 | 3;
  outfit_color: 0 | 1 | 2 | 3;
}

export const DEFAULT_FACE: FaceData = {
  hairstyle: 1,        // 默认短发（不要默认光头）
  hair_color: 0,       // 黑发
  outfit_color: 0,     // 蓝衣
};

// ----- Visual definitions -----

export const HAIRSTYLE_NAMES = ['光头', '短发', '中分', '马尾'] as const;
export const HAIR_COLOR_NAMES = ['黑', '棕', '金', '灰'] as const;
export const OUTFIT_COLOR_NAMES = ['蓝', '红', '绿', '紫'] as const;

// Hex colors for hair (used in Phaser graphics)
export const HAIR_COLOR_HEX: number[] = [
  0x2a1810,  // 黑
  0x6b3a18,  // 棕
  0xe0b860,  // 金
  0xc0c0c0,  // 灰
];

// Tint values for outfit (Phaser sprite tint)
export const OUTFIT_TINT_HEX: number[] = [
  0xffffff,  // 蓝（无 tint，保持原色 — sprite 默认蓝衣）
  0xff8888,  // 红
  0x88dd88,  // 绿
  0xc88aff,  // 紫
];

// ----- Storage -----

const LS_KEY = 'cua-yuanye-face-v1';

interface FaceCache {
  data: FaceData;
  userId: string;
}

function readLocal(userId: string): FaceData | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as FaceCache;
    if (cache.userId !== userId) return null;
    return cache.data;
  } catch {
    return null;
  }
}

function writeLocal(userId: string, data: FaceData) {
  try {
    const cache: FaceCache = { data, userId };
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/**
 * Get face from local cache, falling back to default if not set.
 * Synchronous — uses localStorage only.
 */
export function getFaceLocal(): FaceData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_FACE;
    const cache = JSON.parse(raw) as FaceCache;
    return cache.data ?? DEFAULT_FACE;
  } catch {
    return DEFAULT_FACE;
  }
}

/**
 * Fetch face from cloud + sync to local. Returns merged result.
 */
export async function fetchUserFace(): Promise<FaceData> {
  const supabase = getSupabase();
  if (!supabase) return getFaceLocal();

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return getFaceLocal();

  // Local first (instant)
  const local = readLocal(userId);

  // Cloud (async)
  try {
    const { data, error } = await supabase
      .from('user_faces')
      .select('hairstyle, hair_color, outfit_color')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      reportError('fetch-user-face', error);
      return local ?? DEFAULT_FACE;
    }
    if (!data) return local ?? DEFAULT_FACE;
    const cloudFace: FaceData = {
      hairstyle: data.hairstyle as 0 | 1 | 2 | 3,
      hair_color: data.hair_color as 0 | 1 | 2 | 3,
      outfit_color: data.outfit_color as 0 | 1 | 2 | 3,
    };
    writeLocal(userId, cloudFace);
    return cloudFace;
  } catch (err) {
    reportError('fetch-user-face', err);
    return local ?? DEFAULT_FACE;
  }
}

/**
 * Save face — local + cloud. Emits 'face-updated' event.
 */
export async function saveUserFace(face: FaceData): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: '请先登录' };
  }
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: '请先登录' };
  }

  // Local immediately
  writeLocal(userId, face);
  EventBus.emit('face-updated', face);

  // Cloud (best-effort)
  try {
    const { error } = await supabase.from('user_faces').upsert({
      user_id: userId,
      hairstyle: face.hairstyle,
      hair_color: face.hair_color,
      outfit_color: face.outfit_color,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      reportError('save-user-face', error);
      return { ok: false, error: `云同步失败：${error.message}` };
    }
    return { ok: true };
  } catch (err) {
    reportError('save-user-face', err);
    return { ok: false, error: '云同步失败' };
  }
}
