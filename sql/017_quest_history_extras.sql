-- ============================================================================
-- D9-C · Pack 3 · 用户公开历史 + 单任务历史
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 加 2 个 RPC：
--   1. get_user_public_history    — 看任意用户的公开任务史（用于 /u/[username]）
--   2. get_quest_completions      — 某个 quest_id 的所有完成记录
-- ============================================================================

-- ============================================================================
-- 1. 用户公开任务史（按 username 查询）
-- ============================================================================
create or replace function public.get_user_public_history(
  p_username text,
  p_limit int default 30
)
returns table (
  submission_id text,
  workshop text,
  quest_id text,
  quest_title text,
  cv_amount numeric,
  submitted_at timestamptz,
  source text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- 任何登录用户都能看任何人的公开历史（仅 approved）
  if auth.uid() is null then
    return;
  end if;

  -- 通过 username 找 user_id
  select user_id into v_user_id
  from public.user_profiles
  where lower(username) = lower(p_username)
  limit 1;

  if v_user_id is null then
    return;
  end if;

  return query
  select
    e.submission_id,
    coalesce(e.workshop, '萌芽镇')::text as workshop,
    coalesce(e.quest_id, '')::text as quest_id,
    coalesce(e.quest_title, e.submission_id, 'Unknown')::text as quest_title,
    e.cv_amount::numeric,
    e.created_at as submitted_at,
    case
      when e.workshop is not null and e.workshop != '萌芽镇' then 'workshop'
      when e.workshop = '萌芽镇' then 'sprout'
      when e.submission_id like 'review-%' then 'review'
      when e.submission_id like 'proposal-%' then 'proposal'
      else 'other'
    end::text as source
  from public.cv_entries e
  where e.user_id = v_user_id
    and (e.status is null or e.status = 'approved')
  order by e.created_at desc
  limit p_limit;
end;
$$;

grant execute on function public.get_user_public_history(text, int) to authenticated;


-- ============================================================================
-- 2. 单任务历史 - 谁都做过这个 quest
-- ============================================================================
create or replace function public.get_quest_completions(
  p_quest_id text,
  p_limit int default 30
)
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  cv_amount numeric,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    e.user_id,
    coalesce(p.display_name, 'Anonymous')::text as display_name,
    coalesce(p.username, '')::text as username,
    coalesce(p.avatar_url, '')::text as avatar_url,
    e.cv_amount::numeric,
    e.created_at as submitted_at
  from public.cv_entries e
  left join public.user_profiles p on p.user_id = e.user_id
  where e.quest_id = p_quest_id
    and (e.status is null or e.status = 'approved')
  order by e.created_at desc
  limit p_limit;
end;
$$;

grant execute on function public.get_quest_completions(text, int) to authenticated;


-- ============================================================================
-- 验证
-- ============================================================================
-- select * from get_user_public_history('webagentlab', 10);
-- select * from get_quest_completions('paper-import', 10);
