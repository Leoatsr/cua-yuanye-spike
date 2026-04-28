import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCVEntries, replaceCVLedgerFromCloud, type CVEntry } from '../lib/cv';
import { getAllMailsAsRows, replaceMailsFromCloud, type Mail } from '../lib/mail';
import {
  getAllQuestStatesAsRows,
  replaceQuestStatesFromCloud,
  type QuestState,
} from '../lib/questStore';
import {
  getReviewStateAsRow,
  replaceReviewStateFromCloud,
} from '../lib/reviewerPool';

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error' | 'confirming-pull';

interface UploadResult {
  cv: number;
  mail: number;
  quest: number;
  review: number;
}

interface PullResult {
  cv: number;
  mail: number;
  quest: number;
  review: boolean;
}

/**
 * Cloud sync UI: upload all data + pull from cloud.
 * F2.3: now covers all 4 tables (cv, mail, quest_states, review_tasks).
 */
export function CloudSyncButton({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [pullResult, setPullResult] = useState<PullResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = (window as unknown as { __supabase?: SupabaseClient }).__supabase;
    if (!supabase) {
      setLoggedIn(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session);
    });
  }, []);

  // ===== UPLOAD =====
  const handleUpload = async () => {
    const supabase = (window as unknown as { __supabase?: SupabaseClient }).__supabase;
    if (!supabase) {
      setError('Supabase 未初始化'); setStatus('error'); return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setError('请先登录 GitHub'); setStatus('error'); return;
    }

    setStatus('syncing'); setError('');
    let cv = 0, mail = 0, quest = 0, review = 0;

    // CV
    const cvEntries = getCVEntries();
    if (cvEntries.length > 0) {
      const cvRows = cvEntries.map((e) => ({
        user_id: user.id, submission_id: e.id,
        task_id: e.taskId, task_title: e.taskTitle, workshop: e.workshop,
        coefficient: e.coefficient, base_cp: e.baseCp, cp_earned: e.cpEarned,
        earned_at: new Date(e.earnedAt).toISOString(),
      }));
      const { error: err, count } = await supabase
        .from('cv_entries').upsert(cvRows, { onConflict: 'user_id,submission_id', count: 'exact' });
      if (err) { setError(`CV 上传失败：${err.message}`); setStatus('error'); return; }
      cv = count ?? cvRows.length;
    }

    // Mail
    const mailRows = getAllMailsAsRows(user.id);
    if (mailRows.length > 0) {
      const { error: err, count } = await supabase
        .from('mail').upsert(mailRows, { onConflict: 'user_id,mail_id', count: 'exact' });
      if (err) { setError(`Mail 上传失败：${err.message}`); setStatus('error'); return; }
      mail = count ?? mailRows.length;
    }

    // Quest
    const questRows = getAllQuestStatesAsRows(user.id);
    if (questRows.length > 0) {
      const { error: err, count } = await supabase
        .from('quest_states').upsert(questRows, { onConflict: 'user_id,quest_id', count: 'exact' });
      if (err) { setError(`任务状态上传失败：${err.message}`); setStatus('error'); return; }
      quest = count ?? questRows.length;
    }

    // Review (always 1 row per user)
    const reviewRow = getReviewStateAsRow(user.id);
    const { error: revErr } = await supabase
      .from('review_tasks').upsert(reviewRow, { onConflict: 'user_id' });
    if (revErr) { setError(`审核状态上传失败：${revErr.message}`); setStatus('error'); return; }
    review = 1;

    setUploadResult({ cv, mail, quest, review });
    setStatus('done');
  };

  // ===== PULL =====
  const requestPull = () => setStatus('confirming-pull');

  const handlePull = async () => {
    const supabase = (window as unknown as { __supabase?: SupabaseClient }).__supabase;
    if (!supabase) {
      setError('Supabase 未初始化'); setStatus('error'); return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setError('请先登录 GitHub'); setStatus('error'); return;
    }

    setStatus('syncing'); setError('');
    let cv = 0, mail = 0, quest = 0;
    let reviewLoaded = false;

    // CV: select all entries
    const { data: cvData, error: cvErr } = await supabase
      .from('cv_entries').select('*').eq('user_id', user.id).order('earned_at', { ascending: false });
    if (cvErr) { setError(`CV 拉取失败：${cvErr.message}`); setStatus('error'); return; }
    if (cvData) {
      const entries: CVEntry[] = cvData.map((r) => ({
        id: r.submission_id, taskId: r.task_id, taskTitle: r.task_title,
        workshop: r.workshop, coefficient: Number(r.coefficient),
        baseCp: r.base_cp, cpEarned: r.cp_earned,
        earnedAt: new Date(r.earned_at).getTime(),
      }));
      replaceCVLedgerFromCloud(entries);
      cv = entries.length;
    }

    // Mail
    const { data: mailData, error: mailErr } = await supabase
      .from('mail').select('*').eq('user_id', user.id).order('sent_at', { ascending: false });
    if (mailErr) { setError(`Mail 拉取失败：${mailErr.message}`); setStatus('error'); return; }
    if (mailData) {
      const mails: Mail[] = mailData.map((r) => ({
        id: r.mail_id, category: r.category, from: r.from_name,
        subject: r.subject, body: r.body, read: r.read,
        sentAt: new Date(r.sent_at).getTime(),
        meta: r.meta ?? undefined,
        actions: r.actions ?? undefined,
      }));
      replaceMailsFromCloud(mails);
      mail = mails.length;
    }

    // Quest states
    const { data: questData, error: questErr } = await supabase
      .from('quest_states').select('*').eq('user_id', user.id);
    if (questErr) { setError(`任务状态拉取失败：${questErr.message}`); setStatus('error'); return; }
    if (questData) {
      const rows = questData.map((r) => ({
        quest_id: r.quest_id,
        state: r.state as QuestState,
      }));
      replaceQuestStatesFromCloud(rows);
      quest = rows.length;
    }

    // Review (1 row per user)
    const { data: revData, error: revErr } = await supabase
      .from('review_tasks').select('*').eq('user_id', user.id).maybeSingle();
    if (revErr) { setError(`审核状态拉取失败：${revErr.message}`); setStatus('error'); return; }
    if (revData) {
      replaceReviewStateFromCloud(
        revData.state as { sentSubmissionIds: string[]; tasks: Record<string, unknown> } as never,
        revData.seeded,
      );
      reviewLoaded = true;
    }

    setPullResult({ cv, mail, quest, review: reviewLoaded });
    setStatus('done');
    // Reload page to ensure all components see fresh data
    setTimeout(() => window.location.reload(), 1500);
  };

  if (!loggedIn) return null;

  // ===== UI =====
  if (status === 'confirming-pull') {
    return (
      <div style={{
        padding: '8px 10px', fontSize: 12, lineHeight: 1.5,
        borderTop: '1px solid rgba(245, 240, 224, 0.06)', marginTop: 4,
      }}>
        <div style={{ color: '#e0b060', marginBottom: 8 }}>
          ⚠️ 拉取会用云端数据**覆盖本地**——本地未上传的数据会丢失。确定继续？
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handlePull} style={{
            flex: 1, padding: '5px 10px', fontSize: 11,
            background: 'rgba(192, 128, 112, 0.15)', color: '#c08070',
            border: '1px solid rgba(192, 128, 112, 0.5)',
            borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            确定
          </button>
          <button onClick={() => setStatus('idle')} style={{
            flex: 1, padding: '5px 10px', fontSize: 11,
            background: 'transparent', color: '#a8b3a0',
            border: '1px solid rgba(168, 179, 160, 0.3)',
            borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '8px 10px', fontSize: 12,
      borderTop: '1px solid rgba(245, 240, 224, 0.06)', marginTop: 4,
    }}>
      {status === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={handleUpload} style={{
            padding: '6px 10px', fontSize: 11,
            background: 'rgba(127, 192, 144, 0.12)', color: '#7fc090',
            border: '1px solid rgba(127, 192, 144, 0.4)',
            borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
            letterSpacing: '0.05em',
          }}>
            ⬆ 上传所有数据到云端
          </button>
          <button onClick={requestPull} style={{
            padding: '6px 10px', fontSize: 11,
            background: 'rgba(127, 144, 192, 0.12)', color: '#7f90c0',
            border: '1px solid rgba(127, 144, 192, 0.4)',
            borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
            letterSpacing: '0.05em',
          }}>
            ⬇ 从云端拉取（覆盖本地）
          </button>
        </div>
      )}

      {status === 'syncing' && (
        <div style={{ color: '#a8b3a0', textAlign: 'center', fontSize: 11 }}>
          处理中...
        </div>
      )}

      {status === 'done' && uploadResult && (
        <div style={{ color: '#7fc090', fontSize: 11, lineHeight: 1.6 }}>
          ✓ 已上传 {uploadResult.cv} 条 CV<br />
          ✓ 已上传 {uploadResult.mail} 封邮件<br />
          ✓ 已上传 {uploadResult.quest} 个任务状态<br />
          ✓ 已上传 {uploadResult.review} 份审核进度
          <button onClick={() => { setUploadResult(null); setStatus('idle'); onClose(); }} style={{
            marginTop: 6, width: '100%', padding: '4px 10px', fontSize: 10,
            background: 'transparent', color: '#a8b3a0',
            border: '1px solid rgba(168, 179, 160, 0.3)',
            borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            关闭
          </button>
        </div>
      )}

      {status === 'done' && pullResult && (
        <div style={{ color: '#7f90c0', fontSize: 11, lineHeight: 1.6 }}>
          ✓ 已拉取 {pullResult.cv} 条 CV<br />
          ✓ 已拉取 {pullResult.mail} 封邮件<br />
          ✓ 已拉取 {pullResult.quest} 个任务状态<br />
          ✓ 审核进度：{pullResult.review ? '已恢复' : '云端无数据'}<br />
          <span style={{ color: '#a8b3a0', fontSize: 10 }}>页面即将刷新...</span>
        </div>
      )}

      {status === 'error' && (
        <div style={{ color: '#c08070', fontSize: 11, lineHeight: 1.6 }}>
          ✗ 失败：{error}
          <button onClick={() => { setStatus('idle'); setError(''); }} style={{
            marginTop: 6, width: '100%', padding: '4px 10px', fontSize: 10,
            background: 'transparent', color: '#a8b3a0',
            border: '1px solid rgba(168, 179, 160, 0.3)',
            borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            重试
          </button>
        </div>
      )}
    </div>
  );
}
