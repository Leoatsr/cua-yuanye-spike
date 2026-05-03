import { useEffect, useState, useCallback } from 'react';
import { getTotalCV, getCVEntries, type CVEntry } from '../lib/cv';
import { getSupabase } from '../lib/supabase';
import { fetchUserLevel, type LevelInfo } from '../lib/levelStore';
import { fetchMyProfile, type UserProfile } from '../lib/profileStore';
import type { Proposal } from '../lib/proposalStore';

export interface AuthInfo {
  username: string;
  avatarUrl: string | null;
  userId: string | null;
}

interface HomeWallData {
  auth: AuthInfo | null;
  totalCV: number;
  cvEntries: CVEntry[];
  myProposals: Proposal[];
  levelInfo: LevelInfo | null;
  profile: UserProfile | null;
  loading: boolean;
}

/**
 * 拉自家小屋·纪念墙数据
 *
 * 1. Local CV (sync · fast)
 * 2. Auth + GitHub avatar
 * 3. 我创建的提案（Supabase）
 * 4. 等级信息
 * 5. 自己的 Profile
 */
export function useHomeWallData(active: boolean): HomeWallData & {
  reload: () => Promise<void>;
} {
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [totalCV, setTotalCV] = useState(0);
  const [cvEntries, setCvEntries] = useState<CVEntry[]>([]);
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Local CV
      setTotalCV(getTotalCV());
      setCvEntries(getCVEntries());

      // 2. Auth
      const supabase = getSupabase();
      if (!supabase) {
        setAuth(null);
        setMyProposals([]);
        setLevelInfo(null);
        setProfile(null);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setAuth(null);
        setMyProposals([]);
        return;
      }

      const meta = user.user_metadata ?? {};
      setAuth({
        username: (meta.user_name ??
          meta.preferred_username ??
          meta.full_name ??
          user.email ??
          'unknown') as string,
        avatarUrl: (meta.avatar_url ?? null) as string | null,
        userId: user.id,
      });

      // 3. My proposals
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMyProposals(data as Proposal[]);
      }

      // 4. Level
      const lvl = await fetchUserLevel();
      setLevelInfo(lvl);

      // 5. Profile
      const prof = await fetchMyProfile();
      setProfile(prof);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void reload();
  }, [active, reload]);

  return {
    auth,
    totalCV,
    cvEntries,
    myProposals,
    levelInfo,
    profile,
    loading,
    reload,
  };
}
