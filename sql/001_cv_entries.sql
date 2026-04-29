-- ============================================================================
-- CUA 基地 · F2.0 数据库 schema
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 里跑这整个文件
-- (一次跑完，全部建好。重复跑安全 — 用 if not exists)
-- ============================================================================

-- ----- CV 入账表（F2.0 先做这一张）-----

create table if not exists public.cv_entries (
  -- 主键：玩家 + 提交 ID 复合主键，保证幂等
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id text not null,
  -- 入账内容
  task_id text not null,
  task_title text not null,
  workshop text not null,
  coefficient numeric not null,
  base_cp integer not null,
  cp_earned integer not null,
  earned_at timestamptz not null default now(),
  -- 元数据
  created_at timestamptz not null default now(),
  primary key (user_id, submission_id)
);

create index if not exists cv_entries_user_earned_at_idx
  on public.cv_entries (user_id, earned_at desc);

-- ----- Row Level Security: 每个玩家只能看自己的 -----

alter table public.cv_entries enable row level security;

-- 删除旧策略（如果存在），重建
drop policy if exists "users see own cv" on public.cv_entries;
drop policy if exists "users insert own cv" on public.cv_entries;
drop policy if exists "users update own cv" on public.cv_entries;
drop policy if exists "users delete own cv" on public.cv_entries;

create policy "users see own cv"
  on public.cv_entries for select
  using (auth.uid() = user_id);

create policy "users insert own cv"
  on public.cv_entries for insert
  with check (auth.uid() = user_id);

create policy "users update own cv"
  on public.cv_entries for update
  using (auth.uid() = user_id);

create policy "users delete own cv"
  on public.cv_entries for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- 完成。F2.1 加 mail / F2.2 加 quest_states / F2.3 加 review_tasks
-- ============================================================================
