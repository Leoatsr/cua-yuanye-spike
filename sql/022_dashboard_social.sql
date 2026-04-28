-- ============================================================================
-- J2-B · Pack 2 · 数据看板（社交健康 + 错误埋点）
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 加：
--   1. client_errors 表（前端错误埋点）
--   2. 4 RPC：聊天 / 好友 / 关注 / 错误
-- ============================================================================

-- ============================================================================
-- 1. client_errors 表 — 前端错误埋点
-- ============================================================================
create table if not exists public.client_errors (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  context text not null,           -- 'fetch-friends' / 'send-message' 等
  message text not null,           -- 错误信息
  stack text,                      -- 堆栈（可选）
  url text,                        -- 当前页 URL
  user_agent text,                 -- 浏览器
  metadata jsonb,                  -- 附加数据
  created_at timestamptz not null default now()
);

create index if not exists client_errors_created_idx
  on public.client_errors (created_at desc);

create index if not exists client_errors_context_idx
  on public.client_errors (context, created_at desc);

create index if not exists client_errors_user_idx
  on public.client_errors (user_id, created_at desc);


-- ============================================================================
-- RLS
-- ============================================================================
alter table public.client_errors enable row level security;

drop policy if exists "users insert own errors" on public.client_errors;
drop policy if exists "users see own errors" on public.client_errors;
drop policy if exists "all auth see error stats" on public.client_errors;

-- 任何登录用户都能写入（用于埋点）
create policy "users insert own errors"
  on public.client_errors for insert
  with check (auth.uid() = user_id or user_id is null);

-- 看自己的错误（debug 用）
create policy "users see own errors"
  on public.client_errors for select
  using (auth.uid() = user_id);


-- ============================================================================
-- RPC 1: 聊天健康
-- ============================================================================
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
  if auth.uid() is null then
    return jsonb_build_object('error', 'not authenticated');
  end if;

  -- 兼容性：如果 chat_messages 表不存在，返回空
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'chat_messages'
  ) then
    return jsonb_build_object(
      'total_messages', 0,
      'note', 'chat_messages table not found'
    );
  end if;

  -- 总数
  execute 'select count(*) from public.chat_messages' into v_total_messages;

  -- 今日
  execute 'select count(*) from public.chat_messages where created_at >= now() - interval ''1 day'''
  into v_today_messages;

  -- 本周
  execute 'select count(*) from public.chat_messages where created_at >= now() - interval ''7 days'''
  into v_week_messages;

  -- 按 channel_type 拆分
  execute 'select count(*) from public.chat_messages where channel_type = ''world'''
  into v_world_count;
  execute 'select count(*) from public.chat_messages where channel_type = ''scene'''
  into v_scene_count;
  execute 'select count(*) from public.chat_messages where channel_type = ''private'''
  into v_private_count;

  -- 独立发言人
  execute 'select count(distinct sender_id) from public.chat_messages where created_at >= now() - interval ''30 days'''
  into v_unique_senders;

  -- 平均
  if v_unique_senders > 0 then
    v_avg_per_user := round(v_week_messages::numeric / v_unique_senders, 1);
  else
    v_avg_per_user := 0;
  end if;

  -- 时间序列
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

grant execute on function public.dashboard_chat_health(int) to authenticated;


-- ============================================================================
-- RPC 2: 好友健康
-- ============================================================================
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
  if auth.uid() is null then
    return jsonb_build_object('error', 'not authenticated');
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'friends'
  ) then
    return jsonb_build_object(
      'total_pairs', 0,
      'note', 'friends table not found'
    );
  end if;

  -- 总好友对数（双向行 / 2，因为 accept 时会建反向行）
  execute 'select count(*) / 2 from public.friends where status = ''accepted'''
  into v_total_pairs;

  -- 待处理请求
  execute 'select count(*) from public.friends where status = ''pending'''
  into v_pending_count;

  -- 本周新成立的好友
  execute 'select count(*) / 2 from public.friends where status = ''accepted'' and accepted_at >= now() - interval ''7 days'''
  into v_new_friendships_week;

  -- 时间序列（每日新增成立的好友数）
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

  -- Top 5 好友最多的人
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

grant execute on function public.dashboard_friends_health(int) to authenticated;


-- ============================================================================
-- RPC 3: 关注健康
-- ============================================================================
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
  if auth.uid() is null then
    return jsonb_build_object('error', 'not authenticated');
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'follows'
  ) then
    return jsonb_build_object(
      'total_follows', 0,
      'note', 'follows table not found'
    );
  end if;

  execute 'select count(*) from public.follows' into v_total_follows;

  execute 'select count(*) from public.follows where created_at >= now() - interval ''1 day'''
  into v_today_follows;

  execute 'select count(*) from public.follows where created_at >= now() - interval ''7 days'''
  into v_week_follows;

  execute 'select count(distinct follower_id) from public.follows' into v_unique_followers;
  execute 'select count(distinct followee_id) from public.follows' into v_unique_followees;

  -- 时间序列
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

  -- Top 5 被关注最多的人
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

grant execute on function public.dashboard_follows_health(int) to authenticated;


-- ============================================================================
-- RPC 4: 错误埋点统计
-- ============================================================================
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
  if auth.uid() is null then
    return jsonb_build_object('error', 'not authenticated');
  end if;

  select count(*) into v_total_errors from public.client_errors;

  select count(*) into v_today_errors
  from public.client_errors
  where created_at >= now() - interval '1 day';

  select count(*) into v_week_errors
  from public.client_errors
  where created_at >= now() - interval '7 days';

  select count(distinct user_id) into v_unique_users_affected
  from public.client_errors
  where created_at >= now() - interval '7 days';

  -- 按 context 聚合
  select coalesce(jsonb_agg(t.* order by t.cnt desc), '[]'::jsonb)
  into v_top_contexts
  from (
    select
      context,
      count(*)::int as cnt,
      max(created_at) as last_seen
    from public.client_errors
    where created_at >= now() - (p_days || ' days')::interval
    group by context
    order by cnt desc
    limit 10
  ) t;

  -- 最近 10 条错误
  select coalesce(jsonb_agg(t.* order by t.created_at desc), '[]'::jsonb)
  into v_recent_errors
  from (
    select
      id,
      context,
      message,
      url,
      created_at
    from public.client_errors
    order by created_at desc
    limit 10
  ) t;

  -- 错误时间序列
  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', cnt) order by d), '[]'::jsonb)
  into v_error_series
  from (
    select
      date_trunc('day', created_at)::date as d,
      count(*)::int as cnt
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

grant execute on function public.dashboard_error_health(int) to authenticated;


-- ============================================================================
-- 验证
-- ============================================================================
-- select dashboard_chat_health(30);
-- select dashboard_friends_health(30);
-- select dashboard_follows_health(30);
-- select dashboard_error_health(7);
