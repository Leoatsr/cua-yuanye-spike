-- ============================================================================
-- D9-B · Pack 2 · 全社区时间线 + 工坊/全局统计
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 加 3 个 RPC：
--   1. get_global_quest_timeline   — 全社区任务时间线（按时间倒序）
--   2. get_workshop_stats          — 9 工坊聚合统计
--   3. get_global_stats            — 全局看板（本周/本月/全部）
-- ============================================================================

-- ============================================================================
-- 1. 全社区时间线（带玩家信息脱敏聚合）
-- ============================================================================
create or replace function public.get_global_quest_timeline(
  p_limit int default 50,
  p_workshop_filter text default null
)
returns table (
  submission_id text,
  user_id uuid,
  display_name text,
  avatar_url text,
  workshop text,
  quest_title text,
  cv_amount numeric,
  submitted_at timestamptz,
  source text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 任何登录用户都能看，但只显示 status='approved'
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    e.submission_id,
    e.user_id,
    coalesce(p.display_name, 'Anonymous')::text as display_name,
    coalesce(p.avatar_url, '')::text as avatar_url,
    coalesce(e.workshop, '萌芽镇')::text as workshop,
    coalesce(e.quest_title, e.submission_id, 'Unknown')::text as quest_title,
    e.cv_amount::numeric,
    e.created_at as submitted_at,
    case
      when e.workshop is not null and e.workshop != '萌芽镇' then 'workshop'
      when e.workshop = '萌芽镇' then 'sprout'
      when e.submission_id like 'review-%' then 'review'
      when e.submission_id like 'proposal-%' then 'proposal'
      else 'other'
    end::text as source
  from public.cv_entries e
  left join public.user_profiles p on p.user_id = e.user_id
  where (e.status is null or e.status = 'approved')
    and (p_workshop_filter is null or e.workshop = p_workshop_filter)
  order by e.created_at desc
  limit p_limit;
end;
$$;

grant execute on function public.get_global_quest_timeline(int, text) to authenticated;


-- ============================================================================
-- 2. 工坊聚合统计 - 每个 workshop 一行
-- ============================================================================
create or replace function public.get_workshop_stats()
returns table (
  workshop text,
  total_completions bigint,
  total_cv numeric,
  unique_contributors bigint,
  avg_cv_per_task numeric,
  last_activity_at timestamptz,
  rank int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  with stats as (
    select
      coalesce(e.workshop, '其他')::text as workshop,
      count(*) as total_completions,
      coalesce(sum(e.cv_amount), 0)::numeric as total_cv,
      count(distinct e.user_id) as unique_contributors,
      coalesce(round(avg(e.cv_amount)::numeric, 1), 0) as avg_cv_per_task,
      max(e.created_at) as last_activity_at
    from public.cv_entries e
    where (e.status is null or e.status = 'approved')
    group by e.workshop
  )
  select
    s.workshop,
    s.total_completions,
    s.total_cv,
    s.unique_contributors,
    s.avg_cv_per_task,
    s.last_activity_at,
    cast(row_number() over (order by s.total_cv desc) as int) as rank
  from stats s
  order by s.total_cv desc;
end;
$$;

grant execute on function public.get_workshop_stats() to authenticated;


-- ============================================================================
-- 3. 全局看板（本周 / 本月 / 全部）
-- ============================================================================
create or replace function public.get_global_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_completions bigint;
  v_total_cv numeric;
  v_total_players bigint;
  v_week_completions bigint;
  v_week_cv numeric;
  v_week_active_players bigint;
  v_month_completions bigint;
  v_month_cv numeric;
  v_month_active_players bigint;
  v_top_contributors jsonb;
  v_top_workshops jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('error', 'not authenticated');
  end if;

  -- All-time
  select
    count(*),
    coalesce(sum(cv_amount), 0),
    count(distinct user_id)
  into v_total_completions, v_total_cv, v_total_players
  from public.cv_entries
  where (status is null or status = 'approved');

  -- Past 7 days
  select
    count(*),
    coalesce(sum(cv_amount), 0),
    count(distinct user_id)
  into v_week_completions, v_week_cv, v_week_active_players
  from public.cv_entries
  where (status is null or status = 'approved')
    and created_at >= now() - interval '7 days';

  -- Past 30 days
  select
    count(*),
    coalesce(sum(cv_amount), 0),
    count(distinct user_id)
  into v_month_completions, v_month_cv, v_month_active_players
  from public.cv_entries
  where (status is null or status = 'approved')
    and created_at >= now() - interval '30 days';

  -- Top 5 contributors (this month)
  select coalesce(jsonb_agg(t.* order by t.cv desc), '[]'::jsonb)
  into v_top_contributors
  from (
    select
      coalesce(p.display_name, 'Anonymous') as name,
      coalesce(p.username, '')::text as username,
      coalesce(p.avatar_url, '')::text as avatar_url,
      sum(e.cv_amount)::numeric as cv,
      count(*)::int as tasks
    from public.cv_entries e
    left join public.user_profiles p on p.user_id = e.user_id
    where (e.status is null or e.status = 'approved')
      and e.created_at >= now() - interval '30 days'
    group by e.user_id, p.display_name, p.username, p.avatar_url
    order by cv desc
    limit 5
  ) t;

  -- Top 3 workshops (this month)
  select coalesce(jsonb_agg(t.* order by t.cv desc), '[]'::jsonb)
  into v_top_workshops
  from (
    select
      coalesce(workshop, '其他')::text as name,
      sum(cv_amount)::numeric as cv,
      count(*)::int as tasks
    from public.cv_entries
    where (status is null or status = 'approved')
      and created_at >= now() - interval '30 days'
    group by workshop
    order by cv desc
    limit 3
  ) t;

  return jsonb_build_object(
    'all_time', jsonb_build_object(
      'completions', v_total_completions,
      'total_cv', v_total_cv,
      'total_players', v_total_players
    ),
    'past_week', jsonb_build_object(
      'completions', v_week_completions,
      'total_cv', v_week_cv,
      'active_players', v_week_active_players
    ),
    'past_month', jsonb_build_object(
      'completions', v_month_completions,
      'total_cv', v_month_cv,
      'active_players', v_month_active_players
    ),
    'top_contributors_month', v_top_contributors,
    'top_workshops_month', v_top_workshops
  );
end;
$$;

grant execute on function public.get_global_stats() to authenticated;


-- ============================================================================
-- 验证
-- ============================================================================
-- select * from get_global_quest_timeline(10);
-- select * from get_workshop_stats();
-- select get_global_stats();
