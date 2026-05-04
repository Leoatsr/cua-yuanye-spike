import { presence, type RemotePlayerInfo } from './realtimePresence';
import { chatManager, type ChatMessage } from './chatStore';

/**
 * G1.0 · 假玩家 bots
 *
 * Bots 不真的连 Realtime——直接在 client 里模拟。
 * 通过 presence.injectFakePlayer 注入到本地远程玩家列表。
 */

const BOT_NAMES = [
  '🌸 春雨',
  '🍵 茶童',
  '📜 文谦',
  '🎋 竹雯',
  '⚱️ 陶清',
];

const BOT_FACES = [
  { hairstyle: 1, hair_color: 0, outfit_color: 1 }, // 短发黑红
  { hairstyle: 2, hair_color: 1, outfit_color: 2 }, // 中分棕绿
  { hairstyle: 3, hair_color: 2, outfit_color: 3 }, // 马尾金紫
  { hairstyle: 1, hair_color: 3, outfit_color: 0 }, // 短发灰蓝
  { hairstyle: 2, hair_color: 0, outfit_color: 1 }, // 中分黑红
];

// 中式古风句子库 - bots 随机说
const BOT_PHRASES = [
  '今日天气不错，适合赏花。',
  '听说北边来了位说书人。',
  '这茶香浓郁，可值二两银子。',
  '春花秋月，何时了。',
  '近来鱼市颇为热闹。',
  '哎，又错过了告示板的更新。',
  '诸位可见过那边的桃花？',
  '不知今夜可有月色。',
  '街角的包子铺真不赖。',
  '听闻议政高地有新提案。',
  '这镇子越来越热闹了。',
  '昨夜读书至三更，眼花了。',
  '不远处传来鸟鸣，甚是清雅。',
  '诸君，且共饮此茶。',
  '春雨绵绵，正是好景。',
  '听说东港口又来了商船。',
  '今日心情不错，要不要一起走走？',
  '我家那株梅花开得正好。',
];

const SCENE_NAMES: Record<string, string> = {
  Main: '萌芽镇',
  SproutCity: '共创之都',
  GovHill: '议政高地',
};

const SCENE_BOUNDS: Record<string, { minX: number; maxX: number; minY: number; maxY: number }> = {
  Main: { minX: 96, maxX: 800, minY: 96, maxY: 600 },
  // 其他 scene 的 bounds 在 G1.1 加
};

interface Bot {
  info: RemotePlayerInfo;
  // Wandering AI
  targetX: number;
  targetY: number;
  pauseUntil: number;
  speed: number;
}

class BotManager {
  // Public so App.tsx can check size for idempotent spawn
  public bots: Map<string, Bot> = new Map();
  private tickHandle: number | null = null;
  private chatTickHandle: number | null = null;
  private currentSceneKey: string | null = null;

  spawn(count: number, sceneKey: string): void {
    this.despawnAll();
    this.currentSceneKey = sceneKey;
    const bounds = SCENE_BOUNDS[sceneKey] ?? SCENE_BOUNDS['Main'];

    for (let i = 0; i < Math.min(count, BOT_NAMES.length); i++) {
      const id = `bot-${i}-${Math.random().toString(36).slice(2, 8)}`;
      const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
      const info: RemotePlayerInfo = {
        user_id: id,
        username: `bot_${i}`,
        display_name: BOT_NAMES[i],
        avatar_url: null,
        face: BOT_FACES[i],
        x, y, vx: 0, vy: 0, facing: 'down',
        last_seen: Date.now(),
        meta_ready: true,
      };
      const bot: Bot = {
        info,
        targetX: x,
        targetY: y,
        pauseUntil: 0,
        speed: 30 + Math.random() * 30,
      };
      this.bots.set(id, bot);
      presence.injectFakePlayer(info);

      // G2-A: emit system "进入" message after a small delay (so chat panel can be ready)
      const sceneName = SCENE_NAMES[sceneKey] ?? sceneKey;
      window.setTimeout(() => {
        const sysMsg: ChatMessage = {
          id: `sys-${id}-enter`,
          channel_type: 'world',
          channel_key: 'world',
          sender_id: 'system',
          sender_name: 'system',
          sender_avatar: null,
          sender_face: null,
          recipient_id: null,
          content: `${BOT_NAMES[i]} 进入了${sceneName}`,
          created_at: new Date().toISOString(),
        };
        chatManager.injectLocalMessage(sysMsg);
      }, 500 + i * 200);
    }

    // Movement tick
    if (this.tickHandle === null) {
      let lastTime = Date.now();
      this.tickHandle = window.setInterval(() => {
        const now = Date.now();
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        this.update(dt);
      }, 50);
    }

    // G2-A: chat tick (random bot says something every 90-150s)
    if (this.chatTickHandle === null) {
      this.chatTickHandle = window.setInterval(() => {
        this.maybeBotSpeaks();
      }, 30000); // check every 30s
    }
  }

  despawnAll(): void {
    for (const id of Array.from(this.bots.keys())) {
      presence.removeFakePlayer(id);
    }
    this.bots.clear();
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    if (this.chatTickHandle !== null) {
      window.clearInterval(this.chatTickHandle);
      this.chatTickHandle = null;
    }
  }

  private maybeBotSpeaks(): void {
    if (this.bots.size === 0) return;
    // 50% chance per 30s — average ~60s between bot messages
    if (Math.random() > 0.5) return;
    const botList = Array.from(this.bots.values());
    const bot = botList[Math.floor(Math.random() * botList.length)];
    const phrase = BOT_PHRASES[Math.floor(Math.random() * BOT_PHRASES.length)];
    const msg: ChatMessage = {
      id: `bot-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      channel_type: 'world',
      channel_key: 'world',
      sender_id: bot.info.user_id,
      sender_name: bot.info.display_name,
      sender_avatar: null,
      sender_face: bot.info.face,
      recipient_id: null,
      content: phrase,
      created_at: new Date().toISOString(),
    };
    chatManager.injectLocalMessage(msg);
  }

  private update(dt: number): void {
    if (!this.currentSceneKey) return;
    const bounds = SCENE_BOUNDS[this.currentSceneKey] ?? SCENE_BOUNDS['Main'];
    const now = Date.now();

    for (const bot of this.bots.values()) {
      const info = bot.info;

      if (now < bot.pauseUntil) {
        info.vx = 0;
        info.vy = 0;
        presence.updateFakePlayerPosition(info.user_id, {
          user_id: info.user_id,
          x: info.x, y: info.y, vx: 0, vy: 0, facing: info.facing,
        });
        continue;
      }

      const dx = bot.targetX - info.x;
      const dy = bot.targetY - info.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        // Reached target — pick new + maybe pause
        if (Math.random() < 0.6) {
          // 60% chance to pause
          bot.pauseUntil = now + 800 + Math.random() * 2400;
        }
        bot.targetX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        bot.targetY = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
        info.vx = 0;
        info.vy = 0;
      } else {
        const vx = (dx / dist) * bot.speed;
        const vy = (dy / dist) * bot.speed;
        info.x += vx * dt;
        info.y += vy * dt;
        info.vx = vx;
        info.vy = vy;
        // Set facing
        if (Math.abs(vx) > Math.abs(vy)) {
          info.facing = vx > 0 ? 'right' : 'left';
        } else {
          info.facing = vy > 0 ? 'down' : 'up';
        }
      }

      presence.updateFakePlayerPosition(info.user_id, {
        user_id: info.user_id,
        x: info.x, y: info.y, vx: info.vx, vy: info.vy, facing: info.facing,
      });
    }
  }
}

export const bots = new BotManager();

// Expose to window for debugging
declare global {
  interface Window {
    __bots?: BotManager;
  }
}
if (typeof window !== 'undefined') {
  window.__bots = bots;
}
