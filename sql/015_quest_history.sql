-- ============================================================================
-- D9-A · Pack 1 · 任务历史 RPC
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 加 2 个 RPC：
--   1. get_my_quest_history     — 拉我自己所有 completed 任务（含时间 + CV 来源）
--   2. get_my_quest_stats       — 我的统计聚合（总任务数、总 CV、工坊分布）
-- 不动现有表结构。复用 quest_states + cv_entries。
-- ============================================================================

-- ============================================================================
-- 1. 个人任务历史：从 cv_entries 取（cv_entries 是 source of truth）
-- ============================================================================
create or replace function public.get_my_quest_history(
  p_limit int default 100
)
returns table (
  submission_id text,
  workshop text,
  quest_id text,
  quest_title text,
  cv_amount numeric,
  status text,
  submitted_at timestamptz,
  source text          -- 'workshop' | 'sprout' | 'review' | 'proposal'
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
    e.submission_id,
    coalesce(e.workshop, '萌芽镇')::text as workshop,
    coalesce(e.quest_id, '')::text as quest_id,
    coalesce(e.quest_title, e.submission_id, 'Unknown')::text as quest_title,
    e.cv_amount::numeric,
    coalesce(e.status, 'approved')::text as status,
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
  order by e.created_at desc
  limit p_limit;
end;
$$;

grant execute on function public.get_my_quest_history(int) to authenticated;


-- ============================================================================
-- 2. 个人统计聚合
-- ============================================================================
create or replace function public.get_my_quest_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_total_tasks int;
  v_total_cv numeric;
  v_workshop_dist jsonb;
  v_source_dist jsonb;
  v_first_at timestamptz;
  v_last_at timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('error', 'not authenticated');
  end if;

  -- Totals
  select
    count(*),
    coalesce(sum(cv_amount), 0),
    min(created_at),
    max(created_at)
  into v_total_tasks, v_total_cv, v_first_at, v_last_at
  from public.cv_entries
  where user_id = v_user_id;

  -- Workshop distribution
  select coalesce(jsonb_object_agg(workshop_label, cnt), '{}'::jsonb)
  into v_workshop_dist
  from (
    select coalesce(workshop, '其他') as workshop_label, count(*) as cnt
    from public.cv_entries
    where user_id = v_user_id
    group by workshop
  ) t;

  -- Source distribution (workshop / sprout / review / proposal)
  select coalesce(jsonb_object_agg(src, cnt), '{}'::jsonb)
  into v_source_dist
  from (
    select
      case
        when workshop is not null and workshop != '萌芽镇' then 'workshop'
        when workshop = '萌芽镇' then 'sprout'
        when submission_id like 'review-%' then 'review'
        when submission_id like 'proposal-%' then 'proposal'
        else 'other'
      end as src,
      count(*) as cnt
    from public.cv_entries
    where user_id = v_user_id
    group by src
  ) t;

  return jsonb_build_object(
    'total_tasks', v_total_tasks,
    'total_cv', v_total_cv,
    'workshop_distribution', v_workshop_dist,
    'source_distribution', v_source_dist,
    'first_submission_at', v_first_at,
    'last_submission_at', v_last_at
  );
end;
$$;

grant execute on function public.get_my_quest_stats() to authenticated;


-- ============================================================================
-- 验证查询
-- ============================================================================
-- 跑完上面后，可以跑这两个验证（用当前登录用户）：
--   select * from get_my_quest_history(10);
--   select get_my_quest_stats();
