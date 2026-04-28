import { useEffect } from 'react';
import { EventBus } from '../game/EventBus';
import {
  isReviewSeeded,
  markReviewSeeded,
  sendNextReviewRequest,
} from '../lib/reviewerPool';
import { sendMail } from '../lib/mail';

const SEED_DELAY_MS = 60_000;  // 1 minute after game starts

/**
 * Headless component: when the player first starts the game, after 1 minute
 * automatically send their first review request — via mail — so they
 * discover the review system organically.
 */
export function ReviewSeeder() {
  useEffect(() => {
    if (isReviewSeeded()) return;

    const timer = setTimeout(() => {
      const sub = sendNextReviewRequest();
      if (!sub) return;
      markReviewSeeded();

      sendMail({
        category: 'review',
        from: '审核委员会',
        subject: `✉️ 你被抽中了：审核 ${sub.submitter}的"${sub.taskTitle}"`,
        body:
          `恭喜——你已经成为镇民有一段时间了，议事会决定让你也加入审核队伍。\n\n` +
          `这是你的第一份审核任务：\n\n` +
          `提交者：${sub.submitter}\n` +
          `任务：${sub.taskTitle}\n` +
          `提交者自评：x${sub.selfRated}\n\n` +
          `你的工作很简单：读一下他的提交内容，对照贡献细则，投一票（x0.5 / x1.0 / x2.0）。\n\n` +
          `每完成一次审核，奖励 5 CP；如果你的判断与最终中位数一致，额外 +5。\n\n` +
          `点下方按钮开始审核——或者打开"审核面板"（待会儿会有按钮）。\n\n` +
          `— 审核委员会`,
        meta: { submissionId: sub.id, type: 'first-review-request' },
        actions: [
          { label: '开始审核', event: 'open-review-panel' },
        ],
      });
      EventBus.emit('mail-received');
      EventBus.emit('show-toast', {
        text: `📨 收到第一份审核请求——审核 ${sub.submitter}的"${sub.taskTitle}"`,
      });
    }, SEED_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
