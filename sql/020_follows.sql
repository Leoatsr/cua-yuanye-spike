-- ============================================================================
-- G7-A · Pack D · 关注系统（单向）
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 设计：1 行 = 1 个有向关系（follower → followee）
-- 不需要"接受/拒绝" — 关注是单向的，不需要对方同意
-- ============================================================================

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id != followee_id)
);

create index if not exists follows_follower_idx
  on public.follows (follower_id, created_at desc);

create index if not exists follows_followee_idx
  on public.follows (followee_id, created_at desc);


-- ============================================================================
-- RLS
-- ============================================================================
alter table public.follows enable row level security;

drop policy if exists "users see own follows" on public.follows;
drop policy if exists "users see public followers" on public.follows;
drop policy if exists "users insert own follows" on public.follows;
drop policy if exists "users delete own follows" on public.follows;

-- 任何人都能看任何关注关系（关注是公开行为）
create policy "users see public follows"
  on public.follows for select
  using (true);

-- 只能创建自己作为 follower 的行
create policy "users insert own follows"
  on public.follows for insert
  with check (auth.uid() = follower_id);

-- 只能删除自己作为 follower 的行
create policy "users delete own follows"
  on public.follows for delete
  using (auth.uid() = follower_id);


-- ============================================================================
-- RPC 1: 关注某人
-- ============================================================================
create or replace function public.follow_user(
  p_followee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_already boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;
  if v_user_id = p_followee_id then
    return jsonb_build_object('ok', false, 'error', 'cannot follow yourself');
  end if;

  -- Check existing
  select exists (
    select 1 from public.follows
    where follower_id = v_user_id and followee_id = p_followee_id
  ) into v_already;

  if v_already then
    return jsonb_build_object('ok', false, 'error', 'already following');
  end if;

  insert into public.follows (follower_id, followee_id)
  values (v_user_id, p_followee_id);

  -- Push notification to followee
  insert into public.notifications (user_id, kind, title, body, link, metadata)
  select
    p_followee_id,
    'system',
    '⭐ 新粉丝',
    coalesce(p.display_name, 'Anonymous') || ' 关注了你',
    null,
    jsonb_build_object('follower_id', v_user_id, 'kind', 'new_follower')
  from public.user_profiles p where p.user_id = v_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.follow_user(uuid) to authenticated;


-- ============================================================================
-- RPC 2: 取消关注
-- ============================================================================
create or replace function public.unfollow_user(
  p_followee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  delete from public.follows
  where follower_id = v_user_id
    and followee_id = p_followee_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.unfollow_user(uuid) to authenticated;


-- ============================================================================
-- RPC 3: 列出我关注的人
-- ============================================================================
create or replace function public.list_my_following()
returns table (
  followee_id uuid,
  display_name text,
  username text,
  avatar_url text,
  face jsonb,
  level int,
  level_name text,
  total_cv numeric,
  followed_at timestamptz
)
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

  return query
  select
    f.followee_id,
    coalesce(p.display_name, 'Anonymous')::text as display_name,
    coalesce(p.username, '')::text as username,
    coalesce(p.avatar_url, '')::text as avatar_url,
    coalesce(uf.face_data, '{}'::jsonb) as face,
    coalesce(lv.level, 0)::int as level,
    coalesce(lv.level_name, '新人')::text as level_name,
    coalesce(lv.total_cv, 0)::numeric as total_cv,
    f.created_at as followed_at
  from public.follows f
  left join public.user_profiles p on p.user_id = f.followee_id
  left join (
    select user_id, jsonb_build_object(
      'hairstyle', hairstyle,
      'hair_color', hair_color,
      'outfit_color', outfit_color
    ) as face_data
    from public.user_faces
  ) uf on uf.user_id = f.followee_id
  left join lateral (select * from get_user_level(f.followee_id)) lv on true
  where f.follower_id = v_user_id
  order by f.created_at desc;
end;
$$;

grant execute on function public.list_my_following() to authenticated;


-- ============================================================================
-- RPC 4: 列出我的粉丝
-- ============================================================================
create or replace function public.list_my_followers()
returns table (
  follower_id uuid,
  display_name text,
  username text,
  avatar_url text,
  face jsonb,
  level int,
  level_name text,
  total_cv numeric,
  followed_at timestamptz
)
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

  return query
  select
    f.follower_id,
    coalesce(p.display_name, 'Anonymous')::text as display_name,
    coalesce(p.username, '')::text as username,
    coalesce(p.avatar_url, '')::text as avatar_url,
    coalesce(uf.face_data, '{}'::jsonb) as face,
    coalesce(lv.level, 0)::int as level,
    coalesce(lv.level_name, '新人')::text as level_name,
    coalesce(lv.total_cv, 0)::numeric as total_cv,
    f.created_at as followed_at
  from public.follows f
  left join public.user_profiles p on p.user_id = f.follower_id
  left join (
    select user_id, jsonb_build_object(
      'hairstyle', hairstyle,
      'hair_color', hair_color,
      'outfit_color', outfit_color
    ) as face_data
    from public.user_faces
  ) uf on uf.user_id = f.follower_id
  left join lateral (select * from get_user_level(f.follower_id)) lv on true
  where f.followee_id = v_user_id
  order by f.created_at desc;
end;
$$;

grant execute on function public.list_my_followers() to authenticated;


-- ============================================================================
-- RPC 5: 关注计数 + 关系状态（一次拿全）
-- 用于公开页：显示"X 关注 / Y 粉丝"+ 显示"已关注/未关注"按钮
-- ============================================================================
create or replace function public.get_follow_stats(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_following_count bigint;
  v_followers_count bigint;
  v_i_follow_them boolean;
  v_they_follow_me boolean;
begin
  v_me := auth.uid();

  -- TA 关注的人数
  select count(*) into v_following_count
  from public.follows
  where follower_id = p_user_id;

  -- TA 的粉丝数
  select count(*) into v_followers_count
  from public.follows
  where followee_id = p_user_id;

  -- 我是否关注 TA
  if v_me is null or v_me = p_user_id then
    v_i_follow_them := false;
  else
    select exists (
      select 1 from public.follows
      where follower_id = v_me and followee_id = p_user_id
    ) into v_i_follow_them;
  end if;

  -- TA 是否关注我
  if v_me is null or v_me = p_user_id then
    v_they_follow_me := false;
  else
    select exists (
      select 1 from public.follows
      where follower_id = p_user_id and followee_id = v_me
    ) into v_they_follow_me;
  end if;

  return jsonb_build_object(
    'following_count', v_following_count,
    'followers_count', v_followers_count,
    'i_follow_them', v_i_follow_them,
    'they_follow_me', v_they_follow_me,
    'is_me', v_me = p_user_id
  );
end;
$$;

grant execute on function public.get_follow_stats(uuid) to authenticated;


-- ============================================================================
-- 验证
-- ============================================================================
-- select * from list_my_following();
-- select * from list_my_followers();
-- select get_follow_stats(auth.uid());  -- 自己
