/**
 * Reviewer pool — virtual submissions for the player to audit.
 *
 * In single-player spike, we pre-populate 5 virtual submissions from
 * fictional players. The player audits these; their vote is combined
 * with 2 AI reviewer votes to compute the median; player earns review CP.
 *
 * In multiplayer (Phase 3+), these virtual submissions will be replaced
 * with real submissions from other players' game instances.
 */

import { EventBus } from '../game/EventBus';
import { addCVEntry, computeFinalCoefficient } from './cv';
import { fireCloudWrite } from './cloudStore';

export type QualityCoeff = 0.5 | 1.0 | 2.0;

export interface VirtualSubmission {
  id: string;
  /** Submitter's display name */
  submitter: string;
  /** Which task the submitter did */
  taskId: string;
  taskTitle: string;
  workshop: string;
  /** Player's self-rated coefficient */
  selfRated: QualityCoeff;
  /** Submitted-at timestamp (relative to first game start) */
  submittedAtRelative: number; // ms ago from "now"
  /** Submission summary (what the auditor reads) */
  summary: string;
  /** Submission link (mock) */
  link: string;
  /** True quality (HIDDEN — used to compute the AI co-reviewers' votes) */
  trueQuality: QualityCoeff;
  /** Hint text shown next to summary, helps player calibrate */
  reviewerHint?: string;
}

const STORAGE_KEY = 'cua-yuanye-review-tasks-v1';
const SEED_KEY = 'cua-yuanye-review-seeded-v1';

/**
 * Predefined pool of virtual submissions. Each is a teaching moment about
 * the CUA quality coefficient system.
 */
export const VIRTUAL_SUBMISSIONS: VirtualSubmission[] = [
  {
    id: 'vs-acha-paper',
    submitter: '阿茶',
    taskId: 'paper-import',
    taskTitle: '单篇论文入库',
    workshop: '百晓居',
    selfRated: 1.0,
    submittedAtRelative: 30 * 60_000,  // 30 min ago
    summary:
      '论文：《Constitutional AI: Harmlessness from AI Feedback》（Anthropic, 2022）\n\n' +
      '中文摘要：本文提出 Constitutional AI 方法，通过 AI 自我反馈实现无害化训练，' +
      '不依赖人类反馈即可对齐模型行为。\n\n' +
      '英文摘要：已提取（120 词）\n' +
      '流派标签：对齐 / Alignment\n' +
      '架构图：未提取\n' +
      '隐藏 Repo 链接：未补全',
    link: 'https://feishu.example/doc-acha-paper-001',
    trueQuality: 1.0,
    reviewerHint: '核心字段无遗漏，但未提取架构图、未补 Repo 链接——典型的 x1.0 提交。',
  },
  {
    id: 'vs-linshen-author',
    submitter: '林深',
    taskId: 'author-card',
    taskTitle: '作者/机构卡片完善',
    workshop: '百晓居',
    selfRated: 2.0,
    submittedAtRelative: 60 * 60_000,
    summary:
      '人物：Dario Amodei（Anthropic CEO）\n\n' +
      '已添加：\n' +
      '  · 个人主页：https://example.com/dario\n' +
      '  · 最新职务：Anthropic CEO（2021- 至今）\n' +
      '  · 履历：OpenAI VP of Research → Anthropic 共同创始人\n\n' +
      '未追踪：机构变动史 / 师承网络（未涉及）',
    link: 'https://feishu.example/doc-linshen-card-002',
    trueQuality: 0.5,
    reviewerHint:
      '⚠️ 玩家自评 x2.0，但 x2.0 标准要求"追踪重大机构变动、梳理师承网络"——本提交未包含这些。' +
      '\n按贡献细则，这应该是 x1.0 甚至 x0.5。审核员需要纠正。',
  },
  {
    id: 'vs-zhouyi-qa',
    submitter: '周一',
    taskId: 'qa-week',
    taskTitle: '完成单周数据质量抽查（QA）',
    workshop: '百晓居',
    selfRated: 1.0,
    submittedAtRelative: 4 * 3600_000,
    summary:
      '本周抽查：35 条新入库论文 / 12 个作者卡片\n\n' +
      '发现的问题：\n' +
      '  1. 7 条论文流派标签错误（多数把"工具调用 / Tool Use"标成"代理 / Agent"）\n' +
      '  2. 3 个作者卡片职务过期（已联系作者更新）\n' +
      '  3. 流派打标规范文档第 4 节存在歧义——已起草修订建议（附文档）\n\n' +
      '附件：抽查日志（公开链接）+ 修订建议草案',
    link: 'https://feishu.example/doc-zhouyi-qa-003',
    trueQuality: 2.0,
    reviewerHint:
      '✨ 玩家自评 x1.0，但本提交不仅揪出了常规错误（x1.0 标准），' +
      '还从根源优化了规范文档（x2.0 标准）。审核员应该把它抬到 x2.0。',
  },
  {
    id: 'vs-xiaomai-paper',
    submitter: '小麦',
    taskId: 'paper-import',
    taskTitle: '单篇论文入库',
    workshop: '百晓居',
    selfRated: 0.5,
    submittedAtRelative: 8 * 3600_000,
    summary:
      '论文：《Attention Is All You Need》（Google, 2017）\n\n' +
      '中文摘要：（直接从论文复制）"我们提出 Transformer，一种基于注意力机制的新型网络架构..."\n' +
      '英文摘要：原文复制\n' +
      '流派标签：架构 / Architecture\n\n' +
      '说明：第一次做，不熟悉规范，自评 x0.5。',
    link: 'https://feishu.example/doc-xiaomai-paper-004',
    trueQuality: 0.5,
    reviewerHint:
      '玩家自评 x0.5（诚实自评）。摘要确实是直接复制的，符合 x0.5 标准。' +
      '\n但作为审核员，可以考虑：是否给 x1.0 鼓励第一次尝试？还是按规则严格 x0.5？',
  },
  {
    id: 'vs-aha-script',
    submitter: '阿哈',
    taskId: 'auto-script',
    taskTitle: '开发/升级自动化抓取脚本',
    workshop: '百晓居',
    selfRated: 2.0,
    submittedAtRelative: 26 * 3600_000,
    summary:
      'arXiv 自动抓取 + GitHub Repo 关联预填脚本\n\n' +
      '功能：\n' +
      '  · 每日自动拉取 cs.AI / cs.CL 新论文\n' +
      '  · GPT-4 初筛（去除非主流 / 重复 / 低质量）\n' +
      '  · 自动关联 paper → GitHub Repo（基于作者邮箱 + 关键词匹配）\n' +
      '  · 自动提交 Pull Request 到 CUA 论文库 Repo\n\n' +
      '运行状态：已稳定运行 14 天，处理 230 篇，0 故障。\n' +
      '人工干预：仅在初筛误删时手动恢复（约 5% 比例）。\n\n' +
      '代码：https://github.com/ahaha/cua-arxiv-bot（开源）\n' +
      '文档：完整 README + 架构图（已附）',
    link: 'https://github.com/example/cua-arxiv-bot',
    trueQuality: 2.0,
    reviewerHint:
      '✅ 玩家自评 x2.0。架构优雅、接入 AI 初筛、几乎零人工——完全符合 x2.0 标准。' +
      '\n稳定运行超过 7 天的硬性要求。审核员应该认同 x2.0。',
  },
];

export type ReviewTaskStatus = 'pending' | 'completed';

export interface ReviewTask {
  submission: VirtualSubmission;
  status: ReviewTaskStatus;
  /** Player's vote on this submission */
  playerVote?: QualityCoeff;
  /** Player's comment (free-form text) */
  playerComment?: string;
  /** AI co-reviewers' votes (computed when player submits) */
  aiVotes?: Array<{ name: string; coeff: QualityCoeff }>;
  /** Final coefficient (median of player + 2 AI votes) */
  finalCoeff?: QualityCoeff;
  /** CP earned by the player for this review (5 base + 5 if accurate) */
  reviewCpEarned?: number;
  /** When player completed the review */
  completedAt?: number;
}

interface ReviewState {
  /** Submissions that have been "sent" to the player as review requests */
  sentSubmissionIds: string[];
  /** Per-submission state */
  tasks: Record<string, Omit<ReviewTask, 'submission'>>;
}

function loadState(): ReviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ReviewState;
  } catch { /* ignore */ }
  return { sentSubmissionIds: [], tasks: {} };
}

function saveState(s: ReviewState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  // F2.3: also write to cloud
  const seeded = localStorage.getItem(SEED_KEY) === '1';
  fireCloudWrite('saveReviewState', async (supabase, userId) => {
    return await supabase.from('review_tasks').upsert({
      user_id: userId,
      state: s as unknown as Record<string, unknown>,
      seeded,
      updated_at: new Date().toISOString(),
    });
  });
}

/** Get all review tasks the player has been sent (with their states). */
export function getReviewTasks(): ReviewTask[] {
  const s = loadState();
  return s.sentSubmissionIds
    .map((id) => {
      const sub = VIRTUAL_SUBMISSIONS.find((v) => v.id === id);
      if (!sub) return null;
      const t = s.tasks[id] ?? { status: 'pending' as ReviewTaskStatus };
      return { submission: sub, ...t };
    })
    .filter((t): t is ReviewTask => t !== null);
}

/** Send the next pending submission to the player (returns it, or null if all sent). */
export function sendNextReviewRequest(): VirtualSubmission | null {
  const s = loadState();
  const next = VIRTUAL_SUBMISSIONS.find((v) => !s.sentSubmissionIds.includes(v.id));
  if (!next) return null;
  s.sentSubmissionIds.push(next.id);
  s.tasks[next.id] = { status: 'pending' };
  saveState(s);
  return next;
}

/** Has the seed (first auto-send) happened yet? */
export function isReviewSeeded(): boolean {
  return localStorage.getItem(SEED_KEY) === '1';
}
export function markReviewSeeded(): void {
  localStorage.setItem(SEED_KEY, '1');
  // F2.3: write seeded flag to cloud (read state first to keep state intact)
  const s = loadState();
  fireCloudWrite('markReviewSeeded', async (supabase, userId) => {
    return await supabase.from('review_tasks').upsert({
      user_id: userId,
      state: s as unknown as Record<string, unknown>,
      seeded: true,
      updated_at: new Date().toISOString(),
    });
  });
}

/** Submit the player's vote on a review task. Computes AI co-reviewer votes,
 *  median, and CP earned. Returns the completed task. */
export function submitPlayerReview(
  submissionId: string,
  playerVote: QualityCoeff,
  playerComment: string
): ReviewTask | null {
  const sub = VIRTUAL_SUBMISSIONS.find((v) => v.id === submissionId);
  if (!sub) return null;
  const s = loadState();
  if (s.tasks[submissionId]?.status === 'completed') {
    // Already done — return existing
    return getReviewTasks().find((t) => t.submission.id === submissionId) ?? null;
  }

  // Two AI co-reviewers' votes (random, biased toward true quality)
  const trueQ = sub.trueQuality;
  const candidates: QualityCoeff[] = [0.5, 1.0, 2.0];
  const pickAiVote = (): QualityCoeff => {
    // 70% true, 15% one off either side
    const r = Math.random();
    if (r < 0.7) return trueQ;
    const idx = candidates.indexOf(trueQ);
    if (r < 0.85 && idx > 0) return candidates[idx - 1];
    if (idx < candidates.length - 1) return candidates[idx + 1];
    return trueQ;
  };
  const aiNames: Array<['周明' | '严之' | '白徽', QualityCoeff]> = [
    ['周明', pickAiVote()],
    ['白徽', pickAiVote()],
  ];

  const allCoeffs = [playerVote, ...aiNames.map(([_, c]) => c)];
  const finalCoeff = computeFinalCoefficient(allCoeffs) as QualityCoeff;

  // CP: 5 base + 5 if player vote matches median
  const reviewCpEarned = playerVote === finalCoeff ? 10 : 5;

  s.tasks[submissionId] = {
    status: 'completed',
    playerVote,
    playerComment,
    aiVotes: aiNames.map(([name, coeff]) => ({ name, coeff })),
    finalCoeff,
    reviewCpEarned,
    completedAt: Date.now(),
  };
  saveState(s);

  // Add to CV ledger as review CP
  addCVEntry({
    submissionId: `review-${submissionId}-${Date.now()}`,
    taskId: 'review-' + sub.taskId,
    taskTitle: `审核：${sub.submitter}的"${sub.taskTitle}"`,
    workshop: '审核委员会',
    coefficient: 1.0,         // not applicable for review CP, just for math
    baseCp: reviewCpEarned,    // direct CP value
  });

  // Notify systems
  EventBus.emit('cv-updated', { totalCV: reviewCpEarned });
  EventBus.emit('show-toast', {
    text: `🎖️ 完成审核 · +${reviewCpEarned} 审核 CP（${playerVote === finalCoeff ? '与中位数一致' : '与中位数有偏移'}）`,
  });

  return {
    submission: sub,
    status: 'completed',
    playerVote,
    playerComment,
    aiVotes: aiNames.map(([name, coeff]) => ({ name, coeff })),
    finalCoeff,
    reviewCpEarned,
    completedAt: s.tasks[submissionId].completedAt,
  };
}

/** How many submissions remain in the pool. */
export function getRemainingSubmissions(): number {
  const s = loadState();
  return VIRTUAL_SUBMISSIONS.length - s.sentSubmissionIds.length;
}

// ===== F2.3: bulk upload helper =====

export function getReviewStateAsRow(userId: string) {
  const s = loadState();
  const seeded = localStorage.getItem(SEED_KEY) === '1';
  return {
    user_id: userId,
    state: s as unknown as Record<string, unknown>,
    seeded,
    updated_at: new Date().toISOString(),
  };
}

// ===== F2.3: pull-from-cloud helper =====

/**
 * Replace local review state with the given snapshot (used by pull button).
 * Caller must already have fetched the row from Supabase.
 */
export function replaceReviewStateFromCloud(state: ReviewState, seeded: boolean) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (seeded) {
    localStorage.setItem(SEED_KEY, '1');
  } else {
    localStorage.removeItem(SEED_KEY);
  }
}
