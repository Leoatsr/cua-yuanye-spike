/**
 * 审核员 + 申诉员 人物档案 · Codex 用
 *
 * Wave 3.B
 *
 * 数据来自 reviewers.ts + appealReviewers.ts 的代码注释 + voteFn 行为
 */

export interface ReviewerProfile {
  id: string;
  name: string;
  role: '审核员' | '申诉员';
  avatar: string;
  /** 性格 · 1 句 */
  personality: string;
  /** 评审风格 · 2-3 行 */
  style: string;
  /** 偏好 */
  preference: string;
  /** 投票延迟 */
  delayRange: string;
}

export const REVIEWER_PROFILES: ReviewerProfile[] = [
  {
    id: 'zhouming',
    name: '周明',
    role: '审核员',
    avatar: '🧑‍🏫',
    personality: '严谨 · 爱挑刺',
    style: '倾向打低自评 · 看重核心字段完整性 · 重视流派标签准确度',
    preference: '青睐"自评诚实"的玩家 · 不喜浮夸',
    delayRange: '60-90 秒',
  },
  {
    id: 'yanzhi',
    name: '严之',
    role: '审核员',
    avatar: '👨‍🔬',
    personality: '挑剔 · 重质感',
    style: '看不惯敷衍内容 · 翻译机器味重者直接 x0.5 · 高质量直接 x2.0',
    preference: '欣赏深度内容 · 痛恨抄袭与滥竽充数',
    delayRange: '40-70 秒',
  },
  {
    id: 'baihui',
    name: '白徽',
    role: '审核员',
    avatar: '👩‍🎓',
    personality: '稳健 · 标准',
    style: '严格按照规范打分 · 中规中矩 · 不易被打动也不轻易抠分',
    preference: '看重"达标"而非"超越"',
    delayRange: '30-60 秒',
  },
];

export const APPEAL_REVIEWER_PROFILES: ReviewerProfile[] = [
  {
    id: 'xiechen',
    name: '谢忱',
    role: '申诉员',
    avatar: '🧙',
    personality: '公正 · 中庸',
    style: '权衡证据 · 多数投合理值 · 偶尔偏向自评 · 不易被任一方左右',
    preference: '看重"事实"与"惯例"的平衡',
    delayRange: '50-80 秒',
  },
  {
    id: 'liming',
    name: '李明',
    role: '申诉员',
    avatar: '⚖',
    personality: '严苛 · 复审',
    style: '高度怀疑申诉 · 倾向维持原判 · 但若发现确凿证据也会上调',
    preference: '"原审核员的判断有其依据" · 申诉需有力证据',
    delayRange: '60-90 秒',
  },
  {
    id: 'suyan',
    name: '苏砚',
    role: '申诉员',
    avatar: '🧑‍⚖',
    personality: '宽厚 · 给机会',
    style: '倾向维持或上调 · 不下调 · 申诉员的"温情判官"',
    preference: '"既有勇气申诉 · 必有其理"',
    delayRange: '40-70 秒',
  },
];
