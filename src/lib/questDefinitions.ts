/**
 * 任务定义数据 · 5 个百晓居任务
 *
 * 抽自 QuestLog.tsx 内部 QUESTS 数组（Wave 2.5.A.2）
 * 旧 QuestLog 内部 QUESTS 不动 · 这里只是新版本的 single source of truth
 *
 * 后续 Wave 2.5.A.3+ 时旧 QuestLog 删除后，这里成为唯一来源
 */

export type Difficulty = 'beginner' | 'medium' | 'advanced';

export interface QuestDef {
  id: string;
  workshop: string;
  title: string;
  description: string;
  cpRange: string;
  baseCp: number;
  estimatedTime: string;
  difficulty: Difficulty;
  qualityCriteria: string;
  acceptCriteria: string;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'paper-import',
    workshop: '百晓居',
    title: '单篇论文入库',
    description:
      '为 CUA 论文库添加一篇 AI 论文：中英文摘要提炼、图片提取、7 大流派精准打标。',
    cpRange: '10–15 CP / 篇',
    baseCp: 12,
    estimatedTime: '约 0.8–1.5h',
    difficulty: 'beginner',
    qualityCriteria:
      'x0.5：仅复制粘贴摘要、流派标签打错。x1.0：准确判定流派、核心字段无遗漏。x2.0：提取高质量架构图、补全隐藏 Repo 链接。',
    acceptCriteria: '需成功录入论文库，经受质检抽查。拒绝纯机器翻译与敷衍了事。',
  },
  {
    id: 'author-card',
    workshop: '百晓居',
    title: '作者/机构卡片完善',
    description: '补充某位 AI 研究者或机构的最新履历、个人主页、最新职务。',
    cpRange: '5 CP / 人',
    baseCp: 5,
    estimatedTime: '约 0.5h',
    difficulty: 'beginner',
    qualityCriteria:
      'x0.5：提供无效旧链接。x1.0：完整补充最新履历与机构归属。x2.0：追踪重大机构变动、梳理师承网络。',
    acceptCriteria: '信息真实有效，完成双向实体关联映射。',
  },
  {
    id: 'qa-week',
    workshop: '百晓居',
    title: '完成单周数据质量抽查（QA）',
    description: '对本周新入库的论文/作者条目做抽查，解决标引争议、清理脏数据。',
    cpRange: '50 CP / 周',
    baseCp: 50,
    estimatedTime: '约 0.5 天',
    difficulty: 'medium',
    qualityCriteria:
      'x1.0：揪出常规错误，给出修正建议。x2.0：发现持续性打标错误，从根源优化规范文档。',
    acceptCriteria: '需公开抽查日志与争议解决记录。禁止"走过场"。',
  },
  {
    id: 'auto-script',
    workshop: '百晓居',
    title: '开发/升级自动化抓取脚本',
    description: '实现 arXiv 或 GitHub 的自动推送与预填，解放手工填表时间。',
    cpRange: '150–300 CP',
    baseCp: 200,
    estimatedTime: '约 1.5–3 天',
    difficulty: 'advanced',
    qualityCriteria:
      'x0.5：脚本不稳定、漏抓乱码。x1.0：稳定运行，解放 50% 填表时间。x2.0：架构优雅、接入 AI 初筛、几乎零人工。',
    acceptCriteria: '代码需开源至社区 Repo，附带使用文档，稳定运行至少 7 天。',
  },
  {
    id: 'tech-quarterly',
    workshop: '百晓居',
    title: '产出季度 CUA 技术版图研判',
    description:
      '基于真实数据进行机构排行、爆发点分析，输出可被广泛引用的研判报告。',
    cpRange: '200–300 CP',
    baseCp: 250,
    estimatedTime: '约 2–3 天',
    difficulty: 'advanced',
    qualityCriteria:
      'x0.5：简单文字描述、无深度。x1.0：逻辑严密、准确指出风向。x2.0：研判超前、成功预警爆发、被广泛引用。',
    acceptCriteria: '需依托飞书真实数据源，经编审核通过后发布。',
  },
];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: '入门',
  medium: '中等',
  advanced: '困难',
};

export const DIFFICULTY_TONE: Record<Difficulty, 'spring' | 'gold' | 'danger'> = {
  beginner: 'spring',
  medium: 'gold',
  advanced: 'danger',
};
