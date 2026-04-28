-- ============================================================================
-- F2.2 · quest_states 表
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================

-- 设计：1 行 1 个 quest（颗粒细、便于查询）
-- state 字段塞整个 QuestState 对象 (JSONB)
create table if not exists public.quest_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id text not null,                  -- 'paper-import' / 'author-card' / ...
  state jsonb not null,                     -- entire QuestState object as JSON
  updated_at timestamptz not null default now(),
  primary key (user_id, quest_id)
);

create index if not exists quest_states_user_updated_at_idx
  on public.quest_states (user_id, updated_at desc);

-- Row Level Security
alter table public.quest_states enable row level security;

drop policy if exists "users see own quests" on public.quest_states;
drop policy if exists "users insert own quests" on public.quest_states;
drop policy if exists "users update own quests" on public.quest_states;
drop policy if exists "users delete own quests" on public.quest_states;

create policy "users see own quests"
  on public.quest_states for select using (auth.uid() = user_id);

create policy "users insert own quests"
  on public.quest_states for insert with check (auth.uid() = user_id);

create policy "users update own quests"
  on public.quest_states for update using (auth.uid() = user_id);

create policy "users delete own quests"
  on public.quest_states for delete using (auth.uid() = user_id);
