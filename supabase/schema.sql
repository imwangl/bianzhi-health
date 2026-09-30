-- 在 Supabase Dashboard > SQL Editor 中执行一次。
create extension if not exists pgcrypto;

create table if not exists public.stool_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  bristol smallint not null check (bristol between 1 and 7),
  color text not null check (color in ('brown','dark-brown','green','yellow','black','red','pale')),
  feeling text not null check (feeling in ('easy','some-effort','straining')),
  symptoms text[] not null default '{}',
  note text not null default '',
  score smallint not null check (score between 0 and 100),
  risk text not null check (risk in ('good','watch','attention')),
  summary text not null,
  photo_path text,
  constraint own_photo_path check (photo_path is null or photo_path like user_id::text || '/%')
);

create index if not exists stool_records_user_created_idx
  on public.stool_records (user_id, created_at desc);

alter table public.stool_records enable row level security;

create policy "Users can read own records" on public.stool_records
  for select using (auth.uid() = user_id);
create policy "Users can insert own records" on public.stool_records
  for insert with check (auth.uid() = user_id);
create policy "Users can update own records" on public.stool_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own records" on public.stool_records
  for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stool-photos', 'stool-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false;

create policy "Users can read own stool photos" on storage.objects
  for select using (bucket_id = 'stool-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can upload own stool photos" on storage.objects
  for insert with check (bucket_id = 'stool-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own stool photos" on storage.objects
  for delete using (bucket_id = 'stool-photos' and (storage.foldername(name))[1] = auth.uid()::text);
