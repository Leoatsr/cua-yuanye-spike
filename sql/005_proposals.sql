-- ============================================================================
-- C6.3a · proposals 与 proposal_votes 两张表
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================

-- ===== proposals 表 =====
-- 每条 = 一个提案
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,            -- 创建时快照 GitHub username（防止用户改名后追溯不了）
  title text not null check (length(title) >= 4 and length(title) <= 80),
  description text not null check (length(description) >= 10 and length(description) <= 2000),
  category text not null check (category in ('rule', 'feature', 'event', 'budget', 'other')),
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  -- 投票截止时间（C6.3d 决议归档会用）
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- 投票汇总（决议归档时填充）
  yes_count int not null default 0,
  no_count int not null default 0,
  abstain_count int not null default 0,
  -- 决议结果（C6.3d 填）
  outcome text check (outcome in ('passed', 'rejected', 'tied', 'no_quorum'))
);

create index if not exists proposals_status_closes_at_idx
  on public.proposals (status, closes_at desc);

create index if not exists proposals_author_id_idx
  on public.proposals (author_id);

-- ===== proposal_votes 表 =====
-- 每条 = 一票。复合主键确保一票一人
create table if not exists public.proposal_votes (
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  voter_name text not null,             -- 创建时快照
  vote text not null check (vote in ('yes', 'no', 'abstain')),
  comment text check (length(comment) <= 500),
  voted_at timestamptz not null default now(),
  primary key (proposal_id, voter_id)   -- 一人一票，防重复
);

create index if not exists proposal_votes_proposal_id_idx
  on public.proposal_votes (proposal_id);

-- ============================================================================
-- RLS 策略
-- ============================================================================

alter table public.proposals enable row level security;
alter table public.proposal_votes enable row level security;

-- proposals 策略
drop policy if exists "anyone authenticated reads proposals" on public.proposals;
drop policy if exists "users insert own proposals" on public.proposals;
drop policy if exists "authors update own open proposals" on public.proposals;
drop policy if exists "authors delete own open proposals" on public.proposals;

-- 任何已登录用户都能读所有提案（公开公示）
create policy "anyone authenticated reads proposals"
  on public.proposals for select
  using (auth.role() = 'authenticated');

-- 用户只能插入自己作为 author 的提案
create policy "users insert own proposals"
  on public.proposals for insert
  with check (auth.uid() = author_id);

-- 提案作者可以修改 / 删除自己的 open 状态提案（关闭后不能改）
create policy "authors update own open proposals"
  on public.proposals for update
  using (auth.uid() = author_id and status = 'open');

create policy "authors delete own open proposals"
  on public.proposals for delete
  using (auth.uid() = author_id and status = 'open');

-- proposal_votes 策略
drop policy if exists "anyone authenticated reads votes" on public.proposal_votes;
drop policy if exists "users insert own votes" on public.proposal_votes;
drop policy if exists "users update own votes" on public.proposal_votes;
drop policy if exists "users delete own votes" on public.proposal_votes;

-- 任何已登录用户都能读所有投票（公开透明）
create policy "anyone authenticated reads votes"
  on public.proposal_votes for select
  using (auth.role() = 'authenticated');

-- 用户只能投自己的票
create policy "users insert own votes"
  on public.proposal_votes for insert
  with check (auth.uid() = voter_id);

-- 改票（改主意） · 只能改自己的
create policy "users update own votes"
  on public.proposal_votes for update
  using (auth.uid() = voter_id);

-- 撤回票 · 只能撤自己的
create policy "users delete own votes"
  on public.proposal_votes for delete
  using (auth.uid() = voter_id);
