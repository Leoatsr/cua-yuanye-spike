-- ============================================================================
-- J2-C · Pack 3 · 数据看板（留存 + 在线时长 + scene 分布）
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 加：
--   1. user_sessions 表（每次进入游戏一行，60s 心跳更新）
--   2. 4 RPC：start / heartbeat / end / dashboard_session_stats
--   3. RPC: dashboard_retention（D1/D7/D30 留存）
--   4. RPC: dashboard_online_duration（在线时长）
--   5. RPC: dashboard_scene_distribution（scene 分布）
-- ============================================================================

-- ============================================================================
-- 1. user_sessions 表
-- ============================================================================
create table if not exists public.user_sessions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  ended_at timestamptz,                  -- null = 仍在线（最后心跳距今 < 90s）
  duration_seconds int,                  -- ended_at 写入时计算
  current_scene text,                    -- 'Main' / 'KaiyuanLou' / etc
  user_agent text,
  metadata jsonb
);

create index if not exists user_sessions_user_idx
  on public.user_sessions (user_id, started_at desc);

create index if not exists user_sessions_active_idx
  on public.user_sessions (last_heartbeat_at desc)
  where ended_at is null;

create index if not exists user_sessions_started_idx
  on public.user_sessions (started_at desc);


-- ============================================================================
-- RLS
-- ============================================================================
alter table public.user_sessions enable row level security;

drop policy if exists "users insert own session" on public.user_sessions;
drop policy if exists "users update own session" on public.user_sessions;
drop policy if exists "users see own sessions" on public.user_sessions;

create policy "users insert own session"
  on public.user_sessions for insert
  with check (auth.uid() = user_id);

create policy "users update own session"
  on public.user_sessions for update
  using (auth.uid() = user_id);

create policy "users see own sessions"
  on public.user_sessions for select
  using (auth.uid() = user_id);


-- ============================================================================
-- RPC: 开始 session（返回 session id）
-- ============================================================================
create or replace function public.session_start(
  p_scene text default 'Main',
  p_user_agent text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_session_id bigint;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return null;
  end if;

  -- 关闭这个用户其他还没结束的 sessions（防止重复）
  update public.user_sessions
  set ended_at = last_heartbeat_at,
      duration_seconds = greatest(0, extract(epoch from (last_heartbeat_at - started_at))::int)
  where user_id = v_user_id and ended_at is null;

  insert into public.user_sessions (user_id, current_scene, user_agent)
  values (v_user_id, p_scene, p_user_agent)
  returning id into v_session_id;

  return v_session_id;
end;
$$;

grant execute on function public.session_start(text, text) to authenticated;


-- ============================================================================
-- RPC: 心跳（更新 last_heartbeat_at + current_scene）
-- ============================================================================
create or replace function public.session_heartbeat(
  p_session_id bigint,
  p_scene text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return;
  end if;

  update public.user_sessions
  set
    last_heartbeat_at = now(),
    current_scene = coalesce(p_scene, current_scene)
  where id = p_session_id
    and user_id = v_user_id
    and ended_at is null;
end;
$$;

grant execute on function public.session_heartbeat(bigint, text) to authenticated;


-- ============================================================================
-- RPC: 结束 session
-- ============================================================================
create or replace function public.session_end(
  p_session_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return;
  end if;

  update public.user_sessions
  set
    ended_at = now(),
    duration_seconds = greatest(0, extract(epoch from (now() - started_at))::int)
  where id = p_session_id
    and user_id = v_user_id
    and ended_at is null;
end;
$$;

grant execute on function public.session_end(bigint) to authenticated;


-- ============================================================================
-- RPC: 留存曲线（基于 user_sessions）
-- ============================================================================
create or replace function public.dashboard_retention()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d1 numeric;
  v_d7 numeric;
  v_d30 numeric;
  v_d1_cohort_size int;
  v_d7_cohort_size int;
  v_d30_cohort_size int;
  v_d1_returned int;
  v_d7_returned int;
  v_d30_returned int;
  v_retention_curve jsonb;
begin
  if not is_dashboard_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  -- D1: 至少 2 天前注册的用户中，第二天有 session 的比例
  -- 先算 cohort 大小（>= 2 天前注册的用户数）
  select count(*) into v_d1_cohort_size
  from auth.users
  where created_at <= now() - interval '2 days';

  -- 这些人里，注册后第 1 天（24-48 小时区间）有 session 的
  select count(distinct u.id) into v_d1_returned
  from auth.users u
  inner join public.user_sessions s on s.user_id = u.id
  where u.created_at <= now() - interval '2 days'
    and s.started_at >= u.created_at + interval '1 day'
    and s.started_at < u.created_at + interval '2 days';

  v_d1 := case when v_d1_cohort_size > 0
    then round(100.0 * v_d1_returned / v_d1_cohort_size, 1)
    else 0
  end;

  -- D7: 至少 8 天前注册的用户中，第 7 天有 session 的比例
  select count(*) into v_d7_cohort_size
  from auth.users
  where created_at <= now() - interval '8 days';

  select count(distinct u.id) into v_d7_returned
  from auth.users u
  inner join public.user_sessions s on s.user_id = u.id
  where u.created_at <= now() - interval '8 days'
    and s.started_at >= u.created_at + interval '7 days'
    and s.started_at < u.created_at + interval '8 days';

  v_d7 := case when v_d7_cohort_size > 0
    then round(100.0 * v_d7_returned / v_d7_cohort_size, 1)
    else 0
  end;

  -- D30: 至少 31 天前注册的用户中，第 30 天有 session 的比例
  select count(*) into v_d30_cohort_size
  from auth.users
  where created_at <= now() - interval '31 days';

  select count(distinct u.id) into v_d30_returned
  from auth.users u
  inner join public.user_sessions s on s.user_id = u.id
  where u.created_at <= now() - interval '31 days'
    and s.started_at >= u.created_at + interval '30 days'
    and s.started_at < u.created_at + interval '31 days';

  v_d30 := case when v_d30_cohort_size > 0
    then round(100.0 * v_d30_returned / v_d30_cohort_size, 1)
    else 0
  end;

  -- 留存曲线（D0-D30）
  select coalesce(jsonb_agg(jsonb_build_object('day', d, 'rate', rate) order by d), '[]'::jsonb)
  into v_retention_curve
  from (
    with day_series as (
      select generate_series(0, 30) as d
    ),
    cohort_users as (
      select id, created_at from auth.users
      where created_at >= now() - interval '60 days'
        and created_at <= now() - interval '1 day'
    )
    select
      ds.d,
      case when (select count(*) from cohort_users where created_at <= now() - (ds.d || ' days')::interval) > 0
        then round(100.0 * (
          select count(distinct u.id)
          from cohort_users u
          inner join public.user_sessions s on s.user_id = u.id
          where u.created_at <= now() - (ds.d || ' days')::interval
            and s.started_at >= u.created_at + (ds.d || ' days')::interval
            and s.started_at < u.created_at + ((ds.d + 1) || ' days')::interval
        ) / (
          select count(*) from cohort_users where created_at <= now() - (ds.d || ' days')::interval
        ), 1)
        else 0
      end::numeric as rate
    from day_series ds
  ) t;

  return jsonb_build_object(
    'd1', v_d1,
    'd7', v_d7,
    'd30', v_d30,
    'd1_cohort_size', v_d1_cohort_size,
    'd7_cohort_size', v_d7_cohort_size,
    'd30_cohort_size', v_d30_cohort_size,
    'd1_returned', v_d1_returned,
    'd7_returned', v_d7_returned,
    'd30_returned', v_d30_returned,
    'retention_curve', v_retention_curve
  );
end;
$$;

grant execute on function public.dashboard_retention() to authenticated;


-- ============================================================================
-- RPC: 在线时长统计
-- ============================================================================
create or replace function public.dashboard_online_duration(
  p_days int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_sessions bigint;
  v_active_now bigint;
  v_today_sessions bigint;
  v_week_sessions bigint;
  v_avg_duration_seconds numeric;
  v_median_duration_seconds numeric;
  v_p90_duration_seconds numeric;
  v_total_hours numeric;
  v_duration_by_day jsonb;
  v_top_users jsonb;
begin
  if not is_dashboard_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  -- 总 session 数
  select count(*) into v_total_sessions from public.user_sessions;

  -- 当前在线（90s 内有心跳，且未结束）
  select count(*) into v_active_now
  from public.user_sessions
  where ended_at is null
    and last_heartbeat_at >= now() - interval '90 seconds';

  select count(*) into v_today_sessions
  from public.user_sessions
  where started_at >= now() - interval '1 day';

  select count(*) into v_week_sessions
  from public.user_sessions
  where started_at >= now() - interval '7 days';

  -- 平均时长（仅看已结束 + 时长 > 0 的）
  select
    coalesce(round(avg(duration_seconds), 0), 0),
    coalesce(round(percentile_cont(0.5) within group (order by duration_seconds), 0), 0),
    coalesce(round(percentile_cont(0.9) within group (order by duration_seconds), 0), 0)
  into v_avg_duration_seconds, v_median_duration_seconds, v_p90_duration_seconds
  from public.user_sessions
  where duration_seconds > 0
    and started_at >= now() - (p_days || ' days')::interval;

  -- 总在线小时数
  select coalesce(round(sum(duration_seconds)::numeric / 3600, 1), 0)
  into v_total_hours
  from public.user_sessions
  where duration_seconds > 0
    and started_at >= now() - (p_days || ' days')::interval;

  -- 按日聚合
  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) order by d), '[]'::jsonb)
  into v_duration_by_day
  from (
    select
      date_trunc('day', started_at)::date as d,
      coalesce(round(sum(duration_seconds)::numeric / 3600, 1), 0)::numeric as cnt
    from public.user_sessions
    where started_at >= now() - (p_days || ' days')::interval
      and duration_seconds > 0
    group by date_trunc('day', started_at)
  ) t;

  -- Top 5 在线时长用户
  select coalesce(jsonb_agg(t.* order by t.total_hours desc), '[]'::jsonb)
  into v_top_users
  from (
    select
      coalesce(p.display_name, 'Anonymous') as name,
      coalesce(p.username, '')::text as username,
      coalesce(p.avatar_url, '')::text as avatar_url,
      round(sum(s.duration_seconds)::numeric / 3600, 1) as total_hours,
      count(*)::int as session_count
    from public.user_sessions s
    left join public.user_profiles p on p.user_id = s.user_id
    where s.duration_seconds > 0
      and s.started_at >= now() - (p_days || ' days')::interval
    group by s.user_id, p.display_name, p.username, p.avatar_url
    order by total_hours desc
    limit 5
  ) t;

  return jsonb_build_object(
    'total_sessions', v_total_sessions,
    'active_now', v_active_now,
    'today_sessions', v_today_sessions,
    'week_sessions', v_week_sessions,
    'avg_duration_seconds', v_avg_duration_seconds,
    'median_duration_seconds', v_median_duration_seconds,
    'p90_duration_seconds', v_p90_duration_seconds,
    'total_hours', v_total_hours,
    'duration_by_day', v_duration_by_day,
    'top_users', v_top_users,
    'window_days', p_days
  );
end;
$$;

grant execute on function public.dashboard_online_duration(int) to authenticated;


-- ============================================================================
-- RPC: scene 分布（基于活跃 session 的 current_scene）
-- ============================================================================
create or replace function public.dashboard_scene_distribution()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_now bigint;
  v_scenes jsonb;
  v_scene_total_time jsonb;
begin
  if not is_dashboard_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  -- 当前活跃 session 数
  select count(*) into v_active_now
  from public.user_sessions
  where ended_at is null
    and last_heartbeat_at >= now() - interval '90 seconds';

  -- 当前每个 scene 有多少人
  select coalesce(jsonb_agg(t.* order by t.count desc), '[]'::jsonb)
  into v_scenes
  from (
    select
      coalesce(current_scene, 'Unknown') as scene,
      count(*)::int as count
    from public.user_sessions
    where ended_at is null
      and last_heartbeat_at >= now() - interval '90 seconds'
    group by current_scene
  ) t;

  -- 历史累计：哪个 scene 累计被访问最多（30 天）
  select coalesce(jsonb_agg(t.* order by t.total_seconds desc), '[]'::jsonb)
  into v_scene_total_time
  from (
    select
      coalesce(current_scene, 'Unknown') as scene,
      count(*)::int as visit_count,
      coalesce(round(sum(duration_seconds)::numeric / 60, 0), 0)::int as total_minutes,
      coalesce(sum(duration_seconds), 0)::int as total_seconds
    from public.user_sessions
    where started_at >= now() - interval '30 days'
      and duration_seconds > 0
    group by current_scene
    order by total_seconds desc
    limit 20
  ) t;

  return jsonb_build_object(
    'active_now', v_active_now,
    'scenes_now', v_scenes,
    'scenes_30d', v_scene_total_time
  );
end;
$$;

grant execute on function public.dashboard_scene_distribution() to authenticated;


-- ============================================================================
-- 验证（用 leoatsr 登录后跑）
-- ============================================================================
-- select session_start('Main', 'Test Browser');
-- select session_heartbeat(1, 'KaiyuanLou');
-- select * from user_sessions order by id desc limit 5;
-- select dashboard_retention();
-- select dashboard_online_duration(30);
-- select dashboard_scene_distribution();
