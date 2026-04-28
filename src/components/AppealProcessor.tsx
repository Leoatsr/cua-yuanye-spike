import { useEffect } from 'react';
import { EventBus } from '../game/EventBus';
import { sendMail } from '../lib/mail';
import { addCVEntry, computeFinalCoefficient } from '../lib/cv';
import type { AppealReviewerVote } from '../lib/appealReviewers';

/**
 * Headless component: listens for the 3rd appeal vote and finalizes the
 * appeal with the "upward-only" rule:
 *
 * - new median > original → CV difference is added (positive supplement)
 * - new median = original → no change, just notify
 * - new median < original → IGNORED, original stands. We still show the votes
 *   transparently so the player can see all 3 reviewers' opinions.
 *
 * We compensate by adding (newCp - oldCp) to the CV ledger as a top-up entry.
 */

interface AppealQuorumPayload {
  appealId: string;
  taskId: string;
  taskTitle: string;
  workshop: string;
  baseCp: number;
  selfRated: number;
  originalCoeff: number;
  originalCpEarned: number;
  votes: AppealReviewerVote[];
}

function buildAppealResultBody(
  votes: AppealReviewerVote[],
  _selfRated: number,
  originalCoeff: number,
  appealCoeff: number,
  finalCoeff: number,
  newCp: number,
  topUpCp: number,
  outcome: 'upgrade' | 'maintain' | 'declined',
): string {
  const lines: string[] = [];

  lines.push('—— 申诉复审 ——');
  lines.push('');
  lines.push(`原审核中位数：x${originalCoeff}`);
  lines.push(`复审中位数：x${appealCoeff}`);
  lines.push('');
  lines.push('—— 复审员意见 ——');
  lines.push('');
  const order: Array<'xiechen' | 'liming' | 'suyan'> = ['xiechen', 'liming', 'suyan'];
  for (const rid of order) {
    const v = votes.find((vv) => vv.reviewerId === rid);
    if (!v) continue;
    lines.push(`【${v.reviewerName}】 投 x${v.coeff}`);
    lines.push(`  "${v.comment}"`);
    lines.push('');
  }

  if (outcome === 'upgrade') {
    lines.push('—— 申诉成功 ——');
    lines.push('');
    lines.push(`最终系数：x${finalCoeff}（取上调结果）`);
    lines.push(`新 CP 总额：${newCp}`);
    lines.push(`补差额：+${topUpCp} CV`);
    lines.push('');
    lines.push('你的判断被复审员认可。继续保持。');
  } else if (outcome === 'maintain') {
    lines.push('—— 维持原判 ——');
    lines.push('');
    lines.push(`复审中位数与原审一致：x${originalCoeff}`);
    lines.push(`CP 不变：${newCp}`);
    lines.push('');
    lines.push('复审员的判断与原审核一致——你的工作量已被准确评价。');
  } else {
    // declined: appeal would have lowered, but we never lower
    lines.push('—— 维持原判 ——');
    lines.push('');
    lines.push(`复审中位数 x${appealCoeff} < 原审 x${originalCoeff}`);
    lines.push(`按申诉规则，结算只上调不下调——维持原判。`);
    lines.push(`CP 不变：${newCp}`);
    lines.push('');
    lines.push('复审员意见有所分歧，但 CUA 申诉机制保证：你不会因为申诉而被扣分。');
    lines.push('保留所有投票记录在任务详情中——欢迎对照贡献细则自查。');
  }

  lines.push('');
  lines.push('— 审核委员会');
  return lines.join('\n');
}

export function AppealProcessor() {
  useEffect(() => {
    // Forward each vote to UI for progressive updates.
    // QuestLog tracks full appeal state and is responsible for emitting
    // 'appeal-quorum-reached' with full payload (taskId, baseCp, etc.) when
    // the 3rd vote arrives.

    const onVoteCast = (data: { appealId: string; vote: AppealReviewerVote }) => {
      EventBus.emit('show-toast', {
        text: `📜 ${data.vote.reviewerName} 完成了申诉复审`,
      });
      // QuestLog will handle aggregation
      EventBus.emit('appeal-vote-progress', {
        appealId: data.appealId,
        vote: data.vote,
      });
    };

    EventBus.on('appeal-vote-cast', onVoteCast);

    const onQuorum = (data: AppealQuorumPayload) => {
      const { appealId, taskId, taskTitle, workshop, baseCp,
              selfRated, originalCoeff, originalCpEarned, votes } = data;

      if (votes.length < 3) return;

      const coeffs = votes.map((v) => v.coeff);
      const appealCoeff = computeFinalCoefficient(coeffs);

      // Apply the "upward-only" rule
      let outcome: 'upgrade' | 'maintain' | 'declined';
      let finalCoeff: number;
      let topUpCp = 0;
      let newCp = originalCpEarned;

      if (appealCoeff > originalCoeff) {
        outcome = 'upgrade';
        finalCoeff = appealCoeff;
        newCp = Math.round(baseCp * finalCoeff);
        topUpCp = newCp - originalCpEarned;
      } else if (appealCoeff === originalCoeff) {
        outcome = 'maintain';
        finalCoeff = originalCoeff;
      } else {
        outcome = 'declined';
        finalCoeff = originalCoeff;
      }

      // Add top-up CV entry if there's a positive delta
      if (topUpCp > 0) {
        addCVEntry({
          submissionId: `${appealId}-topup`,
          taskId,
          taskTitle: `${taskTitle}（申诉补差）`,
          workshop,
          coefficient: 1.0,
          baseCp: topUpCp,
        });
        EventBus.emit('cv-updated', { totalCV: topUpCp });
      }

      // Send result mail
      const subject =
        outcome === 'upgrade' ? `📜 申诉成功：${taskTitle}（+${topUpCp} CV）`
        : `📜 申诉复审：${taskTitle}（维持原判）`;

      sendMail({
        category: 'appeal',
        from: '审核委员会 · 申诉复审',
        subject,
        body: buildAppealResultBody(
          votes, selfRated, originalCoeff, appealCoeff, finalCoeff,
          newCp, topUpCp, outcome,
        ),
        meta: { appealId, taskId, outcome, finalCoeff, topUpCp },
      });
      EventBus.emit('mail-received');

      // Tell QuestLog to finalize the appeal state in the quest record
      EventBus.emit('appeal-finalized', {
        appealId,
        taskId,
        outcome,
        appealCoeff,
        finalCoeff,
        newCp,
        topUpCp,
        votes,
      });

      const toastText =
        outcome === 'upgrade' ? `📜 申诉成功：「${taskTitle}」+${topUpCp} CV`
        : `📜 申诉复审完成：「${taskTitle}」维持原判`;
      EventBus.emit('show-toast', { text: toastText });
    };

    EventBus.on('appeal-quorum-reached', onQuorum);

    return () => {
      EventBus.off('appeal-vote-cast', onVoteCast);
      EventBus.off('appeal-quorum-reached', onQuorum);
    };
  }, []);

  return null;
}
