-- ============================================================================
-- J2-B Fix 2 · 数据看板白名单 — 添加 han032206
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 只改 is_dashboard_admin() 函数 — 不影响其他 RPC
-- ============================================================================

create or replace function public.is_dashboard_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select raw_user_meta_data->>'user_name'
  into v_username
  from auth.users
  where id = auth.uid();

  if v_username is null then
    return false;
  end if;

  -- 白名单（大小写不敏感）
  return lower(v_username) in (
    'leoatsr',
    'webagentlab',
    'han032206'
  );
end;
$$;

grant execute on function public.is_dashboard_admin() to authenticated;


-- ============================================================================
-- 验证
-- ============================================================================
-- 用 han032206 登录后跑这个，应返回 true：
-- select is_dashboard_admin();

-- 看当前所有"管理员级别"的用户（直接查 auth.users）：
-- select id, email, raw_user_meta_data->>'user_name' as github_username
-- from auth.users
-- where lower(raw_user_meta_data->>'user_name') in ('leoatsr', 'webagentlab', 'han032206');
