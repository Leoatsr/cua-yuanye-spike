import { useEffect } from 'react';
import { EventBus } from '../game/EventBus';
import { sendMail } from '../lib/mail';
import { addCVEntry, computeFinalCoefficient } from '../lib/cv';

/**
 * Headless component that listens for reviewer quorum events and finalizes
 * the task: computes CV, sends the verdict mail, and notifies QuestLog
 * to advance the state machine.
 *
 * Renders nothing — just a side-effect handler at the App root.
 */

interface QuestSnapshot {
  id: string;
  title: string;
  workshop: string;
  baseCp: number;
}

interface QuestStateSnapshot {
  selfRated?: number;
  submissionLink?: string;
  submissionId?: string;
}

interface ReviewerVoteSnapshot {
  reviewerId: 'zhouming' | 'yanzhi' | 'baihui';
  reviewerName: string;
  coeff: number;
  comment: string;
}

interface QuorumPayload {
  submissionId: string;
  taskId: string;
  quest: QuestSnapshot;
  state: QuestStateSnapshot;
  votes: ReviewerVoteSnapshot[];
}

function buildVerdictBody(
  votes: ReviewerVoteSnapshot[],
  selfRated: number,
  finalCoeff: number,
  cpEarned: number
): string {
  const lines: string[] = [];

  // Header
  lines.push(`经过 3 位审核员的协商，最终结果如下：`);
  lines.push('');
  lines.push(`你的自评：x${selfRated}`);
  lines.push(`审核员协商系数：x${finalCoeff}（中位数）`);
  lines.push(`本次入账 CP：${cpEarned}`);
  lines.push('');
  lines.push('—— 审核详情 ——');
  lines.push('');

  // Per-reviewer breakdown
  const order: Array<'zhouming' | 'yanzhi' | 'baihui'> = ['zhouming', 'yanzhi', 'baihui'];
  for (const rid of order) {
    const v = votes.find((vv) => vv.reviewerId === rid);
    if (!v) continue;
    lines.push(`【${v.reviewerName}】 投 x${v.coeff}`);
    lines.push(`  "${v.comment}"`);
    lines.push('');
  }

  // Closing
  if (finalCoeff < selfRated) {
    lines.push('— 提示：本次审核员系数低于你的自评。');
    lines.push('  这不代表否定——是协商后的中位数。');
    lines.push('  下次提交时可以参考审核员的具体建议。');
  } else if (finalCoeff > selfRated) {
    lines.push('— 提示：本次审核员系数高于你的自评。');
    lines.push('  你的工作被认为超出预期——继续保持。');
  } else {
    lines.push('— 提示：你的自评与审核员一致。');
    lines.push('  对自己工作质量的判断很准确。');
  }

  lines.push('');
  lines.push('— 审核委员会');

  return lines.join('\n');
}

export function ReviewProcessor() {
  useEffect(() => {
    const onQuorum = (data: QuorumPayload) => {
      const { submissionId, taskId, quest, state, votes } = data;

      if (votes.length < 3) return;
      if (!state.selfRated) return;

      // Compute final coefficient (median of 3 votes)
      const coeffs = votes.map((v) => v.coeff);
      const finalCoeff = computeFinalCoefficient(coeffs);

      // Add to CV ledger (idempotent — won't double-credit on re-emit)
      const entry = addCVEntry({
        submissionId,
        taskId,
        taskTitle: quest.title,
        workshop: quest.workshop,
        coefficient: finalCoeff,
        baseCp: quest.baseCp,
      });

      // If null, this submission was already finalized — don't send a duplicate mail
      if (!entry) return;

      // Send verdict mail
      const verdictBody = buildVerdictBody(
        votes,
        state.selfRated,
        finalCoeff,
        entry.cpEarned
      );

      sendMail({
        category: 'cv',
        from: '审核委员会',
        subject: `🏆 任务通过：${quest.title}（+${entry.cpEarned} CV）`,
        body: verdictBody,
        meta: {
          taskId,
          submissionId,
          finalCoeff,
          cpEarned: entry.cpEarned,
        },
      });

      // Notify other systems
      EventBus.emit('mail-received');
      EventBus.emit('cv-updated', { totalCV: entry.cpEarned, entry });
      EventBus.emit('quest-finalized', {
        taskId,
        submissionId,
        finalCoeff,
        cpEarned: entry.cpEarned,
      });

      // Toast (let QuestPanel render it via its show-toast handler)
      EventBus.emit('show-toast', {
        text: `🏆 「${quest.title}」结算完成 · +${entry.cpEarned} CV`,
      });
    };

    EventBus.on('reviewer-quorum-reached', onQuorum);
    return () => {
      EventBus.off('reviewer-quorum-reached', onQuorum);
    };
  }, []);

  return null;
}
