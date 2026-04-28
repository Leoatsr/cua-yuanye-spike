-- ============================================================================
-- C5b2 · CV 排行榜 RPC
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 作用：聚合 cv_entries 表，给功德堂的"贡献者排行榜"提供数据。
-- 因为 cv_entries 的 RLS 只让用户读自己——必须用 security definer 函数
-- 绕过 RLS 做聚合。
-- ============================================================================

create or replace function public.get_cv_leaderboard(p_limit int default 20)
returns table (
  user_id uuid,
  user_name text,
  total_cv numeric,
  task_count bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
  select
    cv.user_id,
    coalesce(
      (u.raw_user_meta_data ->> 'user_name'),
      (u.raw_user_meta_data ->> 'preferred_username'),
      (u.raw_user_meta_data ->> 'full_name'),
      u.email,
      'unknown'
    )::text as user_name,
    sum(cv.cp_earned)::numeric as total_cv,
    count(*)::bigint as task_count
  from public.cv_entries cv
  left join auth.users u on u.id = cv.user_id
  group by cv.user_id, u.raw_user_meta_data, u.email
  order by total_cv desc
  limit p_limit;
end;
$$;

grant execute on function public.get_cv_leaderboard(int) to authenticated;
