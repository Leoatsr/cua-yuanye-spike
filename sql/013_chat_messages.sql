-- ============================================================================
-- G2-A · 聊天消息（世界频道为主，预留工坊+私聊扩展）
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 字段：
--   - channel_type: 'world' | 'scene' | 'private'
--   - channel_key: 用于 scope（'world' / 'SproutCity' / user_id pair）
--   - sender_id / sender_name / sender_avatar / sender_face
--   - content: ≤ 200 字
--   - recipient_id: 仅私聊用（G2-C 启用）
-- ============================================================================

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_type text not null check (channel_type in ('world', 'scene', 'private')),
  channel_key text not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  sender_avatar text,
  sender_face jsonb,
  recipient_id uuid references auth.users(id) on delete cascade,  -- private only
  content text not null check (length(content) >= 1 and length(content) <= 200),
  created_at timestamptz not null default now()
);

-- 按 channel + 时间倒序查（拉最近 N 条）
create index if not exists chat_messages_world_time_idx
  on public.chat_messages (channel_type, channel_key, created_at desc)
  where channel_type = 'world';

create index if not exists chat_messages_scene_time_idx
  on public.chat_messages (channel_type, channel_key, created_at desc)
  where channel_type = 'scene';

-- 私聊索引：双向查找
create index if not exists chat_messages_private_idx
  on public.chat_messages (sender_id, recipient_id, created_at desc)
  where channel_type = 'private';

create index if not exists chat_messages_private_inbox_idx
  on public.chat_messages (recipient_id, created_at desc)
  where channel_type = 'private';

-- ----- RLS -----

alter table public.chat_messages enable row level security;

drop policy if exists "everyone read world" on public.chat_messages;
drop policy if exists "everyone read scene" on public.chat_messages;
drop policy if exists "private read own" on public.chat_messages;
drop policy if exists "users insert own messages" on public.chat_messages;

-- 任何登录用户能读 world / scene 频道
create policy "everyone read world"
  on public.chat_messages for select
  using (auth.role() = 'authenticated' and channel_type in ('world', 'scene'));

-- 私聊只有发送者和接收者能读
create policy "private read own"
  on public.chat_messages for select
  using (
    auth.role() = 'authenticated'
    and channel_type = 'private'
    and (auth.uid() = sender_id or auth.uid() = recipient_id)
  );

-- 用户只能以自己身份发消息
create policy "users insert own messages"
  on public.chat_messages for insert
  with check (auth.uid() = sender_id);

-- ----- RPC: 拉最近消息 -----
-- 简化客户端调用：拉某 channel 最近 N 条

create or replace function public.get_recent_chat_messages(
  p_channel_type text,
  p_channel_key text,
  p_limit int default 50
)
returns table (
  id uuid,
  channel_type text,
  channel_key text,
  sender_id uuid,
  sender_name text,
  sender_avatar text,
  sender_face jsonb,
  recipient_id uuid,
  content text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(coalesce(p_limit, 50), 100);
begin
  if p_channel_type = 'private' then
    -- 私聊：channel_key 格式 "<user_a>::<user_b>" (sorted)
    -- 简化：返回所有发送者或接收者是当前用户的私聊
    return query
    select
      m.id, m.channel_type, m.channel_key,
      m.sender_id, m.sender_name, m.sender_avatar, m.sender_face,
      m.recipient_id, m.content, m.created_at
    from public.chat_messages m
    where m.channel_type = 'private'
      and m.channel_key = p_channel_key
      and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
    order by m.created_at desc
    limit v_limit;
  else
    return query
    select
      m.id, m.channel_type, m.channel_key,
      m.sender_id, m.sender_name, m.sender_avatar, m.sender_face,
      m.recipient_id, m.content, m.created_at
    from public.chat_messages m
    where m.channel_type = p_channel_type
      and m.channel_key = p_channel_key
    order by m.created_at desc
    limit v_limit;
  end if;
end;
$$;

grant execute on function public.get_recent_chat_messages(text, text, int) to authenticated;
