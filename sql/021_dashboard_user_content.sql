-- ============================================================================
-- J2-A · Pack 1 · 数据看板（用户 + 内容健康）
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 5 个 RPC：
--   1. dashboard_user_activity   — 用户活跃趋势（按日聚合，N 天序列）
--   2. dashboard_level_distribution — 等级分布（L0-L4 各多少人）
--   3. dashboard_quest_volume    — 任务提交量趋势（按日聚合）
--   4. dashboard_quest_quality   — 任务通过率 + 工坊对比
--   5. dashboard_cv_flow         — CV 经济流转（按日聚合）
-- ============================================================================

-- ============================================================================
-- RPC 1: 用户活跃趋势（DAU 序列 + 累计用户）
-- ============================================================================
create or replace function public.dashboard_user_activity(
  p_days int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dau_series jsonb;
  v_new_users_series jsonb;
  v_total_users bigint;
  v_active_today bigint;
  v_active_week bigint;
  v_active_month bigint;
  v_new_today bigint;
  v_new_week bigint;
  v_new_month bigint;
begin
  if auth.uid() is null then
    return jsonb_build_object('error', 'not authenticated');
  end if;

  -- 总用户数
  select count(*) into v_total_users from auth.users;

  -- 活跃用户（按 cv_entries 提交时间统计）
  select count(distinct user_id) into v_active_today
  from public.cv_entries
  where created_at >= now() - interval '1 day';

  select count(distinct user_id) into v_active_week
  from public.cv_entries
  where created_at >= now() - interval '7 days';

  select count(distinct user_id) into v_active_month
  from public.cv_entries
  where created_at >= now() - interval '30 days';

  -- 新增用户
  select count(*) into v_new_today
  from auth.users
  where created_at >= now() - interval '1 day';

  select count(*) into v_new_week
  from auth.users
  where created_at >= now() - interval '7 days';

  select count(*) into v_new_month
  from auth.users
  where created_at >= now() - interval '30 days';

  -- DAU 序列（每天有几个 distinct user 提交）
  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) order by d), '[]'::jsonb)
  into v_dau_series
  from (
    select
      date_trunc('day', e.created_at)::date as d,
      count(distinct e.user_id)::int as cnt
    from public.cv_entries e
    where e.created_at >= now() - (p_days || ' days')::interval
    group by date_trunc('day', e.created_at)
  ) t;

  -- 新增用户序列
  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) order by d), '[]'::jsonb)
  into v_new_users_series
  from (
    select
      date_trunc('day', u.created_at)::date as d,
      count(*)::int as cnt
    from auth.users u
    where u.created_at >= now() - (p_days || ' days')::interval
    group by date_trunc('day', u.created_at)
  ) t;

  return jsonb_build_object(
    'total_users', v_total_users,
    'active_today', v_active_today,
    'active_week', v_active_week,
    'active_month', v_active_month,
    'new_today', v_new_today,
    'new_week', v_new_week,
    'new_month', v_new_month,
    'dau_series', v_dau_series,
    'new_users_series', v_new_users_series,
    'window_days', p_days
  );
end;
$$;

grant execute on function public.dashboard_user_activity(int) to authenticated;


-- ============================================================================
-- RPC 2: 等级分布
-- ============================================================================
create or replace function public.dashboard_level_distribution()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_levels jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('error', 'not authenticated');
  end if;

  -- 用 cv_entries 计算每个用户的总 CV，再按等级阈值分桶
  -- L0=新人 (0-49), L1=活跃贡献者 (50-199), L2=mentor (200-499)
  -- L3=核心贡献者 (500-1499), L4=共建人（人工授予）
  select coalesce(jsonb_agg(jsonb_build_object(
    'level', level_num,
    'level_name', level_name,
    'count', cnt
  ) order by level_num), '[]'::jsonb)
  into v_levels
  from (
    select 0 as level_num, '新人' as level_name,
      (select count(*) from auth.users u
       where coalesce((select sum(cv_amount) from public.cv_entries where user_id = u.id), 0) < 50
      )::int as cnt
    union all
    select 1, '活跃贡献者',
      (select count(*) from auth.users u
       where coalesce((select sum(cv_amount) from public.cv_entries where user_id = u.id), 0) between 50 and 199
      )::int
    union all
    select 2, 'mentor',
      (select count(*) from auth.users u
       where coalesce((select sum(cv_amount) from public.cv_entries where user_id = u.id), 0) between 200 and 499
      )::int
    union all
    select 3, '核心贡献者',
      (select count(*) from auth.users u
       where coalesce((select sum(cv_amount) from public.cv_entries where user_id = u.id), 0) >= 500
      )::int
  ) t;

  return jsonb_build_object('levels', v_levels);
end;
$$;

grant execute on function public.dashboard_level_distribution() to authenticated;


-- ============================================================================
-- RPC 3: 任务提交量趋势
-- ============================================================================
create or replace function public.dashboard_quest_volume(
  p_days int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_volume_series jsonb;
  v_total_today bigint;
  v_total_week bigint;
  v_total_month bigint;
  v_total_all bigint;
begin
  if auth.uid() is null then
    return jsonb_build_object('error', 'not authenticated');
  end if;

  select count(*) into v_total_all from public.cv_entries;

  select count(*) into v_total_today
  from public.cv_entries
  where created_at >= now() - interval '1 day';

  select count(*) into v_total_week
  from public.cv_entries
  where created_at >= now() - interval '7 days';

  select count(*) into v_total_month
  from public.cv_entries
  where created_at >= now() - interval '30 days';

  -- 按日聚合
  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) order by d), '[]'::jsonb)
  into v_volume_series
  from (
    select
      date_trunc('day', created_at)::date as d,
      count(*)::int as cnt
    from public.cv_entries
    where created_at >= now() - (p_days || ' days')::interval
    group by date_trunc('day', created_at)
  ) t;

  return jsonb_build_object(
    'total_all', v_total_all,
    'total_today', v_total_today,
    'total_week', v_total_week,
    'total_month', v_total_month,
    'volume_series', v_volume_series,
    'window_days', p_days
  );
end;
$$;

grant execute on function public.dashboard_quest_volume(int) to authenticated;


-- ============================================================================
-- RPC 4: 任务质量（通过率 + 9 工坊对比）
-- ============================================================================
create or replace function public.dashboard_quest_quality()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approved bigint;
  v_rejected bigint;
  v_pending bigint;
  v_workshop_breakdown jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('error', 'not authenticated');
  end if;

  -- 整体通过/否决分布
  select count(*) into v_approved
  from public.cv_entries
  where status is null or status = 'approved';

  select count(*) into v_rejected
  from public.cv_entries
  where status = 'rejected';

  -- pending 来自 review_tasks（如果存在该表）
  v_pending := 0;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'review_tasks'
  ) then
    execute 'select count(*) from public.review_tasks where status = ''pending'''
    into v_pending;
  end if;

  -- 9 工坊对比
  select coalesce(jsonb_agg(jsonb_build_object(
    'workshop', workshop,
    'count', cnt,
    'cv', cv,
    'unique_users', users
  ) order by cv desc), '[]'::jsonb)
  into v_workshop_breakdown
  from (
    select
      coalesce(workshop, '其他')::text as workshop,
      count(*)::int as cnt,
      coalesce(sum(cv_amount), 0)::numeric as cv,
      count(distinct user_id)::int as users
    from public.cv_entries
    where (status is null or status = 'approved')
    group by workshop
  ) t;

  return jsonb_build_object(
    'approved', v_approved,
    'rejected', v_rejected,
    'pending', v_pending,
    'workshop_breakdown', v_workshop_breakdown
  );
end;
$$;

grant execute on function public.dashboard_quest_quality() to authenticated;


-- ============================================================================
-- RPC 5: CV 经济流转
-- ============================================================================
create or replace function public.dashboard_cv_flow(
  p_days int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_cv numeric;
  v_today_cv numeric;
  v_week_cv numeric;
  v_month_cv numeric;
  v_avg_cv_per_user numeric;
  v_avg_cv_per_task numeric;
  v_cv_series jsonb;
  v_top_earners jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('error', 'not authenticated');
  end if;

  select coalesce(sum(cv_amount), 0) into v_total_cv from public.cv_entries
  where status is null or status = 'approved';

  select coalesce(sum(cv_amount), 0) into v_today_cv from public.cv_entries
  where (status is null or status = 'approved') and created_at >= now() - interval '1 day';

  select coalesce(sum(cv_amount), 0) into v_week_cv from public.cv_entries
  where (status is null or status = 'approved') and created_at >= now() - interval '7 days';

  select coalesce(sum(cv_amount), 0) into v_month_cv from public.cv_entries
  where (status is null or status = 'approved') and created_at >= now() - interval '30 days';

  -- 平均
  select coalesce(round(v_total_cv / nullif(count(distinct user_id), 0), 1), 0)
  into v_avg_cv_per_user
  from public.cv_entries where status is null or status = 'approved';

  select coalesce(round(avg(cv_amount), 1), 0) into v_avg_cv_per_task
  from public.cv_entries where status is null or status = 'approved';

  -- CV 序列（每日发出 CV）
  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'cv', cv) order by d), '[]'::jsonb)
  into v_cv_series
  from (
    select
      date_trunc('day', created_at)::date as d,
      coalesce(sum(cv_amount), 0)::numeric as cv
    from public.cv_entries
    where (status is null or status = 'approved')
      and created_at >= now() - (p_days || ' days')::interval
    group by date_trunc('day', created_at)
  ) t;

  -- Top 5 earners (period)
  select coalesce(jsonb_agg(t.* order by t.cv desc), '[]'::jsonb)
  into v_top_earners
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
      and e.created_at >= now() - (p_days || ' days')::interval
    group by e.user_id, p.display_name, p.username, p.avatar_url
    order by cv desc
    limit 5
  ) t;

  return jsonb_build_object(
    'total_cv', v_total_cv,
    'today_cv', v_today_cv,
    'week_cv', v_week_cv,
    'month_cv', v_month_cv,
    'avg_cv_per_user', v_avg_cv_per_user,
    'avg_cv_per_task', v_avg_cv_per_task,
    'cv_series', v_cv_series,
    'top_earners', v_top_earners,
    'window_days', p_days
  );
end;
$$;

grant execute on function public.dashboard_cv_flow(int) to authenticated;


-- ============================================================================
-- 验证
-- ============================================================================
-- select dashboard_user_activity(30);
-- select dashboard_level_distribution();
-- select dashboard_quest_volume(30);
-- select dashboard_quest_quality();
-- select dashboard_cv_flow(30);
