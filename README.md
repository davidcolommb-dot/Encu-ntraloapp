# Aula Virtual Muñoz Bosch — versión web independiente (Supabase)

Esta es la versión del Aula Virtual adaptada para funcionar como página web real,
fuera de Claude. Usa [Supabase](https://supabase.com) (plan gratuito) como base de
datos en lugar del almacenamiento interno de los artifacts de Claude.

## 1. Crear el proyecto en Supabase (gratis)

1. Ve a [supabase.com](https://supabase.com) → "Start your project" → crea una cuenta
   (puedes entrar con GitHub o Google).
2. "New project" → ponle un nombre (ej. `aula-virtual-mb`) → elige una contraseña
   de base de datos (guárdala, no hace falta usarla en este proyecto) → elige la
   región más cercana (Europa) → "Create new project". Tarda 1-2 minutos en crearse.

## 2. Crear la tabla

1. En el menú lateral de tu proyecto Supabase, entra en **SQL Editor**.
2. "New query" → abre el archivo `supabase/schema.sql` de esta carpeta, copia todo
   su contenido, pégalo ahí → pulsa **Run**.
3. Deberías ver "Success. No rows returned". Ya tienes la tabla `app_storage`
   creada, con las políticas de acceso configuradas.

   ⚠️ Lee el aviso de seguridad que hay dentro de `schema.sql` antes de continuar
   — es importante que lo entiendas antes de meter datos reales.

## 3. Coger las credenciales

1. En el menú lateral: **Project Settings** (el icono de engranaje) → **API**.
2. Copia el valor de **Project URL**.
3. Copia el valor de **anon public** (dentro de "Project API keys"). No copies
   "service_role" — esa es secreta y no debe usarse aquí.

## 4. Configurar el proyecto localmente

Necesitas [Node.js](https://nodejs.org) instalado (versión 18 o superior).

```bash
# Dentro de la carpeta del proyecto:
npm install
cp .env.example .env
```

Abre `.env` y pega tus dos valores:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anon_aqui
```

## 5. Probarlo en tu ordenador

```bash
npm run dev
```

Abre la URL que te muestre (normalmente `http://localhost:5173`). La primera vez
que entres como administrador, te pedirá crear el PIN — a partir de ahí ya puedes
añadir empleados, grupos y formaciones, y esos datos quedan guardados de verdad
en tu proyecto Supabase (puedes comprobarlo en **Table Editor > app_storage**).

## 6. Publicarlo con tu dominio (.com / .es)

Recomendación: **Cloudflare Pages** (gratis, sin límite de tráfico), aunque
Vercel o Netlify funcionan igual de bien.

Con Cloudflare Pages:

1. Sube este proyecto a un repositorio de GitHub (puedes hacerlo desde
   [github.com/new](https://github.com/new) + arrastrar los archivos, o con git).
2. En [pages.cloudflare.com](https://pages.cloudflare.com) → "Create a project" →
   conecta tu cuenta de GitHub → elige el repositorio.
3. Configuración de build:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
4. En "Environment variables" añade las dos mismas variables que en tu `.env`:
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. "Save and Deploy". En un par de minutos tendrás una URL tipo
   `aula-virtual-mb.pages.dev` ya funcionando.
6. Para conectar tu dominio: dentro del proyecto en Cloudflare Pages →
   **Custom domains** → añade tu dominio `.com` o `.es` (tendrás que haberlo
   comprado antes en un registrador — Cloudflare Registrar, Namecheap, OVH...).
   Cloudflare te guía para apuntar el DNS.

## Qué cambió respecto a la versión de Claude

- Antes: los datos vivían en `window.storage` (solo existe dentro de un artifact
  de Claude). Ahora: viven en la tabla `app_storage` de tu Supabase, en formato
  clave/valor idéntico — la lógica de la app no ha cambiado, solo el sitio donde
  se guarda.
- Los adjuntos (PDF, imágenes) siguen guardándose como texto codificado en
  base64, igual que antes, cada uno en su propia fila de la tabla.
- El límite de ~3,5 MB por documento adjunto lo dejé igual — puedes subirlo si
  quieres, Supabase lo admite sin problema, pero mejor probarlo primero.

## Nota de seguridad (léela)

El PIN de acceso protege la interfaz, no la base de datos. Con la configuración
de este `schema.sql`, la clave pública de Supabase (visible en el código de la
web) puede leer y escribir directamente en la tabla, sin pasar por ningún PIN.
Para uso interno con datos de formación es un riesgo generalmente asumible, pero
si en algún momento vais a guardar algo más sensible, hay que añadir una capa de
seguridad real en Supabase (Auth + políticas por usuario) antes de hacerlo.
