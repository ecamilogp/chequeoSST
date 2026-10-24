-- ---------------------------------------------------------------------
-- Cambio 002 · Validar todas las inspecciones de un día con una sola firma
-- Pega esto en Supabase → SQL Editor → New query → Run (una sola vez).
--   · Solo owner y administradores.
--   · Solo un día a la vez (p_fecha); nunca un rango ni el mes.
--   · Valida las que están "por validar" o "corregidas" de ese día.
--   · No toca las devueltas (esperan corrección del empleado),
--     ni las ya validadas, ni la propia inspección de quien firma.
-- ---------------------------------------------------------------------
create or replace function public.validar_dia(
  p_fecha date,
  p_nombre text,
  p_cargo text,
  p_firma_path text
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  yo public.miembros := public.mi_miembro();
  n  integer;
begin
  if yo.id is null or yo.rol not in ('owner', 'admin') then raise exception 'Solo el owner y los administradores pueden revisar.'; end if;
  if p_fecha is null then raise exception 'Elige el día que vas a validar.'; end if;
  if p_fecha > (now() at time zone 'America/Bogota')::date then raise exception 'No se puede validar un día futuro.'; end if;
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'Escribe tu nombre.'; end if;
  if p_firma_path is null or position(('rev/' || yo.id::text || '/') in p_firma_path) <> 1 then
    raise exception 'Falta tu firma.';
  end if;

  update public.inspecciones
     set estado = 'validada',
         revisor_id = yo.id,
         revisor_nombre = left(trim(p_nombre), 120),
         revisor_cargo = left(trim(coalesce(p_cargo, '')), 120),
         firma_revisor_path = p_firma_path,
         revisada_at = now(),
         nota_revisor = ''
   where fecha = p_fecha
     and estado in ('pendiente', 'corregida')
     and miembro_id <> yo.id;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.validar_dia(date, text, text, text) from public, anon;
grant execute on function public.validar_dia(date, text, text, text) to authenticated;
