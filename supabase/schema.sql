-- =====================================================================
-- ChequeoSST · Base de datos (Supabase / PostgreSQL)
-- Pegar completo en Supabase → SQL Editor → Run.
-- Se puede volver a ejecutar: no borra datos.
-- =====================================================================

create extension if not exists pgcrypto;

do $$ begin
  create type public.rol_miembro as enum ('owner', 'admin', 'empleado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_inspeccion as enum ('pendiente', 'corregida', 'validada', 'devuelta');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

-- Personas autorizadas. Se registran por correo de Google; la cuenta se
-- vincula sola (user_id) la primera vez que esa persona inicia sesión.
create table if not exists public.miembros (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (email = lower(trim(email)) and email like '%@%'),
  user_id    uuid unique references auth.users (id) on delete set null,
  nombre     text not null,
  cargo      text not null default '',
  area       text not null default '',
  rol        public.rol_miembro not null default 'empleado',
  energia    boolean not null default false,   -- actividades que realiza
  agua       boolean not null default false,
  moto       boolean not null default false,
  activo     boolean not null default true,
  creado_por uuid references public.miembros (id),
  creado_at  timestamptz not null default now()
);

-- Elementos de la planilla FO-CG-42 (debe coincidir con src/lib/catalogo.js).
create table if not exists public.elementos (
  id             text primary key,
  seccion        text not null,
  seccion_nombre text not null,
  nombre         text not null,
  orden          int  not null,
  activo         boolean not null default true
);

insert into public.elementos (id, seccion, seccion_nombre, nombre, orden) values
  ('A01','A','EPP generales','Gafas de seguridad lente claro',1),
  ('A02','A','EPP generales','Gafas lente oscuro',2),
  ('A03','A','EPP generales','Monogafa de seguridad LC',3),
  ('A04','A','EPP generales','Tapaoídos de inserción',4),
  ('A05','A','EPP generales','Tapaoídos de copa',5),
  ('A06','A','EPP generales','Guantes de poliuretano',6),
  ('A07','A','EPP generales','Guantes anticorte CAT 5',7),
  ('A08','A','EPP generales','Guantes de carnaza',8),
  ('A09','A','EPP generales','Casco de seguridad tipo II',9),
  ('A10','A','EPP generales','Máscara respirador media cara',10),
  ('A11','A','EPP generales','Filtro para máscara',11),
  ('A12','A','EPP generales','Botas de seguridad dieléctricas',12),
  ('B01','B','EPP para actividades de energía','Guante protector de carnaza',13),
  ('B02','B','EPP para actividades de energía','Guantín de algodón',14),
  ('B03','B','EPP para actividades de energía','Guante caucho aislado CL0',15),
  ('B04','B','EPP para actividades de energía','Guante caucho aislado CL2',16),
  ('B05','B','EPP para actividades de energía','Guante caucho aislado CL4',17),
  ('B06','B','EPP para actividades de energía','Careta arco eléctrico',18),
  ('B07','B','EPP para actividades de energía','Monja balaclava',19),
  ('B08','B','EPP para actividades de energía','Overol ignífugo',20),
  ('C01','C','EPP para actividades de agua','Rodilleras',21),
  ('C02','C','EPP para actividades de agua','Guantes de caucho',22),
  ('C03','C','EPP para actividades de agua','Máscara full face',23),
  ('C04','C','EPP para actividades de agua','Overol de trabajo',24),
  ('C05','C','EPP para actividades de agua','Impermeable',25),
  ('D01','D','EPP para moto','Rodilleras',26),
  ('D02','D','EPP para moto','Coderas',27),
  ('D03','D','EPP para moto','Casco de motociclista',28),
  ('D04','D','EPP para moto','Chaleco airbag',29),
  ('D05','D','EPP para moto','Guante protector para motocicleta',30),
  ('D06','D','EPP para moto','Botas para motocicleta',31),
  ('D07','D','EPP para moto','Bala de repuesto',32),
  ('E01','E','Dotación','Camibuso gris',33),
  ('E02','E','Dotación','Pantalón',34)
on conflict (id) do nothing;

-- Una fila por empleado por día.
create table if not exists public.inspecciones (
  id                    uuid primary key default gen_random_uuid(),
  miembro_id            uuid not null references public.miembros (id),
  fecha                 date not null,
  respuestas            jsonb not null,               -- {"A01":"C","A02":"N",...}  C=Cumple N=No cumple NA=No aplica
  obs_items             jsonb not null default '{}',  -- {"A02":"lente rayado"} solo para los N
  observaciones         text not null default '',
  total_no_cumple       int  not null default 0,
  firma_path            text not null,                -- imagen en el bucket "firmas"
  ubicacion             text,                         -- "lat, lon" del celular al enviar
  nombre                text not null,                -- copia de los datos del empleado ese día
  cargo                 text not null default '',
  area                  text not null default '',
  enviada_at            timestamptz not null default now(),
  estado                public.estado_inspeccion not null default 'pendiente',
  revisor_id            uuid references public.miembros (id),
  revisor_nombre        text,
  revisor_cargo         text,
  firma_revisor_path    text,
  revisada_at           timestamptz,
  nota_revisor          text,
  unique (miembro_id, fecha)
);
create index if not exists inspecciones_fecha_idx on public.inspecciones (fecha);

-- ---------------------------------------------------------------------
-- Funciones de apoyo
-- ---------------------------------------------------------------------

-- Correo de la cuenta de Google con la que se inició sesión.
create or replace function public.mi_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Miembro activo que corresponde a la sesión (null si no está autorizado).
create or replace function public.mi_miembro()
returns public.miembros language sql stable security definer set search_path = public as $$
  select * from public.miembros where user_id = auth.uid() and activo limit 1;
$$;

create or replace function public.mi_miembro_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.miembros where user_id = auth.uid() and activo limit 1;
$$;

create or replace function public.mi_rol()
returns public.rol_miembro language sql stable security definer set search_path = public as $$
  select rol from public.miembros where user_id = auth.uid() and activo limit 1;
$$;

create or replace function public.es_revisor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('owner', 'admin'), false);
$$;

-- Al entrar: vincula la cuenta de Google con el correo registrado y
-- devuelve el perfil. Si el correo no está autorizado devuelve null.
create or replace function public.entrar()
returns public.miembros language plpgsql security definer set search_path = public as $$
declare m public.miembros;
begin
  if auth.uid() is null then return null; end if;
  update public.miembros set user_id = auth.uid()
   where email = public.mi_email() and user_id is null and activo
     and not exists (select 1 from public.miembros x where x.user_id = auth.uid());
  select * into m from public.miembros where user_id = auth.uid() and activo;
  return m;
end $$;

-- ---------------------------------------------------------------------
-- Inspecciones
-- ---------------------------------------------------------------------

-- El empleado envía (o corrige) su inspección del día. Todo se valida aquí.
create or replace function public.enviar_inspeccion(
  p_fecha date,
  p_respuestas jsonb,
  p_obs jsonb,
  p_observaciones text,
  p_firma_path text,
  p_ubicacion text,
  p_cargo text,
  p_area text,
  p_energia boolean,
  p_agua boolean,
  p_moto boolean
) returns public.inspecciones
language plpgsql security definer set search_path = public as $$
declare
  yo      public.miembros := public.mi_miembro();
  hoy     date := (now() at time zone 'America/Bogota')::date;
  previa  public.inspecciones;
  r       public.inspecciones;
  faltan  text;
  sin_obs text;
  resp    jsonb;
  obs     jsonb;
  nc      int;
begin
  if yo.id is null then raise exception 'Tu usuario no está autorizado.'; end if;
  if p_fecha is null or p_fecha > hoy then raise exception 'No puedes registrar días futuros.'; end if;
  if p_fecha < hoy - 7 then raise exception 'Solo puedes registrar hasta 7 días atrás.'; end if;
  if p_firma_path is null or position((yo.id::text || '/') in p_firma_path) <> 1 then
    raise exception 'Falta la firma.';
  end if;

  select string_agg(e.nombre, ', ' order by e.orden) into faltan
    from public.elementos e
   where e.activo and coalesce(p_respuestas ->> e.id, '') not in ('C', 'N', 'NA');
  if faltan is not null then raise exception 'Faltan elementos por marcar: %', faltan; end if;

  select string_agg(e.nombre, ', ' order by e.orden) into sin_obs
    from public.elementos e
   where e.activo and p_respuestas ->> e.id = 'N'
     and length(trim(coalesce(p_obs ->> e.id, ''))) = 0;
  if sin_obs is not null then raise exception 'Explica qué falla en: %', sin_obs; end if;

  select coalesce(jsonb_object_agg(e.id, p_respuestas ->> e.id), '{}'),
         coalesce(jsonb_object_agg(e.id, left(trim(p_obs ->> e.id), 300)) filter (where p_respuestas ->> e.id = 'N'), '{}'),
         count(*) filter (where p_respuestas ->> e.id = 'N')
    into resp, obs, nc
    from public.elementos e where e.activo;

  update public.miembros
     set cargo = left(coalesce(nullif(trim(p_cargo), ''), cargo), 120),
         area = left(coalesce(trim(p_area), area), 120),
         energia = coalesce(p_energia, energia),
         agua = coalesce(p_agua, agua),
         moto = coalesce(p_moto, moto)
   where id = yo.id
  returning * into yo;

  select * into previa from public.inspecciones where miembro_id = yo.id and fecha = p_fecha for update;
  if found then
    if previa.estado = 'validada' then
      raise exception 'Esta inspección ya fue validada y no se puede cambiar.';
    end if;
    update public.inspecciones
       set respuestas = resp, obs_items = obs, observaciones = left(coalesce(p_observaciones, ''), 1000),
           total_no_cumple = nc, firma_path = p_firma_path, ubicacion = left(p_ubicacion, 60),
           nombre = yo.nombre, cargo = yo.cargo, area = yo.area, enviada_at = now(),
           estado = case when previa.estado = 'devuelta' then 'corregida'::public.estado_inspeccion else previa.estado end
     where id = previa.id
    returning * into r;
  else
    insert into public.inspecciones (miembro_id, fecha, respuestas, obs_items, observaciones, total_no_cumple,
                                     firma_path, ubicacion, nombre, cargo, area)
    values (yo.id, p_fecha, resp, obs, left(coalesce(p_observaciones, ''), 1000), nc,
            p_firma_path, left(p_ubicacion, 60), yo.nombre, yo.cargo, yo.area)
    returning * into r;
  end if;
  return r;
end $$;

-- El owner o un administrador valida o devuelve una inspección con su firma.
create or replace function public.revisar_inspeccion(
  p_id uuid,
  p_estado text,
  p_nombre text,
  p_cargo text,
  p_nota text,
  p_firma_path text
) returns public.inspecciones
language plpgsql security definer set search_path = public as $$
declare
  yo public.miembros := public.mi_miembro();
  i  public.inspecciones;
  r  public.inspecciones;
begin
  if yo.id is null or yo.rol not in ('owner', 'admin') then raise exception 'Solo el owner y los administradores pueden revisar.'; end if;
  if p_estado not in ('validada', 'devuelta') then raise exception 'Estado no válido.'; end if;
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'Escribe tu nombre.'; end if;
  if p_estado = 'devuelta' and length(trim(coalesce(p_nota, ''))) = 0 then
    raise exception 'Escribe una nota explicando qué debe corregir.';
  end if;
  if p_firma_path is null or position(('rev/' || yo.id::text || '/') in p_firma_path) <> 1 then
    raise exception 'Falta tu firma.';
  end if;

  select * into i from public.inspecciones where id = p_id for update;
  if not found then raise exception 'La inspección no existe.'; end if;
  if i.miembro_id = yo.id then raise exception 'No puedes validar tu propia inspección.'; end if;
  if i.estado = 'validada' then raise exception 'Esta inspección ya está validada.'; end if;

  update public.inspecciones
     set estado = p_estado::public.estado_inspeccion,
         revisor_id = yo.id,
         revisor_nombre = left(trim(p_nombre), 120),
         revisor_cargo = left(trim(coalesce(p_cargo, '')), 120),
         firma_revisor_path = p_firma_path,
         revisada_at = now(),
         nota_revisor = left(trim(coalesce(p_nota, '')), 500)
   where id = p_id
  returning * into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Gestión de usuarios
--   owner: registra y edita administradores y empleados.
--   admin: registra y edita solo empleados.
-- ---------------------------------------------------------------------

create or replace function public.guardar_miembro(
  p_id uuid,          -- null para registrar uno nuevo
  p_email text,
  p_nombre text,
  p_cargo text,
  p_area text,
  p_rol text,
  p_energia boolean,
  p_agua boolean,
  p_moto boolean
) returns public.miembros
language plpgsql security definer set search_path = public as $$
declare
  yo     public.miembros := public.mi_miembro();
  actual public.miembros;
  r      public.miembros;
  correo text := lower(trim(coalesce(p_email, '')));
begin
  if yo.id is null or yo.rol not in ('owner', 'admin') then raise exception 'No tienes permiso para gestionar usuarios.'; end if;
  if p_rol not in ('admin', 'empleado') then raise exception 'Rol no válido.'; end if;
  if yo.rol = 'admin' and p_rol <> 'empleado' then raise exception 'Solo el owner puede registrar administradores.'; end if;
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'Escribe el nombre.'; end if;

  if p_id is null then
    if correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido.'; end if;
    if exists (select 1 from public.miembros where email = correo) then raise exception 'Ese correo ya está registrado.'; end if;
    insert into public.miembros (email, nombre, cargo, area, rol, energia, agua, moto, creado_por)
    values (correo, left(trim(p_nombre), 120), left(trim(coalesce(p_cargo, '')), 120), left(trim(coalesce(p_area, '')), 120),
            p_rol::public.rol_miembro, coalesce(p_energia, false), coalesce(p_agua, false), coalesce(p_moto, false), yo.id)
    returning * into r;
    return r;
  end if;

  select * into actual from public.miembros where id = p_id for update;
  if not found then raise exception 'El usuario no existe.'; end if;
  if actual.rol = 'owner' then raise exception 'El owner no se puede editar desde aquí.'; end if;
  if yo.rol = 'admin' and actual.rol <> 'empleado' then raise exception 'Solo el owner puede editar administradores.'; end if;

  -- El correo solo se puede corregir si la persona aún no ha entrado.
  if correo <> '' and correo <> actual.email then
    if actual.user_id is not null then raise exception 'No se puede cambiar el correo de alguien que ya ingresó.'; end if;
    if correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido.'; end if;
    if exists (select 1 from public.miembros where email = correo) then raise exception 'Ese correo ya está registrado.'; end if;
  else
    correo := actual.email;
  end if;

  update public.miembros
     set email = correo, nombre = left(trim(p_nombre), 120), cargo = left(trim(coalesce(p_cargo, '')), 120),
         area = left(trim(coalesce(p_area, '')), 120), rol = p_rol::public.rol_miembro,
         energia = coalesce(p_energia, false), agua = coalesce(p_agua, false), moto = coalesce(p_moto, false)
   where id = p_id
  returning * into r;
  return r;
end $$;

create or replace function public.activar_miembro(p_id uuid, p_activo boolean)
returns public.miembros language plpgsql security definer set search_path = public as $$
declare
  yo     public.miembros := public.mi_miembro();
  actual public.miembros;
  r      public.miembros;
begin
  if yo.id is null or yo.rol not in ('owner', 'admin') then raise exception 'No tienes permiso para gestionar usuarios.'; end if;
  select * into actual from public.miembros where id = p_id for update;
  if not found then raise exception 'El usuario no existe.'; end if;
  if actual.id = yo.id then raise exception 'No puedes desactivar tu propio usuario.'; end if;
  if actual.rol = 'owner' then raise exception 'El owner no se puede desactivar.'; end if;
  if yo.rol = 'admin' and actual.rol <> 'empleado' then raise exception 'Solo el owner puede desactivar administradores.'; end if;
  update public.miembros set activo = coalesce(p_activo, activo) where id = p_id returning * into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Permisos y reglas de seguridad (RLS)
-- Desde la app solo se puede leer; todo cambio pasa por las funciones.
-- ---------------------------------------------------------------------

alter table public.miembros     enable row level security;
alter table public.elementos    enable row level security;
alter table public.inspecciones enable row level security;

revoke all on public.miembros, public.elementos, public.inspecciones from anon, authenticated;
grant select on public.miembros, public.elementos, public.inspecciones to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.mi_email()', 'public.mi_miembro()', 'public.mi_miembro_id()', 'public.mi_rol()', 'public.es_revisor()', 'public.entrar()',
    'public.enviar_inspeccion(date, jsonb, jsonb, text, text, text, text, text, boolean, boolean, boolean)',
    'public.revisar_inspeccion(uuid, text, text, text, text, text)',
    'public.guardar_miembro(uuid, text, text, text, text, text, boolean, boolean, boolean)',
    'public.activar_miembro(uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

drop policy if exists miembros_leer on public.miembros;
create policy miembros_leer on public.miembros for select to authenticated
  using (user_id = auth.uid() or public.es_revisor());

drop policy if exists elementos_leer on public.elementos;
create policy elementos_leer on public.elementos for select to authenticated
  using (public.mi_miembro_id() is not null);

drop policy if exists inspecciones_leer on public.inspecciones;
create policy inspecciones_leer on public.inspecciones for select to authenticated
  using (miembro_id = public.mi_miembro_id() or public.es_revisor());

-- ---------------------------------------------------------------------
-- Firmas (Storage, bucket privado "firmas")
--   empleado: <id del miembro>/<fecha>-<hora>.png
--   revisor:  rev/<id del miembro>/<id inspección>-<hora>.png
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('firmas', 'firmas', false, 300000, array['image/png'])
on conflict (id) do nothing;

drop policy if exists firmas_subir on storage.objects;
create policy firmas_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'firmas' and public.mi_miembro_id() is not null and (
      (storage.foldername(name))[1] = public.mi_miembro_id()::text
      or ((storage.foldername(name))[1] = 'rev' and (storage.foldername(name))[2] = public.mi_miembro_id()::text and public.es_revisor())
    )
  );

drop policy if exists firmas_ver on storage.objects;
create policy firmas_ver on storage.objects for select to authenticated
  using (
    bucket_id = 'firmas' and public.mi_miembro_id() is not null and (
      (storage.foldername(name))[1] = public.mi_miembro_id()::text or public.es_revisor()
    )
  );

-- ---------------------------------------------------------------------
-- (Opcional, recomendado) Rechazar desde el inicio a quien no esté registrado.
-- Actívalo en Authentication → Hooks → "Before User Created" → Postgres →
-- función public.hook_antes_de_crear_usuario.
-- ---------------------------------------------------------------------
create or replace function public.hook_antes_de_crear_usuario(event jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.miembros where email = lower(event -> 'user' ->> 'email') and activo) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Tu correo no está autorizado. Pide al administrador que te registre.'));
end $$;

revoke all on function public.hook_antes_de_crear_usuario(jsonb) from public, anon, authenticated;
do $$ begin
  grant execute on function public.hook_antes_de_crear_usuario(jsonb) to supabase_auth_admin;
  grant select on public.miembros to supabase_auth_admin;
exception when undefined_object then null; end $$;
