import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import type { QualityCoeff, VirtualSubmission, ReviewTask } from '../lib/reviewerPool';
import {
  getReviewTasks,
  sendNextReviewRequest,
  submitPlayerReview,
  getRemainingSubmissions,
} from '../lib/reviewerPool';
import { sendMail } from '../lib/mail';

const QUALITY_RUBRIC: Record<string, { x05: string; x10: string; x20: string }> = {
  'paper-import': {
    x05: '仅复制粘贴摘要、流派标签打错',
    x10: '准确判定流派、核心字段无遗漏',
    x20: '提取高质量架构图、补全隐藏 Repo 链接',
  },
  'author-card': {
    x05: '提供无效旧链接',
    x10: '完整补充最新履历与机构归属',
    x20: '追踪重大机构变动、梳理师承网络',
  },
  'qa-week': {
    x05: '（不适用）',
    x10: '揪出常规错误，给出修正建议',
    x20: '发现持续性打标错误，从根源优化规范文档',
  },
  'auto-script': {
    x05: '脚本不稳定、漏抓乱码',
    x10: '稳定运行，解放 50% 填表时间',
    x20: '架构优雅、接入 AI 初筛、几乎零人工',
  },
  'tech-quarterly': {
    x05: '简单文字描述、无深度',
    x10: '逻辑严密、准确指出风向',
    x20: '研判超前、成功预警爆发、被广泛引用',
  },
};

function formatRelativeTime(ms: number): string {
  const min = Math.floor(ms / 60_000);
  const hr = Math.floor(ms / 3600_000);
  if (min < 60) return `${min} 分钟前`;
  if (hr < 24) return `${hr} 小时前`;
  return `${Math.floor(ms / 86400_000)} 天前`;
}

export function ReviewPanel() {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftVote, setDraftVote] = useState<QualityCoeff | null>(null);
  const [draftComment, setDraftComment] = useState('');

  const refresh = () => setTasks(getReviewTasks());

  useEffect(() => {
    refresh();

    const onOpen = (data?: { selectSubmissionId?: string }) => {
      refresh();
      setOpen(true);
      if (data?.selectSubmissionId) {
        setSelectedId(data.selectSubmissionId);
      }
    };
    EventBus.on('open-review-panel', onOpen);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      EventBus.off('open-review-panel', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Reset draft when switching selection
  useEffect(() => {
    if (!selectedId) return;
    const t = tasks.find((tt) => tt.submission.id === selectedId);
    if (t?.status === 'completed') {
      setDraftVote(t.playerVote ?? null);
      setDraftComment(t.playerComment ?? '');
    } else {
      setDraftVote(null);
      setDraftComment('');
    }
  }, [selectedId, tasks]);

  const handleSubmit = (sub: VirtualSubmission) => {
    if (!draftVote) return;
    const result = submitPlayerReview(sub.id, draftVote, draftComment);
    if (!result) return;

    // Send "review completed" mail summarizing the result
    const otherCoeffs = (result.aiVotes ?? []).map((v) => `${v.name} 投 x${v.coeff}`).join('、');
    sendMail({
      category: 'verdict',
      from: '审核委员会',
      subject: `🎖️ 审核完成：${sub.submitter}的"${sub.taskTitle}"`,
      body:
        `你刚刚完成了对 ${sub.submitter} 的「${sub.taskTitle}」的审核。\n\n` +
        `你投：x${result.playerVote}\n` +
        `${otherCoeffs}\n` +
        `最终中位数：x${result.finalCoeff}\n\n` +
        `本次审核 CP：${result.reviewCpEarned}\n` +
        (result.playerVote === result.finalCoeff
          ? '— 你的判断与中位数一致，奖励 +5。'
          : '— 你的判断与中位数有偏移。基础奖励 5 CP。\n  这不代表错——审核员各有视角。下次继续。'),
      meta: { submissionId: sub.id, finalCoeff: result.finalCoeff },
    });
    EventBus.emit('mail-received');

    refresh();
  };

  const handleRequestNext = () => {
    const next = sendNextReviewRequest();
    if (!next) {
      EventBus.emit('show-toast', {
        text: '✨ 当前所有审核任务都做完了——感谢你的贡献',
      });
      return;
    }
    sendMail({
      category: 'review',
      from: '审核委员会',
      subject: `✉️ 新的审核请求：${next.submitter}的"${next.taskTitle}"`,
      body:
        `你被随机抽中，作为"${next.taskTitle}"的审核员。\n\n` +
        `提交者：${next.submitter}\n` +
        `自评：x${next.selfRated}\n\n` +
        `打开审核面板（左下角徽章）查看详情并投票。\n` +
        `每次审核基础奖励 5 CP；判断与最终中位数一致额外 +5。\n\n` +
        `— 审核委员会`,
      meta: { submissionId: next.id, type: 'new-review-request' },
      actions: [
        { label: '开始审核', event: 'open-review-panel' },
      ],
    });
    EventBus.emit('mail-received');
    EventBus.emit('show-toast', {
      text: `📨 收到新的审核请求：${next.submitter}的"${next.taskTitle}"`,
    });
    refresh();
  };

  if (!open) return null;

  const selected = selectedId ? tasks.find((t) => t.submission.id === selectedId) : null;
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const remaining = getRemainingSubmissions();

  return (
    <div
      onClick={() => { setOpen(false); setSelectedId(null); }}
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
          width: 'min(960px, 92vw)', height: 'min(680px, 84vh)',
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
            <div style={{ fontSize: 18, color: '#FFD700', letterSpacing: '0.15em' }}>🎖️ 审核面板</div>
            <div style={{ fontSize: 11, color: '#a8b3a0', marginTop: 2 }}>
              待审核 {pendingCount} · 已完成 {completedCount} · 还可领取 {remaining}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {remaining > 0 && (
              <button
                onClick={handleRequestNext}
                style={{
                  padding: '6px 14px', fontSize: 11,
                  background: 'rgba(255, 215, 0, 0.15)',
                  color: '#FFD700',
                  border: '1px solid rgba(255, 215, 0, 0.4)',
                  borderRadius: 4, cursor: 'pointer',
                }}
              >
                + 申请下一个
              </button>
            )}
            <span style={{ fontSize: 11, color: '#8a8576' }}>Esc 关闭</span>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Task list */}
          <div style={{ width: 280, borderRight: '1px solid rgba(220, 180, 60, 0.15)', overflowY: 'auto' }}>
            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#8a8576', fontSize: 12, marginTop: 60, padding: '0 16px', lineHeight: 1.7 }}>
                还没有审核任务。
                <br />
                {remaining > 0 ? '点右上角"+ 申请下一个"' : '已没有更多任务。'}
              </div>
            ) : (
              tasks.map((t) => {
                const isSelected = selectedId === t.submission.id;
                return (
                  <div
                    key={t.submission.id}
                    onClick={() => setSelectedId(t.submission.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(245, 240, 224, 0.06)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(255, 215, 0, 0.08)' : 'transparent',
                      borderLeft: isSelected
                        ? '3px solid #FFD700'
                        : t.status === 'pending' ? '3px solid #e0b060' : '3px solid transparent',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 4 }}>
                      {t.submission.submitter}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f0e0' }}>
                      {t.submission.taskTitle}
                    </div>
                    <div style={{ fontSize: 11, color: '#a8b3a0', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span>自评 x{t.submission.selfRated}</span>
                      <span>{formatRelativeTime(t.submission.submittedAtRelative)}</span>
                    </div>
                    <div style={{ fontSize: 11, marginTop: 6 }}>
                      {t.status === 'pending' && <span style={{ color: '#e0b060' }}>⏳ 待审核</span>}
                      {t.status === 'completed' && (
                        <span style={{ color: '#7fc090' }}>
                          ● 已审核 · +{t.reviewCpEarned} CP
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            {selected ? (
              <>
                <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 4 }}>
                  {selected.submission.submitter} · {selected.submission.workshop}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#FFD700', marginBottom: 8 }}>
                  {selected.submission.taskTitle}
                </div>
                <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 16 }}>
                  自评 x{selected.submission.selfRated} · {formatRelativeTime(selected.submission.submittedAtRelative)}
                </div>

                {/* Submission summary */}
                <div style={{
                  padding: '12px 14px',
                  marginBottom: 16,
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: 4,
                  borderLeft: '2px solid rgba(127, 160, 192, 0.4)',
                }}>
                  <div style={{ fontSize: 11, color: '#a8b3a0', marginBottom: 6 }}>提交内容预览</div>
                  <div style={{
                    fontSize: 12, lineHeight: 1.7, color: '#e0d8c0',
                    whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                  }}>
                    {selected.submission.summary}
                  </div>
                  <div style={{ fontSize: 10, color: '#7fa0c0', marginTop: 8, wordBreak: 'break-all' }}>
                    🔗 {selected.submission.link}
                  </div>
                </div>

                {/* Quality rubric */}
                {QUALITY_RUBRIC[selected.submission.taskId] && (
                  <div style={{
                    padding: '10px 14px',
                    marginBottom: 16,
                    background: 'rgba(255, 215, 0, 0.05)',
                    borderRadius: 4,
                    fontSize: 11, lineHeight: 1.7, color: '#c8c0a8',
                  }}>
                    <div style={{ color: '#a8b3a0', marginBottom: 6 }}>📐 质量系数标准</div>
                    <div><strong style={{ color: '#e07060' }}>x0.5：</strong>{QUALITY_RUBRIC[selected.submission.taskId].x05}</div>
                    <div><strong style={{ color: '#e0b060' }}>x1.0：</strong>{QUALITY_RUBRIC[selected.submission.taskId].x10}</div>
                    <div><strong style={{ color: '#7fc090' }}>x2.0：</strong>{QUALITY_RUBRIC[selected.submission.taskId].x20}</div>
                  </div>
                )}

                {/* Reviewer hint */}
                {selected.submission.reviewerHint && (
                  <div style={{
                    padding: '10px 14px',
                    marginBottom: 20,
                    background: 'rgba(160, 200, 240, 0.06)',
                    borderRadius: 4,
                    borderLeft: '2px solid rgba(160, 200, 240, 0.3)',
                    fontSize: 11, lineHeight: 1.7, color: '#a8c0d8',
                    whiteSpace: 'pre-wrap',
                  }}>
                    💡 审核提示：{selected.submission.reviewerHint}
                  </div>
                )}

                {/* Voting / completed view */}
                {selected.status === 'pending' ? (
                  <>
                    <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 8 }}>
                      你的投票
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      {([0.5, 1.0, 2.0] as QualityCoeff[]).map((c) => (
                        <button
                          key={c}
                          onClick={() => setDraftVote(c)}
                          style={{
                            flex: 1, padding: '10px 12px', fontSize: 13,
                            background: draftVote === c ? '#FFD700' : 'rgba(0, 0, 0, 0.3)',
                            color: draftVote === c ? '#1a1a1a' : '#c8c0a8',
                            border: `1px solid ${draftVote === c ? '#FFD700' : 'rgba(220, 180, 60, 0.2)'}`,
                            borderRadius: 4, cursor: 'pointer',
                            fontWeight: draftVote === c ? 600 : 400,
                          }}
                        >
                          x{c}
                        </button>
                      ))}
                    </div>

                    <div style={{ fontSize: 12, color: '#a8b3a0', marginBottom: 6 }}>
                      评语（可选）
                    </div>
                    <textarea
                      value={draftComment}
                      onChange={(e) => setDraftComment(e.target.value)}
                      placeholder="给提交者一句话——表扬、建议、或批评"
                      rows={3}
                      style={{
                        width: '100%', padding: '8px 12px', fontSize: 12,
                        background: 'rgba(0, 0, 0, 0.3)', color: '#f5f0e0',
                        border: '1px solid rgba(220, 180, 60, 0.3)',
                        borderRadius: 4, marginBottom: 16, boxSizing: 'border-box',
                        fontFamily: 'inherit', resize: 'vertical',
                      }}
                    />

                    <button
                      onClick={() => handleSubmit(selected.submission)}
                      disabled={!draftVote}
                      style={{
                        padding: '10px 20px', fontSize: 13,
                        background: draftVote ? '#7fc090' : '#444',
                        color: '#1a1a1a', border: 'none', borderRadius: 4,
                        cursor: draftVote ? 'pointer' : 'not-allowed',
                        fontWeight: 600, letterSpacing: '0.1em',
                      }}
                    >
                      提交审核（+5 CP，命中中位数额外 +5）
                    </button>
                  </>
                ) : (
                  <div>
                    <div style={{
                      padding: '12px 16px',
                      marginBottom: 14,
                      background: 'rgba(255, 215, 0, 0.08)',
                      borderRadius: 4,
                      borderLeft: '3px solid #FFD700',
                    }}>
                      <div style={{ fontSize: 14, color: '#FFD700', fontWeight: 600, marginBottom: 6 }}>
                        🎖️ 已完成 +{selected.reviewCpEarned} 审核 CP
                      </div>
                      <div style={{ fontSize: 12, color: '#c8c0a8', lineHeight: 1.7 }}>
                        你的判断：x{selected.playerVote}
                        {' · '}
                        最终中位数：x{selected.finalCoeff}
                        {selected.playerVote === selected.finalCoeff
                          ? <span style={{ color: '#7fc090' }}>（一致 +5）</span>
                          : <span style={{ color: '#a8b3a0' }}>（有偏移）</span>}
                      </div>
                    </div>

                    {selected.playerComment && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: '#a8b3a0', marginBottom: 4 }}>你的评语</div>
                        <div style={{
                          fontSize: 12, color: '#e0d8c0', padding: '8px 12px',
                          background: 'rgba(0, 0, 0, 0.2)', borderRadius: 4,
                          lineHeight: 1.6,
                        }}>
                          "{selected.playerComment}"
                        </div>
                      </div>
                    )}

                    {selected.aiVotes && (
                      <>
                        <div style={{ fontSize: 11, color: '#a8b3a0', marginBottom: 8 }}>
                          其他审核员
                        </div>
                        {selected.aiVotes.map((v) => (
                          <div
                            key={v.name}
                            style={{
                              padding: '8px 12px',
                              marginBottom: 6,
                              background: 'rgba(0, 0, 0, 0.2)',
                              borderRadius: 4,
                              fontSize: 12, color: '#c8c0a8',
                            }}
                          >
                            <strong style={{ color: '#e0d8c0' }}>{v.name}</strong>
                            <span style={{ marginLeft: 8, color: '#FFD700' }}>x{v.coeff}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#8a8576', fontSize: 13, marginTop: 80 }}>
                ← 选择左侧的审核任务
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
