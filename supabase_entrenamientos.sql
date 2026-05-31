create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.cuenta_perfiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nombre text not null default '',
  apellidos text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_cuenta_perfiles_updated_at on public.cuenta_perfiles;
create trigger set_cuenta_perfiles_updated_at
before update on public.cuenta_perfiles
for each row execute function public.set_updated_at();

alter table public.cuenta_perfiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.cuenta_perfiles to authenticated;

do $$
begin
  if to_regclass('public.nutricion_perfiles') is not null then
    execute 'grant select, insert, update on public.nutricion_perfiles to authenticated';

    execute 'drop policy if exists "Usuarios leen su perfil nutricional" on public.nutricion_perfiles';
    execute 'create policy "Usuarios leen su perfil nutricional"
      on public.nutricion_perfiles for select
      to authenticated
      using (auth.uid() = user_id)';

    execute 'drop policy if exists "Usuarios crean su perfil nutricional" on public.nutricion_perfiles';
    execute 'create policy "Usuarios crean su perfil nutricional"
      on public.nutricion_perfiles for insert
      to authenticated
      with check (auth.uid() = user_id)';

    execute 'drop policy if exists "Usuarios actualizan su perfil nutricional" on public.nutricion_perfiles';
    execute 'create policy "Usuarios actualizan su perfil nutricional"
      on public.nutricion_perfiles for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)';
  end if;
end;
$$;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Usuarios leen su perfil de cuenta" on public.cuenta_perfiles;
create policy "Usuarios leen su perfil de cuenta"
on public.cuenta_perfiles for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Usuarios crean su perfil de cuenta" on public.cuenta_perfiles;
create policy "Usuarios crean su perfil de cuenta"
on public.cuenta_perfiles for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Usuarios actualizan su perfil de cuenta" on public.cuenta_perfiles;
create policy "Usuarios actualizan su perfil de cuenta"
on public.cuenta_perfiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Usuarios leen avatars" on storage.objects;
create policy "Usuarios leen avatars"
on storage.objects for select
to authenticated
using (bucket_id = 'avatars');

drop policy if exists "Usuarios suben su avatar" on storage.objects;
create policy "Usuarios suben su avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Usuarios actualizan su avatar" on storage.objects;
create policy "Usuarios actualizan su avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Usuarios eliminan su avatar" on storage.objects;
create policy "Usuarios eliminan su avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
