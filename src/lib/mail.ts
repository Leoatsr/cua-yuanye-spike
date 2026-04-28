/**
 * Mail system — F2.1: dual-track (localStorage + cloud).
 *
 * Public API unchanged from C-5. UI components (MailBox, MailBadge) work
 * without changes.
 */

import { fireCloudWrite } from './cloudStore';

export type MailCategory =
  | 'system'
  | 'review'
  | 'verdict'
  | 'appeal'
  | 'cv';

export interface MailAction {
  label: string;
  event: string;
}

export interface Mail {
  id: string;
  category: MailCategory;
  from: string;
  subject: string;
  body: string;
  sentAt: number;
  read: boolean;
  actions?: MailAction[];
  meta?: Record<string, unknown>;
}

const STORAGE_KEY = 'cua-yuanye-mail-v1';

function loadMails(): Mail[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Mail[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveMails(mails: Mail[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mails));
}

// --- Cloud helpers ---

function mailToRow(mail: Mail, userId: string) {
  return {
    user_id: userId,
    mail_id: mail.id,
    category: mail.category,
    from_name: mail.from,
    subject: mail.subject,
    body: mail.body,
    read: mail.read,
    meta: mail.meta ?? null,
    actions: mail.actions ?? null,
    sent_at: new Date(mail.sentAt).toISOString(),
  };
}

// --- Public API (unchanged signatures) ---

export function sendMail(mail: Omit<Mail, 'id' | 'sentAt' | 'read'>): Mail {
  const newMail: Mail = {
    ...mail,
    id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sentAt: Date.now(),
    read: false,
  };
  const all = loadMails();
  all.unshift(newMail);
  saveMails(all);

  // F2.1: cloud write
  fireCloudWrite('sendMail', async (supabase, userId) => {
    return await supabase.from('mail').upsert(mailToRow(newMail, userId));
  });

  return newMail;
}

export function getAllMails(): Mail[] {
  return loadMails();
}

export function getUnreadCount(): number {
  return loadMails().filter((m) => !m.read).length;
}

export function markAsRead(id: string): void {
  const all = loadMails();
  const target = all.find((m) => m.id === id);
  if (!target || target.read) return;
  target.read = true;
  saveMails(all);

  // F2.1: cloud write
  fireCloudWrite('markAsRead', async (supabase, userId) => {
    return await supabase
      .from('mail')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('mail_id', id);
  });
}

export function deleteMail(id: string): void {
  const all = loadMails().filter((m) => m.id !== id);
  saveMails(all);

  // F2.1: cloud write
  fireCloudWrite('deleteMail', async (supabase, userId) => {
    return await supabase
      .from('mail')
      .delete()
      .eq('user_id', userId)
      .eq('mail_id', id);
  });
}

export function ensureWelcomeMails(): void {
  const existing = loadMails();
  if (existing.length > 0) return;

  sendMail({
    category: 'system',
    from: '萌芽镇议事会',
    subject: '欢迎来到萌芽镇',
    body:
      '你好——\n\n' +
      '这里是源野邮筒。系统通知、审核请求、贡献结算，都会送到这里。\n\n' +
      '按 K 键随时打开收件箱。\n\n' +
      '— 萌芽镇议事会',
  });

  sendMail({
    category: 'system',
    from: '系统',
    subject: '关于审核系统（v0.7）',
    body:
      '审核系统正在分阶段上线：\n\n' +
      '✓ v0.7（当前）：邮件系统基础\n' +
      '· v0.8：AI 模拟审核员（你提交的任务会被审核）\n' +
      '· v0.9：CV 入账 + 结果反馈\n' +
      '· v1.0：你也能成为审核员，赚审核 CP\n\n' +
      '在 v0.6 之前提交的任务会保留——等审核系统全部上线后按规则补走流程。\n\n' +
      '感谢你成为这个系统的早期参与者。',
  });
}

// --- F2.1: bulk upload helper for CloudSyncButton ---

/** Returns all mails as Supabase rows for bulk upload. */
export function getAllMailsAsRows(userId: string) {
  return loadMails().map((m) => mailToRow(m, userId));
}

// ===== F2.3: pull-from-cloud helper =====

export function replaceMailsFromCloud(mails: Mail[]) {
  // Sort by sentAt descending (newest first), matching local convention
  const sorted = [...mails].sort((a, b) => b.sentAt - a.sentAt);
  saveMails(sorted);
}
