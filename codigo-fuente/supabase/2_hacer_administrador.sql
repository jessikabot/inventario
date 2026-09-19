-- =====================================================================
--  PASO 2: CONVERTIR TU USUARIO EN ADMINISTRADOR
--
--  Antes de ejecutar esto:
--    - Ya debes haber ejecutado el archivo 1_crear_base_de_datos.sql
--    - Ya debes haber creado tu usuario en Supabase:
--      Authentication -> Users -> Add user -> Create new user
--      (marca la casilla "Auto Confirm User")
--
--  Qué hacer:
--    1. Cambia el correo de abajo (entre comillas) por el correo de TU usuario.
--    2. Copia todo, pégalo en SQL Editor y presiona "Run".
--    3. Abajo debe aparecer una fila con tu correo y el rol "admin".
--       Si no aparece ninguna fila, el correo no coincide: revísalo.
-- =====================================================================

insert into public.profiles (id, email, full_name, role, active)
select id, email, 'Administrador', 'admin', true
  from auth.users
 where lower(email) = lower('CAMBIA-ESTE-CORREO@ejemplo.com')
on conflict (id) do update
   set role = 'admin',
       active = true,
       full_name = case when public.profiles.full_name = '' then 'Administrador'
                        else public.profiles.full_name end;

select email, full_name, role, active from public.profiles where role = 'admin';
