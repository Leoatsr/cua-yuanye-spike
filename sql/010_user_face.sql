-- ============================================================================
-- F6.0 · 捏脸数据 (user_faces)
-- ============================================================================
-- 在 Supabase Dashboard → SQL Editor 跑这个文件
-- ============================================================================
-- 维度：发型 (0-3) · 发色 (0-3) · 衣服色 (0-3)
-- 总组合：4 × 4 × 4 = 64
-- ============================================================================

create table if not exists public.user_faces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hairstyle smallint not null default 0 check (hairstyle >= 0 and hairstyle <= 3),
  hair_color smallint not null default 0 check (hair_color >= 0 and hair_color <= 3),
  outfit_color smallint not null default 0 check (outfit_color >= 0 and outfit_color <= 3),
  updated_at timestamptz not null default now()
);

create index if not exists user_faces_updated_idx
  on public.user_faces (updated_at desc);

-- ----- RLS -----

alter table public.user_faces enable row level security;

drop policy if exists "users see own face" on public.user_faces;
drop policy if exists "everyone read faces" on public.user_faces;
drop policy if exists "users insert own face" on public.user_faces;
drop policy if exists "users update own face" on public.user_faces;
drop policy if exists "users delete own face" on public.user_faces;

-- 任何登录用户能看任何人的脸（用于排行榜显示头像）
create policy "everyone read faces"
  on public.user_faces for select using (auth.role() = 'authenticated');

create policy "users insert own face"
  on public.user_faces for insert
  with check (auth.uid() = user_id);

create policy "users update own face"
  on public.user_faces for update
  using (auth.uid() = user_id);

create policy "users delete own face"
  on public.user_faces for delete
  using (auth.uid() = user_id);
