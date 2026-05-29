-- Migracion para gestion de tiempo: actividades tipadas, repeticion, visibilidad
-- de calendarios y tareas archivadas. Es idempotente para poder ejecutarla mas
-- de una vez en Supabase.

alter table public.actividades
  add column if not exists categoria text;

update public.actividades
set categoria = case
  when descripcion like '[[subtipo:actividad_fisica]]%' then 'actividad_fisica'
  when descripcion like '[[subtipo:cumpleanos]]%' then 'cumpleanos'
  when tipo = 'bloque_tiempo' then 'tiempo_dedicado'
  else 'evento_unico'
end
where categoria is null;

alter table public.actividades
  alter column categoria set default 'evento_unico',
  alter column categoria set not null;

alter table public.actividades
  add column if not exists visible_calendario_mensual boolean;

update public.actividades
set visible_calendario_mensual = true
where visible_calendario_mensual is null;

alter table public.actividades
  alter column visible_calendario_mensual set default false,
  alter column visible_calendario_mensual set not null;

alter table public.actividades
  add column if not exists datos_extra jsonb;

update public.actividades
set datos_extra = '{}'::jsonb
where datos_extra is null;

alter table public.actividades
  alter column datos_extra set default '{}'::jsonb,
  alter column datos_extra set not null;

alter table public.actividades
  add column if not exists serie_id uuid,
  add column if not exists ocurrencia_fecha date,
  add column if not exists oculta_calendarios boolean,
  add column if not exists eliminada_calendario_at timestamptz;

update public.actividades
set oculta_calendarios = false
where oculta_calendarios is null;

alter table public.actividades
  alter column oculta_calendarios set default false,
  alter column oculta_calendarios set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'actividades_categoria_check'
      and conrelid = 'public.actividades'::regclass
  ) then
    alter table public.actividades drop constraint actividades_categoria_check;
  end if;

  alter table public.actividades
    add constraint actividades_categoria_check
    check (
      categoria in (
        'evento_unico',
        'actividad_fisica',
        'cumpleanos',
        'juntada',
        'actividad_rutinaria',
        'tiempo_dedicado'
      )
    );
end $$;

alter table public.tareas_kanban
  add column if not exists archivada_at timestamptz;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'tareas_kanban_columna_check'
      and conrelid = 'public.tareas_kanban'::regclass
  ) then
    alter table public.tareas_kanban drop constraint tareas_kanban_columna_check;
  end if;

  alter table public.tareas_kanban
    add constraint tareas_kanban_columna_check
    check (columna in ('todo', 'pendientes', 'in_progress', 'done', 'archived'));
end $$;

create index if not exists actividades_user_fecha_visible_idx
  on public.actividades (user_id, fecha_inicio)
  where oculta_calendarios = false;

create index if not exists actividades_user_serie_idx
  on public.actividades (user_id, serie_id)
  where serie_id is not null;

create index if not exists actividades_user_categoria_idx
  on public.actividades (user_id, categoria);

create index if not exists tareas_kanban_user_columna_idx
  on public.tareas_kanban (user_id, columna, posicion);
