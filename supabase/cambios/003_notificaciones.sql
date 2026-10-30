-- ---------------------------------------------------------------------
-- Cambio 003 · Campana de notificaciones
-- Pega esto en Supabase → SQL Editor → New query → Run (una sola vez).
--   · Cuando una inspección se DEVUELVE, se avisa al empleado.
--   · Cuando el empleado la CORRIGE y la reenvía, se avisa al owner y a los
--     administradores activos.
--   Los avisos los crea la base de datos sola (trigger); nadie puede
--   escribirlos desde la app. Cada quien solo ve los suyos.
-- ---------------------------------------------------------------------
create table if not exists public.notificaciones (
  id             uuid primary key default gen_random_uuid(),
  miembro_id     uuid not null references public.miembros(id) on delete cascade,  -- quien la recibe
  tipo           text not null check (tipo in ('devuelta', 'corregida')),
  inspeccion_id  uuid references public.inspecciones(id) on delete cascade,
  empleado_id    uuid references public.miembros(id) on delete cascade,
  fecha          date not null,          -- día de la inspección
  titulo         text not null,
  detalle        text not null default '',
  creada_at      timestamptz not null default now(),
  leida_at       timestamptz
);
create index if not exists notificaciones_miembro_idx on public.notificaciones (miembro_id, creada_at desc);

alter table public.notificaciones enable row level security;
revoke all on public.notificaciones from anon, authenticated;
grant select on public.notificaciones to authenticated;

drop policy if exists notificaciones_leer on public.notificaciones;
create policy notificaciones_leer on public.notificaciones for select to authenticated
  using (miembro_id = public.mi_miembro_id());

-- Crea los avisos cuando cambia el estado de una inspección.
create or replace function public.notificar_cambio_inspeccion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado is not distinct from old.estado then return new; end if;

  if new.estado = 'devuelta' then
    insert into public.notificaciones (miembro_id, tipo, inspeccion_id, empleado_id, fecha, titulo, detalle)
    values (new.miembro_id, 'devuelta', new.id, new.miembro_id, new.fecha,
            'Te devolvieron la inspección para corregir',
            coalesce(nullif(new.revisor_nombre, ''), 'Quien revisa') || ': ' || coalesce(nullif(new.nota_revisor, ''), 'revisa tu inspección'));

  elsif new.estado = 'corregida' and old.estado = 'devuelta' then
    insert into public.notificaciones (miembro_id, tipo, inspeccion_id, empleado_id, fecha, titulo, detalle)
    select m.id, 'corregida', new.id, new.miembro_id, new.fecha,
           new.nombre || ' corrigió su inspección',
           case when new.total_no_cumple > 0 then new.total_no_cumple || ' elemento(s) aún no cumplen' else 'Lista para validar' end
      from public.miembros m
     where m.activo and m.rol in ('owner', 'admin') and m.id <> new.miembro_id;
  end if;
  return new;
end $$;

revoke all on function public.notificar_cambio_inspeccion() from public, anon, authenticated;

drop trigger if exists inspecciones_notificar on public.inspecciones;
create trigger inspecciones_notificar after update of estado on public.inspecciones
  for each row execute function public.notificar_cambio_inspeccion();

-- Marcar como leídas: una (p_id) o todas las mías (p_id nulo).
create or replace function public.marcar_notificaciones(p_id uuid default null) returns integer
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := public.mi_miembro_id();
  n  integer;
begin
  if yo is null then raise exception 'Tu usuario no está autorizado.'; end if;
  update public.notificaciones set leida_at = now()
   where miembro_id = yo and leida_at is null and (p_id is null or id = p_id);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.marcar_notificaciones(uuid) from public, anon;
grant execute on function public.marcar_notificaciones(uuid) to authenticated;
