import { useEffect, useState, useSyncExternalStore } from 'react';
import { EventBus } from '../game/EventBus';
import type {
  QualityCoeff,
  ReviewerVote,
} from '../lib/reviewers';
import {
  scheduleReviewerVotes,
  catchUpPendingVotes,
  cancelScheduledVotes,
} from '../lib/reviewers';
import type {
  AppealReviewerVote,
} from '../lib/appealReviewers';
import {
  scheduleAppealVotes,
  catchUpAppealVotes,
} from '../lib/appealReviewers';
import { validateSubmissionUrl } from '../lib/urlValidation';
import {
  type QuestStates,
  getQuestStatesSnapshot,
  subscribeQuestStates,
  ensureQuestStates,
  acceptQuest as storeAcceptQuest,
  saveDraft as storeSaveDraft,
  confirmSubmit as storeConfirmSubmit,
  withdrawSubmissionState as storeWithdrawSubmission,
  addReviewerVote as storeAddReviewerVote,
  finalizeQuest as storeFinalizeQuest,
  startAppealState as storeStartAppeal,
  addAppealVote as storeAddAppealVote,
  finalizeAppeal as storeFinalizeAppeal,
} from '../lib/questStore';

/** Quest definition — based on real CUA contribution rules. */
interface QuestDef {
  id: string;
  workshop: string;
  title: string;
  description: string;
  cpRange: string;
  baseCp: number;             // C-7 will use this × coefficient for CV
  estimatedTime: string;
  difficulty: 'beginner' | 'medium' | 'advanced';
  qualityCriteria: string;
  acceptCriteria: string;
}

const QUESTS: QuestDef[] = [
  {
    id: 'paper-import',
    workshop: '百晓居',
    title: '单篇论文入库',
    description: '为 CUA 论文库添加一篇 AI 论文：中英文摘要提炼、图片提取、7 大流派精准打标。',
    cpRange: '10–15 CP / 篇',
    baseCp: 12,
    estimatedTime: '约 0.8–1.5h',
    difficulty: 'beginner',
    qualityCriteria: 'x0.5：仅复制粘贴摘要、流派标签打错。x1.0：准确判定流派、核心字段无遗漏。x2.0：提取高质量架构图、补全隐藏 Repo 链接。',
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
    qualityCriteria: 'x0.5：提供无效旧链接。x1.0：完整补充最新履历与机构归属。x2.0：追踪重大机构变动、梳理师承网络。',
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
    qualityCriteria: 'x1.0：揪出常规错误，给出修正建议。x2.0：发现持续性打标错误，从根源优化规范文档。',
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
    qualityCriteria: 'x0.5：脚本不稳定、漏抓乱码。x1.0：稳定运行，解放 50% 填表时间。x2.0：架构优雅、接入 AI 初筛、几乎零人工。',
    acceptCriteria: '代码需开源至社区 Repo，附带使用文档，稳定运行至少 7 天。',
  },
  {
    id: 'tech-quarterly',
    workshop: '百晓居',
    title: '产出季度 CUA 技术版图研判',
    description: '基于真实数据进行机构排行、爆发点分析，输出可被广泛引用的研判报告。',
    cpRange: '200–300 CP',
    baseCp: 250,
    estimatedTime: '约 2–3 天',
    difficulty: 'advanced',
    qualityCriteria: 'x0.5：简单文字描述、无深度。x1.0：逻辑严密、准确指出风向。x2.0：研判超前、成功预警爆发、被广泛引用。',
    acceptCriteria: '需依托飞书真实数据源，经编审核通过后发布。',
  },
];

const DIFFICULTY_LABEL: Record<QuestDef['difficulty'], string> = {
  beginner: '入门', medium: '中等', advanced: '困难',
};
const DIFFICULTY_COLOR: Record<QuestDef['difficulty'], string> = {
  beginner: '#7fc090', medium: '#e0b060', advanced: '#e07060',
};

export function QuestLog() {
  const [open, setOpen] = useState(false);
  const states: QuestStates = useSyncExternalStore(
    subscribeQuestStates,
    getQuestStatesSnapshot,
    getQuestStatesSnapshot,
  );
  const [selectedQuest, setSelectedQuest] = useState<string | null>(null);
  const [submissionDraft, setSubmissionDraft] = useState('');
  const [draftSelfRated, setDraftSelfRated] = useState<QualityCoeff>(1.0);
  // D5: confirm modal + tick clock for withdraw countdown
  const [confirmingQuestId, setConfirmingQuestId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);  // forces re-render every second for countdown

  // Initialize default 'available' state for quests not yet in store
  useEffect(() => {
    ensureQuestStates(QUESTS.map((q) => q.id));
  }, []);

  // ---- Open/close & Esc handling ----
  useEffect(() => {
    const onOpen = () => setOpen((p) => !p);
    EventBus.on('open-quest-log', onOpen);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        if (confirmingQuestId) {
          setConfirmingQuestId(null);
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      EventBus.off('open-quest-log', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, confirmingQuestId]);

  // ---- D5: 1-second tick to drive withdraw countdown UI ----
  useEffect(() => {
    if (!open) return;
    const hasWithdrawable = Object.values(states).some(
      (s) => s.status === 'reviewing' && s.withdrawDeadline && s.withdrawDeadline > Date.now()
    );
    if (!hasWithdrawable) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [open, states]);

  // ---- Listen for incoming reviewer votes ----
  useEffect(() => {
    const onVoteCast = (data: { submissionId: string; vote: ReviewerVote }) => {
      const result = storeAddReviewerVote(data.submissionId, data.vote);
      if (!result) return;

      const reviewerName = data.vote.reviewerName;
      const quest = QUESTS.find((q) => q.id === result.questId);
      EventBus.emit('show-toast', {
        text: `📊 ${reviewerName} 完成了对「${quest?.title}」的审核`,
      });

      // If all 3 votes are in, emit a finalize event for C-7 to consume
      if (result.isQuorum) {
        EventBus.emit('reviewer-quorum-reached', {
          submissionId: data.submissionId,
          taskId: result.questId,
          quest,
          state: result.state,
          votes: result.state.votes ?? [],
        });
      }
    };
    EventBus.on('reviewer-vote-cast', onVoteCast);

    // C-7: when ReviewProcessor finalizes the task, advance state to submitted
    const onFinalized = (data: { taskId: string; submissionId: string; finalCoeff: number; cpEarned: number }) => {
      storeFinalizeQuest(data.taskId, data.submissionId, data.finalCoeff, data.cpEarned);
    };
    EventBus.on('quest-finalized', onFinalized);

    // ---- C-9: Appeal vote progress listener ----
    const onAppealVote = (data: { appealId: string; vote: AppealReviewerVote }) => {
      const result = storeAddAppealVote(data.appealId, data.vote);
      if (!result) return;

      // 3 votes → emit quorum-reached with full payload
      if (result.isQuorum) {
        const quest = QUESTS.find((q) => q.id === result.questId);
        const s = result.state;
        if (quest && s.finalCoeff !== undefined && s.cpEarned !== undefined) {
          EventBus.emit('appeal-quorum-reached', {
            appealId: data.appealId,
            taskId: result.questId,
            taskTitle: quest.title,
            workshop: quest.workshop,
            baseCp: quest.baseCp,
            selfRated: s.selfRated ?? 1.0,
            originalCoeff: s.finalCoeff,
            originalCpEarned: s.cpEarned,
            votes: s.appealVotes ?? [],
          });
        }
      }
    };
    EventBus.on('appeal-vote-progress', onAppealVote);

    // ---- C-9: Appeal finalized listener ----
    const onAppealFinalized = (data: {
      appealId: string;
      taskId: string;
      outcome: 'upgrade' | 'maintain' | 'declined';
      appealCoeff: number;
      finalCoeff: number;
      newCp: number;
      topUpCp: number;
    }) => {
      storeFinalizeAppeal(data.taskId, data.appealId, {
        outcome: data.outcome,
        appealCoeff: data.appealCoeff,
        finalCoeff: data.finalCoeff,
        newCp: data.newCp,
      });
    };
    EventBus.on('appeal-finalized', onAppealFinalized);

    return () => {
      EventBus.off('reviewer-vote-cast', onVoteCast);
      EventBus.off('quest-finalized', onFinalized);
      EventBus.off('appeal-vote-progress', onAppealVote);
      EventBus.off('appeal-finalized', onAppealFinalized);
    };
  }, []);

  // ---- On mount, catch up any pending votes from before page reload ----
  useEffect(() => {
    const submissions = Object.entries(states)
      .filter(([_, s]) => s.status === 'reviewing' && s.submissionId && s.scheduledVotes)
      .map(([_, s]) => ({
        submissionId: s.submissionId!,
        selfRated: s.selfRated ?? 1.0,
        scheduledVotes: s.scheduledVotes!,
        receivedVoteIds: (s.votes ?? []).map((v) => v.reviewerId),
      }));
    if (submissions.length > 0) {
      catchUpPendingVotes(submissions);
    }

    // C-9: catch up pending appeal votes
    const appeals = Object.entries(states)
      .filter(([_, s]) => s.status === 'appealing' && s.appealId && s.appealScheduledVotes)
      .map(([_, s]) => ({
        appealId: s.appealId!,
        selfRated: s.selfRated ?? 1.0,
        originalCoeff: (s.finalCoeff ?? 1.0) as QualityCoeff,
        scheduledVotes: s.appealScheduledVotes!,
        receivedVoteIds: (s.appealVotes ?? []).map((v) => v.reviewerId),
      }));
    if (appeals.length > 0) {
      catchUpAppealVotes(appeals);
    }
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptQuest = (id: string) => {
    storeAcceptQuest(id);
    EventBus.emit('show-toast', { text: `📋 已接受任务：${QUESTS.find((q) => q.id === id)?.title}` });
  };

  // D5: persist draft (link + self-rated) while in 'accepted' state.
  // Called whenever the player edits the draft form.
  const saveDraft = (id: string, link: string, selfRated: QualityCoeff) => {
    storeSaveDraft(id, link, selfRated);
  };

  // D5: open the confirm modal instead of submitting directly.
  const requestSubmit = (id: string, link: string, _selfRated: QualityCoeff) => {
    const validation = validateSubmissionUrl(link);
    if (!validation.ok) {
      EventBus.emit('show-toast', { text: `⚠️ ${validation.reason}` });
      return;
    }
    setConfirmingQuestId(id);
  };

  // D5: actually submit (called from confirm modal's "确认提交")
  const confirmedSubmit = (id: string, link: string, selfRated: QualityCoeff) => {
    const validation = validateSubmissionUrl(link);
    if (!validation.ok) return;

    const submissionId = `sub-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const scheduled = scheduleReviewerVotes(submissionId, selfRated);
    const withdrawDeadline = Date.now() + 3 * 60_000;  // 3 min withdraw window

    storeConfirmSubmit(id, link, selfRated, submissionId, scheduled, withdrawDeadline);

    setConfirmingQuestId(null);
    setSelectedQuest(null);
    setSubmissionDraft('');
    setDraftSelfRated(1.0);

    EventBus.emit('show-toast', {
      text: `✅ 任务已提交（自评 x${selfRated}）· 3 位审核员陆续给出投票 · 3 分钟内可撤回`,
    });
  };

  // D5: withdraw a submission within the withdraw window.
  const withdrawSubmission = (id: string) => {
    const target = states[id];
    if (!target || target.status !== 'reviewing' || !target.submissionId) return;
    if (!target.withdrawDeadline || target.withdrawDeadline <= Date.now()) {
      EventBus.emit('show-toast', { text: '⚠️ 撤回窗口已关闭，无法撤回' });
      return;
    }

    const cancelled = cancelScheduledVotes(target.submissionId);

    storeWithdrawSubmission(id);

    // Reset selected detail-pane state
    setSubmissionDraft(target.submissionLink ?? '');
    setDraftSelfRated((target.selfRated ?? 1.0) as QualityCoeff);

    EventBus.emit('show-toast', {
      text: `↩️ 已撤回提交${cancelled > 0 ? `（取消了 ${cancelled} 位审核员的待投）` : ''} · 链接和自评已保留为草稿`,
    });
  };

  const startAppeal = (id: string) => {
    const target = states[id];
    if (!target || target.appealed) return;
    if (target.finalCoeff === undefined || target.cpEarned === undefined) return;

    const appealId = `appeal-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const scheduled = scheduleAppealVotes(
      appealId,
      (target.selfRated ?? 1.0) as QualityCoeff,
      target.finalCoeff as QualityCoeff,
    );

    storeStartAppeal(id, appealId, scheduled);

    EventBus.emit('show-toast', {
      text: `📜 已发起申诉 · 3 位复审员陆续给出意见（约 30-90 秒）`,
    });
  };

  const acceptedCount = Object.values(states).filter((s) => s.status === 'accepted').length;
  const reviewingCount = Object.values(states).filter((s) => s.status === 'reviewing').length;
  const appealingCount = Object.values(states).filter((s) => s.status === 'appealing').length;
  const submittedCount = Object.values(states).filter((s) => s.status === 'submitted').length;

  if (!open) return null;

  const selected = selectedQuest ? QUESTS.find((q) => q.id === selectedQuest) : null;
  const selectedState = selectedQuest ? states[selectedQuest] : null;

  return (
    <div
      onClick={() => { setOpen(false); setSelectedQuest(null); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(8, 12, 18, 0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
        animation: 'fadeIn 0.25s ease-out',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(900px, 90vw)', height: 'min(640px, 80vh)',
          background: 'rgba(20, 24, 30, 0.96)',
          border: '2px solid rgba(220, 180, 60, 0.4)',
          borderRadius: 8,
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', color: '#f5f0e0',
        }}
      >
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(220, 180, 60, 0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(30, 35, 45, 0.6)',
        }}>
          <div>
            <div style={{ fontSize: 18, color: '#FFD700', letterSpacing: '0.15em' }}>📋 任务日志</div>
            <div style={{ fontSize: 11, color: '#a8b3a0', marginTop: 2 }}>
              百晓居 · {QUESTS.length} 个任务 · 进行中 {acceptedCount} · 审核中 {reviewingCount}{appealingCount > 0 ? ` · 申诉中 ${appealingCount}` : ''} · 已结算 {submittedCount}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#8a8576' }}>J / Esc 关闭</div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* List */}
          <div style={{ width: 320, borderRight: '1px solid rgba(220, 180, 60, 0.15)', overflowY: 'auto' }}>
            {QUESTS.map((q) => {
              const s = states[q.id];
              const isSelected = selectedQuest === q.id;
              return (
                <div
                  key={q.id}
                  onClick={() => {
                    setSelectedQuest(q.id);
                    // D5: prefer draft (saved while in 'accepted' state) over submissionLink
                    setSubmissionDraft(s.draftLink ?? s.submissionLink ?? '');
                    setDraftSelfRated(s.draftSelfRated ?? s.selfRated ?? 1.0);
                  }}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(245, 240, 224, 0.06)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(255, 215, 0, 0.08)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #FFD700' : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f0e0', flex: 1 }}>{q.title}</div>
                    <div style={{
                      fontSize: 9, color: '#fff', background: DIFFICULTY_COLOR[q.difficulty],
                      padding: '1px 6px', borderRadius: 3, flexShrink: 0,
                    }}>
                      {DIFFICULTY_LABEL[q.difficulty]}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#a8b3a0', marginTop: 4 }}>
                    {q.cpRange} · {q.estimatedTime}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 6 }}>
                    {s.status === 'available' && <span style={{ color: '#7fa0c0' }}>○ 可接</span>}
                    {s.status === 'accepted' && <span style={{ color: '#FFD700' }}>◐ 进行中</span>}
                    {s.status === 'reviewing' && (
                      <span style={{ color: '#e0b060' }}>
                        ⏳ 审核中（{(s.votes ?? []).length}/3）
                      </span>
                    )}
                    {s.status === 'appealing' && (
                      <span style={{ color: '#c08070' }}>
                        📜 申诉中（{(s.appealVotes ?? []).length}/3）
                      </span>
                    )}
                    {s.status === 'submitted' && <span style={{ color: '#7fc090' }}>● 已结算</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            {selected && selectedState ? (
              <>
                <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 4 }}>来自 {selected.workshop}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#FFD700', marginBottom: 12 }}>{selected.title}</div>

                <div style={{
                  display: 'flex', gap: 16, fontSize: 12, color: '#c8c0a8',
                  marginBottom: 16, padding: '8px 12px',
                  background: 'rgba(255, 215, 0, 0.06)', borderRadius: 4,
                  borderLeft: '2px solid rgba(255, 215, 0, 0.3)',
                }}>
                  <div>📊 {selected.cpRange}</div>
                  <div>⏱ {selected.estimatedTime}</div>
                  <div style={{ color: DIFFICULTY_COLOR[selected.difficulty] }}>
                    📈 {DIFFICULTY_LABEL[selected.difficulty]}
                  </div>
                </div>

                <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 16, color: '#e0d8c0' }}>
                  {selected.description}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 4 }}>质量系数</div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: '#c8c0a8' }}>
                    {selected.qualityCriteria}
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 4 }}>评判与验收</div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: '#c8c0a8' }}>
                    {selected.acceptCriteria}
                  </div>
                </div>

                {/* Action area — varies by status */}
                {selectedState.status === 'available' && (
                  <button
                    onClick={() => acceptQuest(selected.id)}
                    style={{
                      padding: '10px 20px', fontSize: 13,
                      background: '#FFD700', color: '#1a1a1a',
                      border: 'none', borderRadius: 4, cursor: 'pointer',
                      fontWeight: 600, letterSpacing: '0.1em',
                    }}
                  >
                    接受任务
                  </button>
                )}

                {selectedState.status === 'accepted' && (() => {
                  const validation = validateSubmissionUrl(submissionDraft);
                  const showValidation = submissionDraft.trim().length > 0 && !validation.ok;
                  return (
                  <div>
                    <div style={{ fontSize: 12, color: '#FFD700', marginBottom: 12 }}>
                      ◐ 任务进行中。完成后填写以下内容提交：
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: '#a8b3a0', marginBottom: 6 }}>
                        飞书文档 / Repo / 帖子 链接（必须 https://）
                      </div>
                      <input
                        type="text"
                        value={submissionDraft}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSubmissionDraft(v);
                          saveDraft(selected.id, v, draftSelfRated);
                        }}
                        placeholder="https://..."
                        style={{
                          width: '100%', padding: '8px 12px', fontSize: 13,
                          background: 'rgba(0, 0, 0, 0.3)', color: '#f5f0e0',
                          border: showValidation
                            ? '1px solid rgba(192, 128, 112, 0.6)'
                            : validation.ok
                              ? '1px solid rgba(127, 192, 144, 0.5)'
                              : '1px solid rgba(220, 180, 60, 0.3)',
                          borderRadius: 4, boxSizing: 'border-box',
                          transition: 'border-color 0.2s',
                        }}
                      />
                      {showValidation && (
                        <div style={{ fontSize: 11, color: '#c08070', marginTop: 4 }}>
                          ⚠️ {validation.reason}
                        </div>
                      )}
                      {validation.ok && (
                        <div style={{ fontSize: 11, color: '#7fc090', marginTop: 4 }}>
                          ✓ 链接格式有效
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: '#a8b3a0', marginBottom: 6 }}>
                        自评质量系数
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([0.5, 1.0, 2.0] as QualityCoeff[]).map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              setDraftSelfRated(c);
                              saveDraft(selected.id, submissionDraft, c);
                            }}
                            style={{
                              flex: 1, padding: '8px 12px', fontSize: 12,
                              background: draftSelfRated === c ? '#FFD700' : 'rgba(0, 0, 0, 0.3)',
                              color: draftSelfRated === c ? '#1a1a1a' : '#c8c0a8',
                              border: `1px solid ${draftSelfRated === c ? '#FFD700' : 'rgba(220, 180, 60, 0.2)'}`,
                              borderRadius: 4, cursor: 'pointer',
                              fontWeight: draftSelfRated === c ? 600 : 400,
                            }}
                          >
                            x{c}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 10, color: '#8a8576', marginTop: 6, lineHeight: 1.5 }}>
                        诚实自评——审核员会根据你的提交决定最终系数。低估 / 高估都会被纠正。
                      </div>
                    </div>

                    {(selectedState.draftLink || selectedState.draftSelfRated) && (
                      <div style={{
                        fontSize: 10, color: '#8a8576', marginBottom: 12,
                        padding: '6px 10px',
                        background: 'rgba(127, 160, 192, 0.06)', borderRadius: 3,
                      }}>
                        💾 草稿自动保存——关闭面板再回来内容仍在
                      </div>
                    )}

                    <button
                      onClick={() => requestSubmit(selected.id, submissionDraft, draftSelfRated)}
                      disabled={!validation.ok}
                      style={{
                        padding: '10px 20px', fontSize: 13,
                        background: validation.ok ? '#7fc090' : '#444',
                        color: '#1a1a1a', border: 'none', borderRadius: 4,
                        cursor: validation.ok ? 'pointer' : 'not-allowed',
                        fontWeight: 600, letterSpacing: '0.1em',
                      }}
                    >
                      提交进入审核
                    </button>
                  </div>
                  );
                })()}

                {selectedState.status === 'reviewing' && (() => {
                  const withdrawRemaining = selectedState.withdrawDeadline
                    ? selectedState.withdrawDeadline - Date.now()
                    : 0;
                  const canWithdraw = withdrawRemaining > 0;
                  void tick;  // referenced to make this re-render every 1s
                  return (
                  <div>
                    <div style={{ fontSize: 12, color: '#e0b060', marginBottom: 12 }}>
                      ⏳ 审核中——3 位审核员陆续给出投票
                    </div>
                    <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 8 }}>
                      自评：x{selectedState.selfRated} · 提交于 {selectedState.submittedAt ? new Date(selectedState.submittedAt).toLocaleTimeString('zh-CN') : '?'}
                    </div>
                    <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 16, wordBreak: 'break-all' }}>
                      链接：{selectedState.submissionLink}
                    </div>

                    {/* D5: withdraw button (only within 3-min window) */}
                    {canWithdraw && (
                      <div style={{
                        marginBottom: 16, padding: '10px 14px',
                        background: 'rgba(192, 128, 112, 0.06)',
                        borderRadius: 4, borderLeft: '2px solid rgba(192, 128, 112, 0.3)',
                      }}>
                        <button
                          onClick={() => withdrawSubmission(selected.id)}
                          style={{
                            padding: '6px 14px', fontSize: 12,
                            background: 'transparent', color: '#c08070',
                            border: '1px solid rgba(192, 128, 112, 0.5)',
                            borderRadius: 4, cursor: 'pointer',
                          }}
                        >
                          ↩️ 撤回提交
                        </button>
                        <div style={{ fontSize: 10, color: '#a8b3a0', marginTop: 6, lineHeight: 1.5 }}>
                          剩余 {Math.floor(withdrawRemaining / 60_000)}:{String(Math.floor((withdrawRemaining % 60_000) / 1000)).padStart(2, '0')} ——
                          撤回后链接和自评会保留为草稿，可重新提交。
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 8 }}>
                        审核员投票（{(selectedState.votes ?? []).length}/3）
                      </div>
                      {(['zhouming', 'yanzhi', 'baihui'] as const).map((rid) => {
                        const v = (selectedState.votes ?? []).find((vv) => vv.reviewerId === rid);
                        const name = rid === 'zhouming' ? '周明' : rid === 'yanzhi' ? '严之' : '白徽';
                        return (
                          <div
                            key={rid}
                            style={{
                              padding: '10px 14px',
                              marginBottom: 8,
                              background: v ? 'rgba(127, 192, 144, 0.06)' : 'rgba(0, 0, 0, 0.2)',
                              borderRadius: 4,
                              borderLeft: `2px solid ${v ? '#7fc090' : 'rgba(140, 140, 140, 0.3)'}`,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: v ? '#e0d8c0' : '#8a8576' }}>
                                {name}
                              </span>
                              <span style={{ fontSize: 12, color: v ? '#FFD700' : '#666' }}>
                                {v ? `已投 x${v.coeff}` : '审议中…'}
                              </span>
                            </div>
                            {v && (
                              <div style={{ fontSize: 11, color: '#a8b3a0', marginTop: 6, lineHeight: 1.6 }}>
                                "{v.comment}"
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{
                      marginTop: 16, fontSize: 11, color: '#8a8576',
                      padding: '10px 14px',
                      background: 'rgba(127, 160, 192, 0.06)',
                      borderRadius: 4, borderLeft: '2px solid rgba(127, 160, 192, 0.3)',
                      lineHeight: 1.6,
                    }}>
                      💡 v1.0 已上线：3 位审核员的投票会陆续到达（约 20 秒 - 90 秒）。
                      <br />
                      投票完成后自动结算 CV、发邮件、可申诉。提交后 3 分钟内可撤回。
                    </div>
                  </div>
                  );
                })()}

                {selectedState.status === 'submitted' && (
                  <div>
                    {/* If finalized via C-7 review (has finalCoeff), show full breakdown */}
                    {selectedState.finalCoeff !== undefined && selectedState.cpEarned !== undefined ? (
                      <>
                        <div style={{
                          padding: '12px 16px',
                          marginBottom: 14,
                          background: 'rgba(255, 215, 0, 0.08)',
                          borderRadius: 4,
                          borderLeft: '3px solid #FFD700',
                        }}>
                          <div style={{ fontSize: 14, color: '#FFD700', fontWeight: 600, marginBottom: 6 }}>
                            🏆 已结算 +{selectedState.cpEarned} CV
                          </div>
                          <div style={{ fontSize: 12, color: '#c8c0a8', lineHeight: 1.7 }}>
                            自评 x{selectedState.selfRated} → 审核员协商 x{selectedState.finalCoeff}（中位数）
                            <br />
                            基础 {selected.baseCp} CP × x{selectedState.finalCoeff} = <strong style={{ color: '#FFD700' }}>{selectedState.cpEarned} CV 入账</strong>
                          </div>
                        </div>

                        {selectedState.finalizedAt && (
                          <div style={{ fontSize: 11, color: '#a8b3a0', marginBottom: 14 }}>
                            结算时间：{new Date(selectedState.finalizedAt).toLocaleString('zh-CN')}
                          </div>
                        )}

                        <div style={{ fontSize: 11, color: '#a8b3a0', marginBottom: 16, wordBreak: 'break-all' }}>
                          提交链接：{selectedState.submissionLink}
                        </div>

                        {selectedState.votes && selectedState.votes.length > 0 && (
                          <>
                            <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 8 }}>
                              审核员投票记录
                            </div>
                            {selectedState.votes.map((v) => (
                              <div
                                key={v.reviewerId}
                                style={{
                                  padding: '8px 12px',
                                  marginBottom: 6,
                                  background: 'rgba(0, 0, 0, 0.2)',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  color: '#c8c0a8',
                                  lineHeight: 1.6,
                                }}
                              >
                                <strong style={{ color: '#e0d8c0' }}>{v.reviewerName}</strong>
                                <span style={{ marginLeft: 8, color: '#FFD700' }}>x{v.coeff}</span>
                                <div style={{ marginTop: 4, color: '#a8b3a0' }}>"{v.comment}"</div>
                              </div>
                            ))}
                          </>
                        )}

                        {/* C-9: Appeal button or appeal result */}
                        {!selectedState.appealed ? (
                          <div style={{ marginTop: 20 }}>
                            <button
                              onClick={() => startAppeal(selected.id)}
                              style={{
                                padding: '10px 20px', fontSize: 13,
                                background: 'transparent',
                                color: '#c08070',
                                border: '1px solid rgba(192, 128, 112, 0.5)',
                                borderRadius: 4, cursor: 'pointer',
                                fontWeight: 500, letterSpacing: '0.05em',
                              }}
                            >
                              📜 申诉本次结算
                            </button>
                            <div style={{ fontSize: 10, color: '#8a8576', marginTop: 8, lineHeight: 1.6 }}>
                              对结果不满？可以申请 3 位新复审员（谢忱 / 黎明 / 苏砚）重新评估。
                              <br />
                              申诉只能上调，不会下调——但每个任务只能申诉一次。
                            </div>
                          </div>
                        ) : selectedState.appealOutcome && (
                          <div style={{ marginTop: 20 }}>
                            <div style={{
                              padding: '12px 16px',
                              marginBottom: 14,
                              background:
                                selectedState.appealOutcome === 'upgrade' ? 'rgba(127, 192, 144, 0.08)'
                                : 'rgba(192, 128, 112, 0.08)',
                              borderRadius: 4,
                              borderLeft: `3px solid ${selectedState.appealOutcome === 'upgrade' ? '#7fc090' : '#c08070'}`,
                            }}>
                              <div style={{
                                fontSize: 13, fontWeight: 600, marginBottom: 6,
                                color: selectedState.appealOutcome === 'upgrade' ? '#7fc090' : '#c08070',
                              }}>
                                📜 申诉{selectedState.appealOutcome === 'upgrade' ? '成功'
                                       : selectedState.appealOutcome === 'maintain' ? '维持原判'
                                       : '维持原判（复审低于原审，按规则不下调）'}
                              </div>
                              <div style={{ fontSize: 11, color: '#c8c0a8', lineHeight: 1.7 }}>
                                复审中位数：x{selectedState.appealCoeff}
                                {selectedState.appealOutcome === 'upgrade' && (
                                  <> · 已上调到 x{selectedState.finalCoeff} · CP 已补差</>
                                )}
                              </div>
                            </div>

                            {selectedState.appealVotes && selectedState.appealVotes.length > 0 && (
                              <>
                                <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 8 }}>
                                  复审员投票记录
                                </div>
                                {selectedState.appealVotes.map((v) => (
                                  <div
                                    key={v.reviewerId}
                                    style={{
                                      padding: '8px 12px',
                                      marginBottom: 6,
                                      background: 'rgba(0, 0, 0, 0.2)',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      color: '#c8c0a8',
                                      lineHeight: 1.6,
                                    }}
                                  >
                                    <strong style={{ color: '#e0d8c0' }}>{v.reviewerName}</strong>
                                    <span style={{ marginLeft: 8, color: '#FFD700' }}>x{v.coeff}</span>
                                    <div style={{ marginTop: 4, color: '#a8b3a0' }}>"{v.comment}"</div>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      // Legacy submission from C-4 (before review system) — no finalCoeff
                      <>
                        <div style={{ fontSize: 12, color: '#7fc090', marginBottom: 8 }}>
                          ● 已于 {selectedState.submittedAt ? new Date(selectedState.submittedAt).toLocaleString('zh-CN') : '?'} 提交
                        </div>
                        <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 12, wordBreak: 'break-all' }}>
                          链接：{selectedState.submissionLink}
                        </div>
                        <div style={{
                          fontSize: 11, color: '#8a8576',
                          padding: '10px 14px',
                          background: 'rgba(127, 192, 144, 0.06)',
                          borderRadius: 4,
                          borderLeft: '2px solid rgba(127, 192, 144, 0.3)',
                          lineHeight: 1.6,
                        }}>
                          💡 这条提交在 v0.6 之前完成——不会重新进入审核流程。
                          <br />
                          后续提交（v0.8+）会自动经过 3 位审核员投票。
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* C-9: appealing — show progress on the 3 appeal reviewers */}
                {selectedState.status === 'appealing' && (
                  <div>
                    <div style={{ fontSize: 12, color: '#c08070', marginBottom: 12 }}>
                      📜 申诉中——3 位复审员陆续给出意见
                    </div>
                    <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 8 }}>
                      原审核中位数：x{selectedState.finalCoeff} · 你的自评：x{selectedState.selfRated}
                    </div>
                    {selectedState.appealedAt && (
                      <div style={{ fontSize: 11, color: '#a8b3a0', marginBottom: 16 }}>
                        申诉发起：{new Date(selectedState.appealedAt).toLocaleTimeString('zh-CN')}
                      </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 8 }}>
                        复审员投票（{(selectedState.appealVotes ?? []).length}/3）
                      </div>
                      {(['xiechen', 'liming', 'suyan'] as const).map((rid) => {
                        const v = (selectedState.appealVotes ?? []).find((vv) => vv.reviewerId === rid);
                        const name = rid === 'xiechen' ? '谢忱' : rid === 'liming' ? '黎明' : '苏砚';
                        return (
                          <div
                            key={rid}
                            style={{
                              padding: '10px 14px',
                              marginBottom: 8,
                              background: v ? 'rgba(127, 192, 144, 0.06)' : 'rgba(0, 0, 0, 0.2)',
                              borderRadius: 4,
                              borderLeft: `2px solid ${v ? '#7fc090' : 'rgba(140, 140, 140, 0.3)'}`,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: v ? '#e0d8c0' : '#8a8576' }}>
                                {name}
                              </span>
                              <span style={{ fontSize: 12, color: v ? '#FFD700' : '#666' }}>
                                {v ? `已投 x${v.coeff}` : '审议中…'}
                              </span>
                            </div>
                            {v && (
                              <div style={{ fontSize: 11, color: '#a8b3a0', marginTop: 6, lineHeight: 1.6 }}>
                                "{v.comment}"
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{
                      marginTop: 16, fontSize: 11, color: '#8a8576',
                      padding: '10px 14px',
                      background: 'rgba(192, 128, 112, 0.06)',
                      borderRadius: 4, borderLeft: '2px solid rgba(192, 128, 112, 0.3)',
                      lineHeight: 1.6,
                    }}>
                      💡 复审员的意见会陆续到达（约 25-85 秒）。
                      <br />
                      申诉规则：复审中位数 &gt; 原审 → 上调并补差；&le; 原审 → 维持原判（不下调）。
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#8a8576', fontSize: 13, marginTop: 80 }}>
                ← 选择左侧任务查看详情
              </div>
            )}
          </div>
        </div>
      </div>

      {/* D5: Confirm submission modal */}
      {confirmingQuestId && (() => {
        const cq = QUESTS.find((q) => q.id === confirmingQuestId);
        const cs = states[confirmingQuestId];
        if (!cq || !cs) return null;
        const expectedCp = Math.round(cq.baseCp * draftSelfRated);
        return (
          <div
            onClick={() => setConfirmingQuestId(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 600,
              background: 'rgba(8, 12, 18, 0.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(3px)',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(480px, 90vw)',
                background: 'rgba(20, 24, 30, 0.98)',
                border: '2px solid rgba(255, 215, 0, 0.5)',
                borderRadius: 8,
                boxShadow: '0 8px 40px rgba(0, 0, 0, 0.7)',
                padding: 24,
                color: '#f5f0e0',
              }}
            >
              <div style={{ fontSize: 16, color: '#FFD700', fontWeight: 600, marginBottom: 16, letterSpacing: '0.1em' }}>
                确认提交？
              </div>

              <div style={{ fontSize: 13, lineHeight: 1.9, color: '#e0d8c0', marginBottom: 16 }}>
                你即将提交：
                <div style={{
                  marginTop: 10, padding: '12px 14px',
                  background: 'rgba(0, 0, 0, 0.3)', borderRadius: 4,
                  fontSize: 12, color: '#c8c0a8',
                }}>
                  <div style={{ marginBottom: 6 }}>📋 任务：<strong style={{ color: '#f5f0e0' }}>{cq.title}</strong></div>
                  <div style={{ marginBottom: 6, wordBreak: 'break-all' }}>🔗 链接：<span style={{ color: '#7fa0c0' }}>{submissionDraft}</span></div>
                  <div style={{ marginBottom: 6 }}>📊 自评：<strong style={{ color: '#FFD700' }}>x{draftSelfRated}</strong></div>
                  <div style={{ color: '#a8b3a0' }}>预期 CP：{cq.baseCp} × x{draftSelfRated} = ~{expectedCp}（最终由审核员决定）</div>
                </div>
              </div>

              <div style={{
                fontSize: 11, color: '#a8b3a0', lineHeight: 1.7,
                marginBottom: 20, padding: '10px 14px',
                background: 'rgba(192, 128, 112, 0.06)',
                borderRadius: 4, borderLeft: '2px solid rgba(192, 128, 112, 0.3)',
              }}>
                ⏱ 提交后审核启动，3 分钟内可撤回，之后不可。
                <br />
                ⚖️ 审核员会根据你的提交决定最终系数（x0.5 / x1.0 / x2.0）。
                <br />
                📜 不满意结果可申诉一次。
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setConfirmingQuestId(null)}
                  style={{
                    padding: '8px 18px', fontSize: 12,
                    background: 'transparent', color: '#a8b3a0',
                    border: '1px solid rgba(168, 179, 160, 0.3)',
                    borderRadius: 4, cursor: 'pointer',
                    letterSpacing: '0.05em',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={() => confirmedSubmit(confirmingQuestId, submissionDraft, draftSelfRated)}
                  style={{
                    padding: '8px 22px', fontSize: 12,
                    background: '#7fc090', color: '#1a1a1a',
                    border: 'none', borderRadius: 4, cursor: 'pointer',
                    fontWeight: 600, letterSpacing: '0.05em',
                  }}
                >
                  确认提交
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
