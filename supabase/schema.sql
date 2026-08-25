-- Aula Virtual Muñoz Bosch — esquema de Supabase
-- Ejecuta esto en: tu proyecto Supabase > SQL Editor > New query > pega y "Run"

-- Una única tabla, a modo de almacén clave-valor, que reproduce fielmente
-- cómo guardaba los datos la versión de Claude (una clave por curso, por
-- adjunto, etc.). Esto minimiza el riesgo de romper algo en la migración:
-- toda la lógica de la app sigue igual, solo cambia dónde vive el dato.
create table if not exists app_storage (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Fila de ejemplo — bórrala, es solo para comprobar que la tabla funciona.
-- insert into app_storage (key, value) values ('test', '{"ok": true}');

-- Row Level Security: lo activamos, pero con políticas permisivas para la
-- clave "anon" (pública), porque esta app usa su propio sistema de PIN en
-- vez del sistema de autenticación de Supabase.
--
-- AVISO DE SEGURIDAD IMPORTANTE: con esta configuración, cualquiera que
-- inspeccione el código de la web (la "anon key" es pública, viaja en el
-- propio JavaScript del navegador) puede leer y escribir DIRECTAMENTE en
-- esta tabla, saltándose por completo la pantalla de PIN. El PIN protege
-- la interfaz, no la base de datos. Para un dato como "quién ha completado
-- qué formación" esto suele ser un riesgo asumible en un uso interno, pero
-- no lo trates como una base de datos con información realmente sensible
-- (nóminas, datos médicos, etc.) sin añadir después una capa de seguridad
-- real (Supabase Auth + políticas por usuario, o funciones "Edge" que
-- validen el PIN en el servidor antes de tocar la tabla).
alter table app_storage enable row level security;

create policy "anon puede leer" on app_storage
  for select using (true);

create policy "anon puede insertar" on app_storage
  for insert with check (true);

create policy "anon puede actualizar" on app_storage
  for update using (true);

create policy "anon puede borrar" on app_storage
  for delete using (true);
