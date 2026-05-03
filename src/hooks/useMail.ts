import { useEffect, useState, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import {
  getAllMails,
  getUnreadCount,
  markAsRead as markAsReadStore,
  deleteMail as deleteMailStore,
  type Mail,
} from '../lib/mail';

/**
 * 监听邮件列表 + 未读数
 *
 * 订阅 'mail-received' EventBus
 * 提供 markAsRead / deleteMail 包装（自动 refresh）
 */
export function useMail(): {
  mails: Mail[];
  unreadCount: number;
  refresh: () => void;
  markAsRead: (id: string) => void;
  deleteMail: (id: string) => void;
} {
  const [mails, setMails] = useState<Mail[]>(() => getAllMails());
  const [unreadCount, setUnreadCount] = useState<number>(() => getUnreadCount());

  const refresh = useCallback(() => {
    setMails(getAllMails());
    setUnreadCount(getUnreadCount());
  }, []);

  const markAsRead = useCallback(
    (id: string) => {
      markAsReadStore(id);
      refresh();
    },
    [refresh],
  );

  const deleteMail = useCallback(
    (id: string) => {
      deleteMailStore(id);
      refresh();
    },
    [refresh],
  );

  useEffect(() => {
    const onMailReceived = () => refresh();
    EventBus.on('mail-received', onMailReceived);
    return () => {
      EventBus.off('mail-received', onMailReceived);
    };
  }, [refresh]);

  return { mails, unreadCount, refresh, markAsRead, deleteMail };
}
