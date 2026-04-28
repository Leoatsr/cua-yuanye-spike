-- ============================================================================
-- G5-A · Pack A · 好友系统核心
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 表设计：1 行 = 1 个有向关系（A 邀请 B）
-- 双向好友 = 2 行（A→B + B→A），由 accept_friend RPC 自动建第二行
--
-- 这样比"双向单行"的设计简单：查询 / RLS / 索引都更直接
-- ============================================================================

create table if not exists public.friends (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_id, friend_id),
  check (user_id != friend_id)
);

create index if not exists friends_user_status_idx
  on public.friends (user_id, status);

create index if not exists friends_friend_status_idx
  on public.friends (friend_id, status);


-- ============================================================================
-- RLS
-- ============================================================================
alter table public.friends enable row level security;

drop policy if exists "users see own friend rows" on public.friends;
drop policy if exists "users see incoming pending" on public.friends;
drop policy if exists "users insert own outgoing" on public.friends;
drop policy if exists "users update own friend rows" on public.friends;
drop policy if exists "users delete own friend rows" on public.friends;

-- 看自己作为 user_id 的所有行
create policy "users see own friend rows"
  on public.friends for select
  using (auth.uid() = user_id);

-- 看作为 friend_id 的待处理请求（让我能看到谁邀请我）
create policy "users see incoming pending"
  on public.friends for select
  using (auth.uid() = friend_id and status = 'pending');

-- 只能创建自己作为 user_id 的行
create policy "users insert own outgoing"
  on public.friends for insert
  with check (auth.uid() = user_id);

-- 只能改自己作为 user_id 的行（接受 / 拒绝由 RPC 走 security definer）
create policy "users update own friend rows"
  on public.friends for update
  using (auth.uid() = user_id);

-- 删除自己作为 user_id 的行（解除好友 / 取消请求）
create policy "users delete own friend rows"
  on public.friends for delete
  using (auth.uid() = user_id);


-- ============================================================================
-- RPC 1: 发送好友请求
-- ============================================================================
create or replace function public.send_friend_request(
  p_friend_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_existing record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;
  if v_user_id = p_friend_id then
    return jsonb_build_object('ok', false, 'error', 'cannot friend yourself');
  end if;

  -- Check existing relationship in either direction
  select * into v_existing
  from public.friends
  where (user_id = v_user_id and friend_id = p_friend_id)
     or (user_id = p_friend_id and friend_id = v_user_id)
  limit 1;

  if found then
    if v_existing.status = 'accepted' then
      return jsonb_build_object('ok', false, 'error', 'already friends');
    elsif v_existing.status = 'pending' then
      -- If they already invited me, auto-accept
      if v_existing.user_id = p_friend_id then
        return public.accept_friend_request(p_friend_id);
      end if;
      return jsonb_build_object('ok', false, 'error', 'request pending');
    elsif v_existing.status = 'blocked' then
      return jsonb_build_object('ok', false, 'error', 'blocked');
    end if;
  end if;

  -- Insert new pending request
  insert into public.friends (user_id, friend_id, status)
  values (v_user_id, p_friend_id, 'pending');

  -- Push notification to friend
  insert into public.notifications (user_id, kind, title, body, link, metadata)
  select
    p_friend_id,
    'system',
    '🤝 好友邀请',
    coalesce(p.display_name, 'Anonymous') || ' 想成为你的好友',
    null,
    jsonb_build_object('from_user_id', v_user_id, 'kind', 'friend_request')
  from public.user_profiles p where p.user_id = v_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.send_friend_request(uuid) to authenticated;


-- ============================================================================
-- RPC 2: 接受好友请求（自动建反向行）
-- ============================================================================
create or replace function public.accept_friend_request(
  p_from_user_id uuid
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

  -- Verify the pending request exists
  if not exists (
    select 1 from public.friends
    where user_id = p_from_user_id
      and friend_id = v_user_id
      and status = 'pending'
  ) then
    return jsonb_build_object('ok', false, 'error', 'no pending request');
  end if;

  -- Mark forward direction as accepted
  update public.friends
  set status = 'accepted', accepted_at = now()
  where user_id = p_from_user_id and friend_id = v_user_id;

  -- Insert reverse direction (also accepted)
  insert into public.friends (user_id, friend_id, status, accepted_at)
  values (v_user_id, p_from_user_id, 'accepted', now())
  on conflict (user_id, friend_id) do update
  set status = 'accepted', accepted_at = now();

  -- Notify back
  insert into public.notifications (user_id, kind, title, body, link, metadata)
  select
    p_from_user_id,
    'system',
    '🤝 好友请求已接受',
    coalesce(p.display_name, 'Anonymous') || ' 接受了你的好友邀请',
    null,
    jsonb_build_object('friend_user_id', v_user_id, 'kind', 'friend_accepted')
  from public.user_profiles p where p.user_id = v_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.accept_friend_request(uuid) to authenticated;


-- ============================================================================
-- RPC 3: 拒绝好友请求
-- ============================================================================
create or replace function public.reject_friend_request(
  p_from_user_id uuid
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

  delete from public.friends
  where user_id = p_from_user_id
    and friend_id = v_user_id
    and status = 'pending';

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.reject_friend_request(uuid) to authenticated;


-- ============================================================================
-- RPC 4: 移除好友（双向删）
-- ============================================================================
create or replace function public.remove_friend(
  p_friend_id uuid
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

  delete from public.friends
  where (user_id = v_user_id and friend_id = p_friend_id)
     or (user_id = p_friend_id and friend_id = v_user_id);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.remove_friend(uuid) to authenticated;


-- ============================================================================
-- RPC 5: 取消我发出的请求
-- ============================================================================
create or replace function public.cancel_friend_request(
  p_friend_id uuid
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

  delete from public.friends
  where user_id = v_user_id
    and friend_id = p_friend_id
    and status = 'pending';

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.cancel_friend_request(uuid) to authenticated;


-- ============================================================================
-- RPC 6: 列出我的好友（已 accepted）
-- ============================================================================
create or replace function public.list_my_friends()
returns table (
  friend_id uuid,
  display_name text,
  username text,
  avatar_url text,
  face jsonb,
  level int,
  level_name text,
  total_cv numeric,
  accepted_at timestamptz
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
    f.friend_id,
    coalesce(p.display_name, 'Anonymous')::text as display_name,
    coalesce(p.username, '')::text as username,
    coalesce(p.avatar_url, '')::text as avatar_url,
    coalesce(uf.face_data, '{}'::jsonb) as face,
    coalesce(lv.level, 0)::int as level,
    coalesce(lv.level_name, '新人')::text as level_name,
    coalesce(lv.total_cv, 0)::numeric as total_cv,
    f.accepted_at
  from public.friends f
  left join public.user_profiles p on p.user_id = f.friend_id
  left join (
    select user_id, jsonb_build_object(
      'hairstyle', hairstyle,
      'hair_color', hair_color,
      'outfit_color', outfit_color
    ) as face_data
    from public.user_faces
  ) uf on uf.user_id = f.friend_id
  left join lateral (select * from get_user_level(f.friend_id)) lv on true
  where f.user_id = v_user_id
    and f.status = 'accepted'
  order by f.accepted_at desc nulls last;
end;
$$;

grant execute on function public.list_my_friends() to authenticated;


-- ============================================================================
-- RPC 7: 列出收到的待处理请求 + 我发出的待处理请求
-- ============================================================================
create or replace function public.list_friend_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_incoming jsonb;
  v_outgoing jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('incoming', '[]'::jsonb, 'outgoing', '[]'::jsonb);
  end if;

  -- Incoming (others invited me)
  select coalesce(jsonb_agg(t.* order by t.created_at desc), '[]'::jsonb)
  into v_incoming
  from (
    select
      f.user_id as from_user_id,
      coalesce(p.display_name, 'Anonymous')::text as display_name,
      coalesce(p.username, '')::text as username,
      coalesce(p.avatar_url, '')::text as avatar_url,
      f.created_at
    from public.friends f
    left join public.user_profiles p on p.user_id = f.user_id
    where f.friend_id = v_user_id
      and f.status = 'pending'
  ) t;

  -- Outgoing (I invited others)
  select coalesce(jsonb_agg(t.* order by t.created_at desc), '[]'::jsonb)
  into v_outgoing
  from (
    select
      f.friend_id as to_user_id,
      coalesce(p.display_name, 'Anonymous')::text as display_name,
      coalesce(p.username, '')::text as username,
      coalesce(p.avatar_url, '')::text as avatar_url,
      f.created_at
    from public.friends f
    left join public.user_profiles p on p.user_id = f.friend_id
    where f.user_id = v_user_id
      and f.status = 'pending'
  ) t;

  return jsonb_build_object('incoming', v_incoming, 'outgoing', v_outgoing);
end;
$$;

grant execute on function public.list_friend_requests() to authenticated;


-- ============================================================================
-- RPC 8: 查看与某人的关系
-- ============================================================================
create or replace function public.get_friend_status(
  p_other_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return 'none';
  end if;
  if v_user_id = p_other_user_id then
    return 'self';
  end if;

  -- Check forward
  select status into v_status
  from public.friends
  where user_id = v_user_id and friend_id = p_other_user_id;

  if found then
    if v_status = 'accepted' then return 'friends'; end if;
    if v_status = 'pending' then return 'request_sent'; end if;
    if v_status = 'blocked' then return 'blocked'; end if;
  end if;

  -- Check reverse pending
  select status into v_status
  from public.friends
  where user_id = p_other_user_id and friend_id = v_user_id and status = 'pending';

  if found then
    return 'request_received';
  end if;

  return 'none';
end;
$$;

grant execute on function public.get_friend_status(uuid) to authenticated;


-- ============================================================================
-- 验证
-- ============================================================================
-- select * from list_my_friends();
-- select list_friend_requests();
-- select get_friend_status('某个 user_id 的 uuid');
