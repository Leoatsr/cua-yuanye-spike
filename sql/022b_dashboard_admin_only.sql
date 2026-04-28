-- ============================================================================
-- J2-B Fix 1 · 数据看板加 GitHub 白名单
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 修复：之前 dashboard_*** RPC 任何登录用户都能调用，泄露其他用户数据。
-- 这次：只有指定 GitHub 用户名才能看数据。
--
-- 默认白名单：Leoatsr, webagentlab
-- 要加更多管理员：修改 is_dashboard_admin() 函数
-- ============================================================================

-- ============================================================================
-- Helper: 判断当前用户是否管理员（基于 GitHub username）
-- ============================================================================
create or replace function public.is_dashboard_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  if auth.uid() is null then
    return false;
  end if;

  -- 从 auth.users 取 GitHub username
  select raw_user_meta_data->>'user_name'
  into v_username
  from auth.users
  where id = auth.uid();

  if v_username is null then
    return false;
  end if;

  -- 白名单（大小写不敏感）
  return lower(v_username) in (
    'leoatsr',
    'webagentlab'
  );
end;
$$;

grant execute on function public.is_dashboard_admin() to authenticated;


-- ============================================================================
-- 重建 5 个 J2-A 的 RPC：加白名单检查
-- ============================================================================

-- 1. user_activity
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
  if not is_dashboard_admin() then
    return jsonb_build_object('error', 'forbidden', 'reason', 'admin only');
  end if;

  select count(*) into v_total_users from auth.users;
  select count(distinct user_id) into v_active_today from public.cv_entries where created_at >= now() - interval '1 day';
  select count(distinct user_id) into v_active_week from public.cv_entries where created_at >= now() - interval '7 days';
  select count(distinct user_id) into v_active_month from public.cv_entries where created_at >= now() - interval '30 days';
  select count(*) into v_new_today from auth.users where created_at >= now() - interval '1 day';
  select count(*) into v_new_week from auth.users where created_at >= now() - interval '7 days';
  select count(*) into v_new_month from auth.users where created_at >= now() - interval '30 days';

  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) order by d), '[]'::jsonb)
  into v_dau_series
  from (
    select date_trunc('day', e.created_at)::date as d, count(distinct e.user_id)::int as cnt
    from public.cv_entries e
    where e.created_at >= now() - (p_days || ' days')::interval
    group by date_trunc('day', e.created_at)
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) order by d), '[]'::jsonb)
  into v_new_users_series
  from (
    select date_trunc('day', u.created_at)::date as d, count(*)::int as cnt
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


-- 2. level_distribution
create or replace function public.dashboard_level_distribution()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_levels jsonb;
begin
  if not is_dashboard_admin() then
    return jsonb_build_object('error', 'forbidden', 'reason', 'admin only');
  end if;

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


-- 3. quest_volume
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
  if not is_dashboard_admin() then
    return jsonb_build_object('error', 'forbidden', 'reason', 'admin only');
  end if;

  select count(*) into v_total_all from public.cv_entries;
  select count(*) into v_total_today from public.cv_entries where created_at >= now() - interval '1 day';
  select count(*) into v_total_week from public.cv_entries where created_at >= now() - interval '7 days';
  select count(*) into v_total_month from public.cv_entries where created_at >= now() - interval '30 days';

  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) order by d), '[]'::jsonb)
  into v_volume_series
  from (
    select date_trunc('day', created_at)::date as d, count(*)::int as cnt
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


-- 4. quest_quality
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
  if not is_dashboard_admin() then
    return jsonb_build_object('error', 'forbidden', 'reason', 'admin only');
  end if;

  select count(*) into v_approved from public.cv_entries where status is null or status = 'approved';
  select count(*) into v_rejected from public.cv_entries where status = 'rejected';

  v_pending := 0;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'review_tasks'
  ) then
    execute 'select count(*) from public.review_tasks where status = ''pending'''
    into v_pending;
  end if;

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


-- 5. cv_flow
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
  if not is_dashboard_admin() then
    return jsonb_build_object('error', 'forbidden', 'reason', 'admin only');
  end if;

  select coalesce(sum(cv_amount), 0) into v_total_cv from public.cv_entries
  where status is null or status = 'approved';

  select coalesce(sum(cv_amount), 0) into v_today_cv from public.cv_entries
  where (status is null or status = 'approved') and created_at >= now() - interval '1 day';

  select coalesce(sum(cv_amount), 0) into v_week_cv from public.cv_entries
  where (status is null or status = 'approved') and created_at >= now() - interval '7 days';

  select coalesce(sum(cv_amount), 0) into v_month_cv from public.cv_entries
  where (status is null or status = 'approved') and created_at >= now() - interval '30 days';

  select coalesce(round(v_total_cv / nullif(count(distinct user_id), 0), 1), 0)
  into v_avg_cv_per_user
  from public.cv_entries where status is null or status = 'approved';

  select coalesce(round(avg(cv_amount), 1), 0) into v_avg_cv_per_task
  from public.cv_entries where status is null or status = 'approved';

  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'cv', cv) order by d), '[]'::jsonb)
  into v_cv_series
  from (
    select date_trunc('day', created_at)::date as d, coalesce(sum(cv_amount), 0)::numeric as cv
    from public.cv_entries
    where (status is null or status = 'approved')
      and created_at >= now() - (p_days || ' days')::interval
    group by date_trunc('day', created_at)
  ) t;

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


-- ============================================================================
-- 重建 4 个 J2-B 的 RPC：加白名单检查
-- ============================================================================

-- 6. chat_health
create or replace function public.dashboard_chat_health(
  p_days int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_messages bigint;
  v_today_messages bigint;
  v_week_messages bigint;
  v_world_count bigint;
  v_scene_count bigint;
  v_private_count bigint;
  v_unique_senders bigint;
  v_avg_per_user numeric;
  v_message_series jsonb;
begin
  if not is_dashboard_admin() then
    return jsonb_build_object('error', 'forbidden', 'reason', 'admin only');
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'chat_messages'
  ) then
    return jsonb_build_object('total_messages', 0, 'note', 'chat_messages table not found');
  end if;

  execute 'select count(*) from public.chat_messages' into v_total_messages;
  execute 'select count(*) from public.chat_messages where created_at >= now() - interval ''1 day''' into v_today_messages;
  execute 'select count(*) from public.chat_messages where created_at >= now() - interval ''7 days''' into v_week_messages;
  execute 'select count(*) from public.chat_messages where channel_type = ''world''' into v_world_count;
  execute 'select count(*) from public.chat_messages where channel_type = ''scene''' into v_scene_count;
  execute 'select count(*) from public.chat_messages where channel_type = ''private''' into v_private_count;
  execute 'select count(distinct sender_id) from public.chat_messages where created_at >= now() - interval ''30 days''' into v_unique_senders;

  if v_unique_senders > 0 then
    v_avg_per_user := round(v_week_messages::numeric / v_unique_senders, 1);
  else
    v_avg_per_user := 0;
  end if;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''date'', d, ''count'', cnt) order by d), ''[]''::jsonb)
     from (
       select date_trunc(''day'', created_at)::date as d, count(*)::int as cnt
       from public.chat_messages
       where created_at >= now() - ($1 || '' days'')::interval
       group by date_trunc(''day'', created_at)
     ) t'
  )
  into v_message_series
  using p_days;

  return jsonb_build_object(
    'total_messages', v_total_messages,
    'today_messages', v_today_messages,
    'week_messages', v_week_messages,
    'world_count', v_world_count,
    'scene_count', v_scene_count,
    'private_count', v_private_count,
    'unique_senders_month', v_unique_senders,
    'avg_per_user_week', v_avg_per_user,
    'message_series', v_message_series,
    'window_days', p_days
  );
end;
$$;


-- 7. friends_health
create or replace function public.dashboard_friends_health(
  p_days int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_pairs bigint;
  v_pending_count bigint;
  v_new_friendships_week bigint;
  v_friendships_series jsonb;
  v_top_socializers jsonb;
begin
  if not is_dashboard_admin() then
    return jsonb_build_object('error', 'forbidden', 'reason', 'admin only');
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'friends'
  ) then
    return jsonb_build_object('total_pairs', 0, 'note', 'friends table not found');
  end if;

  execute 'select count(*) / 2 from public.friends where status = ''accepted''' into v_total_pairs;
  execute 'select count(*) from public.friends where status = ''pending''' into v_pending_count;
  execute 'select count(*) / 2 from public.friends where status = ''accepted'' and accepted_at >= now() - interval ''7 days''' into v_new_friendships_week;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''date'', d, ''count'', cnt) order by d), ''[]''::jsonb)
     from (
       select date_trunc(''day'', accepted_at)::date as d, (count(*) / 2)::int as cnt
       from public.friends
       where status = ''accepted'' and accepted_at >= now() - ($1 || '' days'')::interval
       group by date_trunc(''day'', accepted_at)
     ) t'
  )
  into v_friendships_series
  using p_days;

  execute '
    select coalesce(jsonb_agg(t.* order by t.friend_count desc), ''[]''::jsonb)
    from (
      select
        coalesce(p.display_name, ''Anonymous'') as name,
        coalesce(p.username, '''')::text as username,
        coalesce(p.avatar_url, '''')::text as avatar_url,
        count(*)::int as friend_count
      from public.friends f
      left join public.user_profiles p on p.user_id = f.user_id
      where f.status = ''accepted''
      group by f.user_id, p.display_name, p.username, p.avatar_url
      order by friend_count desc
      limit 5
    ) t'
  into v_top_socializers;

  return jsonb_build_object(
    'total_pairs', v_total_pairs,
    'pending_count', v_pending_count,
    'new_friendships_week', v_new_friendships_week,
    'friendships_series', v_friendships_series,
    'top_socializers', v_top_socializers,
    'window_days', p_days
  );
end;
$$;


-- 8. follows_health
create or replace function public.dashboard_follows_health(
  p_days int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_follows bigint;
  v_today_follows bigint;
  v_week_follows bigint;
  v_unique_followers bigint;
  v_unique_followees bigint;
  v_follow_series jsonb;
  v_top_followed jsonb;
begin
  if not is_dashboard_admin() then
    return jsonb_build_object('error', 'forbidden', 'reason', 'admin only');
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'follows'
  ) then
    return jsonb_build_object('total_follows', 0, 'note', 'follows table not found');
  end if;

  execute 'select count(*) from public.follows' into v_total_follows;
  execute 'select count(*) from public.follows where created_at >= now() - interval ''1 day''' into v_today_follows;
  execute 'select count(*) from public.follows where created_at >= now() - interval ''7 days''' into v_week_follows;
  execute 'select count(distinct follower_id) from public.follows' into v_unique_followers;
  execute 'select count(distinct followee_id) from public.follows' into v_unique_followees;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''date'', d, ''count'', cnt) order by d), ''[]''::jsonb)
     from (
       select date_trunc(''day'', created_at)::date as d, count(*)::int as cnt
       from public.follows
       where created_at >= now() - ($1 || '' days'')::interval
       group by date_trunc(''day'', created_at)
     ) t'
  )
  into v_follow_series
  using p_days;

  execute '
    select coalesce(jsonb_agg(t.* order by t.followers_count desc), ''[]''::jsonb)
    from (
      select
        coalesce(p.display_name, ''Anonymous'') as name,
        coalesce(p.username, '''')::text as username,
        coalesce(p.avatar_url, '''')::text as avatar_url,
        count(*)::int as followers_count
      from public.follows f
      left join public.user_profiles p on p.user_id = f.followee_id
      group by f.followee_id, p.display_name, p.username, p.avatar_url
      order by followers_count desc
      limit 5
    ) t'
  into v_top_followed;

  return jsonb_build_object(
    'total_follows', v_total_follows,
    'today_follows', v_today_follows,
    'week_follows', v_week_follows,
    'unique_followers', v_unique_followers,
    'unique_followees', v_unique_followees,
    'follow_series', v_follow_series,
    'top_followed', v_top_followed,
    'window_days', p_days
  );
end;
$$;


-- 9. error_health
create or replace function public.dashboard_error_health(
  p_days int default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_errors bigint;
  v_today_errors bigint;
  v_week_errors bigint;
  v_unique_users_affected bigint;
  v_top_contexts jsonb;
  v_recent_errors jsonb;
  v_error_series jsonb;
begin
  if not is_dashboard_admin() then
    return jsonb_build_object('error', 'forbidden', 'reason', 'admin only');
  end if;

  select count(*) into v_total_errors from public.client_errors;
  select count(*) into v_today_errors from public.client_errors where created_at >= now() - interval '1 day';
  select count(*) into v_week_errors from public.client_errors where created_at >= now() - interval '7 days';
  select count(distinct user_id) into v_unique_users_affected from public.client_errors where created_at >= now() - interval '7 days';

  select coalesce(jsonb_agg(t.* order by t.cnt desc), '[]'::jsonb)
  into v_top_contexts
  from (
    select context, count(*)::int as cnt, max(created_at) as last_seen
    from public.client_errors
    where created_at >= now() - (p_days || ' days')::interval
    group by context
    order by cnt desc
    limit 10
  ) t;

  select coalesce(jsonb_agg(t.* order by t.created_at desc), '[]'::jsonb)
  into v_recent_errors
  from (
    select id, context, message, url, created_at
    from public.client_errors
    order by created_at desc
    limit 10
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) order by d), '[]'::jsonb)
  into v_error_series
  from (
    select date_trunc('day', created_at)::date as d, count(*)::int as cnt
    from public.client_errors
    where created_at >= now() - (p_days || ' days')::interval
    group by date_trunc('day', created_at)
  ) t;

  return jsonb_build_object(
    'total_errors', v_total_errors,
    'today_errors', v_today_errors,
    'week_errors', v_week_errors,
    'unique_users_affected', v_unique_users_affected,
    'top_contexts', v_top_contexts,
    'recent_errors', v_recent_errors,
    'error_series', v_error_series,
    'window_days', p_days
  );
end;
$$;


-- ============================================================================
-- 验证（用 leoatsr 账号登录后跑）
-- ============================================================================
-- select is_dashboard_admin();   -- 应返回 true
-- select dashboard_user_activity(30);  -- 应返回数据，不是 forbidden
