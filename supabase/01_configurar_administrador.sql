-- LIQUIDADOR DIAN 16.30 — CONFIGURACIÓN DE ADMINISTRADOR
-- Reemplaza SOLO 'TU_CORREO_ADMIN@EJEMPLO.COM' por el correo con el que
-- crearás/iniciarás sesión en Supabase Authentication.

create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Permite que un usuario autenticado consulte únicamente su propia fila.
drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read
on public.admin_users
for select
to authenticated
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Registra el único administrador inicial.
insert into public.admin_users (email)
values ('TU_CORREO_ADMIN@EJEMPLO.COM')
on conflict (email) do nothing;

-- Protecciones para la tabla central de tasas.
-- La lectura pública ya existe en el proyecto. No se reemplaza aquí.

drop policy if exists tasas_admin_insert on public.tasas_liquidador;
create policy tasas_admin_insert
on public.tasas_liquidador
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists tasas_admin_update on public.tasas_liquidador;
create policy tasas_admin_update
on public.tasas_liquidador
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
with check (
  exists (
    select 1
    from public.admin_users a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

-- No se crea permiso de DELETE para administradores desde la aplicación.
