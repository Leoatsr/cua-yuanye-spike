-- ============================================================================
-- F2.1 · mail 表
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================

create table if not exists public.mail (
  user_id uuid not null references auth.users(id) on delete cascade,
  mail_id text not null,
  -- 内容
  category text not null,
  from_name text not null,
  subject text not null,
  body text not null,
  -- 状态
  read boolean not null default false,
  -- 元数据（任意 JSON，存 meta + actions）
  meta jsonb,
  actions jsonb,
  -- 时间
  sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mail_id)
);

create index if not exists mail_user_sent_at_idx
  on public.mail (user_id, sent_at desc);

-- Row Level Security
alter table public.mail enable row level security;

drop policy if exists "users see own mail" on public.mail;
drop policy if exists "users insert own mail" on public.mail;
drop policy if exists "users update own mail" on public.mail;
drop policy if exists "users delete own mail" on public.mail;

create policy "users see own mail"
  on public.mail for select using (auth.uid() = user_id);

create policy "users insert own mail"
  on public.mail for insert with check (auth.uid() = user_id);

create policy "users update own mail"
  on public.mail for update using (auth.uid() = user_id);

create policy "users delete own mail"
  on public.mail for delete using (auth.uid() = user_id);
