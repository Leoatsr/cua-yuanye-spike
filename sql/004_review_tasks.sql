-- ============================================================================
-- F2.3 · review_tasks 表
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================

-- 设计：1 行 1 用户（review state 是个小对象，整体存最简）
create table if not exists public.review_tasks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,             -- ReviewState 整体
  seeded boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists review_tasks_user_updated_at_idx
  on public.review_tasks (user_id, updated_at desc);

alter table public.review_tasks enable row level security;

drop policy if exists "users see own reviews" on public.review_tasks;
drop policy if exists "users insert own reviews" on public.review_tasks;
drop policy if exists "users update own reviews" on public.review_tasks;
drop policy if exists "users delete own reviews" on public.review_tasks;

create policy "users see own reviews"
  on public.review_tasks for select using (auth.uid() = user_id);

create policy "users insert own reviews"
  on public.review_tasks for insert with check (auth.uid() = user_id);

create policy "users update own reviews"
  on public.review_tasks for update using (auth.uid() = user_id);

create policy "users delete own reviews"
  on public.review_tasks for delete using (auth.uid() = user_id);
