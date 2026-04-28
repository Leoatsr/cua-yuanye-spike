-- ============================================================================
-- D10 · Pack 4 · 推送提醒
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 1. notifications 表 — 玩家收件箱（不同于 mail，这是轻量提醒）
-- 2. 触发器 — 自动推送提醒事件
-- 3. RPC — 拉取/标记已读
-- 4. Realtime — 启用 broadcast 让客户端立即收到
-- ============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,             -- 'task_new' | 'review_result' | 'proposal_vote' | 'task_due' | 'level_up' | 'system'
  title text not null,            -- "新任务: 帮春雨找鱼"
  body text,                      -- 详情，可选
  link text,                      -- 跳转目标，可选 ('/quest/X' / '/u/Y' / null)
  metadata jsonb,                 -- 附加数据
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at)
  where read_at is null;


-- ============================================================================
-- RLS
-- ============================================================================
alter table public.notifications enable row level security;

drop policy if exists "users see own notifications" on public.notifications;
drop policy if exists "users update own notifications" on public.notifications;
drop policy if exists "system inserts notifications" on public.notifications;

create policy "users see own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "users update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- 客户端能 insert（受信任的本地代码） + service_role 也能（服务端触发器）
create policy "users insert notifications for self"
  on public.notifications for insert
  with check (auth.uid() = user_id);


-- ============================================================================
-- RPC 1: 拉取最近通知
-- ============================================================================
create or replace function public.get_my_notifications(
  p_limit int default 50,
  p_unread_only boolean default false
)
returns table (
  id uuid,
  kind text,
  title text,
  body text,
  link text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz
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
    n.id, n.kind, n.title, n.body, n.link, n.metadata, n.read_at, n.created_at
  from public.notifications n
  where n.user_id = v_user_id
    and (not p_unread_only or n.read_at is null)
  order by n.created_at desc
  limit p_limit;
end;
$$;

grant execute on function public.get_my_notifications(int, boolean) to authenticated;


-- ============================================================================
-- RPC 2: 标记已读
-- ============================================================================
create or replace function public.mark_notifications_read(
  p_ids uuid[] default null    -- null = 全部已读
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_count int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return 0;
  end if;

  if p_ids is null then
    update public.notifications
    set read_at = now()
    where user_id = v_user_id and read_at is null;
  else
    update public.notifications
    set read_at = now()
    where user_id = v_user_id and id = any(p_ids) and read_at is null;
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_notifications_read(uuid[]) to authenticated;


-- ============================================================================
-- RPC 3: 未读计数
-- ============================================================================
create or replace function public.count_unread_notifications()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_count int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return 0;
  end if;

  select count(*)::int into v_count
  from public.notifications
  where user_id = v_user_id and read_at is null;

  return v_count;
end;
$$;

grant execute on function public.count_unread_notifications() to authenticated;


-- ============================================================================
-- TRIGGER 1: 提案投票通知 — 投票后给提案作者发提醒
-- ============================================================================
create or replace function public.notify_proposal_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposer_id uuid;
  v_proposal_title text;
  v_voter_name text;
begin
  -- 拉提案作者 + 标题
  select user_id, title into v_proposer_id, v_proposal_title
  from public.proposals
  where id = NEW.proposal_id;

  if v_proposer_id is null or v_proposer_id = NEW.voter_id then
    return NEW;  -- 自己投自己不通知
  end if;

  -- 拉投票人姓名
  select coalesce(display_name, 'Anonymous') into v_voter_name
  from public.user_profiles
  where user_id = NEW.voter_id;

  -- 插入通知
  insert into public.notifications (user_id, kind, title, body, link, metadata)
  values (
    v_proposer_id,
    'proposal_vote',
    v_voter_name || ' 投了 ' || NEW.choice,
    coalesce(v_proposal_title, '你的提案') || ' 收到一票 ' || NEW.choice,
    null,
    jsonb_build_object(
      'proposal_id', NEW.proposal_id,
      'voter_id', NEW.voter_id,
      'choice', NEW.choice
    )
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_proposal_vote on public.proposal_votes;
create trigger trg_notify_proposal_vote
  after insert on public.proposal_votes
  for each row execute function public.notify_proposal_vote();


-- ============================================================================
-- TRIGGER 2: 任务审核结果通知 — review_tasks status 变化时
-- ============================================================================
-- 注：现有 mail 表已经走流程 - 这里加 lightweight notifications 重复一份
-- 不影响 mail 系统

create or replace function public.notify_review_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 仅在 status 从 pending 变到 approved/rejected 时触发
  if OLD.status is null or OLD.status = NEW.status then
    return NEW;
  end if;
  if NEW.status not in ('approved', 'rejected') then
    return NEW;
  end if;

  insert into public.notifications (user_id, kind, title, body, link, metadata)
  values (
    NEW.submitter_id,
    'review_result',
    case NEW.status
      when 'approved' then '✓ 任务通过审核'
      when 'rejected' then '✗ 任务未通过'
      else '审核结果'
    end,
    coalesce(NEW.quest_title, '你的任务') || ' 已被审核',
    null,
    jsonb_build_object(
      'submission_id', NEW.submission_id,
      'status', NEW.status,
      'cv_amount', NEW.cv_amount
    )
  );

  return NEW;
end;
$$;

-- 注：仅当 review_tasks 表存在该结构时启用 trigger
-- 检查方式：select column_name from information_schema.columns where table_name = 'review_tasks';
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'review_tasks'
  ) then
    drop trigger if exists trg_notify_review_result on public.review_tasks;
    -- 仅当 review_tasks 有 status 和 submitter_id 字段时创建
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'review_tasks' and column_name = 'status'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'review_tasks' and column_name = 'submitter_id'
    ) then
      create trigger trg_notify_review_result
        after update on public.review_tasks
        for each row execute function public.notify_review_result();
    end if;
  end if;
end$$;


-- ============================================================================
-- 验证
-- ============================================================================
-- select * from get_my_notifications(10);
-- select count_unread_notifications();
-- select mark_notifications_read();  -- 全部标记已读
