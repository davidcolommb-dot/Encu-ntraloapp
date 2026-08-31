// ============================================================================
// Aula Virtual Muñoz Bosch — Avisos automáticos por Outlook
// ============================================================================
// Este archivo sustituye al "solo servir la web" de antes: ahora el mismo
// Worker de Cloudflare, además de servir la aplicación, ejecuta una tarea
// programada (cron) que revisa Supabase y envía avisos por correo a través
// de Microsoft Graph (la API que hay detrás de Outlook/Microsoft 365).
//
// No necesita que nadie tenga la app abierta — Cloudflare lo dispara solo,
// a la hora que se configure en wrangler.jsonc.
//
// Variables/secretos que necesita (Cloudflare → Settings → Variables and
// Secrets — la sección GENERAL, no la de "Build"):
//   SUPABASE_URL            (la misma URL que ya usa la app)
//   SUPABASE_SERVICE_KEY    (la clave "service_role" de Supabase — Project
//                            Settings > API. Es más fiable que la "anon" para
//                            un proceso de fondo, porque no depende de RLS)
//   MS_TENANT_ID            (de tu registro de aplicación en Azure)
//   MS_CLIENT_ID            (de tu registro de aplicación en Azure)
//   MS_CLIENT_SECRET        (el secreto que generaste para esa aplicación)
//   MS_SENDER_EMAIL         (la dirección desde la que se envían los avisos,
//                            ej. aula-virtual@munozbosch.com)
//   NOTIFY_TEST_SECRET      (una palabra clave inventada por ti, para poder
//                            probar el envío a mano sin esperar al cron)
//   NOTIFY_DRY_RUN          ("true" mientras pruebas — no envía nada de
//                            verdad, solo te dice qué habría enviado)
//   APP_URL                 (la URL pública de la app, para el botón del email)
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Ruta de prueba manual: visita
    // https://tu-web.workers.dev/__test-notifications?secret=TU_PALABRA_CLAVE
    // para disparar la comprobación a mano, sin esperar al cron diario.
    if (url.pathname === "/__test-notifications") {
      if (!env.NOTIFY_TEST_SECRET || url.searchParams.get("secret") !== env.NOTIFY_TEST_SECRET) {
        return new Response("No autorizado.", { status: 401 });
      }
      try {
        const result = await runNotificationCheck(env);
        return new Response(JSON.stringify(result, null, 2), { headers: { "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }, null, 2), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    // Cualquier otra ruta: la app normal, como siempre.
    return env.ASSETS.fetch(request);
  },

  // Esto es lo que Cloudflare llama solo, a la hora programada en wrangler.jsonc.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runNotificationCheck(env));
  },
};

/* ---------- Lógica de negocio (replica la de la app, en JS plano) ---------- */

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T23:59:59");
  const now = new Date();
  return Math.ceil((target - now) / 86400000);
}

// A diferencia de daysUntil (pensada para mostrar "quedan X días" en pantalla,
// donde redondear hacia arriba tiene sentido), aquí necesitamos saber si HOY
// es exactamente el día "3 días antes" o el día del propio plazo — comparando
// fechas de calendario en UTC, sin que la hora exacta a la que se ejecuta el
// cron afecte al resultado. Sin esto, "d === 3" casi nunca sería cierto.
function calendarDaysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00Z");
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.round((target - todayUTC) / 86400000);
}

function isAssignedToUser(course, userName, groups) {
  const a = course.assignment;
  if (!a || a.mode === "todos") return true;
  if (a.mode === "individual") return (a.employeeNames || []).includes(userName);
  if (a.mode === "grupos") {
    const userGroupIds = groups.filter((g) => (g.memberNames || []).includes(userName)).map((g) => g.id);
    return (a.groupIds || []).some((gid) => userGroupIds.includes(gid));
  }
  return true;
}

/* ---------- Acceso a Supabase (REST directo, sin librería) ---------- */

async function supabaseGet(env, query) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/app_storage?${query}`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase (lectura) falló: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabaseUpsert(env, key, value) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/app_storage`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase (guardado) falló: ${res.status} ${await res.text()}`);
}

/* ---------- Microsoft Graph (Outlook) ---------- */

async function getGraphToken(env) {
  const res = await fetch(`https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.MS_CLIENT_ID,
      client_secret: env.MS_CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`No se pudo obtener el token de Microsoft: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function sendMail(env, accessToken, toEmail, subject, htmlBody) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${env.MS_SENDER_EMAIL}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: htmlBody },
        toRecipients: [{ emailAddress: { address: toEmail } }],
      },
      saveToSentItems: false,
    }),
  });
  if (!res.ok) {
    console.error(`Fallo al enviar a ${toEmail}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

function buildEmailHtml(appUrl, name, items) {
  const list = items.map((i) => `<li style="margin-bottom:8px;">${i}</li>`).join("");
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
      <div style="background:#E9312B;padding:16px 24px;border-radius:8px 8px 0 0;">
        <span style="color:#ffffff;font-weight:bold;font-size:16px;">Aula Virtual · Muñoz Bosch</span>
      </div>
      <div style="border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <p>Hola ${name},</p>
        <p>Tienes novedades en tu Aula Virtual:</p>
        <ul style="padding-left:20px;">${list}</ul>
        <p style="margin-top:24px;">
          <a href="${appUrl}" style="background:#E9312B;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Entrar al Aula Virtual</a>
        </p>
      </div>
    </div>
  `;
}

/* ---------- El proceso completo ---------- */

export async function runNotificationCheck(env) {
  const dryRun = env.NOTIFY_DRY_RUN === "true";

  // 1. Cargar formaciones, empleados, grupos y el registro de avisos ya enviados.
  const mainRows = await supabaseGet(env, "key=in.(mb_courses,mb_employees,mb_groups,mb_notif_log)&select=key,value");
  const byKey = Object.fromEntries(mainRows.map((r) => [r.key, r.value]));
  const courses = byKey.mb_courses || [];
  const employees = byKey.mb_employees || [];
  const groups = byKey.mb_groups || [];
  const notifLog = byKey.mb_notif_log || {};

  // 2. Cargar el progreso de todas las formaciones de una vez.
  const completionRows = await supabaseGet(env, "key=like.mb_completions_course_*&select=key,value");
  const completionsByCourse = {};
  for (const row of completionRows) {
    const courseId = row.key.replace("mb_completions_course_", "");
    completionsByCourse[courseId] = row.value || {};
  }

  // 3. Calcular qué avisos hacen falta, agrupados por persona (un solo correo
  //    por persona con todo lo que le corresponda, no uno por cada cosa).
  const perEmployee = {};
  const newlySent = [];
  const now = Date.now();

  function addItem(emp, text, logKey) {
    if (notifLog[logKey]) return; // ya se avisó de esto antes, no repetir
    if (!perEmployee[emp.email]) perEmployee[emp.email] = { name: emp.name, items: [] };
    perEmployee[emp.email].items.push(text);
    newlySent.push(logKey);
  }

  for (const emp of employees) {
    if (!emp.email) continue;
    for (const course of courses) {
      if (!isAssignedToUser(course, emp.name, groups)) continue;
      const rec = completionsByCourse[course.id]?.[emp.name];
      const completed = rec && rec.status === "completada";

      if (!completed && course.deadline) {
        const d = calendarDaysUntil(course.deadline);
        if (d === 3) {
          addItem(emp, `"${course.title}" vence en 3 días`, `${course.id}__${emp.name}__3day`);
        } else if (d === 0) {
          addItem(emp, `"${course.title}" vence hoy — quedan menos de 24 horas`, `${course.id}__${emp.name}__lastday`);
        }
      }

      if (course.createdAt) {
        const ageHours = (now - new Date(course.createdAt).getTime()) / 3600000;
        // Margen de 30h (no 24h exactas) para que un cron diario no se salte
        // nunca una formación publicada justo antes de la última comprobación.
        if (ageHours >= 0 && ageHours <= 30 && isAssignedToUser(course, emp.name, groups)) {
          addItem(emp, `Nueva formación disponible: "${course.title}"`, `${course.id}__${emp.name}__new`);
        }
      }
    }
  }

  const recipients = Object.entries(perEmployee);
  if (recipients.length === 0) {
    return { sent: 0, dryRun, checked: employees.length };
  }

  // 4. Enviar (o simular, en modo prueba).
  let accessToken = null;
  if (!dryRun) accessToken = await getGraphToken(env);

  let sent = 0;
  const details = [];
  for (const [email, data] of recipients) {
    if (dryRun) {
      details.push({ email, name: data.name, items: data.items });
    } else {
      const html = buildEmailHtml(env.APP_URL || "", data.name, data.items);
      const ok = await sendMail(env, accessToken, email, "Aula Virtual · Tienes novedades de formación", html);
      if (ok) sent++;
    }
  }

  // 5. Guardar qué se ha avisado ya, para no repetirlo mañana.
  if (!dryRun && newlySent.length > 0) {
    const updatedLog = { ...notifLog };
    for (const k of newlySent) updatedLog[k] = new Date().toISOString();
    await supabaseUpsert(env, "mb_notif_log", updatedLog);
  }

  return dryRun
    ? { dryRun: true, wouldSendTo: recipients.length, details }
    : { sent, totalRecipients: recipients.length };
}
