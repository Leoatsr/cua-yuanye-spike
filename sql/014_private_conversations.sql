-- ============================================================================
-- G2-C · 私聊会话列表 RPC
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 表已经在 G2-A (013) 建好了（chat_messages.recipient_id, channel_type='private'）
-- 这里只加 RPC：返回当前用户的所有私聊会话（每个对手的最新消息 + 未读数）
-- ============================================================================

create or replace function public.get_my_private_conversations()
returns table (
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text,
  other_user_face jsonb,
  channel_key text,
  last_message_content text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  unread_count bigint
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
  with my_messages as (
    select
      m.id, m.channel_key, m.sender_id, m.recipient_id,
      m.content, m.created_at, m.sender_name, m.sender_avatar, m.sender_face,
      case
        when m.sender_id = v_user_id then m.recipient_id
        else m.sender_id
      end as other_id,
      case
        when m.sender_id = v_user_id then m.recipient_id
        else m.sender_id
      end as other_uid_for_join
    from public.chat_messages m
    where m.channel_type = 'private'
      and (m.sender_id = v_user_id or m.recipient_id = v_user_id)
  ),
  ranked as (
    select
      mm.*,
      row_number() over (partition by mm.other_id order by mm.created_at desc) as rn
    from my_messages mm
  ),
  latest as (
    select * from ranked where rn = 1
  ),
  unread as (
    -- 简化：所有 recipient 是自己的算未读（暂无 read 标记字段）
    -- G2-D 可加 read_at / last_read_at 字段做精细控制
    select
      sender_id as other_id,
      count(*) as unread_count
    from public.chat_messages
    where recipient_id = v_user_id
      and channel_type = 'private'
      and created_at > coalesce((
        select max(created_at) from public.chat_messages
        where sender_id = v_user_id
          and recipient_id = chat_messages.sender_id
          and channel_type = 'private'
      ), '1970-01-01'::timestamptz)
    group by sender_id
  )
  select
    l.other_id as other_user_id,
    coalesce(p.display_name, l.sender_name)::text as other_user_name,
    coalesce(p.avatar_url, l.sender_avatar)::text as other_user_avatar,
    coalesce(uf.face_data, l.sender_face) as other_user_face,
    l.channel_key,
    l.content as last_message_content,
    l.created_at as last_message_at,
    l.sender_id as last_message_sender_id,
    coalesce(u.unread_count, 0) as unread_count
  from latest l
  left join public.user_profiles p on p.user_id = l.other_id
  left join (
    select user_id, jsonb_build_object(
      'hairstyle', hairstyle,
      'hair_color', hair_color,
      'outfit_color', outfit_color
    ) as face_data
    from public.user_faces
  ) uf on uf.user_id = l.other_id
  left join unread u on u.other_id = l.other_id
  order by l.created_at desc;
end;
$$;

grant execute on function public.get_my_private_conversations() to authenticated;
