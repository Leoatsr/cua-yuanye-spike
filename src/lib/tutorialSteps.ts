/**
 * 互动教程 24 step 定义
 *
 * 全部激活 (Pub 2a/2b/2c/2d 累计完成):
 *   - 第 1 章 · 基本控制 (1-5)
 *   - 第 2 章 · 萌芽镇探索 (6-9)
 *   - 第 3 章 · 9 工坊初识 (10-13)
 *   - 第 4 章 · 任务工作流 (14-17)
 *   - 第 5 章 · 社交 (18-21)
 *   - 第 6 章 · 进阶 (22-24)
 *
 * 每个 step:
 *   - id: 数字 ID（持久化用）
 *   - chapter: 章节
 *   - title: 简短标题（toast 顶部）
 *   - hint: 详细提示（toast 内容）
 *   - highlight: 哪个 UI 元素发光（key 对应 TutorialOverlay 里的逻辑）
 *   - completion: 完成条件类型（详见 tutorialStore）
 *   - completionData: 完成条件参数
 *   - active: 是否启用（保留字段以备未来灵活控制）
 */

export type CompletionType =
  | 'event'              // 监听 EventBus 事件
  | 'event-with-data'    // 监听事件 + 数据匹配
  | 'movement'           // 监听玩家移动距离
  | 'position'           // 监听玩家到达位置
  | 'scene-change'       // 监听 scene 切换
  | 'manual';            // 玩家点"我已完成"

export type HighlightTarget =
  | 'announcement-button'
  | 'help-button'
  | 'emote-button'
  | 'top-hud'
  | 'chat-button'
  | 'none';

export interface TutorialStep {
  id: number;
  chapter: number;
  chapterName: string;
  title: string;
  hint: string;
  highlight: HighlightTarget;
  completion: CompletionType;
  completionData?: Record<string, unknown>;
  active: boolean; // 这一 pack 是否启用
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ============================================================================
  // 第 1 章 · 基本控制
  // ============================================================================
  {
    id: 1,
    chapter: 1,
    chapterName: '基本控制',
    title: '🚶 用 WASD 走 5 步',
    hint: '按 W A S D 键走动 — 这是探索源野的基本方式。走过试试后点"我已完成"',
    highlight: 'none',
    completion: 'manual',
    completionData: {},
    active: true,
  },
  {
    id: 2,
    chapter: 1,
    chapterName: '基本控制',
    title: '🎯 走到老村长高粱身边',
    hint: '萌芽镇里有一位老村长 — 走到他身边',
    highlight: 'none',
    completion: 'manual',
    completionData: {},
    active: true,
  },
  {
    id: 3,
    chapter: 1,
    chapterName: '基本控制',
    title: '💬 按 E 跟高粱对话',
    hint: '靠近 NPC 时按 E 键开始对话',
    highlight: 'none',
    completion: 'event',
    completionData: { eventName: 'show-dialogue' },
    active: true,
  },
  {
    id: 4,
    chapter: 1,
    chapterName: '基本控制',
    title: '📜 看公告板',
    hint: '点屏幕左下角的 📜 按钮看最新公告',
    highlight: 'announcement-button',
    completion: 'manual',
    completionData: {},
    active: true,
  },
  {
    id: 5,
    chapter: 1,
    chapterName: '基本控制',
    title: '❓ 看玩家手册',
    hint: '点屏幕右下角的 ? 按钮打开玩家手册',
    highlight: 'help-button',
    completion: 'manual',
    completionData: {},
    active: true,
  },

  // ============================================================================
  // 第 2 章 · 萌芽镇探索
  // ============================================================================
  {
    id: 6,
    chapter: 2,
    chapterName: '萌芽镇探索',
    title: '🚶 探索萌芽镇',
    hint: '在萌芽镇里随便走走，了解一下环境。看完后点"我已完成"',
    highlight: 'none',
    completion: 'manual',
    completionData: {},
    active: true,
  },
  {
    id: 7,
    chapter: 2,
    chapterName: '萌芽镇探索',
    title: '🤖 跟 NPC 玩家打招呼',
    hint: '萌芽镇里有 5 个 NPC（春雨/茶童/文谦/竹雯/陶清）— 走到他们身边按 E',
    highlight: 'none',
    completion: 'event',
    completionData: { eventName: 'show-dialogue' },
    active: true,
  },
  {
    id: 8,
    chapter: 2,
    chapterName: '萌芽镇探索',
    title: '🙏 用 /yi 表情拱手',
    hint: '点屏幕右下的 😀 按钮 → 选"拱手"，或在聊天框输入 /yi',
    highlight: 'emote-button',
    completion: 'event',
    completionData: { eventName: 'emote-triggered' },
    active: true,
  },
  {
    id: 9,
    chapter: 2,
    chapterName: '萌芽镇探索',
    title: '🌍 在世界聊天发"你好"',
    hint: '按 T 打开聊天框，输入"你好"按回车发送',
    highlight: 'top-hud',
    completion: 'event',
    completionData: { eventName: 'chat-message-received' },
    active: true,
  },

  // ============================================================================
  // 第 3 章 · 9 工坊初识
  // ============================================================================
  {
    id: 10,
    chapter: 3,
    chapterName: '9 工坊初识',
    title: '🗺️ 打开世界地图',
    hint: '按 M 键查看世界地图',
    highlight: 'none',
    completion: 'event',
    completionData: { eventName: 'open-world-map' },
    active: true,
  },
  {
    id: 11,
    chapter: 3,
    chapterName: '9 工坊初识',
    title: '🚪 走到开元楼前',
    hint: '萌芽镇里找到开元楼的入口',
    highlight: 'none',
    completion: 'manual',
    completionData: {},
    active: true,
  },
  {
    id: 12,
    chapter: 3,
    chapterName: '9 工坊初识',
    title: '🏛 进入开元楼',
    hint: '走进开元楼内部',
    highlight: 'none',
    completion: 'scene-change',
    completionData: { sceneKey: 'KaiyuanLou' },
    active: true,
  },
  {
    id: 13,
    chapter: 3,
    chapterName: '9 工坊初识',
    title: '💼 接第一个任务',
    hint: '在开元楼里找 NPC 接任务',
    highlight: 'none',
    completion: 'manual',
    completionData: {},
    active: true,
  },

  // ============================================================================
  // 第 4 章 · 任务工作流
  // ============================================================================
  {
    id: 14,
    chapter: 4,
    chapterName: '任务工作流',
    title: '📋 看任务日志',
    hint: '按 J 查看你接到的任务',
    highlight: 'none',
    completion: 'event',
    completionData: { eventName: 'open-quest-log' },
    active: true,
  },
  {
    id: 15,
    chapter: 4,
    chapterName: '任务工作流',
    title: '✅ 完成第一个任务',
    hint: '按任务说明完成任务并提交',
    highlight: 'none',
    completion: 'event',
    completionData: { eventName: 'quest-finalized' },
    active: true,
  },
  {
    id: 16,
    chapter: 4,
    chapterName: '任务工作流',
    title: '📬 看邮件',
    hint: '按 K 查看邮箱（任务结果会通过邮件通知你）',
    highlight: 'none',
    completion: 'event',
    completionData: { eventName: 'open-mailbox' },
    active: true,
  },
  {
    id: 17,
    chapter: 4,
    chapterName: '任务工作流',
    title: '🎖️ 注意 CV 余额变化',
    hint: '完成任务后会获得 CV — 看左上角 CV 数字',
    highlight: 'top-hud',
    completion: 'event',
    completionData: { eventName: 'cv-updated' },
    active: true,
  },

  // ============================================================================
  // 第 5 章 · 社交
  // ============================================================================
  {
    id: 18,
    chapter: 5,
    chapterName: '社交',
    title: '👤 编辑个人资料',
    hint: '按 P 完善你的个人资料 — 别人才能看到你',
    highlight: 'none',
    completion: 'event',
    completionData: { eventName: 'open-profile-panel' },
    active: true,
  },
  {
    id: 19,
    chapter: 5,
    chapterName: '社交',
    title: '🤝 看好友面板',
    hint: '按 F 打开好友面板 — 这里有好友 / 关注 / 粉丝',
    highlight: 'none',
    completion: 'event',
    completionData: { eventName: 'open-friends-panel' },
    active: true,
  },
  {
    id: 20,
    chapter: 5,
    chapterName: '社交',
    title: '⭐ 了解关注系统',
    hint: '在 F 面板的"⭐ 关注"tab — 后续遇到喜欢的玩家可以关注他们',
    highlight: 'none',
    completion: 'manual',
    completionData: {},
    active: true,
  },
  {
    id: 21,
    chapter: 5,
    chapterName: '社交',
    title: '🔔 看通知',
    hint: '按 N 查看通知（好友请求 / 任务结果都会推送）',
    highlight: 'top-hud',
    completion: 'event',
    completionData: { eventName: 'open-notifications' },
    active: true,
  },

  // ============================================================================
  // 第 6 章 · 进阶
  // ============================================================================
  {
    id: 22,
    chapter: 6,
    chapterName: '进阶',
    title: '📜 看任务历史',
    hint: '按 H 看你和全社区的任务历史',
    highlight: 'none',
    completion: 'event',
    completionData: { eventName: 'open-quest-history' },
    active: true,
  },
  {
    id: 23,
    chapter: 6,
    chapterName: '进阶',
    title: '🎉 持续做任务',
    hint: '再完成一个任务，向 L1（50 CV）迈进 — 持续贡献是核心循环',
    highlight: 'none',
    completion: 'event',
    completionData: { eventName: 'cv-updated' },
    active: true,
  },
  {
    id: 24,
    chapter: 6,
    chapterName: '进阶',
    title: '🏛 参观议政高地',
    hint: '高等级（L2+）可以去议政高地参与社区决策 — 先去看看',
    highlight: 'none',
    completion: 'scene-change',
    completionData: { sceneKey: 'GovHill' },
    active: true,
  },
];

export const ACTIVE_STEPS = TUTORIAL_STEPS.filter((s) => s.active);
export const TOTAL_STEP_COUNT = TUTORIAL_STEPS.length;
