-- ============================================================================
-- F5.0 · 等级系统 (L0-L4)
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 等级映射：
--   L0 新人              注册即得
--   L1 活跃贡献者         CV >= 200 AND tasks >= 3
--   L2 mentor            CV >= 800 AND tasks >= 10
--   L3 子项目负责人        CV >= 2500 AND tasks >= 25 AND proposals >= 3
--   L4 联席主席           人工授予 (manual_level_grants 表)
-- ============================================================================

-- ---------- L4 人工授予表 ----------

create table if not exists public.manual_level_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_level smallint not null check (granted_level >= 0 and granted_level <= 4),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  reason text
);

-- 仅 admin 可读写——这里先全部禁，等你需要时手动 SQL Editor 加
alter table public.manual_level_grants enable row level security;

drop policy if exists "everyone read grants" on public.manual_level_grants;
create policy "everyone read grants"
  on public.manual_level_grants for select using (true);

-- ---------- 等级 RPC ----------

create or replace function public.get_user_level(p_user_id uuid)
returns table (
  level smallint,
  level_name text,
  total_cv numeric,
  task_count bigint,
  proposal_count bigint,
  -- 距离下一级还需的进度
  next_level smallint,
  next_level_name text,
  next_cv_required numeric,
  next_tasks_required bigint,
  next_proposals_required bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cv numeric;
  v_tasks bigint;
  v_proposals bigint;
  v_manual_level smallint;
  v_calc_level smallint;
  v_final_level smallint;
begin
  -- 算 CV + 任务数
  select coalesce(sum(cp_earned), 0)::numeric, count(*)::bigint
  into v_cv, v_tasks
  from public.cv_entries
  where user_id = p_user_id;

  -- 算提案数
  select count(*)::bigint into v_proposals
  from public.proposals
  where author_id = p_user_id;

  -- 计算自动等级
  if v_cv >= 2500 and v_tasks >= 25 and v_proposals >= 3 then
    v_calc_level := 3;
  elsif v_cv >= 800 and v_tasks >= 10 then
    v_calc_level := 2;
  elsif v_cv >= 200 and v_tasks >= 3 then
    v_calc_level := 1;
  else
    v_calc_level := 0;
  end if;

  -- 检查人工授予（只升不降）
  select granted_level into v_manual_level
  from public.manual_level_grants
  where user_id = p_user_id;

  v_final_level := greatest(v_calc_level, coalesce(v_manual_level, 0));

  -- 返回等级信息 + 下一级阈值
  return query
  select
    v_final_level::smallint as level,
    case v_final_level
      when 0 then '新人'
      when 1 then '活跃贡献者'
      when 2 then 'mentor'
      when 3 then '子项目负责人'
      when 4 then '联席主席'
      else 'unknown'
    end::text as level_name,
    v_cv,
    v_tasks,
    v_proposals,
    case
      when v_final_level >= 4 then null
      else (v_final_level + 1)::smallint
    end as next_level,
    case v_final_level + 1
      when 1 then '活跃贡献者'
      when 2 then 'mentor'
      when 3 then '子项目负责人'
      when 4 then '联席主席'
      else null
    end::text as next_level_name,
    case v_final_level
      when 0 then 200
      when 1 then 800
      when 2 then 2500
      when 3 then null  -- L4 人工授予，没数值阈值
      else null
    end::numeric as next_cv_required,
    case v_final_level
      when 0 then 3
      when 1 then 10
      when 2 then 25
      when 3 then null
      else null
    end::bigint as next_tasks_required,
    case v_final_level
      when 0 then 0
      when 1 then 0
      when 2 then 3
      when 3 then null
      else null
    end::bigint as next_proposals_required;
end;
$$;

grant execute on function public.get_user_level(uuid) to authenticated;
