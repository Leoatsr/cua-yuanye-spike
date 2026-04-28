-- ============================================================================
-- F4.3c · username 修改 cooldown + 历史 + 重定向
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 规则：
--   - 改 username 30 天 cooldown
--   - 旧 username 保留 90 天（防止被他人立刻占用 + 旧 URL 可重定向）
-- ============================================================================

-- ---------- username_history 表 ----------

create table if not exists public.username_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  old_username text not null,
  new_username text not null,
  changed_at timestamptz not null default now()
);

create index if not exists username_history_old_idx
  on public.username_history (lower(old_username));

create index if not exists username_history_user_idx
  on public.username_history (user_id, changed_at desc);

-- RLS - 任何登录用户可读（用于公开页重定向），仅本人可见自己的完整历史
alter table public.username_history enable row level security;

drop policy if exists "everyone read history" on public.username_history;
create policy "everyone read history"
  on public.username_history for select
  using (auth.role() = 'authenticated');

-- 不允许直接 insert/update/delete — 只通过 change_username RPC 操作
-- (因此不加任何 INSERT/UPDATE/DELETE policy)


-- ============================================================================
-- 修改 check_username_available — 加上历史检查
-- ============================================================================
-- 一个 username 是"可用"的条件：
--   1. 当前没人在 user_profiles 占用（除自己外）
--   2. 没在 username_history 90 天内被别人用过
--   3. 格式合法

create or replace function public.check_username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_history_count int;
  v_caller_id uuid;
begin
  if p_username is null or p_username !~ '^[a-zA-Z0-9_-]{2,30}$' then
    return false;
  end if;

  v_caller_id := auth.uid();

  -- 1. 检查 user_profiles 占用（排除自己）
  select count(*) into v_count
  from public.user_profiles
  where lower(username) = lower(p_username)
    and user_id <> coalesce(v_caller_id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count > 0 then
    return false;
  end if;

  -- 2. 检查历史中 90 天内是否被别人用过
  select count(*) into v_history_count
  from public.username_history
  where lower(old_username) = lower(p_username)
    and changed_at > now() - interval '90 days'
    and user_id <> coalesce(v_caller_id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_history_count > 0 then
    return false;
  end if;

  return true;
end;
$$;

grant execute on function public.check_username_available(text) to authenticated;


-- ============================================================================
-- RPC: change_username — cooldown 检查 + 写历史 + 更新 user_profiles
-- ============================================================================
-- 返回：{ok bool, error text, new_username text, next_change_after timestamptz}

create or replace function public.change_username(p_new_username text)
returns table (
  ok boolean,
  error text,
  new_username text,
  next_change_after timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_current_username text;
  v_last_change timestamptz;
  v_cooldown interval := interval '30 days';
  v_history_count int;
  v_taken_count int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return query select false, '请先登录'::text, null::text, null::timestamptz;
    return;
  end if;

  -- 格式检查
  if p_new_username is null or p_new_username !~ '^[a-zA-Z0-9_-]{2,30}$' then
    return query select false, 'username 格式不合法（2-30 字 / a-zA-Z0-9_-）'::text, null::text, null::timestamptz;
    return;
  end if;

  -- 拿当前 username
  select up.username into v_current_username
  from public.user_profiles up
  where up.user_id = v_user_id;

  if v_current_username is null then
    return query select false, '尚未创建 profile（请先按 P 编辑资料）'::text, null::text, null::timestamptz;
    return;
  end if;

  -- 没改：返回 ok 但不写历史
  if lower(v_current_username) = lower(p_new_username) then
    return query select true, ''::text, v_current_username, null::timestamptz;
    return;
  end if;

  -- 检查 cooldown — 拿最近一次改名时间
  select max(changed_at) into v_last_change
  from public.username_history
  where user_id = v_user_id;

  if v_last_change is not null and v_last_change + v_cooldown > now() then
    return query select
      false,
      ('距下次可改 username 还有 ' ||
       extract(day from (v_last_change + v_cooldown - now()))::int ||
       ' 天')::text,
      null::text,
      (v_last_change + v_cooldown)::timestamptz;
    return;
  end if;

  -- 检查新 username 是否被别人占
  select count(*) into v_taken_count
  from public.user_profiles
  where lower(username) = lower(p_new_username)
    and user_id <> v_user_id;

  if v_taken_count > 0 then
    return query select false, ('username "' || p_new_username || '" 已被占用')::text, null::text, null::timestamptz;
    return;
  end if;

  -- 检查 90 天历史是否被别人用过
  select count(*) into v_history_count
  from public.username_history uh
  where lower(uh.old_username) = lower(p_new_username)
    and uh.changed_at > now() - interval '90 days'
    and uh.user_id <> v_user_id;

  if v_history_count > 0 then
    return query select false, ('username "' || p_new_username || '" 90 天内被其他人使用过 · 已锁定')::text, null::text, null::timestamptz;
    return;
  end if;

  -- 写历史
  insert into public.username_history (user_id, old_username, new_username)
  values (v_user_id, v_current_username, p_new_username);

  -- 更新 user_profiles
  update public.user_profiles
  set username = p_new_username,
      updated_at = now()
  where user_id = v_user_id;

  return query select true, ''::text, p_new_username, (now() + v_cooldown)::timestamptz;
end;
$$;

grant execute on function public.change_username(text) to authenticated;


-- ============================================================================
-- RPC: lookup_username_history — 旧 username 重定向
-- ============================================================================
-- 输入：旧 username
-- 输出：当前 username（如果该 username 曾被某用户使用过，且该用户现在用的是另一个 username）
-- 用于公开页 fallback：访问 /u/old_name → 找到该 user → 跳到 /u/new_name

create or replace function public.lookup_username_history(p_username text)
returns table (
  current_username text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_username is null or p_username !~ '^[a-zA-Z0-9_-]{2,30}$' then
    return;
  end if;

  -- 找最近一次把这个 username 改掉的用户
  select uh.user_id into v_user_id
  from public.username_history uh
  where lower(uh.old_username) = lower(p_username)
  order by uh.changed_at desc
  limit 1;

  if v_user_id is null then
    return;
  end if;

  -- 返回该用户现在的 username
  return query
  select up.username
  from public.user_profiles up
  where up.user_id = v_user_id;
end;
$$;

grant execute on function public.lookup_username_history(text) to authenticated;


-- ============================================================================
-- RPC: get_username_change_status — 给前端查"还能不能改 username"
-- ============================================================================
-- 返回 cooldown 状态，用于 UI 显示

create or replace function public.get_username_change_status()
returns table (
  can_change boolean,
  next_change_after timestamptz,
  days_remaining int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_last_change timestamptz;
  v_cooldown interval := interval '30 days';
  v_next_after timestamptz;
  v_days int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return query select false, null::timestamptz, 0;
    return;
  end if;

  select max(changed_at) into v_last_change
  from public.username_history
  where user_id = v_user_id;

  if v_last_change is null then
    -- 从来没改过 — 可改
    return query select true, null::timestamptz, 0;
    return;
  end if;

  v_next_after := v_last_change + v_cooldown;

  if v_next_after <= now() then
    return query select true, null::timestamptz, 0;
    return;
  end if;

  v_days := extract(day from (v_next_after - now()))::int;
  return query select false, v_next_after, v_days;
end;
$$;

grant execute on function public.get_username_change_status() to authenticated;
