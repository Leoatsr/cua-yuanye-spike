-- ============================================================================
-- F4.0 · user_profiles 表 + GitHub 同步
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 字段：
--   - 唯一 username（自定义，默认 GitHub）
--   - display_name / bio / avatar_url
--   - workshops 工作组（多选）
--   - links / skills / location / interests
--   - joined_at / visibility / updated_at
-- ============================================================================

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- 唯一标识 (用于 /u/[username] 公开页)
  username text not null unique
    check (username ~ '^[a-zA-Z0-9_-]{2,30}$'),
  -- 基础信息
  display_name text not null check (length(display_name) >= 1 and length(display_name) <= 30),
  bio text default '' check (length(bio) <= 200),
  avatar_url text,
  -- 工作组（多选 9 个 CUA 工作组之一）
  workshops text[] not null default array[]::text[],
  -- 个人链接 jsonb 数组：[{name, url}, ...] 最多 3 个
  links jsonb not null default '[]'::jsonb,
  -- 技能标签
  skills text[] not null default array[]::text[],
  -- 位置（仅城市，可选）
  location text default '',
  -- 兴趣标签
  interests text[] not null default array[]::text[],
  -- 元数据
  joined_at timestamptz not null default now(),
  visibility text not null default 'public'
    check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 索引（username 已经 UNIQUE 自带，加 case-insensitive）
create unique index if not exists user_profiles_username_lower_idx
  on public.user_profiles (lower(username));

create index if not exists user_profiles_workshops_gin_idx
  on public.user_profiles using gin (workshops);

-- ============================================================================
-- RLS - 仅登录用户可读，仅本人可写
-- ============================================================================

alter table public.user_profiles enable row level security;

drop policy if exists "authenticated read profiles" on public.user_profiles;
drop policy if exists "users insert own profile" on public.user_profiles;
drop policy if exists "users update own profile" on public.user_profiles;
drop policy if exists "users delete own profile" on public.user_profiles;

-- 任何登录用户都能读所有人的 profile（公开页用）
create policy "authenticated read profiles"
  on public.user_profiles for select
  using (auth.role() = 'authenticated');

create policy "users insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "users update own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id);

create policy "users delete own profile"
  on public.user_profiles for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- RPC: check_username_available
-- ============================================================================
-- 检查 username 是否可用（case-insensitive）
-- 返回 true = 可用 / false = 已被占用

create or replace function public.check_username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_caller_id uuid;
begin
  -- 不允许空或非法格式
  if p_username is null or p_username !~ '^[a-zA-Z0-9_-]{2,30}$' then
    return false;
  end if;

  v_caller_id := auth.uid();

  -- 检查除自己以外有没有人用了这个 username（case-insensitive）
  select count(*) into v_count
  from public.user_profiles
  where lower(username) = lower(p_username)
    and user_id <> coalesce(v_caller_id, '00000000-0000-0000-0000-000000000000'::uuid);

  return v_count = 0;
end;
$$;

grant execute on function public.check_username_available(text) to authenticated;

-- ============================================================================
-- RPC: ensure_user_profile
-- ============================================================================
-- 为登录用户创建/同步 profile (从 auth.users.raw_user_meta_data 拉 GitHub 信息)
-- 一次性同步：仅当 profile 不存在时创建
-- 返回 profile 行

create or replace function public.ensure_user_profile()
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  joined_at timestamptz,
  is_new boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_meta jsonb;
  v_github_username text;
  v_github_name text;
  v_github_avatar text;
  v_email text;
  v_proposed_username text;
  v_existing_count int;
  v_suffix int;
  v_final_username text;
  v_final_display text;
  v_is_new boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- 检查是否已有 profile
  select count(*) into v_existing_count
  from public.user_profiles up
  where up.user_id = v_user_id;

  if v_existing_count > 0 then
    -- 已存在 — 直接返回
    return query
    select up.user_id, up.username, up.display_name, up.avatar_url, up.joined_at, false
    from public.user_profiles up
    where up.user_id = v_user_id;
    return;
  end if;

  -- 新用户 — 从 auth.users 拉 GitHub metadata
  select u.raw_user_meta_data, u.email
  into v_meta, v_email
  from auth.users u
  where u.id = v_user_id;

  v_github_username := coalesce(
    v_meta ->> 'user_name',
    v_meta ->> 'preferred_username',
    split_part(coalesce(v_email, 'user'), '@', 1)
  );
  v_github_name := coalesce(
    v_meta ->> 'full_name',
    v_meta ->> 'name',
    v_github_username
  );
  v_github_avatar := v_meta ->> 'avatar_url';

  -- 清理 username（只允许 a-zA-Z0-9_- 范围，2-30 字符）
  v_proposed_username := regexp_replace(v_github_username, '[^a-zA-Z0-9_-]', '', 'g');
  if length(v_proposed_username) < 2 then
    v_proposed_username := 'user' || substring(v_user_id::text, 1, 8);
  end if;
  v_proposed_username := substring(v_proposed_username, 1, 30);

  -- 处理冲突：加 -2 -3 后缀直到可用
  v_final_username := v_proposed_username;
  v_suffix := 1;
  while exists (
    select 1 from public.user_profiles up
    where lower(up.username) = lower(v_final_username)
  ) loop
    v_suffix := v_suffix + 1;
    v_final_username := substring(v_proposed_username, 1, 27) || '-' || v_suffix;
    if v_suffix > 100 then
      -- 极端情况兜底
      v_final_username := 'user' || substring(v_user_id::text, 1, 8);
      exit;
    end if;
  end loop;

  -- display_name 兜底
  v_final_display := nullif(trim(v_github_name), '');
  if v_final_display is null then
    v_final_display := v_final_username;
  end if;
  if length(v_final_display) > 30 then
    v_final_display := substring(v_final_display, 1, 30);
  end if;

  -- 插入新 profile
  insert into public.user_profiles (
    user_id, username, display_name, avatar_url, joined_at
  ) values (
    v_user_id, v_final_username, v_final_display, v_github_avatar, now()
  );

  v_is_new := true;

  return query
  select v_user_id, v_final_username, v_final_display, v_github_avatar, now()::timestamptz, v_is_new;
end;
$$;

grant execute on function public.ensure_user_profile() to authenticated;
