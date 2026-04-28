-- ============================================================================
-- C6.3d · 决议归档 + Realtime 启用
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================

-- ============================================================================
-- 1. 决议归档函数 finalize_overdue_proposals()
-- ============================================================================
-- 找出所有 status='open' 且 closes_at <= now() 的提案，
-- 算出 outcome 并把 status 改为 'closed'。
--
-- 决议规则：
--   - 总票数 < 3        → no_quorum（不达法定人数）
--   - yes > no          → passed
--   - no > yes          → rejected
--   - yes == no         → tied
--   - 弃权票算入总数但不影响结果
--
-- 任何已登录用户都可以调（client-side lazy finalization）。
-- ============================================================================

create or replace function public.finalize_overdue_proposals()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  finalized_count int := 0;
  p record;
  v_outcome text;
  v_total int;
begin
  for p in
    select id, yes_count, no_count, abstain_count
    from public.proposals
    where status = 'open' and closes_at <= now()
  loop
    v_total := p.yes_count + p.no_count + p.abstain_count;

    if v_total < 3 then
      v_outcome := 'no_quorum';
    elsif p.yes_count > p.no_count then
      v_outcome := 'passed';
    elsif p.no_count > p.yes_count then
      v_outcome := 'rejected';
    else
      v_outcome := 'tied';
    end if;

    update public.proposals
    set status = 'closed', outcome = v_outcome
    where id = p.id;

    finalized_count := finalized_count + 1;
  end loop;

  return finalized_count;
end;
$$;

-- 任何已登录用户都能调这个 RPC
grant execute on function public.finalize_overdue_proposals() to authenticated;

-- ============================================================================
-- 2. 启用 Realtime
-- ============================================================================
-- 让 proposals 和 proposal_votes 的变化能被订阅。
-- 添加到 supabase_realtime publication（如果不存在则创建）。

do $$
begin
  -- proposals 表
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'proposals'
  ) then
    alter publication supabase_realtime add table public.proposals;
  end if;

  -- proposal_votes 表
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'proposal_votes'
  ) then
    alter publication supabase_realtime add table public.proposal_votes;
  end if;
end;
$$;
