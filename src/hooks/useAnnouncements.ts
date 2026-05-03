import { useEffect, useState } from 'react';
import {
  fetchAnnouncements,
  prependSolarTermNotice,
} from '../lib/announcementsStore';

const SEEN_KEY = 'cua-yuanye-announcement-seen-v1';

/**
 * 拉公告内容 + 节气历史 + 已读 fingerprint
 *
 * 返回:
 *   markdown: 完整 markdown（含节气历史 prepend）
 *   loading: 是否加载中
 *   hasUnread: 是否有未读（fingerprint 跟 localStorage 不一致）
 *   markRead: 调用后清除 hasUnread
 */
export function useAnnouncements(): {
  markdown: string;
  loading: boolean;
  hasUnread: boolean;
  markRead: () => void;
} {
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAnnouncements().then((md) => {
      if (cancelled) return;
      const fullMd = prependSolarTermNotice(md);
      setMarkdown(fullMd);
      const fingerprint = fullMd.length.toString() + fullMd.slice(0, 50);
      const seen = localStorage.getItem(SEEN_KEY);
      setHasUnread(seen !== fingerprint);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const markRead = () => {
    if (!markdown) return;
    const fingerprint = markdown.length.toString() + markdown.slice(0, 50);
    localStorage.setItem(SEEN_KEY, fingerprint);
    setHasUnread(false);
  };

  return { markdown, loading, hasUnread, markRead };
}
