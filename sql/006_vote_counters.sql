-- ============================================================================
-- C6.3c · 投票计数 trigger
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 作用：每当 proposal_votes 表 INSERT/UPDATE/DELETE 时，自动重新计算
-- 对应 proposal 的 yes_count / no_count / abstain_count。
-- 客户端只管插票，无需自己维护计数 —— 数据库层强制一致。
-- ============================================================================

-- ===== Helper function: 重新计算单个 proposal 的票数 =====
create or replace function public.recount_proposal_votes(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.proposals
  set
    yes_count = (select count(*) from public.proposal_votes where proposal_id = p_id and vote = 'yes'),
    no_count = (select count(*) from public.proposal_votes where proposal_id = p_id and vote = 'no'),
    abstain_count = (select count(*) from public.proposal_votes where proposal_id = p_id and vote = 'abstain')
  where id = p_id;
end;
$$;

-- ===== Trigger function: 在 INSERT/UPDATE/DELETE 后调 recount =====
create or replace function public.on_proposal_vote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- INSERT 或 UPDATE: 重算 NEW 提案
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    perform public.recount_proposal_votes(new.proposal_id);
  end if;
  -- DELETE 或 UPDATE 跨提案（极少发生，但兜底）: 重算 OLD 提案
  if (tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.proposal_id is distinct from old.proposal_id)) then
    perform public.recount_proposal_votes(old.proposal_id);
  end if;
  return null;
end;
$$;

-- ===== 安装 trigger =====
drop trigger if exists trg_proposal_vote_change on public.proposal_votes;

create trigger trg_proposal_vote_change
  after insert or update or delete on public.proposal_votes
  for each row execute function public.on_proposal_vote_change();

-- ============================================================================
-- 验证：手动重算一次（覆盖之前已有的票，如果有）
-- ============================================================================
do $$
declare
  p record;
begin
  for p in select id from public.proposals loop
    perform public.recount_proposal_votes(p.id);
  end loop;
end;
$$;
