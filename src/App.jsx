import { useState, useEffect, useMemo } from "react";
import {
  ClipboardList, Users, Package, Cpu, CheckCircle2, Clock, AlertTriangle,
  Plus, Trash2, X, PlayCircle, FileText, Newspaper, ChevronLeft, ChevronDown, ChevronUp, ChevronRight,
  ShieldCheck, LayoutGrid, Home, Settings, Loader2, LogOut, Lock, KeyRound,
  Trophy, Award, Star, PartyPopper, Upload, FileSpreadsheet, Search, Map
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { PublicClientApplication } from "@azure/msal-browser";
import * as XLSX from "xlsx";

// Credenciales de Supabase: se leen de variables de entorno (ver .env.example).
// Nunca pongas aquí la "service_role key" — solo la "anon public key",
// que está pensada para vivir en el navegador.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Inicio de sesión con la cuenta de Microsoft 365 (opcional — convive con el
// acceso por nombre y contraseña, no lo sustituye). Solo se activa si estas
// dos variables están rellenas; si no, el botón simplemente no aparece, para
// no romper nada en despliegues donde todavía no se haya configurado Azure.
const msalClientId = import.meta.env.VITE_MSAL_CLIENT_ID || "";
const msalTenantId = import.meta.env.VITE_MSAL_TENANT_ID || "";
const msalIsConfigured = !!(msalClientId && msalTenantId);
let msalInstancePromise = null;
function getMsalInstance() {
  if (!msalInstancePromise) {
    const pca = new PublicClientApplication({
      auth: {
        clientId: msalClientId,
        authority: `https://login.microsoftonline.com/${msalTenantId}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    msalInstancePromise = pca.initialize().then(() => pca);
  }
  return msalInstancePromise;
}
// Abre la ventana de acceso de Microsoft y devuelve el email + nombre de la
// persona una vez confirmada su identidad. No devuelve ninguna contraseña —
// eso lo comprueba Microsoft, nunca esta aplicación.
async function loginWithMicrosoftPopup() {
  const pca = await getMsalInstance();
  const result = await pca.loginPopup({ scopes: ["User.Read"] });
  return { email: result.account.username, name: result.account.name };
}

const BRAND = {
  red: "#E9312B",
  redDark: "#AF2520",
  gold: "#C9A227",
  blue: "#3E7C96",
  teal: "#2E5F5A",
  cream: "#FAF7F2",
  ink: "#2B2420",
};

const AVATAR_PALETTE = [BRAND.red, BRAND.blue, BRAND.gold, BRAND.teal, "#7A5C3E", "#5B6B79"];

// Límite de archivo adjunto: ~3.5MB en crudo para que, tras la codificación base64
// (+33% de tamaño), el elemento guardado no supere el límite de 5MB por clave.
const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024;

const CATEGORIES = [
  { id: "protocolos", label: "Protocolos", code: "P1", color: BRAND.blue, icon: ClipboardList },
  { id: "generica", label: "Formación genérica", code: "P2", color: BRAND.gold, icon: Users },
  { id: "especifica", label: "Formación específica por equipo", code: "P3", color: BRAND.red, icon: Package },
  { id: "ia", label: "IA y nuevas tecnologías", code: "P4", color: BRAND.teal, icon: Cpu },
];

function categoryMeta(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T23:59:59");
  const now = new Date();
  return Math.ceil((target - now) / 86400000);
}

// Caducidad y recertificación: si una formación tiene validityMonths configurado,
// una vez pasado ese tiempo desde que se completó, vuelve a contar como pendiente
// — sin borrar el historial de que ya se hizo una vez (eso se conserva en el
// propio registro, solo cambia lo que se considera "vigente ahora mismo").
function isCourseExpired(course, record) {
  if (!course?.validityMonths || !record?.completedAt) return false;
  const completedDate = new Date(record.completedAt);
  if (isNaN(completedDate.getTime())) return false;
  const expiryDate = new Date(completedDate);
  expiryDate.setMonth(expiryDate.getMonth() + course.validityMonths);
  return new Date() > expiryDate;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

function avatarColor(name) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

// Hash de contraseña de un solo sentido (SHA-256): nadie, ni el admin, puede
// "leer" la contraseña original a partir de esto — solo comparar si una
// contraseña introducida coincide. No es tan robusto como bcrypt/argon2 (no
// hay "salt" ni ralentización deliberada), pero es muchísimo más seguro que
// guardar la contraseña tal cual, y no requiere librerías externas.
async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Un hash SHA-256 real siempre son 64 caracteres hexadecimales. Si lo guardado no
// tiene esa forma (por ejemplo, un PIN de 4 dígitos del sistema anterior), lo
// tratamos como si no hubiera contraseña configurada, en vez de dejar a alguien
// bloqueado comparando su contraseña nueva contra un valor que nunca coincidirá.
function isValidHash(h) {
  return typeof h === "string" && /^[0-9a-f]{64}$/.test(h);
}

// Sesión recordada en este navegador (no en el servidor), para no pedir
// contraseña de nuevo cada vez que se recarga la página.
const SESSION_KEY = "mb_session_v1";
function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // almacenamiento no disponible (modo privado, etc.); la sesión simplemente no se recuerda
  }
}
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // nada que limpiar
  }
}

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita acentos
}

const HEADER_ALIASES = {
  nombre: ["nombre", "name", "empleado", "nombre y apellido", "nombre completo"],
  email: ["email", "correo", "e-mail", "correo electronico", "mail"],
  equipo: ["equipo", "grupo", "team", "departamento", "area"],
};

function matchColumn(headers, field) {
  const aliases = HEADER_ALIASES[field];
  const idx = headers.findIndex((h) => aliases.includes(normalizeHeader(h)));
  return idx;
}

// Lee un Excel/CSV de empleados y devuelve filas normalizadas + errores de formato.
// Columnas reconocidas (en cualquier orden, mayúsc./minúsc. y con o sin acentos):
// Nombre (obligatoria), Email (opcional), Equipo (opcional). Las contraseñas no se
// importan — cada persona crea la suya en su primer acceso.
async function parseEmployeeExcelFile(file) {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  if (rows.length === 0) return { rows: [], error: "El archivo está vacío." };

  const headers = rows[0];
  const nameIdx = matchColumn(headers, "nombre");
  if (nameIdx === -1) {
    return { rows: [], error: 'No se encontró una columna de nombre. Usa una cabecera como "Nombre" en la primera fila.' };
  }
  const emailIdx = matchColumn(headers, "email");
  const equipoIdx = matchColumn(headers, "equipo");

  const parsed = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row[nameIdx] || "").trim();
    if (!name) continue;
    const email = emailIdx !== -1 ? String(row[emailIdx] || "").trim() : "";
    const equipo = equipoIdx !== -1 ? String(row[equipoIdx] || "").trim() : "";
    parsed.push({ name, email, equipo });
  }
  return { rows: parsed, error: null };
}

function getVideoEmbedUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return `https://player.vimeo.com/video/${id}`;
    }
    if (u.hostname.includes("drive.google.com")) {
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
      const id = u.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
    return url;
  } catch {
    return url;
  }
}

function isAssignedToUser(course, userName, groups) {
  const a = course.assignment;
  if (!a) return true;
  // Nombres añadidos automáticamente (p. ej. por la ruta de bienvenida al dar de
  // alta a alguien nuevo) cuentan siempre, sin importar el modo de asignación —
  // así no hace falta tocar "todos/grupos/personas" para que esto funcione.
  if ((a.extraNames || []).includes(userName)) return true;
  if (a.mode === "todos") return true;
  if (a.mode === "individual") return (a.employeeNames || []).includes(userName);
  if (a.mode === "grupos") {
    const userGroupIds = groups.filter((g) => (g.memberNames || []).includes(userName)).map((g) => g.id);
    return (a.groupIds || []).some((gid) => userGroupIds.includes(gid));
  }
  return true;
}

const LEVELS = [
  { min: 0, name: "Iniciando", color: "#6B655D" },
  { min: 200, name: "En marcha", color: "#3E7C96" },
  { min: 500, name: "Consolidado", color: "#C9A227" },
  { min: 1000, name: "Experto", color: "#E9312B" },
];

function levelForPoints(points) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (points >= lvl.min) current = lvl;
  }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  return { ...current, tier: idx + 1, totalTiers: LEVELS.length, nextMin: next ? next.min : null };
}

function getFormEmbedUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("docs.google.com") && u.pathname.includes("/forms/")) {
      if (!u.searchParams.has("embedded")) u.searchParams.set("embedded", "true");
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

const SEED_COURSES = [
  {
    id: uid(),
    title: "[Ejemplo] Cómo usar el Aula Virtual — tutorial completo",
    category: "generica",
    description:
      "Formación de bienvenida para quien nunca ha usado el Aula Virtual: cómo entrar, qué es cada pantalla, cómo hacer una formación de principio a fin, y cómo funcionan los puntos e insignias. Son 5 módulos que se van desbloqueando uno a uno — esta formación es, de hecho, un ejemplo en vivo de cómo funcionan las formaciones por módulos.",
    videoUrl: "",
    presentationUrl: "",
    deadline: "",
    testMode: "interno",
    passPct: 70,
    attachments: [],
    modules: [
      {
        id: "m1",
        title: "1. Bienvenida y cómo entrar",
        videoUrl: "",
        body:
          "El Aula Virtual es el sitio donde vas a encontrar toda tu formación: protocolos de trabajo, formación general, formación específica de tu equipo, y contenidos de IA y nuevas tecnologías. Cada formación tiene su vídeo o material, y un test final que confirma que la has entendido.\n\n" +
          "CÓMO ENTRAR\n" +
          "En la pantalla de acceso escribes tu nombre y apellido, tal como está registrado, y pulsas \"Continuar\".\n\n" +
          "LA PRIMERA VEZ es distinto a las siguientes: como todavía no tienes contraseña, la aplicación te pedirá tu email (el mismo que el administrador registró) para comprobar que eres tú, y a continuación podrás crear tu contraseña — mínimo 6 caracteres, elige una que no uses en otro sitio importante.\n\n" +
          "LAS SIGUIENTES VECES ya solo hace falta tu nombre y esa contraseña. Además, el propio navegador recuerda que has iniciado sesión, así que si cierras y vuelves a abrir la página no te la va a volver a pedir, hasta que pulses \"Cerrar sesión\" tú mismo.\n\n" +
          "SI TE BLOQUEAS: si no recuerdas tu contraseña, no hay forma de \"recuperarla\" — por seguridad, ni siquiera el administrador puede verla. Lo que sí puede hacer es restablecerla, y la próxima vez que entres, el sistema te pedirá crear una nueva, verificando tu email otra vez, igual que la primera vez.",
        quiz: [
          {
            question: "¿Qué necesitas la PRIMERA vez que entras, además de tu nombre?",
            options: ["Tu DNI", "Verificar tu email para poder crear tu contraseña", "El PIN que te dé un compañero", "Nada más, ya tienes contraseña desde el principio"],
            correct: 1,
          },
          {
            question: "¿Puede el administrador ver tu contraseña si la olvidas?",
            options: ["Sí, siempre puede verla", "No — solo puede restablecerla, y tú creas una nueva", "Solo si lleva más de un año en la empresa", "Solo los fines de semana"],
            correct: 1,
          },
          {
            question: "Si cierras el navegador y lo vuelves a abrir al día siguiente, ¿tienes que volver a escribir tu contraseña?",
            options: ["Sí, siempre, cada vez", "No, el navegador recuerda tu sesión hasta que cierres sesión tú mismo", "Solo si es lunes", "Solo si el administrador lo decide cada día"],
            correct: 1,
          },
        ],
        passPct: 70,
      },
      {
        id: "m2",
        title: "2. La pantalla de Inicio",
        videoUrl: "",
        body:
          "Al entrar, lo primero que ves es tu panel personal — pensado para responder de un vistazo a \"¿qué tengo que hacer?\".\n\n" +
          "EL SALUDO Y TU ESTADO: arriba del todo aparece tu nombre y una etiqueta de color que resume tu situación: verde si estás al día, ámbar si tienes formaciones pendientes, o rojo si alguna ha pasado de plazo.\n\n" +
          "CONTINUAR FORMACIÓN: justo debajo, si tienes algo pendiente, aparece una tarjeta con la formación más urgente y un botón \"Continuar\" — es la forma más rápida de retomar exactamente lo que te toca hacer, sin tener que buscarlo.\n\n" +
          "LOS NÚMEROS: pendientes, completadas, y tu progreso en porcentaje — de un vistazo, sin tener que entrar a mirar formación por formación.\n\n" +
          "PUNTOS, NIVEL E INSIGNIAS: cada formación completada suma 100 puntos. Acumulando puntos subes de nivel (Iniciando → En marcha → Consolidado → Experto). También se desbloquean insignias automáticamente: por tu primera formación, por llegar a 5 y a 10, por completar una categoría entera, y una especial por estar al día con todo. Es individual — nadie ve tus puntos ni tú los de los demás.\n\n" +
          "NOVEDADES: más abajo, avisos publicados por el administrador. Si una novedad menciona una formación o un campo en concreto, puedes pinchar en ella y te lleva directo ahí.",
        quiz: [
          {
            question: "¿Qué hace el botón \"Continuar\" de la tarjeta principal de Inicio?",
            options: ["Cierra tu sesión", "Te lleva directo a la formación más urgente que tienes pendiente", "Te lleva al panel de administración", "Descarga un PDF"],
            correct: 1,
          },
          {
            question: "¿Cuántos puntos suma completar una formación?",
            options: ["10", "50", "100", "Depende del número de preguntas del test"],
            correct: 2,
          },
          {
            question: "¿Pueden tus compañeros ver cuántos puntos tienes tú?",
            options: ["Sí, hay una clasificación pública", "No, los puntos y el nivel son individuales, solo los ves tú", "Solo el administrador puede verlo, y lo comparte con todos", "Solo si tú lo compartes en las Novedades"],
            correct: 1,
          },
          {
            question: "Si una novedad menciona una formación concreta, ¿qué puedes hacer?",
            options: ["Nada, las novedades son solo texto", "Pinchar en ella para ir directo a esa formación", "Hay que buscarla a mano en el catálogo, la novedad no enlaza a nada", "Solo el administrador puede abrirla"],
            correct: 1,
          },
        ],
        passPct: 70,
      },
      {
        id: "m3",
        title: "3. Catálogo y Alertas",
        videoUrl: "",
        body:
          "CATÁLOGO: al entrar, en vez de una lista larga con todo mezclado, ves 4 burbujas grandes de color — una por cada campo: Protocolos, Formación genérica, Formación específica por equipo, e IA y nuevas tecnologías. Pinchando en una entras a ver solo las formaciones de ese campo.\n\n" +
          "DENTRO DE UN CAMPO: las formaciones pendientes se ordenan solas por urgencia — primero las que ya han vencido, luego las que tienen el plazo más próximo, y al final las que no tienen fecha límite. Las que ya completaste se guardan aparte, en un apartado plegado que no estorba, por si quieres repasarlas.\n\n" +
          "Para volver a las burbujas desde dentro de un campo, hay un botón \"Catálogo\" arriba a la izquierda.\n\n" +
          "ALERTAS: es una pestaña aparte, pensada solo para lo urgente. Ahí, y solo ahí, ves separado en dos bloques: lo que ya está VENCIDO, y lo que vence en 3 días o menos. Si tienes algo ahí, verás un número rojo pequeño junto a la palabra \"Alertas\" en el menú de arriba — así sabes que hay algo urgente sin tener que entrar a comprobarlo.\n\n" +
          "Si no tienes nada urgente, la pestaña de Alertas simplemente te lo dice con un mensaje tranquilo — no significa que esté rota, significa que vas bien.",
        quiz: [
          {
            question: "¿Qué ves nada más entrar en el Catálogo?",
            options: ["Una lista con todas las formaciones mezcladas", "4 burbujas de color, una por cada campo", "Un buscador vacío", "El panel de administración"],
            correct: 1,
          },
          {
            question: "Dentro de un campo, ¿en qué orden aparecen las formaciones pendientes?",
            options: ["Por orden alfabético", "Al azar", "Por urgencia: vencidas primero, luego las más próximas a vencer", "Por orden de creación, la más antigua primero"],
            correct: 2,
          },
          {
            question: "¿Qué diferencia hay entre \"Alertas\" y el Catálogo?",
            options: ["Ninguna, muestran lo mismo", "Alertas solo muestra lo vencido o a punto de vencer (3 días o menos); el Catálogo muestra todo", "Alertas es solo para el administrador", "Alertas muestra las formaciones ya completadas"],
            correct: 1,
          },
          {
            question: "Si la pestaña \"Alertas\" no tiene ningún número rojo al lado, ¿qué significa?",
            options: ["Que está rota", "Que no tienes nada urgente ahora mismo", "Que tienes que refrescar la página", "Que el administrador la ha desactivado"],
            correct: 1,
          },
        ],
        passPct: 70,
      },
      {
        id: "m4",
        title: "4. Hacer una formación de principio a fin",
        videoUrl: "",
        body:
          "Al abrir cualquier formación, vas a ver, en este orden: la descripción, el vídeo (si lo tiene), documentos adjuntos (si los hay), y el test final.\n\n" +
          "EL VÍDEO: se reproduce dentro de la propia página. Si por lo que sea no cargara bien, debajo siempre hay un enlace para verlo directamente en su web de origen (YouTube, Vimeo...), en una pestaña aparte.\n\n" +
          "LOS DOCUMENTOS: cada uno tiene dos botones — \"Abrir en pestaña nueva\" y \"Descargar\". Usa el que mejor te funcione.\n\n" +
          "EL TEST — dos formas distintas según la formación:\n" +
          "· Interno (el más habitual): preguntas de opción múltiple, como las que estás respondiendo ahora mismo. Hace falta un porcentaje mínimo de aciertos para aprobar (normalmente 70%).\n" +
          "· Google Form: se abre un formulario externo. Como la aplicación no puede leer las respuestas de un Google Form, tú mismo marcas \"Ya he completado el formulario\" cuando termines.\n\n" +
          "SI NO APRUEBAS un test interno: no pasa nada, puedes reintentarlo las veces que haga falta, sin ningún tipo de penalización. Simplemente pulsa \"Reintentar\" y vuelve a marcar tus respuestas.\n\n" +
          "Esta misma formación que estás haciendo ahora es un ejemplo de formación \"por módulos\" — un tipo especial donde hay que ir aprobando cada parte para desbloquear la siguiente, con una barra de progreso propia. Es menos habitual que el formato normal (un único test al final), pero funciona igual en lo esencial: contenido, luego preguntas, luego siguiente paso.",
        quiz: [
          {
            question: "Si el vídeo incrustado no carga bien, ¿qué puedes hacer?",
            options: ["Nada, hay que esperar a que el administrador lo arregle", "Usar el enlace de debajo para verlo en su web de origen", "La formación queda inaccesible", "Llamar a soporte técnico de Google"],
            correct: 1,
          },
          {
            question: "En un test interno, si no apruebas, ¿qué pasa?",
            options: ["Ya no puedes volver a intentarlo nunca", "Puedes reintentarlo las veces que haga falta, sin penalización", "Tienes que esperar una semana para reintentarlo", "Se avisa automáticamente a tu responsable"],
            correct: 1,
          },
          {
            question: "En una formación con test por Google Form, ¿quién corrige tus respuestas?",
            options: ["La aplicación las corrige sola, automáticamente", "Nadie las corrige — tú marcas \"completado\" cuando terminas, y un administrador puede revisarlas si hace falta", "Se corrigen por videollamada", "No se puede hacer ese tipo de test todavía"],
            correct: 1,
          },
          {
            question: "¿Qué tiene de especial la formación que estás haciendo ahora mismo?",
            options: ["Nada, es una formación normal", "Es un ejemplo de formación \"por módulos\", con partes que se desbloquean una a una", "Es la única formación obligatoria de la empresa", "No tiene ningún test"],
            correct: 1,
          },
        ],
        passPct: 70,
      },
      {
        id: "m5",
        title: "5. Resumen y para terminar",
        videoUrl: "",
        body:
          "Repaso rápido de lo más importante:\n\n" +
          "· Entras con tu nombre y tu contraseña — la primera vez, verificando tu email.\n" +
          "· En Inicio ves de un vistazo qué tienes pendiente y cuál es tu siguiente paso.\n" +
          "· El Catálogo se organiza por campos (burbujas); dentro, lo más urgente sale primero.\n" +
          "· Alertas es solo para lo vencido o a punto de vencer — un número rojo te avisa si hay algo.\n" +
          "· Cada formación tiene su contenido y su test; si no apruebas, puedes reintentar sin problema.\n" +
          "· Vas ganando puntos, subiendo de nivel y desbloqueando insignias según completas formaciones — es solo tuyo, nadie más lo ve.\n\n" +
          "SI TIENES DUDAS que esta formación no haya resuelto, consulta con tu responsable o con la persona indicada en cada formación concreta — este espacio está para ayudarte a hacer mejor tu trabajo, no para complicarlo.\n\n" +
          "¡Eso es todo! Al aprobar este último test, la formación completa quedará marcada como superada, y sumará sus puntos correspondientes a tu perfil.",
        quiz: [
          {
            question: "¿Qué pestaña deberías mirar si quieres ver solo lo urgente (vencido o a 3 días o menos)?",
            options: ["Inicio", "Catálogo", "Alertas", "Administración"],
            correct: 2,
          },
          {
            question: "Si no apruebas un test interno a la primera, ¿debes preocuparte?",
            options: ["Sí, cuenta como una falta grave", "No, puedes reintentarlo sin ningún problema", "Solo si lo cuentas en las Novedades", "Sí, pierdes puntos por cada intento fallido"],
            correct: 1,
          },
          {
            question: "¿A quién deberías consultar si tienes una duda que esta formación no ha resuelto?",
            options: ["A nadie, hay que resolverlo solo", "A tu responsable o a la persona indicada en cada formación", "Solo por escrito en las Novedades", "No hay forma de resolver dudas en esta empresa"],
            correct: 1,
          },
        ],
        passPct: 70,
      },
    ],
  },
  {
    id: uid(),
    title: "[Ejemplo] Seguridad básica en el almacén",
    category: "protocolos",
    description:
      "Formación de ejemplo sobre hábitos básicos de seguridad en el almacén: manipulación de cargas, orden y limpieza, EPIs y qué hacer ante un incidente. Sustituye el vídeo por el vuestro real cuando queráis, o dejad este como referencia de formato.",
    videoUrl: "https://www.youtube.com/watch?v=ySXc8tbw8VA",
    presentationUrl: "",
    deadline: daysFromNow(3),
    testMode: "interno",
    passPct: 70,
    attachments: [{ name: "Seguridad básica en el almacén.pdf", mimeType: "application/pdf", sizeKB: 5.4, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgMTAgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRXh0R1N0YXRlIDw8Ci9nUkxzMCA8PAovY2EgLjEyCj4+IC9nUkxzMSA8PAovY2EgMQo+Pgo+PiAvRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNiAwIG9iago8PAovQ29udGVudHMgMTEgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRXh0R1N0YXRlIDw8Ci9nUkxzMCA8PAovY2EgLjEyCj4+IC9nUkxzMSA8PAovY2EgMQo+Pgo+PiAvRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNyAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDkgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9BdXRob3IgKFwoYW5vbnltb3VzXCkpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAoXCh1bnNwZWNpZmllZFwpKSAvVGl0bGUgKFNlZ3VyaWRhZCBiXDM0MXNpY2EgZW4gZWwgYWxtYWNcMzUxbikgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago5IDAgb2JqCjw8Ci9Db3VudCAyIC9LaWRzIFsgNSAwIFIgNiAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjEwIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDI1NzEKPj4Kc3RyZWFtCkdiISNdOWxvJ3QoPlxqaEAmXDVeUUpcRkJDSyV1Q2heIVZmaW4nR1MmLiRKS09HIVtzQz8vYVpFcmYxNSt1czNRL05mVW0oNVwqMUs2LEAlSjBQaWgtWl02RlJeJksnZm9RL2k9OzgqckhQV0dEYiY2K0FsZUFJOT0kYC1haU5jaVcnSjhsdFoyWlpIV3M1LFEsUl1KMm4kP1JAYC8/MFozQVppU3MpOF5LZDR1NlswdTpuXjUxKHQrV0ZKMEksMDRIL0FOcSEmN1hcQkEqb3RMaCk2cFtXT3Usc1VHJEQ8K3FzSClZLFE1UTBlbEZvO10vWDAlVD1Ub2Q1RiNxRT9HMGdXTzZsUnEwPzRFWD9zLzBRblE3X284SyteMl9jXGhdcCcyP3FvWlE4WUw7Yj5IWjZXJ0QnXUJZJThYJzQxWylmTFkoMV1pRy1lWCM/PDNTPWlaNyUxSHApNzojKC1pWCJfb2NJaTMxL2FUS2VKJCU6UjQ3W2lNLkB0cFFfLyVANkw6SCMjOm1WVzE7U2djcGtLSmtYc1VXJ1ZCb2srNCRVQSsmRnJTKz1ZO2E3NipkQ1x0aF8ySSldPSNsc2wlS2xxOGNDJDlca0pvJTxKTXAvLnRTVUluanUnbEIuN0podSg2PVlYNzU+aGdXLmUvW2wwcTEuSUQqNy5kT0dfZGQ8cHBiLEdIVFpeVW1zLUZDaVk8c2lpdT5cXD9tJktQOylrbDBOJlJsR29eW1BAQmRkLzREcVI5RTxYJkxDRFNBND9wXEQwWCVYLm4sOG1KPSokaFp0LnA4T2gmUiZXKyFbIV1hZ2FuIjNcMCxdPyZrME1pXG1sN0JEOiljVF9FSW48TUBwQjo+OGQ+dGVaWU4lImFWckYya2AhPWNLTStUTVxRLSgsMnUxIUFnYTBcKjFUU2xjPiEqP048aVM9MEdJRVgrM3BAU21uV0klM20rXEhTQGdaTmQkbEAvLWJmb1VtWD07L0g8SD0iV190dUhKWyxHJWNmTHFvREtSLjM2UlJoT2NUIkMiJVVGYE5cNU8yVVxMb1hTLFMzOlEnIipTTmNjSVNPbjNUZkw8TldCQS9DRFdHJUFMQWEjYCRmP08pQHEnTS1QVTZTOSRuSkBYak8kLiEiTWpDL208LmpjbVcuKk4oMzhdVUdgWmNUYEFsViEzYDlrci0ucWhJdVlqWyxpOz9IZFhxKGRQJzRhRFAhMGFvSiY9dTImUF41NC1kQlh1PjxBTEdtSHUuMklOLio0VVVkZ01CL2h0aFxtWk9sRmhmXE85MDxtdFBcLlw6NkEoPWFTUyMzIyZnXzhDPjFvQFpSQlo9Ij5XLlRYa2BXcmhiJGpePXEoK0xBKEFXQUMrPlJGa1xccDMoUmAmQjhDPnAnR1cpYVlPTThKbG5oZVVaRWllZ09pOm1Sb0QkOV5RXnI+My9JLXEpNzsvczEjKzNwJ00hbUllJzVmZmNlOmFmVTpDWztnVVE4dCc/aS09ZnUmV0R0NEFYJENSMD9GcltYSGJTaFZwaSM1XlVrXUhwU0lmdFUvMXFaXEg1Y01NPGZvUXBfZ1I0b1xxKTNZJEcoJihER0xyQ0w9TWpNSEpKZWJRPycrcjJKITFgR2M8ISJWYj9mYC4hIUk4VldrUmxZLj5QPFlYaXM1PVwsVSU8JTllYGxMXzRdci9hcFcwXz8+IjY5dXU2LjdiYSdQJTJOaWQjWVxrXi9KJyY/TCIxdCRoKHJhNE5aU29NVi4xMlJDc11vKzVZXDRYZlpaITBWMyFtb09kb0EzazQ3dE5CVDFaVzpBZmJfXXBnWSNRdWY8MVdYbW1yISRoYW8/ST1DRUpqO1RXYGJPKTY4PjhMNWRZJGw9XT4tTlduLGw7aWojaGxccWFyOz9hdFgiWTd1TiRjXFsyLmFBU0ZULVE5W2I9IU9dZUQ0Z3AjQltyRjhoVj4oa04yXidHTVVncEhNKDhMSDJLL1NRSXVocThzNUAlbGIxTCYncEBTSDdJJmttaXBFQ1NBJiElY2VMTl1GLlZvKFhfUishYiM9PSpzPUpURSNESk1VM3BCbkRtS1pMRD1IbWYsZGA5aUVTXyxtUlFUQWlNbSZANUllX1FlKEQxJFdhblgkRk5hPTFrJWVia0E5TUNuM0lTJ1xeNDBUXmtxbGtbK0FedC0jbTY2IVdIUTdcaThPJzRQR2c8Lm5oVzZQOSQ1YzU2Z1ZuVmAuXmdyNWFcWjwrPUZpSm5DWmk5PTo6MzljQVw7P1dOXjRdWVQyRVs8PG0rI1UrOmdRWj1DIS1WS1tdWE9Lczk8RURrblYrSCgoQHNxdFAiUlJCTTE0KEssUUA8YjhVXS5UM1Q9YS4oVm9SSVpJTzpgMGAmUSkkP2ZXSSstIj5Mb0NdcHJHWUtoMltDY1c3dC4pLEZPLHVhbzlKR0t1RFU/STpzKElhW0JtWGwybCwsXlAwRkNZRGM6UiI+XTZBPDs4Wic8OHQ9cyFTXD1eMDVkMDYnUElWIjVMSiJePSdiKmxsSWJBSD1lJGtkcmpiN0klZGo0PzFGJ2FEZy50ODIqJGZLaVA3TCUqLCdzZTJXVTEmZ2ddOlY/Ii1JPzVTM2ZKQSlbXmZWdSE6RUZQLl40Nk5WWVU9USldWkorVUNvIzU+MCo2aCU0MVcvSiZVTUdbUiVJazlTRy5UMTUyYnBdOyd1ayVQa1pqISlpdWopPlRVTSQ7ImVBYGBCJUp1Vmg3XTZnPVNPUEZuWDdra0ZpMGUtJVAkbFQuWzFPP0Ywbi5zIiVSUzMhVCpKYyNBbDtKRytwQWs9Kk5lW15AU00haTBtRU89azUicllRcW0/ajMsYzpDLi1WPmpGZTFdPCJxIURlYDIxb29BJmkkPSY3bVNgYTddRGpqTV5yM182PXEzUEYkKENtSiNcK0JqRk8lKE85cSVVPG9vVFVFWHRhIiYjIVhnMl08V2pES0JKYEM5ck4mc3AnQW1PO3JIbSI8cGBTJEpSKyxxbUc/M1stal09biRKRiZpLEA0XkxfcEhucUBCP10xUlc/WUk3cS8yY1dUOCleSVY9WlA7SGg3XTgvbDAmb0dBUktocENTZExGWGxpdUhsRnVAZS0pZyc5cCokNVAkZEBlcFtASD9mNnJVWklWTGpBJjI/aF9lXWliNVpIWCVHWTxfWVIwQV9vV3QoVi1VUCIsNFIyTTJrVWc5S0g5ZipHVzNdMTFmOVFXWko+NzhOOy5XRl1cUD85bTQ8OU9NdS82a2ZTIVNSUlVWLTw5XF41K185aFRgLFYqaTRzT2cmT3BAbl5nZz5QR11pQkxSZ0cucnFZbHNlck5yQzBacE5ea3E1X1pJQEZMMGxePz5VcytGW01TSF0sIU1vOlZwQkduV2xFKWlVMydHbV9tL01YMW5cLjc6S1J+PmVuZHN0cmVhbQplbmRvYmoKMTEgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggOTUyCj4+CnN0cmVhbQpHYiEjWT51MDMvJ1JmR1JcRGpKVD8mNF1zOGJOPyU5TUEsMD8rNmBHUispaEZgIiR0LTJMYlYtbz9qRjNbUmUnKFdqUVU9cUhUWTZtUFAiZTVHXCwiJEBvSC9TNlFVSiFBJi8/NnNeIz4ubF5tMipbVnFmVzFQRXAmSkREdWhNdTIoOyZHZ1ZlNFVFWlZeXzpqUW5pJlciUGIlb11TTkItYTFyN0FmU3BhMTFEZV07YD8nL0BCbnFES1VlP1YkTy81LTcrQHMuIUBNKzYoIVJrdVsuVihxM18zcWFiKk5UO1hfZUdaX3BhSnA7b0RBXEFtcFVNPnIlKCkmZF9sW2ljXk0mU0xocm1IJi5IRlluXFRcbyRiQD47MzpeYFIsOilSM0hqaThnI1RfLjI3MCJUTDMrX05EZG8wNlFXImhqZ2FnSm9LSGYwXDxfZGokSz1NYitFKWBfOkchdWUhaGNpXyU6N25OWGBTaTYpMU9lbWg6JDNORVYmc3R0YSVIUU1HXmRCXUhqQDI3Q0hqNEErLDlZSChYXm9HMid1Nk5DOy1JMT1BYmYlUTVVWzEoJ1k7KGlaai9mMENpaiEkRGAiajdtb2VUNSghIydMXEM1ciNYTW5AbmA8PCFKZVlfOG02cXAjUD1qQSouRjpSOy08bm9bI1tSbiU5V00vN3EhKmpPNHMwTnFEaiZBK24vP1omYilyKC0qbTFIVjFbSWhNPHBUaVxIaEpYYFlGJ2dYUl10cS1gcUYjOUdCc0EwU2UmcChKVVBYSiM8TEAqOSRzJys5b0Y+c00kZGwmRDRcKChPKz1uTWdlLyFhalhOakhkUVRiMytWUWo8KkAycTcoVGIuOVk3W101Silla2g2N0xIY1Q+N2htW0ZhS1c9RWkyYEQiXlJmdVYoYnBsKD82b29tcEJYU25SXl8hJ1JvXzYoSF1xND9Pa3RfImIvTiNtbk5ca0k9aU9uTzFCX2kqSFwpPTdiJSZzZkdcTipOLCdsPT5qRSFhYDMuZTJHPUgnMGA3WEM4MWNEMjs5ZSJrVVQ7byJuTD03ZiY+ZypbJzFxTGZVSzA8aCxtNnUkTGVoWnE2RjpeQztlcy5RLWY7IjRpYDomWVc1c2ZNT0xLZzIwZyhmbClgQkBSRDNzLiElOyZWMEApT2RQbE1qZSdARGt1TkNJZCgvRT5BOytgNHRqWiw7LmBdVkBFMSdjT0VcXmcrSkNfTFpbOTMrSUdYREtrRGgxZVBNdFhhPEE9NFZbZG1eUH4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTIKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMTIgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzMxIDAwMDAwIG4gCjAwMDAwMDA0MTQgMDAwMDAgbiAKMDAwMDAwMDY3NSAwMDAwMCBuIAowMDAwMDAwOTM2IDAwMDAwIG4gCjAwMDAwMDEwMDQgMDAwMDAgbiAKMDAwMDAwMTMwNyAwMDAwMCBuIAowMDAwMDAxMzcyIDAwMDAwIG4gCjAwMDAwMDQwMzUgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8OTYwNmFhMDc2ZmY2OGZjMDcxOGRiYWQzYzBiNTgyYTE+PDk2MDZhYTA3NmZmNjhmYzA3MThkYmFkM2MwYjU4MmExPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA4IDAgUgovUm9vdCA3IDAgUgovU2l6ZSAxMgo+PgpzdGFydHhyZWYKNTA3OAolJUVPRgo=" }],
    quiz: [
      {
        question: "¿Cuál es la forma correcta de levantar una caja pesada del suelo?",
        options: ["Doblando solo la espalda", "Doblando las rodillas y manteniendo la espalda recta", "Girando el tronco mientras la levantas", "De un tirón rápido, cuanto antes mejor"],
        correct: 1,
      },
      {
        question: "Si detectas un derrame o un obstáculo en un pasillo, ¿qué debes hacer primero?",
        options: ["Pasar con cuidado y seguir tu tarea", "Esperar a que otra persona lo vea", "Señalizarlo y avisar para que se retire antes de que alguien tropiece", "Ignorarlo si no es tu zona"],
        correct: 2,
      },
      {
        question: "¿Por qué es importante mantener el orden y la limpieza en el almacén?",
        options: ["Solo por estética", "Porque reduce accidentes y mejora la eficiencia del trabajo", "No tiene relación con la seguridad", "Solo importa el día de una auditoría"],
        correct: 1,
      },
      {
        question: "¿Qué debes hacer si sufres o presencias un accidente laboral, por pequeño que sea?",
        options: ["Solo avisar si hay sangre visible", "Esperar a ver si empeora antes de avisar", "No decir nada si no duele mucho", "Comunicarlo siempre a tu responsable, aunque parezca leve"],
        correct: 3,
      },
      {
        question: "¿Qué equipo de protección individual (EPI) es habitual en zonas con circulación de carretillas?",
        options: ["Calzado de seguridad y chaleco de alta visibilidad", "Ninguno si conoces bien el almacén", "Solo guantes, el resto es opcional", "Gafas de sol"],
        correct: 0,
      },
      {
        question: "Antes de mover una carga pesada, ¿qué deberías evaluar?",
        options: ["Nada, cuanto antes se mueva mejor", "El peso y si necesitas ayuda o un equipo mecánico", "Solo el color de la etiqueta", "Si hay alguien mirando"],
        correct: 1,
      },
    ],
  },
  {
    id: uid(),
    title: "[Ejemplo] Bienvenida y funcionamiento del Aula Virtual",
    category: "generica",
    description:
      "Formación de ejemplo pensada para la incorporación de cualquier persona nueva al equipo: qué es el Aula Virtual, cómo se usa, y qué se espera de cada formación. Plantilla lista para adaptar con vuestro contenido real de bienvenida.",
    videoUrl: "",
    presentationUrl: "",
    deadline: "",
    testMode: "interno",
    passPct: 70,
    attachments: [{ name: "Bienvenida al Aula Virtual.pdf", mimeType: "application/pdf", sizeKB: 3.6, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgOSAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCA4IDAgUiAvUmVzb3VyY2VzIDw8Ci9FeHRHU3RhdGUgPDwKL2dSTHMwIDw8Ci9jYSAuMTIKPj4gL2dSTHMxIDw8Ci9jYSAxCj4+Cj4+IC9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgOCAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0F1dGhvciAoXChhbm9ueW1vdXNcKSkgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MDgyNDEyMTgzMiswMCcwMCcpIC9DcmVhdG9yIChcKHVuc3BlY2lmaWVkXCkpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MDgyNDEyMTgzMiswMCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0IChcKHVuc3BlY2lmaWVkXCkpIC9UaXRsZSAoQmllbnZlbmlkYSBhbCBBdWxhIFZpcnR1YWwpIC9UcmFwcGVkIC9GYWxzZQo+PgplbmRvYmoKOCAwIG9iago8PAovQ291bnQgMSAvS2lkcyBbIDUgMCBSIF0gL1R5cGUgL1BhZ2VzCj4+CmVuZG9iago5IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDIwODYKPj4Kc3RyZWFtCkdiISNcPyQiSVMnUmZHUlw7dT1tYHEkVGEhdTtfc2ZVMmRdVCg4VTpDOSE6R1xbKCVebyc/JFQzRCNEXVRrO0Q2TEN1UFI1KiFvTzNxbDZ1Nk1xTXJaWUc8UT8tcW51SmpgIUM9IVdxT1RvMVNyaVNycWwsWTQrVS8uMmY8YUttLiE1TWI+O1RROl5DNXVIUWc+LEZUTVZccygsJ09BQzcjbmcqSStaZFZmalNWRVQwXVMyOmclJDlJbCxyKm1wb0BONjkhXVdqVUphb2YiRUJTTiktbyhAcVRnalIxTFlkXTQ1M2NlMWxKWjBoQD9yaCs1NkM/WEMnPm4lOi1WbzRCPlBlQUolRGRBIkNzKjZuR14tLFc8NV5gSV8xaVo9byg8Y19EVkJkZmAmbisqZ15PRUNyTTRWYnJrNCV0OTxMKy81RFYlOG4+VjYqS2NoajkhUGc9S2FpXV9VQkxsL2onWiUvMiJiOjUsKnVvXyM3YSllWl45bHFaYCkiJmxja2YwX0BtJClIZ2MuKUIyai4xUSwyakY8cmptXUVLQmElcmRbcEUzZDVFPlxvUU1aNkczLzQ6MDE5Y1I7TjEtJCQ5QUBgJDMyK102PkhMcUYnamhlP1ppUGdPUERaOUF1bDZUQ2lbJz8yW09xMSdcMjNWIzZVPl1NbDdxI2gjJFc/Zk9UQmM1Pyg7OGplPVFFQ0VqQmFbTTNZI2tDM182O3IpPHVZQkw6UDZzOC9eVDgzaSY5ZDZHcDtzNDFDczcyIXU6bVNUXjc/Qmo3O3MpKDJxUl1rPikhMisxQHF1XWVHQjlhRkcwckstQzdgPS1ibydLO1tGSGUybEA9YjJWIy82SD8scylIQDlCZ2YldS9XUzlfSnAnZmhuZm9gT2BDK2VcTD46bz1ZWENEN1xacWJhIVRKKUsjPl1GO1E7aSI9V2I7WE4pK0VkYT5UcDQ8J04qZEgmLjZuaU9vLjUoPSVuTyJjMmpecDVVV09NP0xAcW90LzxAPUNZXHArJ3A8JShbKTlddWFyQV5XMjx1US9VMCokOVciWHFoTTFZNlwwNzM1bF8xak9KYmduOjxhUTdBUDU9UWZBNTRjTFg7Kl1FZkFjU0hWJSVwJipTJ2ozT0BNbXJQVClAdGZzWWUpZmFCNnNYN0RVNzgmM0p1NkBpJ2hyZ2dUWHM8LUM9PjMqN25UPF44SDQ6WSltRnFrLjYrMG9oWzp1Zi9uNyxEbGFLOltDbDdbOitaXDtXLnRwZEQ1M080QEYyYGhTNDpnMjV1NytBUkYuUlw4IyYtYWwyRzZkZyolUW1XOTo2aVdLZzRWRHQwPHNmPmFLLj5kXzVCR1xdMjchUFc+YSNQUHRfS1chM1IsPFVzRzdYMlMkRTkmTkxuYT0tbmpWbzk8LGw+bHFBIiI/PWRLaTtxUjtZYUFOJlY8LiVbQnUrUzNoWG80Plo3XSE8IkE+YVtsQm5cJlxuZzpqNFZPPzwlMVZaZTJNPSpQU19CRjQpITozbyMnPzxRaDhXQSlPVWMvOWJkZEl0OT5iLjkpKUVkO21BK2EoPFYqW1N1dE1FMDtELyg9PT5ZK25DODo0YGRkXldAZFEmTm1pQU1YOEddZFlKJEYsO24vQFQlJzheSGwxblsuY1xUYU9ObEEjcyRcSSZpJCQ3T3RIRT9kLl1CYWYuODpxP1hWc0JYOCFER0RsM1cvQU08b1hnQCpISGp0OkhcbCNPcmsnTl1GNE1IN1tfYVUlTE9DaENiTWRIISNYUDVoI1wtIzglbV9MPSVQTSkkYFcqW1heTl5OLkNQQy1qZyFDImxzNU9TTi1WdC4xSlRnS24+TFk7ZUtiKnRXOyMkYTl0PEFPSnMqUEBcUiRKbFkjQ2RrWz9uJWZQLEk9MUdoKF90L1VwczQoTztvPzQudXE9b0RgZ1FnT0U9TT47K25OaCglTDpKQF8/LmJgImBbV2JZMGBYLnFzVCptYkdaY1g3YysqPXBib2AqZkAjYGdtSG5ZWU5SQGMlTGVIcT1AMz1SdDFLN1hJbCJIT0FuN01hYDVQQCo/OE1BbktabU0rWy1GOmloUG8sPVdFPV07UylnS0dtISYjPiZnZjNCJ1plSlg/Mmw1SyplMiExNl1sKTMialByYm1jcGZhUT5GLkYuZGo/NkpVbnBTcl5XN2kmYHFqSGRWT2U+YTMvTmBtYjs+ODFAKk0kU2pGLUhMXkFxKFhmJkxRWj5aUFQ1cVRCSSRMY2MtcHA1cVdqMUwlWCkkKCRsUGYtayNbUzNsTHVJWyJoZFlfaCIva1Q2SSIia1ZkVyZESzNcWVwxMWBSVzhTZXNYUkVkRig9VycqLGZhTDVBJVBJYWQmM1ReayY4NnFHPEZPWSovaldASzBWZk0hPF9xcyksalZjMSNRK1VCZi5eIyMrXllHY3AhYERrJyhpJj0tPmdFKV9sIzZMNzM+ZGlyVDIjSDhySEIhOGpya2A+PG11OW0sMkUqQ1xGbyVTVSJyMXJoLWdmTT0lNWMnWm4uJi1taDY/c0AkamEjLk04TDpnNz9yRUNWJDMvNVpXKSsqMkBzSkkoQylzakNPPGxZJy1pOWs6XzsrRFBVT1giWmFsSGcqXTxpJzBpclktPFlXW0NXaitoUUZAVWgrXjxmNWA9QiNHWTl0PkpsMzxFaHI2KCJaMURaYShsSjMjWFRvKXUhKWo5bTJFZUNXW1guVWheITA+ayM0IXBLZyJecW9ucXNqU1hkWypoc1pmYmdFZGBJIS5lMF46fj5lbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCAxMAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjE5IDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMDQxNCAwMDAwMCBuIAowMDAwMDAwNjc0IDAwMDAwIG4gCjAwMDAwMDA3NDIgMDAwMDAgbiAKMDAwMDAwMTAzNSAwMDAwMCBuIAowMDAwMDAxMDk0IDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPGU4N2NkMjI1Y2ZmYjcwNzBjYmU3NmZkMjg4NDgzYTMyPjxlODdjZDIyNWNmZmI3MDcwY2JlNzZmZDI4ODQ4M2EzMj5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gNyAwIFIKL1Jvb3QgNiAwIFIKL1NpemUgMTAKPj4Kc3RhcnR4cmVmCjMyNzEKJSVFT0YK" }],
    quiz: [
      {
        question: "¿Para qué sirve principalmente el Aula Virtual?",
        options: ["Solo para ver vídeos de ocio", "Centralizar protocolos, formación y novedades del equipo", "Únicamente para el departamento comercial", "No tiene ningún uso práctico"],
        correct: 1,
      },
      {
        question: "Si tienes dudas sobre una formación, ¿qué deberías hacer?",
        options: ["No preguntar nunca", "Adivinar la respuesta", "Consultarlo con tu responsable o la persona indicada", "Esperar a que se te olvide"],
        correct: 2,
      },
      {
        question: "¿Con qué frecuencia conviene revisar la sección de Novedades?",
        options: ["Una vez al año", "Nunca", "Solo el primer día de trabajo", "De forma periódica, para estar al día de cambios y avisos"],
        correct: 3,
      },
      {
        question: "¿Qué se espera de ti al completar una formación con test?",
        options: ["Que respondas lo más rápido posible sin ver el contenido", "Que la veas con atención y respondas con honestidad", "Que la ignores si no te interesa", "Nada en particular"],
        correct: 1,
      },
      {
        question: "Si un plazo de formación está a punto de vencer, ¿qué deberías hacer?",
        options: ["Ignorarlo, no pasa nada", "Eliminar la formación", "Completarla cuanto antes o avisar si necesitas más tiempo", "Esperar a que alguien te lo recuerde en persona"],
        correct: 2,
      },
    ],
  },
  {
    id: uid(),
    title: "[Ejemplo] Sistema ABC de ubicaciones: fundamentos",
    category: "especifica",
    description:
      "Formación de ejemplo para equipos de almacén sobre qué es una clasificación ABC de ubicaciones y por qué importa respetarla. Contenido genérico de referencia — sustitúyelo por vuestro protocolo real cuando esté validado.",
    videoUrl: "",
    presentationUrl: "",
    deadline: daysFromNow(14),
    testMode: "interno",
    passPct: 70,
    attachments: [{ name: "Sistema ABC de ubicaciones.pdf", mimeType: "application/pdf", sizeKB: 3.9, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgOSAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCA4IDAgUiAvUmVzb3VyY2VzIDw8Ci9FeHRHU3RhdGUgPDwKL2dSTHMwIDw8Ci9jYSAuMTIKPj4gL2dSTHMxIDw8Ci9jYSAxCj4+Cj4+IC9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgOCAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0F1dGhvciAoXChhbm9ueW1vdXNcKSkgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MDgyNDEyMTgzMiswMCcwMCcpIC9DcmVhdG9yIChcKHVuc3BlY2lmaWVkXCkpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MDgyNDEyMTgzMiswMCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0IChcKHVuc3BlY2lmaWVkXCkpIC9UaXRsZSAoU2lzdGVtYSBBQkMgZGUgdWJpY2FjaW9uZXM6IGZ1bmRhbWVudG9zKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjggMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyA1IDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKOSAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAyMzg5Cj4+CnN0cmVhbQpHYiEjXDlsbyZJJkFAc0JtJWxMVWEnbmQ8MHQwLDo0Nys6THEvQ11PIlg1Ki0vZF1sSVdFL2lmSTEmcHNqaUZpbXB1KFxwWjpLP29oWDgrK01oJDNRIlJeMionNCJxbGNiQll1S1FPVnIrU0s5VUg6cjFaY0wvdWosWW44YjYhYis1QnE0UVRtSjlMZG5mZ109YDwsTGw0UnA5PjhMWXI5QyVdckMoQyw2TkBxKCtQTidCJkE6TzFzMD5OUjZFPnNAXDFWbm0lSVAnVWdgam9ML0QwOGU0PFY1cCcxaHQ+U3UpT1NpbUMiaFIkWS88KWs9KylDWTA0aGIlPCdTZ10vUkE8c0lrPzAvalU0Ojg+ak0/MidGL0VNIlUyNUgrKXAvb11KTFVGYUtqL2NVKktxPk81Z2cnLXFxOSEjU21IU15tPicwK0gpbEphWzk1a1IpOlFmU3A/NU5iKDNHSz07ZkFCcWsnRidiNzklRD47dXNaVUpgLmNWMTFBMig1MmdhT1hBYT5aRkdwWEE+S1chTk5qYnRISVxEOW1XU1pvX1pLbjgnMHNTQzcjTydXNitUVFNbUWltZmklbidkSG9zbSYmJ1VFY2pBVWFyKyJEQFVIMl5DQ1NaRSIuXHBSNUtVamBXJiRZP1xdP2RidCtWNVU2WTlSR15IaiMyVmpnbnQpXGYjYWsoNWdTUEw1R0M6WHAuZl9YLlQqSE5VK29sKXByIjxgVUM1YmosJElWa1hmLGNXNi8jL2lcIjJnXC9JIzsrPU9XXFQ8Ly1YVy5YOFgoKHVAalFuVDFNOklwLXE4U21yIkMmQGpUbW1MNCI7V0RYJ2VfVE0palM/Uj5XSiVdSi5KJjlTIlQiKlY2QklaRU5XJ0RnV3FQNDlPI1o2N2RUSio2NlduJ2NdYkAwWzBYQC8hPT4iTDVlVSUjZ0w+J0YkKiVGbm9MKnQlcF1aVmUsTmRHYEtCST4iLV5fQWQ0RDBibTtgbk9mWlRWMUUramVvJGAyN0dcRCY0N2EqQVtIOmdyTV1wWF9LLFBwMF9fSSg8P0sxNS1HV1haQSg7JyleTUdBImYuOCdUclc4X2BsZixqbWlXTFg0KFopKiw9WVxaWFo+Lk1BLVpCMThPP3JwNHEuTWo/ZjxXLSonWExJKCFRdW1UJFIxX3U7QDNpLWFYYiQ5U18zWDBQUDZLXXJUJE10L1ktaTtXO1pLW3AsYEZuJk89XSopMTAwVSdmP1YjTHBSUSYoNHI+KFZiV2pfKUtfcnJBPVg6PEZMZD83Wl9PWWxmQGJjT21AZkYyQ1UlO0BfXW5gPEUiLVw2W3AzXEhsOjNjRGg+WTkwKHFqLSVKQj9wOjZDK2FLWCwtNm0uPXV0WS8/a1wsLSprL0YvZWZyKzBuVHA/XDFVKEtySTQqWzZPK1VgXTs/Py9MQkAmXS5HMF4zU1o9YmhAWXEhL2dURjBnKDNQXU5HYkkqVjVTVXRwSTRZclVAIyg3bEVZOTFmMS47ZjFYSGZlIyE1OkFTSThlMTQ2N1ovXmMuc1dZNGEnLD09IUEuQDsxWkJLVUMpWUdNZkcnOkoiQTgyNU0jNWtobl8mOCJlX1MjVDI5PDFFb1pkWGJmOE51Q2MjdTlnO0BNc2llSjByNk5gRlJGNSMxI2AuQUdjQ0dfIyVkIy8ocUJsKUwkT04kRUtnIjNEaiY3KEVuNzdPdVQ3NyhDcjRQbWdWNVdyJmVwOXNtb1hOay0xajZnNUJEU15NXiQhc1w2aUxYSV1uL0ApV145TlpvbmotQ1lsWEdpNkk0ZFksJkAva2VbPzRJTT88UEstMmQpQWlQTEojPDdGZklwPkZlIitpMCFULUhRcyIuOjVZNztyQzwrYTNnWHVXSmFOQCEyNio3cWQ0RlJBO1tPNEk+bGxRUy1LY2ZEImpDQD9NakApWS1hJWxJMV1gLl03b2tFNm4yP0ApU1NFPDMlb0hOLyI5WU9fWjJgVGEzXT5pJlomR0Q7MkdkMDVrU3RaMUxxPiEqa1pDVFdgYz9aOjlQXCIyTWJBTSUwRjQsMj47WyRVMm1tUkteNENITmJsVWhxaTZgXF5iRUZWSkFuLDo3RDBNTWUrYG4+YFgzSVdEOlEuZERUalE8QnJyV0JwRSYsUDVFRGVFQ0JjcCdWaWxjQjgoPG1gO2hfT2onZSVqKFZzXENsWmtRWyxmMk1SJy1ZOlRvLD0pPlwpJCdYdTpGM3V1RCE8Iz9DUytPZUIrMyF1RlkrcnRjPVNAbC9raTJxUURgKGxVLGRCSShfaEQwNXROLSkkXSZxXE9YXlJgWzQzaTdjPixOKkgwYy5falMnVGc6XFs8VHQzVGdYJS1dR09UW2EzST8nQ3UsdUVOPjgqRWQ5MkZMOWwxXSlyaDhAcGc6SXBoJyIiU3RhT2AsXiQ7QHJhZ1FAdSRbNTVnamFHJUVxYTwzbClMPV8lKzZ0ZEcrYU9HMD0hbEFlT2JoT1hVaihgNyhPP2BZTmsiRDYlUG4zTDVFOTdIYCdeIWYsTCI5aSgxOUlnT1RrSTVoQlNWSWs2PGJKVS9rX2RpTCdcQi9EYmZYcU8lL2g1XipXbD1bOVFfNUYzbTNcJGdxUyYjcW5qQVJRXDZFSjhXa2RgOVBeayk4ZGE7cVc5JXQja09XKlQjbkhgciF0TyROQDtmcERXTiUtSTprKkQnJSIjQGwlMVtQNidcSyY4aXVGclNITj5iNHUzMjZEXC4wNiFJVmopQiJCVERxYmtXamA+anVCa0EsRHNeMEtIYVtdJ15cYEVlV3Q+Q1wiPyRfNz9xcyY7XjooZEFVdXJccj8vbkcpXCpDSyd1XSQhTWxfalkia25QJT8wMiMlK09aTywvcjxPOSpeP1xwJ21HbUg7KERAXm8iQyJePXNncUZCMC1tKW9TYCtmLzkzPj9KLkEjUC1bYzRKaCMyPVtkaz5tOVFjNjtUQmhoOktKJUFIQDo0IUxeNEwlYFVAbGZdYUhPRy9lInM8Zk1lLEVNVl9ZNmRScj5hWXRcVVJUaDQ8PGU7X3JWImlGUTZdbGpPXV1ANDgqLjlZYDJsVnNiOTIzMHJvWyIyXUVIU2Quc2RQWFBdbyF1aTFQZyZqKkhFUyg1YFpTJl4wPiJEKFs7JUdTInA8LF82Wm5DOkxiLCtxI0tUJyU8V34+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTAKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMTIgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzMxIDAwMDAwIG4gCjAwMDAwMDA0MTQgMDAwMDAgbiAKMDAwMDAwMDY3NCAwMDAwMCBuIAowMDAwMDAwNzQyIDAwMDAwIG4gCjAwMDAwMDEwNDggMDAwMDAgbiAKMDAwMDAwMTEwNyAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzxhYmY5NTVhNDgxM2MyZDFlNjhjMzhmNjA4MTlmYjNmOD48YWJmOTU1YTQ4MTNjMmQxZTY4YzM4ZjYwODE5ZmIzZjg+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDcgMCBSCi9Sb290IDYgMCBSCi9TaXplIDEwCj4+CnN0YXJ0eHJlZgozNTg3CiUlRU9GCg==" }],
    quiz: [
      {
        question: "En una clasificación ABC de ubicaciones, ¿qué suelen representar los artículos tipo A?",
        options: ["Los que nunca se mueven", "Los que tienen mayor rotación o importancia y deben estar más accesibles", "Los que ocupan más espacio físico", "Los que llegan más tarde al almacén"],
        correct: 1,
      },
      {
        question: "¿Cuál es uno de los objetivos principales de reorganizar ubicaciones según su rotación?",
        options: ["Aumentar la distancia que recorren los operarios", "Complicar la localización de productos", "Reducir los tiempos de picking y desplazamiento", "Ninguno, es solo un cambio estético"],
        correct: 2,
      },
      {
        question: "Si detectas una ubicación física que no coincide con lo que indica el sistema, ¿qué deberías hacer?",
        options: ["Cambiar el producto de sitio sin avisar a nadie", "Ignorarla", "Esperar a la próxima auditoría anual", "Reportar la discrepancia siguiendo el protocolo del equipo"],
        correct: 3,
      },
      {
        question: "¿Por qué es importante respetar la ubicación asignada a cada referencia?",
        options: ["No es importante", "Porque garantiza que el sistema y la realidad física coincidan, evitando errores", "Solo importa para el departamento de compras", "Porque así el almacén se ve más ordenado, sin más motivo"],
        correct: 1,
      },
      {
        question: "¿Qué papel tiene el picking en la productividad del almacén?",
        options: ["No influye en la productividad", "Solo importa en campañas puntuales", "Es una tarea secundaria sin relevancia", "Es una de las tareas que más tiempo consume, por lo que optimizarla tiene alto impacto"],
        correct: 3,
      },
      {
        question: "¿Quién debería poder modificar físicamente una ubicación sin pasar por el proceso establecido?",
        options: ["Cualquiera, en cualquier momento", "Nadie — los cambios deben seguir el protocolo y quedar registrados", "Solo los nuevos empleados", "Solo los clientes"],
        correct: 1,
      },
    ],
  },
  {
    id: uid(),
    title: "Inteligencia Artificial en el trabajo: guía general",
    category: "ia",
    description:
      "Formación completa e introductoria sobre qué es la Inteligencia Artificial, cómo se usa ya en el día a día laboral, qué asistentes existen (ChatGPT, Claude, Copilot...) y qué buenas prácticas de seguridad y sentido crítico hay que aplicar al usarla en el trabajo. Pensada para cualquier persona del equipo, sin conocimientos técnicos previos.",
    videoUrl: "https://www.youtube.com/watch?v=-Nfcj0F7b-Q",
    presentationUrl: "",
    deadline: daysFromNow(21),
    testMode: "interno",
    passPct: 75,
    attachments: [{ name: "Inteligencia Artificial en el trabajo - guía general.pdf", mimeType: "application/pdf", sizeKB: 6.1, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgMTAgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRXh0R1N0YXRlIDw8Ci9nUkxzMCA8PAovY2EgLjEyCj4+IC9nUkxzMSA8PAovY2EgMQo+Pgo+PiAvRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNiAwIG9iago8PAovQ29udGVudHMgMTEgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNyAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDkgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9BdXRob3IgKFwoYW5vbnltb3VzXCkpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAoXCh1bnNwZWNpZmllZFwpKSAvVGl0bGUgKEludGVsaWdlbmNpYSBBcnRpZmljaWFsIGVuIGVsIHRyYWJham8pIC9UcmFwcGVkIC9GYWxzZQo+PgplbmRvYmoKOSAwIG9iago8PAovQ291bnQgMiAvS2lkcyBbIDUgMCBSIDYgMCBSIF0gL1R5cGUgL1BhZ2VzCj4+CmVuZG9iagoxMCAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAyNjY1Cj4+CnN0cmVhbQpHYiEjXWJCRFcwJyZEayhxS1BIbGE9bk5OR1pNc0hkNCElbCs0NFc8OWFiZCJYVD9kRiIvJTVxclM2WkI1Wi9kUC5hYyxSWjpMV3FbcitAP1dsMTxkSikoI1UuYFFxT0E4Y3RaTiFKXz9SZG5JV2ZdPEEzYk42azVNJi9bZVQ0Y0MuNEFEUGxxRD9CWilOMXBVcDlHK2VFPzlIbSlDSShFN15EP1A6OnVER00zIT82NSNWNnExLV9JZF9lSChkZHJHMiYoPmVUXzxoK0QrKm9yZ3BSMjg9YVBkJj5nYyRvLUVARF9cXXA5U1hwJ3E1RyJiMEtpXVllUUZlSDtWQ2dRVCs6JVZ1KGk6Uj9xUThZZS9NYkdvNihKV1doRWViPEE7T0VFczFjKHQoODFpXDZCWCdfMCFxNUtqNGNQNlEja2oiaDI5TGxaclFOITZJJkYuUkNGInFRXyUwWyc1OkgsKTEuRjc8I3FlQj0iLyM+OyRgKS9YcU9qUSg7YjgqSVtINlUkI21CRl9KYjMrSTA2bWNAV1pYSFEpVDk+LWpORUBmaEcsQihFPms2JWUyKWNsWi4jZFlRKk90NnBcSG0xPGdIcy5DLUchOSY9NytiJXBeYURcVENQVDZTXHMmc29iLjpFJFNYRTVZLnNyazhYSTFWQkI+ZyhGZDV1KnVPIXNNLCZOc20kKWI/WUliZHJRbyZGPGVxcFFkSztAKyMmIzRGaHIuaEppanMvOUssRDstJjhUXmkublhUWlhdKUFbUSwjOzg9a1JmYTAiPzI6PG0jPj1YVTA9cXVXSDddciRHU3NDa0pHR0k6ZFkuSVNrNy5cYnRQWldjK1A9MXFfcDY8KHBCTT43O2g2Tj1IUURKSlshIzRTQT0rJU1IWjM6cUg1VF4ralYjMzVIR2xBVWA9Xk1pcTJnc0xyWWZwOyRHLVpeJlg4NiJoTUInPC4iXzxeO0I0TlMwcHQ+dXVpMSRIP2hoPkwwXnQ0bi5wMlpDODxiIUc/TEYhVCkwT2gsZENNKE0vPyZLJHNfZUgwYyciKjBZNDNNcG5aJzUrOmwtbUhtJHMnZjImIk8oPkMqWigwIWc9UE0pLW1APkFAIilFbj1oUyNAOztKbVlePl5JYm8uU01PcypnRDE7WTw0QmxXaHFJREtTTStgKFlxPkRUJiNRa0tjMlsqVFU+LSZGJllCWDZvXVBzMzNScjs9Tk1sK0xVOGA5UnVJWVZkXGdqSnJWVSZYMGs9VTo7I0clcSg5aW5HMjJccWc2VFBJO2QxRVJCUkshYk1dN1JLQGYlPnB0WjcvbkQuK0dtb20tYVdnJ0NzcUBbTlVqO0teIihsWnVSSSJHWXNEI3JvMmtuS1VeOiw0JmpfaF0pJjpmY1c3IVxZSDo0U0QnRjdCUGRMbDpQSkZEK3FSZCZgQ2ktPFZTVFZgRFdvZk1GK2JVRUo4NmtSLChCbFlsWjMtcC5DZTxiZVpzVyIqaydOPk46XHNZQT9hXVpPI2s/X3VuIiZeUnUuTEckOCQuLl9hJVVrKTwlbGJwY28/XHNQKzcxXTM1XztvSSxPJmJadDJuQVhiW0NtOlk3YDM+aWlLJFojOlE2aFJ0PEZNST9MVzxgZzBWdWtiNGU7a2ZnT25HYGgvOl04Q3U1ckw1Tz9YYyYmdCkvMz4uS2A5cC5XTEQlby1fPj4wQltnRUMuTCVqX1ZqYj9fIjsrKS1bbEdASCZSYEJ1JTIjK05NXjpEQCNPaCtgSlRlMEJYKzNqSjNzQ0RZbEdaLG03bjYnTCRQQC5zJlNrZnVDdSw1UWUqQTo4VlVKLEtNS0BHUEhHRCJJdSc4NmRDV2pvJycqaC5lKj1adTN0cCFFZWIscCghclpFMHM4Rl9aXS8vWmFzP1loNUs9KTw1WmtWOm44ZVMrS0krLEtXTFJwRk89MUAhdGYuaDtCTm1vcUA0SiZQZSR0LGhjNCosWDA5LF9fJHMkakw0RXBzZGA2LS5dQ1BAMF4rNlZqKylqKzZOYyYnK1dWNGMqJ0ciN2E7YFA3O1peW1JbajpyJCtjRiR1RW5qdU8uVU82cFFaUT44cmA4KVJJK0VbI19EXlZtUWxvNGpXWXI0U3MsJSZWLSI1KTVJZ1QtOz1kOjo7dFpwUW5XXTxEMThNLUVtZ0NrUUssMjFoYEchJFBjZCEpTVZUIWw8RmZUI0xkanBzb0c6Z10ual9gdWVgVypfJFBDUFBbJSwrJkQ9QnByTDZyOUhcN0csZVYidWZiaCRoIVhZPzBUOj1fbkA1PEJQIV9QZkJVdHVxY05Xa2s1VF0rMm09YCM+O2h0Q0w/UW1SLlsqTTlxMGMhN3QqXXJSN1dEJDluSy1TUyJiVG4pP0ExYVRfLUReUTZxPU5fcSxqY0YrPihpVD1qUGBDTkQ2Z2ZbK1QoOEptVyFfZWAnai41QWMvZ3RwK1tYaV42SCtOWld0ZjQlMmIrSkNxYGJwO15BaCpMSTVGU29nWmxsOkx1OEdaTjlRSjMpb25oOFheYygnKyhVYS5RUz9ETFFxQVVFSmZmb15EKlwsX10kJUBHZGdZPik2ZTRiOSUvS0wmRV0ySC1MODYqa18rPDhdb1ptVkNVTVw4Z2tTTEosK2xmZ0JQbCwtcyI+YSROS2t0Iio6RUQiKjxsP2ArT1ddVGhtJGRkV0RmJ1BDWHFdUiVDXEVdRWduIkUxOC1UYyQmZXVJUWstRFtlbWlJIyRaZ0cmMzpMRTFCbitmNmBxUztdRitPSyxTS0g9KHBZMT01Lz06XVZWMmVoJEtTJER1V1g5RG5XMzssIjE6cklaYWFMZkdZMDVLPXQ9dDsiVSg+YztINzVvP24odEIpT00sQGxXITcsPSEtdTJpNVBnXTUoWWFAJHJLUCdFZTxBcnJ0JFhxZDJqajUmcTc4NUpsZCpcdVxvVyoyPWYtPUNTLl5ZWzFEPXUsT1x1KGhFVlFrMHRmLz8mQ0h1cGA6SDZMSixDL2w9T0xRaUcoIlNpcF1HYFYnJWdEcFF1IjdDcnVwbmNjRlojLkQqXy5CMilUOS9Fa1o8MCtRW0haYmUjKD4kak5RbjsqUHRhQT9yPmckUlBVNCdaal1aVDFNLF8vYm9dMkg1X1IyMkQ7JypfO0lrZDc8W0pgb1A+QVphJ21FZSFBbEFuZUdbXGkxKldfRXFsJzppOzdmM2VZVV0tN1J1O1hjWSpEVUFpZGZYMiw3UCw8Om5IX0h1Uyd0P1EkY3E5ZGxkUGIja24hSV5CbF9UOyZuNEJyO0oyX2gzRDsuR0dXSStZZ3E7ayEwWlhySCNxdWY2cHFrTTwnQmApWWc8JTZTRFMwajtIWmdpNnNqcF9rMUExc1hCTWxNPzFkN3NYOydqcCM3WD5uN0xcJyQ3ImRsSzAyTHFOcyNZaGIwXyRlXEEyRkpwO01SSTk9WkcyN1UqayleW1huPXE8YT1tLjE1WjJTPi5XUHQtSkxcUmQ5MC0sdGJhT1hXQXFiYVknbnI8LCxRW0k4cFhWaFlZRVEmXFRxKjJlSyZFV34+ZW5kc3RyZWFtCmVuZG9iagoxMSAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxNjAwCj4+CnN0cmVhbQpHYiEjWzlvbiRlJkFAUDkpISdgXFkra0JHaEBkMV0kVCg8K1wzOVhTOT0xI244UTg2I1MpJUgvMmpFW11uWVU6PCsrYVlzTz1aOEZEci8tUE4kdVZPalQhZ1BkSF9PXEhrVD9rZHFWTlEpUGpiOk5JRzNpSSgwS2cxXmdASUpnYCw+Wm9EPThtXFwlYTE8Ry1SYDokaW8iYF1bZFBgcTY6STtvcHI7M2NvPVIsQ20zKCFGSWEoWEJXLTYscVlabzNRWVtjIWIxL09CNkU6Oy1YO3NSXHIwSjNhMDE9bFFoUGAsSkRbOl44NXRCKFxHa1hLKVNlX0ZKPTFZWCNqTHVxIyI/KSksdC9hVDc2K14zXz8qO2wzNS1zYlBqY0RxZlIwSGEmIUlhTzxuJDpUYCxta1VKNCpKR2FrJTxAWXRlWkMhS2o2aFRNSEdXWSNcJzpwJ1ZzQzFMWyVkSU8mcjMxYy1VOjYkUVVuaFE3ZEpzOWNcMjlzWTg0SE9COiJQIXMwLGFqX1NHPjQoUDgvZ1BhKGI4Mk4+QVpEdS5xIm4+LWMrYjEhbTdlZk4zbSc5W3JuYF41PiJUJmhzIyJpPlQ3Q2EtLyRiTDFlKVRiTVFsdWIoM29CJD0jQCJCLDJUXSwoKUBiUk4jOCwmPj4pOHJeIjtubSpVY0chVkhgUjU4QFZNOW9kQ19RbyZKKiJQOldjPlhRKEVfPGNZLyJkQjg3IWBGLz0tMWE4VS1uQWAuaCxcXyVoN1NWbS5eVHRla1VkajhDIWcmcXNdcCFVclJRbF4nKWdvPU9IJ01XbytnN0knIVI1Iz5UXzdNZzY0Jy5zTD5gNkVaREdzKU5PW0ZSNnJxNXJPZSQ9V0JlYmFkI048ZXA3OEQ1U1JYazAkVV1wXUI0QG8jZmQmVUFab1QpczVkR3FDaWtXb0E2YUk2UG9XWXRrMVkmYnVaWyxEcHVeXVFxVS9qVkhpWUVfVipUI1tKbz9AY29uSC5rIWdMczw9UGRuUChVSywuXkM8XEttLSlTYmtOX2w5PW5ULjddMk1LXC9KNkwoKkVUcjNMYSVvKlQxUCFrTjM+KT1UaE0+alpVPzhecSs6TzdCOWtqa2cjV1JtYmc6WTg7UUxyc0taT0lkaWgoP0dQW09VJTBLPTtoQCJFMVEyVWU7XlBwPE90W0lXWiplY29dOTt0ZkUlNCgiLFQ8LjVmPComRmBwYFpIXVdTMGxKQERYbmxnRTRVMSY7SzcnbEpRaF5kaCQjNzNEYEI4dTgyPFFtdFYnMT4maDpAZEsjQ19WdCZUOyNsVD9qUUpLTGkuJUFQMjJuKTpjSHVrN10sPVwrTjpEZllHUSsoY2lWWUFEcV9UO11xWzNBMCokKSI/b0FIU0okVEY/ZmVjcVA8JkZpRVM/LSlpI01iQF5UNmwsNUlqMVAoLzM6O042VlQ2N2VcKnJDcy42SlglcjNEJlUkV1NwM1UrXDRpSDk+TlNwTXU/OkkvNiRUJixJXGwxSyoxYC9VcFkoR0NrQG9iX0pJU2dYRl5qY0FzX1RjXjE2Smo5KyszbF4uWWA7Y3JXQUVzRTJRMlQhYjQ4RXQxKz5kLVAmSWYicyklRzs+bDZ1P1lJPW1RXFRlV1ZkZSFRTiIrZFdYVlVacTozQDRxMmdQakM/QVRFXSsxSVU9KzcqNy1XZl5jUjBPMWsoU2BWZ08zSUtYQytkVlVBdWZqbEdKXGRlYjlKQ1AzSjYiT2YuKGM3Z2lSMkcuO2BZL1tHUSM0NixAa0dcR2pHPmYjR29fZVVtWVNGOzVccT9DV1xiNmZUXTciQl9xMDdhMyIsUFF1KnMqJGBnaXBpYkkhdD1WV2lnSkRxQjY5YTE1UixeczdnKlFYZipPdSIhVW9fXVgvMHM9TnRwQFMhMUY9Q09hQGguamovZkA2O1AqZjpKQTFKOjlNKyRLaU1FSmJMLiwiJjY4KypSLyJYTDQ4SUJnSisxREAnZE5hJ207QC1DaF4rZXA4IShKaVdkNjhWZkItMlFkREByRmZzaGloVy4xUEJzL1hHXXBMRCM8LHU7KG5jOTFNJVZpdDZuIiI/ay1JN11IQnJhSzdpc0BKJS9FZFpGa0c0Yz9JZllCUTVdbX4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTIKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMTIgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzMxIDAwMDAwIG4gCjAwMDAwMDA0MTQgMDAwMDAgbiAKMDAwMDAwMDY3NSAwMDAwMCBuIAowMDAwMDAwODc5IDAwMDAwIG4gCjAwMDAwMDA5NDcgMDAwMDAgbiAKMDAwMDAwMTI1MSAwMDAwMCBuIAowMDAwMDAxMzE2IDAwMDAwIG4gCjAwMDAwMDQwNzMgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8MmNlMzgwZTVjMTAzNjM0MWUwNmRiODUzNTZiNTRhZjY+PDJjZTM4MGU1YzEwMzYzNDFlMDZkYjg1MzU2YjU0YWY2Pl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA4IDAgUgovUm9vdCA3IDAgUgovU2l6ZSAxMgo+PgpzdGFydHhyZWYKNTc2NQolJUVPRgo=" }],
    quiz: [
      {
        question: "De forma sencilla, ¿qué es la Inteligencia Artificial (IA)?",
        options: [
          "Un robot físico que sustituye a las personas",
          "Sistemas informáticos capaces de realizar tareas que normalmente requieren razonamiento humano, como entender texto o reconocer patrones",
          "Un programa que solo sirve para generar imágenes",
          "Un tipo de virus informático",
        ],
        correct: 1,
      },
      {
        question: "¿Cuál de estas es un asistente de IA conversacional (tipo 'chat')?",
        options: ["Excel", "Windows Explorer", "ChatGPT o Claude", "Adobe Acrobat Reader"],
        correct: 2,
      },
      {
        question: "La IA generativa a veces inventa información que suena convincente pero es falsa. ¿Cómo se llama este fenómeno?",
        options: ["Spam", "Alucinación", "Phishing", "Un bug de red"],
        correct: 1,
      },
      {
        question: "Por eso, ¿qué deberías hacer siempre con información importante que te da un asistente de IA?",
        options: ["Darla por cierta sin comprobar nada", "Ignorarla siempre", "Verificarla antes de usarla para algo importante, sobre todo datos y cifras", "Compartirla inmediatamente sin revisar"],
        correct: 2,
      },
      {
        question: "¿Es buena idea pegar datos confidenciales de la empresa o de clientes en una herramienta de IA pública y gratuita?",
        options: ["Sí, siempre, no hay ningún riesgo", "Solo los fines de semana", "No, salvo que la empresa lo autorice explícitamente con una herramienta aprobada", "Solo si el archivo es pequeño"],
        correct: 2,
      },
      {
        question: "¿Para qué tipo de tareas suele ser especialmente útil un asistente de IA en el trabajo?",
        options: [
          "Tomar decisiones legales vinculantes sin supervisión",
          "Sustituir por completo el criterio profesional en decisiones críticas",
          "Resumir textos largos, redactar borradores o ayudar a organizar ideas",
          "Ninguna, no tiene aplicaciones prácticas",
        ],
        correct: 2,
      },
      {
        question: "¿Qué significa que la IA sea una herramienta de 'aumento' y no de sustitución total?",
        options: [
          "Que aumenta el precio de las herramientas de oficina",
          "Que reemplaza completamente a la persona en su puesto",
          "Que solo funciona los días laborables",
          "Que ayuda y potencia el trabajo de las personas, sin eliminar la necesidad de su criterio y supervisión",
        ],
        correct: 3,
      },
      {
        question: "¿Qué es un 'prompt' cuando trabajas con un asistente de IA?",
        options: ["Un tipo de virus", "La instrucción o pregunta que le escribes para pedirle algo", "El nombre técnico del ordenador", "Un archivo adjunto obligatorio"],
        correct: 1,
      },
      {
        question: "Si dos personas usan el mismo asistente con el mismo prompt, ¿por qué pueden obtener respuestas algo distintas?",
        options: [
          "Porque depende del color de la pantalla",
          "Porque hay una única respuesta correcta programada de antemano",
          "Porque es imposible, siempre da la respuesta exacta",
          "Porque estos modelos no siempre generan una respuesta idéntica cada vez, aunque la pregunta sea la misma",
        ],
        correct: 3,
      },
      {
        question: "¿Cuál de estas es una buena práctica al usar IA en el trabajo?",
        options: [
          "Publicar cualquier respuesta de la IA sin revisarla",
          "Revisar críticamente el resultado antes de usarlo, igual que revisarías el trabajo de un compañero nuevo",
          "Usarla para decisiones sobre personas sin ninguna supervisión humana",
          "Compartir contraseñas de la empresa con el asistente para que 'te conozca mejor'",
        ],
        correct: 1,
      },
    ],
  },
  {
    id: uid(),
    title: "Buenas prácticas para trabajar con asistentes de IA",
    category: "ia",
    description:
      "Segunda formación de ejemplo sobre IA, más práctica: cómo escribir mejores instrucciones (prompts), cuándo conviene revisar o pedir ajustes, y qué tareas nunca conviene delegar sin supervisión. Complementa a la guía general.",
    videoUrl: "",
    presentationUrl: "",
    deadline: "",
    testMode: "interno",
    passPct: 70,
    attachments: [{ name: "Buenas prácticas con asistentes de IA.pdf", mimeType: "application/pdf", sizeKB: 4.9, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgMTAgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRXh0R1N0YXRlIDw8Ci9nUkxzMCA8PAovY2EgLjEyCj4+IC9nUkxzMSA8PAovY2EgMQo+Pgo+PiAvRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNiAwIG9iago8PAovQ29udGVudHMgMTEgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNyAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDkgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9BdXRob3IgKFwoYW5vbnltb3VzXCkpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAoXCh1bnNwZWNpZmllZFwpKSAvVGl0bGUgKEJ1ZW5hcyBwclwzNDFjdGljYXMgcGFyYSB0cmFiYWphciBjb24gYXNpc3RlbnRlcyBkZSBJQSkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago5IDAgb2JqCjw8Ci9Db3VudCAyIC9LaWRzIFsgNSAwIFIgNiAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjEwIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDI1NTEKPj4Kc3RyZWFtCkdiISNdYkF1QFcnJkRrKF0hQmFZZDBTVGlsc2M8RjhrT0JOXHAoIXEmL1w5PiFcaSs0XnRBWV9IWzVbUlRNL08yYC5jQCI4NzVhZUIyM1pDKlgxV2I/ZjZDIiVGTm9McVZnVWZKcmptPC4jPlIoRFFgNCVjLEpec1FjK19malEkSjFRSCVWT2UjWTAqJSprV2RiQigkPDdIMCMoUCM9bkFkYlhYNj81c1pZTytAbSwxQiwzRzVOUklWQzcxRlhFbEdPKGg/S2BYOGE8LUA9OUs/Iz81MDtXOGlJMmJybmNPJUJxUl0+PkFfUTFcZGQsSUlkMV03cyY1Zlw3SyI9PkgoXllxVD9jUV0/QlAtRHJganMvN1dHWTFYZTkmW2x1LV1iKU9IMlIlOVhIbThYLi1uTVhec201OlQhOS1PWi1KXmg0OHFFQTY+YGo6aXFJJmQzSkZEdCNHZyFHIVkzbVFAPCNfJlJwN25dXTIqVnVUSEM/dERHVm1PS2VgZGdnbUxSUShYRFVKZ040V0lPbCc1I0woWE5OZ3BTWklRP2hoKnNzW2x0amQ2K1MsNz08NzJkOkxIQyNVRjRlbyclQEtDNycqdDRKJXRqOGNRQW89dWBwbUElVD01Rm8sJHIiTkFJQ1RPTC80cjw8NjVaZiNqUkBOTT9kUmdlMUQhLUNhW3Q0PixwWWokWidxUkouTEEmKD9zVypZOzE8N0NjIkVBKjYwLnArNy9yL1JtclZMRkgsImJlX2h1NC4hO2whQUhQUi8jbSxUWF1nSkFsWkJbby9ZYiNlclo2YFk3NDROKm5SbjM5M0VTUEwsMl9iPVM2dUUrK2dWQTtDPW9yY3QlVTIkS0xnIV1vZ1RePiZqL10yckN0MTtwZzdEXFVqU29UP3BjRVNnQm8rWTU4bDJBUFVsZk1uIkAyODFAUWpZQThBIjtkImZAOVxQVjJNJmUoPmRYIyRdTS00SyFocltbNVZXcEdJbk1hbGgvZVpMQ2o2KihRNXNEIyhDcUVuMDNLKD1bKmVOUmlHak4rYG5JVExcSSQmNXMxaUJiMWU+bmoyOGNbSmZXQEAkOVJpQFM3SjdRNlMvPjsrUFdgKSxGXUxHRFlvWT5yX2hvSCZFOjArdGFFPGEiY2ZPWzshXDY7QjFURy40JksuKVMhKig5LVh0JmltOjItJCdYbCNMZGpSQTFFNTtibV5rVU9RKSxdcWhva0tGZ1g8OzovYEJfaUZIVlZbb2xuX2EwZCFLX101YEs1Q21bQV4yTy9rWSQ+dEdHQ28iLz4pJ1tCRixXIV5gNm1aV2JvTz4qZDUtPiUjME40WWA2TCcwYGEqIUBBY3JTa1s2JjhdUy02PyJrbjpxWXJqb2oibGEsXGZDMShcOWpbQnRBQnBvQyVBaVlOaWxYS2xKX0UrRGAhUlA7K01gQztKYVg0QFgxa2REbyk8PWI2U0s+SUxpZGxmZlxuczY7aFEncDo+aVRKI3RoPDwvOV5FPGEuNTgvKy0qUWRlTWRnK0xfY2VuVkhZUGhiQT1jXkpMSkctO1I0QT85WG87aHNnNlVPXTIiJFNqK3AwaktcQlphIS1CMlclS0tQLTRZPSNebWphY15DPyMkZFlnKUgxVmtSXCgqRkU9bSNIKUJDPGhGWVtuK1cpRi1XIyIsMCFuWCRANmlUW15WbERaPHRAKm1zNSQ4LnFcRVNeYFVpcjc+STYncSRzOyMvYy5YVTJuJGI5PjFtJmpMRFMlNydqcV4rMC09MTZYWExvaCZwNmo7QDtHPVUiTz1lK08oUzJwUy4hTEAhLVcoRiZiPm5qLkc2RXMxLy5ZPyRyJVFwSFpzSVRgSTw2cSRpSlBhdWRocChSZHJqSFciajFbJ04oM1k/VXFScFtnN202SiZfRmg2KjJkI1RWKmckKExPZTUzSkoqTHFGWEdzUUsrbCVOcDtgM0wvTUc3KSZtRWpnZEdqKWYpYmkmc29ASDpWQVJoKzIkJ1ZmPFZoZ1c0RTlBXnJrNlc5PFEtWkA+Xy43Ki5gZ3BkKS9jPjh1Klg8NnNWS2I7X1RILkU7UDlFUWQ0KSZEUGUnaWEua3I2KSlAIVcmYVlrO0EkYVNQWGJcL1MxLHQmRzcnSi8hIUZVb0pKQT8hNlJOXTwmXW9JI1VzbmwlTSJyJW1wS2NaVyRNLE03bkY6TitWU05KKEBjWjgtJC08UWlrXlRMJmBWLVlsaGhkNFovaSopJVd0LzJbaDZLWG0sKGJkb1VFVURyVFFIYT9AXWRoUmg9ZksiRlw0cTNgVVZYJm88KWBzWWwnJ1w7QVI5MmpUUCNeWT47QUxONHRpJExSSVtmYGM0cmA+O1s1MyFYNDEwPWJIMVJVOHEtLCosYTpyXG1pbU80Smk7NXFuLmNiIV1gUi03dDE2RUsmIy5TKEMlRzkqQWUlKC5zVGUsR1pXTXE3UUZWUS5gajskcGElTExpWW1faS9nXyU+TGlIVisqTzltLTI+YlIjU1xpdTRPJ2BeS0YrX2JvRjRtVCRSK1ddXFFSRiFzUVlENlcqKit1VycrNWozQzg+TkVjQlBgI1BSJ0AmSzhkZ3QhOl8zVlNjajRXL202Oz80RC1yQTNOPVRiWCtZREFxYTgsYUFyJC8waFp0SmFdYGM8OmRaJDloSTNoT0ZkQi5NSkxfTT5OJmdwTU4sLTJxRW5da0R0VzA1JV1JIj0vPWlQU24vaUk7ZytgTFNQJyY7XVhHQHMnayhYTzlYcVhdI19NNUh0ZHFAPEkhMEk5UDx0TihXV1QpIilKJmA3JTBDW04nTF4iN0E5VyhdL1FFcTlCTy5qUUFMVz9RMnRkU18uXSEzVCp0ajA/SUhLN2BuL2cpYC05NV51Qj8oOkIiKGdAXT0qM1MqZ3Q8OVpvQDA7dEBEZk5BbiJGaGsjRiIucktwNStFLTU2SldTaSNIWldoPVhnXU1iKlFfK2grMmFcTmoocDMrIUhrXzkqYClBZ0dsLkpTSCtgTidsZ2EnbjgjdDtjNCgjOGhJXz4xcGlHTFtOayhCaWxMS2RKLUlYLk5uXzpgOz9SMCVXOyhLK1M4M05jcjRLJSU3K0k3ZWZcPj4yVk0jZzZuRVhQRSlJWHE3J0VIRzY0dFAuUlFuKy1SazU3TmwnL1BTSmk3UHVYZilLM2VpSz9nXE86WVlDaiNcMCdDMEVSaG9bTVMkSjZOV2ppWEVldGtAWUgwcFkpdFpKZHJcUS5RV21BUUtXX0xLSGVBSVFXUzlqW0EtclJGTzM5RHI3LyoqbElZVV9KQUMlUS9FUmlDdWRsdShhckkwbz8vbEMiKj8iV3NCOWxuX0lYPkdiKy83Kjg/bWQmNmUtQkFfUF43SGlcN1w6KFkyPzJQZTA8LC5Cfj5lbmRzdHJlYW0KZW5kb2JqCjExIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDQ2MQo+PgpzdHJlYW0KR2FyJyQ7K290KCdTWUhBLydkMCdQImpATUQ6cDslPyEncCIuL1BoU0dBPi4+Y28uPyRfWVdUMyk9IkZ1VGEsbWltXmAnak9TbCcrXSxROWkoLWQ2dS4jaUJcQVY8P3JMTDRvZz1wU29GQ2hhNlAuVkdjZlZXVkZMRSpaWEVmQmg4MyQ9LWQ+TFpHX1QvOy1sW1A4bCxWV2lSMigvZEwiOjklW0QjWEJrYShYX1YmZT5iYDVBPyZSLGpqM1M6Z2diN0YxV1ZETEMzLT5JQltCIjhbb1JzdCZibVgxXEJUSGdbXlgmKE5CUE9OXWM/ZS0vN1FsTmhUYDlwNW8iZ3FZVnEycT0tXFguU0A4TkFJRWphQWFLPzVCQFs1SDNUUHJgRioxPXIlYGFxSV5DWU1AbmMxc1FcI0RQLDtLUFRoR00nPCZzMElnWUVJczM+TjlRSWE/VE1xTGkoL1BPK15pL11VJHAzN2VucDwyKkIzKVcpYCJDQEdRJzUuYSVscHEnOmFsQ15UcGNOTTo3bF46LkJGKnI7M1o8MG0tJyVJWGsyOyNdcF8vLEkzOTFObEpOKVpzRi5zWnFpdF1RXl45RG83OmpgN2FOMFdRfj5lbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCAxMgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjE5IDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMDQxNCAwMDAwMCBuIAowMDAwMDAwNjc1IDAwMDAwIG4gCjAwMDAwMDA4NzkgMDAwMDAgbiAKMDAwMDAwMDk0NyAwMDAwMCBuIAowMDAwMDAxMjY4IDAwMDAwIG4gCjAwMDAwMDEzMzMgMDAwMDAgbiAKMDAwMDAwMzk3NiAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzwyNWMzMjhjODYzYmVhMGQxNmMxYTcyODk5ZWRiMThkYj48MjVjMzI4Yzg2M2JlYTBkMTZjMWE3Mjg5OWVkYjE4ZGI+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDggMCBSCi9Sb290IDcgMCBSCi9TaXplIDEyCj4+CnN0YXJ0eHJlZgo0NTI4CiUlRU9GCg==" }],
    quiz: [
      {
        question: "¿Qué suele mejorar la calidad de la respuesta de un asistente de IA?",
        options: ["Escribir la pregunta lo más corta y ambigua posible", "Dar contexto claro y detalle específico sobre lo que necesitas", "Nunca dar ejemplos", "Escribir todo el mensaje en mayúsculas"],
        correct: 1,
      },
      {
        question: "Si la primera respuesta no es exactamente lo que buscabas, ¿qué puedes hacer?",
        options: ["Darte por vencido inmediatamente", "Cerrar la sesión sin decir nada", "Pedirle que la ajuste o aclare, como en una conversación", "Culpar a la herramienta y no volver a usarla"],
        correct: 2,
      },
      {
        question: "¿Es recomendable revisar y editar un texto generado por IA antes de enviarlo a un cliente?",
        options: ["No, se puede enviar tal cual siempre", "Sí, siempre conviene revisarlo y adaptarlo con tu propio criterio", "Solo si es muy largo", "Solo si lo pide el cliente"],
        correct: 1,
      },
      {
        question: "¿Qué tipo de tareas NO deberías delegar por completo en un asistente de IA sin supervisión?",
        options: ["Traducir un párrafo sencillo", "Generar ideas para una lluvia de ideas", "Resumir un correo largo", "Decisiones con impacto legal, de seguridad o económico importante"],
        correct: 3,
      },
      {
        question: "¿Qué ventaja tiene mantener una conversación de varios mensajes con un asistente, en vez de un único mensaje suelto?",
        options: ["No tiene ninguna ventaja", "Permite ir refinando la respuesta con más contexto en cada paso", "Hace que la IA se equivoque más", "Solo sirve para hacer la conversación más larga"],
        correct: 1,
      },
    ],
  },
];

const SEED_NEWS = [
  {
    id: uid(),
    date: todayISO(),
    title: "Bienvenida al Aula Virtual",
    body: "Este es el espacio de formación de Muñoz Bosch: protocolos, formación general y por equipo, e IA y nuevas tecnologías. Cada formación incluye vídeo, material y un test final.",
  },
  {
    id: uid(),
    date: todayISO(),
    title: "Nueva formación disponible: IA en el trabajo",
    body: "Ya está disponible la guía general de Inteligencia Artificial en el trabajo, en la categoría IA y nuevas tecnologías. Recomendada para todo el equipo.",
  },
];

// Aviso visible de errores de guardado: la app se suscribe a esto para mostrar
// un banner cuando Supabase rechaza una lectura/escritura, en vez de fallar en
// silencio (que es lo que ocultaba el problema real de que algunos guardados
// no llegaban a persistir).
let globalStorageErrorHandler = null;
function setGlobalStorageErrorHandler(fn) {
  globalStorageErrorHandler = fn;
}
function reportStorageError(action, key, err) {
  const msg = (err && (err.message || err.hint || err.details)) || String(err);
  console.error(`[Supabase] Fallo al ${action} "${key}": ${msg}`);
  if (globalStorageErrorHandler) globalStorageErrorHandler(`No se pudo ${action} "${key}". Detalle: ${msg}`);
}

async function loadKey(key, fallback) {
  try {
    const { data, error } = await supabase.from("app_storage").select("value").eq("key", key).maybeSingle();
    if (error) {
      reportStorageError("leer", key, error);
      return fallback;
    }
    if (!data) return fallback;
    return data.value;
  } catch (err) {
    reportStorageError("leer", key, err);
    return fallback;
  }
}

async function saveKey(key, value) {
  try {
    const { error } = await supabase
      .from("app_storage")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) {
      reportStorageError("guardar", key, error);
      return false;
    }
    return true;
  } catch (err) {
    reportStorageError("guardar", key, err);
    return false;
  }
}

async function deleteKey(key) {
  try {
    const { error } = await supabase.from("app_storage").delete().eq("key", key);
    if (error) reportStorageError("borrar", key, error);
  } catch (err) {
    reportStorageError("borrar", key, err);
  }
}

// Convierte formaciones semilla (con adjuntos en base64 "en crudo") en formaciones
// listas para usar: sube cada adjunto a su propia clave de almacenamiento y deja
// en el curso solo la referencia ligera {id, name, mimeType, sizeKB, storageKey}.
async function materializeSeedCourses(seedList) {
  const result = [];
  for (const c of seedList) {
    const finalAttachments = [];
    for (const att of c.attachments || []) {
      const attId = uid();
      const storageKey = `mb_att_${attId}`;
      await saveKey(storageKey, { name: att.name, mimeType: att.mimeType, data: att.data });
      finalAttachments.push({ id: attId, name: att.name, mimeType: att.mimeType, sizeKB: att.sizeKB, storageKey });
    }
    result.push({
      ...c,
      id: uid(),
      quiz: (c.quiz || []).map((q) => ({ ...q, options: [...q.options] })),
      attachments: finalAttachments,
      createdAt: c.createdAt || new Date().toISOString(),
    });
  }
  return result;
}

/* ---------- Piezas visuales pequeñas ---------- */

function Avatar({ name, size = 36 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: avatarColor(name), fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}

function ProgressRing({ percent, size = 64, color = BRAND.red, label }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#00000014" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
        <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={size * 0.24} fontWeight="bold" fill={BRAND.ink}>
          {percent}%
        </text>
      </svg>
      {label && <div className="text-[11px] text-gray-500 font-medium">{label}</div>}
    </div>
  );
}

function RatingStars({ rating, ratingComment, awaitingRating, onRate }) {
  const [selected, setSelected] = useState(rating || 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(ratingComment || "");
  const [submitted, setSubmitted] = useState(!awaitingRating && !!rating);

  if (submitted) {
    return (
      <div style={{ ...DS.card, padding: "var(--sp-4)", display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <div style={{ display: "flex", gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={16} fill={selected >= n ? "var(--warning)" : "none"} color={selected >= n ? "var(--warning)" : "var(--border-strong)"} />
          ))}
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Gracias por tu valoración.</div>
        <button onClick={() => setSubmitted(false)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--info)", border: "none", background: "none", cursor: "pointer", marginLeft: "auto" }}>
          Cambiarla
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...DS.card, padding: "var(--sp-4)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <div>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
          ¿Qué te ha parecido esta formación?
        </div>
        {awaitingRating && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--warning-text)", backgroundColor: "var(--warning-soft)", display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-full)", marginTop: 4, fontWeight: 500 }}>
            Falta esto para dar la formación por completada
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setSelected(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex" }}
            title={`${n} estrella${n === 1 ? "" : "s"}`}
          >
            <Star size={24} fill={(hover || selected) >= n ? "var(--warning)" : "none"} color={(hover || selected) >= n ? "var(--warning)" : "var(--border-strong)"} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Algún comentario, sugerencia o mejora (opcional)"
        rows={2}
        style={{ width: "100%", fontSize: "var(--text-sm)", padding: "8px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontFamily: "inherit", resize: "vertical" }}
      />
      <button
        disabled={selected === 0}
        onClick={() => {
          onRate(selected, comment);
          setSubmitted(true);
        }}
        style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: selected === 0 ? 0.4 : 1, width: "fit-content" }}
      >
        {awaitingRating ? "Enviar y completar formación" : "Guardar valoración"}
      </button>
    </div>
  );
}

function DeadlineChip({ deadline, completed }) {
  if (completed) {
    return <StatusPill icon={CheckCircle2} label="Completada" variant="success" />;
  }
  if (!deadline) {
    return <StatusPill label="Sin plazo" variant="neutral" />;
  }
  const d = daysUntil(deadline);
  if (d < 0) {
    return <StatusPill icon={AlertTriangle} label={`Vencida hace ${Math.abs(d)} día${Math.abs(d) === 1 ? "" : "s"}`} variant="danger" />;
  }
  if (d <= 3) {
    return <StatusPill icon={Clock} label={`Quedan ${d} día${d === 1 ? "" : "s"}`} variant="warning" />;
  }
  return <StatusPill icon={Clock} label={`${d} días restantes`} variant="neutral" />;
}

// Genera un par "píldora" (fondo muy suave + texto oscuro del mismo tono) a partir
// de cualquier color de marca — así toda la web usa el mismo lenguaje visual de
// etiquetas sin tener que definir a mano cada combinación fondo/texto.
function pillColors(hex) {
  return { bg: shadeColor(hex, 0.86), text: shadeColor(hex, -0.38) };
}

function CategoryTag({ id, small }) {
  const meta = categoryMeta(id);
  const Icon = meta.icon;
  const { bg, text } = pillColors(meta.color);
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 500,
        borderRadius: "var(--radius-full)", backgroundColor: bg, color: text,
        fontSize: small ? 11 : 12, padding: small ? "3px 10px" : "4px 12px",
      }}
    >
      <Icon size={small ? 11 : 12} />
      {meta.label}
    </span>
  );
}

function dataUriToBlobUrl(dataUri, mimeType) {
  const commaIdx = dataUri.indexOf(",");
  const base64 = dataUri.slice(commaIdx + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });
  return URL.createObjectURL(blob);
}

function AttachmentViewer({ att }) {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const parsed = await loadKey(att.storageKey, null);
      if (parsed && parsed.data) {
        // Las URI "data:" a veces no se dejan cargar dentro de un iframe por
        // restricciones del navegador. Las convertimos a un Blob URL, que es
        // más fiable tanto para la vista previa como para la descarga.
        const url = dataUriToBlobUrl(parsed.data, att.mimeType || parsed.mimeType);
        setBlobUrl(url);
      } else {
        setError("No se pudo cargar el archivo — puede que se haya guardado en una sesión anterior sin completarse. Prueba a volver a subirlo desde Admin.");
      }
    } catch {
      setError("No se pudo cargar el archivo.");
    }
    setLoading(false);
  }

  const isImage = att.mimeType?.startsWith("image/");
  const isPdf = att.mimeType === "application/pdf";

  return (
    <div className="rounded-lg border p-3 bg-white" style={{ borderColor: "#00000012" }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} style={{ color: BRAND.blue }} />
          <div className="text-sm font-medium truncate">{att.name}</div>
          <span className="text-[11px] text-gray-400 flex-shrink-0">{att.sizeKB} KB</span>
        </div>
        {!blobUrl && (
          <button onClick={load} disabled={loading} className="text-xs font-semibold flex-shrink-0 flex items-center gap-1" style={{ color: BRAND.red }}>
            {loading && <Loader2 size={12} className="animate-spin" />}
            {loading ? "Cargando..." : "Abrir documento"}
          </button>
        )}
      </div>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      {blobUrl && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <a
              href={blobUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold rounded-md px-3 py-1.5 text-white"
              style={{ backgroundColor: BRAND.red }}
            >
              Abrir en pestaña nueva ↗
            </a>
            <a
              href={blobUrl}
              download={att.name}
              className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-md px-3 py-1.5 border"
              style={{ borderColor: "#00000020", color: BRAND.ink }}
            >
              Descargar ↓
            </a>
          </div>
          {isImage && <img src={blobUrl} alt={att.name} className="max-h-72 rounded-md border mt-2" style={{ borderColor: "#00000012" }} />}
          {isPdf && (
            <div className="text-[11px] text-gray-400">
              La vista previa incrustada de PDF no funciona de forma fiable dentro de este espacio — usa "Abrir en pestaña nueva" o "Descargar" para verlo con el visor de tu navegador.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Pantalla de acceso ---------- */

function TextField({ label, value, onChange, type = "text", placeholder, onEnter, autoFocus }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter && onEnter()}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="mt-1 w-full text-sm rounded-lg border px-3 py-2.5 font-normal text-gray-900"
        style={{ borderColor: "#00000020" }}
      />
    </label>
  );
}

function MicrosoftLogo({ size = 16 }) {
  const s = size / 2;
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function LoginGate({ employees, adminPasswordHash, onEmployeeLogin, onEmployeeCreatePassword, onAdminLogin, onAdminSetup }) {
  // menu | employee-password | employee-verify-email | employee-create-password | admin-password | admin-create-password
  const [mode, setMode] = useState("menu");
  const [typedName, setTypedName] = useState("");
  const [password, setPassword] = useState("");
  const [emailCheck, setEmailCheck] = useState("");
  const [newPass1, setNewPass1] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msBusy, setMsBusy] = useState(false);
  const [msError, setMsError] = useState("");

  async function handleMicrosoftLogin() {
    setMsError("");
    setMsBusy(true);
    try {
      const { email } = await loginWithMicrosoftPopup();
      const normalized = email.trim().toLowerCase();
      const match = employees.find((e) => e.email && e.email.trim().toLowerCase() === normalized);
      if (match) {
        onEmployeeLogin(match.name);
      } else {
        setMsError(`Tu cuenta de Microsoft (${email}) todavía no está registrada aquí. Pide a tu administrador que te dé de alta con este mismo email.`);
      }
    } catch (err) {
      if (err?.errorCode !== "user_cancelled") {
        setMsError("No se pudo completar el inicio de sesión con Microsoft. Inténtalo de nuevo.");
      }
    } finally {
      setMsBusy(false);
    }
  }

  function normalize(s) {
    return s.trim().replace(/\s+/g, " ").toLowerCase();
  }

  function findMatch() {
    const target = normalize(typedName);
    return employees.find((e) => normalize(e.name) === target);
  }

  function goToPassword() {
    if (!typedName.trim()) return;
    setError("");
    setPassword("");
    const match = findMatch();
    if (match && !match.passwordHash) {
      setMode("employee-verify-email");
    } else {
      setMode("employee-password");
    }
  }

  async function submitEmployeePassword() {
    setBusy(true);
    const match = findMatch();
    const hash = await hashPassword(password);
    if (match && match.passwordHash && hash === match.passwordHash) {
      onEmployeeLogin(match.name);
    } else {
      setError("Nombre o contraseña incorrectos.");
    }
    setBusy(false);
  }

  function submitEmailCheck() {
    const match = findMatch();
    if (match && match.email && normalize(match.email) === normalize(emailCheck)) {
      setError("");
      setMode("employee-create-password");
    } else {
      setError("Ese email no coincide con el registrado para ese nombre. Consulta con tu administrador.");
    }
  }

  async function submitCreatePassword() {
    if (newPass1.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPass1 !== newPass2) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError("");
    const hash = await hashPassword(newPass1);
    const match = findMatch();
    await onEmployeeCreatePassword(match.name, hash);
    setBusy(false);
  }

  async function submitAdminPassword() {
    setBusy(true);
    const hash = await hashPassword(password);
    if (hash === adminPasswordHash) {
      onAdminLogin();
    } else {
      setError("Contraseña de administrador incorrecta.");
    }
    setBusy(false);
  }

  async function submitAdminCreate() {
    if (newPass1.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPass1 !== newPass2) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError("");
    const hash = await hashPassword(newPass1);
    await onAdminSetup(hash);
    setBusy(false);
  }

  return (
    <div
      style={{ minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "var(--bg-page)", fontFamily: "var(--font-sans)" }}
    >
      <div style={{ width: "100%", maxWidth: 400, borderRadius: "var(--radius-xl)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", padding: "var(--sp-6)" }}>
        <div className="flex flex-col items-center text-center mb-5">
          <img src="/logo-mb.png" alt="Muñoz Bosch" className="h-14 w-auto mb-3" />
          <div className="font-bold text-lg" style={{ color: BRAND.ink }}>
            Aula Virtual
          </div>
          <div className="text-xs text-gray-400">Acceso con nombre y contraseña</div>
        </div>

        {mode === "menu" && (
          <div>
            {msalIsConfigured && (
              <>
                <button
                  disabled={msBusy}
                  onClick={handleMicrosoftLogin}
                  className="w-full flex items-center justify-center gap-2.5 text-sm font-semibold rounded-lg py-2.5 border transition hover:bg-gray-50 disabled:opacity-60"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  {msBusy ? <Loader2 size={15} className="animate-spin" /> : <MicrosoftLogo size={15} />}
                  Iniciar sesión con Microsoft
                </button>
                {msError && <div className="text-xs mt-2" style={{ color: "var(--danger)" }}>{msError}</div>}
                <div className="flex items-center gap-2 my-4">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] text-gray-400">o con tu nombre y contraseña</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              </>
            )}
            {employees.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4 px-2">
                Todavía no hay empleados registrados. Entra como administrador para añadir el primero.
              </div>
            ) : (
              <div>
                <TextField label="Nombre y apellido" value={typedName} onChange={setTypedName} placeholder="Como está registrado en el equipo" onEnter={goToPassword} autoFocus />
                <button
                  disabled={!typedName.trim()}
                  onClick={goToPassword}
                  className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40 transition-all duration-150 active:scale-[0.98]"
                  style={{ backgroundColor: "var(--brand)" }}
                >
                  Continuar
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] text-gray-400">o</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <button
              onClick={() => {
                setError("");
                setPassword("");
                setNewPass1("");
                setNewPass2("");
                setMode(adminPasswordHash ? "admin-password" : "admin-create-password");
              }}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-lg py-2.5 border transition hover:bg-gray-50"
              style={{ borderColor: "var(--border)", color: "var(--brand)" }}
            >
              <ShieldCheck size={15} /> Acceder como administrador
            </button>
          </div>
        )}

        {mode === "employee-password" && (
          <div>
            <button onClick={() => { setMode("menu"); setError(""); }} className="flex items-center gap-1 text-xs font-semibold text-gray-400 mb-3">
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="flex flex-col items-center mb-3">
              <Avatar name={typedName} size={52} />
              <div className="font-semibold text-sm mt-2">{typedName}</div>
            </div>
            <TextField label="Contraseña" type="password" value={password} onChange={setPassword} onEnter={submitEmployeePassword} autoFocus placeholder="Tu contraseña" />
            <button
              disabled={!password || busy}
              onClick={submitEmployeePassword}
              className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {busy ? "Comprobando..." : "Entrar"}
            </button>
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}

        {mode === "employee-verify-email" && (
          <div>
            <button onClick={() => { setMode("menu"); setError(""); }} className="flex items-center gap-1 text-xs font-semibold text-gray-400 mb-3">
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="flex flex-col items-center mb-3 text-center">
              <Avatar name={typedName} size={52} />
              <div className="font-semibold text-sm mt-2">{typedName}</div>
              <div className="text-[11px] text-gray-400">Primer acceso — confirma tu email registrado para crear tu contraseña</div>
            </div>
            <TextField label="Tu email" type="email" value={emailCheck} onChange={setEmailCheck} onEnter={submitEmailCheck} autoFocus placeholder="nombre@munozbosch.com" />
            <button
              disabled={!emailCheck}
              onClick={submitEmailCheck}
              className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--brand)" }}
            >
              Continuar
            </button>
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}

        {mode === "employee-create-password" && (
          <div>
            <div className="flex flex-col items-center mb-3 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--warning-soft)" }}>
                <KeyRound size={20} style={{ color: "var(--warning)" }} />
              </div>
              <div className="font-semibold text-sm mt-2">Crea tu contraseña</div>
              <div className="text-[11px] text-gray-400">Mínimo 6 caracteres. Que no sea una que uses en otro sitio importante.</div>
            </div>
            <TextField label="Nueva contraseña" type="password" value={newPass1} onChange={setNewPass1} placeholder="Mínimo 6 caracteres" />
            <div className="mt-2">
              <TextField label="Repítela" type="password" value={newPass2} onChange={setNewPass2} onEnter={submitCreatePassword} placeholder="Repite la contraseña" />
            </div>
            <button
              disabled={!newPass1 || !newPass2 || busy}
              onClick={submitCreatePassword}
              className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {busy ? "Creando..." : "Crear contraseña y entrar"}
            </button>
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}

        {mode === "admin-password" && (
          <div>
            <button onClick={() => { setMode("menu"); setError(""); }} className="flex items-center gap-1 text-xs font-semibold text-gray-400 mb-3">
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="flex flex-col items-center mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--brand-soft)" }}>
                <Lock size={20} style={{ color: "var(--brand)" }} />
              </div>
              <div className="font-semibold text-sm mt-2">Acceso administrador</div>
            </div>
            <TextField label="Contraseña de administrador" type="password" value={password} onChange={setPassword} onEnter={submitAdminPassword} autoFocus placeholder="Contraseña" />
            <button
              disabled={!password || busy}
              onClick={submitAdminPassword}
              className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {busy ? "Comprobando..." : "Entrar"}
            </button>
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}

        {mode === "admin-create-password" && (
          <div>
            <button onClick={() => { setMode("menu"); setError(""); }} className="flex items-center gap-1 text-xs font-semibold text-gray-400 mb-3">
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="flex flex-col items-center mb-3 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--warning-soft)" }}>
                <KeyRound size={20} style={{ color: "var(--warning)" }} />
              </div>
              <div className="font-semibold text-sm mt-2">Crea el acceso de administrador</div>
              <div className="text-[11px] text-gray-400">Primer acceso — mínimo 6 caracteres</div>
            </div>
            <TextField label="Contraseña" type="password" value={newPass1} onChange={setNewPass1} placeholder="Mínimo 6 caracteres" />
            <div className="mt-2">
              <TextField label="Repítela" type="password" value={newPass2} onChange={setNewPass2} onEnter={submitAdminCreate} placeholder="Repite la contraseña" />
            </div>
            <button
              disabled={!newPass1 || !newPass2 || busy}
              onClick={submitAdminCreate}
              className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {busy ? "Creando..." : "Crear y entrar"}
            </button>
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- App principal ---------- */

export default function AulaVirtualMB() {
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [courses, setCourses] = useState([]);
  const [news, setNews] = useState([]);
  const [completionsByCourse, setCompletionsByCourse] = useState({});
  const [employees, setEmployees] = useState([]);
  const [groups, setGroups] = useState([]);
  const [paths, setPaths] = useState([]);
  const [adminPasswordHash, setAdminPasswordHash] = useState("");
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [loadingTracking, setLoadingTracking] = useState(false);

  const [currentUser, setCurrentUser] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState("dashboard");
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState(null);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [courseOrigin, setCourseOrigin] = useState("catalog");
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);

  useEffect(() => {
    setGlobalStorageErrorHandler((msg) => setStorageError(msg));
    return () => setGlobalStorageErrorHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      const [c, n, emp, grp, pwHash, lastBk, sUrl, pth] = await Promise.all([
        loadKey("mb_courses", null),
        loadKey("mb_news", null),
        loadKey("mb_employees", []),
        loadKey("mb_groups", []),
        loadKey("mb_admin_pin", ""),
        loadKey("mb_last_backup_at", null),
        loadKey("mb_sheets_webapp_url", ""),
        loadKey("mb_paths", []),
      ]);
      let finalCourses = c;
      let finalNews = n;
      if (finalCourses === null) {
        finalCourses = await materializeSeedCourses(SEED_COURSES);
        saveKey("mb_courses", finalCourses);
      }
      if (finalNews === null) {
        finalNews = SEED_NEWS;
        saveKey("mb_news", finalNews);
      }
      // migración: empleados antiguos guardados como strings, o con "pin" (sistema anterior) ->
      // objetos {name, passwordHash, email}. Un "pin" antiguo no se puede convertir en hash
      // (no sabemos el valor original una vez creado), así que esas personas simplemente
      // crean su contraseña de nuevo la próxima vez, verificando su email.
      const normalizedEmployees = (emp || []).map((e) => {
        if (typeof e === "string") return { name: e, passwordHash: null, email: "", managedGroupIds: [] };
        const { pin, pinProvided, ...rest } = e;
        const validHash = isValidHash(rest.passwordHash) ? rest.passwordHash : null;
        return { email: "", managedGroupIds: [], ...rest, passwordHash: validHash };
      });
      setCourses(finalCourses);
      setNews(finalNews);
      setEmployees(normalizedEmployees);
      setGroups(grp || []);
      // Igual que con los empleados: un PIN antiguo de 4 dígitos no es un hash válido.
      // Si detectamos que lo guardado no tiene forma de hash SHA-256, lo tratamos como
      // "sin configurar todavía", para que se pueda crear una contraseña nueva sin
      // quedarse bloqueado.
      setAdminPasswordHash(isValidHash(pwHash) ? pwHash : "");
      setLastBackupAt(lastBk);
      setSheetsUrl(sUrl || "");
      setPaths(pth || []);

      // Sesión recordada en este navegador: si hay una guardada y sigue siendo válida,
      // entra directamente sin volver a pedir nombre/contraseña.
      const session = loadSession();
      if (session?.type === "admin") {
        setIsAdmin(true);
      } else if (session?.type === "employee") {
        const stillExists = normalizedEmployees.some((e) => e.name === session.name);
        if (stillExists) {
          setCurrentUser(session.name);
          const assignedIds = finalCourses.filter((c2) => isAssignedToUser(c2, session.name, grp || [])).map((c2) => c2.id);
          ensureCompletionsForCourses(assignedIds);
        } else {
          clearSession();
        }
      }

      setLoading(false);
    })();
  }, []);

  const activeCourse = useMemo(() => courses.find((c) => c.id === activeCourseId) || null, [courses, activeCourseId]);

  async function ensureCourseCompletionsLoaded(courseId, force = false) {
    if (!force && completionsByCourse[courseId] !== undefined) return completionsByCourse[courseId];
    const data = await loadKey(`mb_completions_course_${courseId}`, {});
    setCompletionsByCourse((prev) => ({ ...prev, [courseId]: data }));
    return data;
  }
  async function ensureCompletionsForCourses(courseIds) {
    await Promise.all(courseIds.map((id) => ensureCourseCompletionsLoaded(id)));
  }
  async function loadAllCompletionsForTracking() {
    setLoadingTracking(true);
    await Promise.all(courses.map((c) => ensureCourseCompletionsLoaded(c.id, true)));
    setLoadingTracking(false);
  }

  function getStatus(user, courseId) {
    const rec = completionsByCourse[courseId]?.[user];
    if (!rec) return "pendiente";
    if (rec.status === "completada") {
      const course = courses.find((c) => c.id === courseId);
      if (isCourseExpired(course, rec)) return "pendiente";
    }
    return rec.status;
  }
  function getRecord(user, courseId) {
    return completionsByCourse[courseId]?.[user] || null;
  }

  async function markStarted(courseId) {
    if (!currentUser) return;
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    if (current[currentUser]) {
      setCompletionsByCourse((prev) => ({ ...prev, [courseId]: current }));
      return;
    }
    const updated = { ...current, [currentUser]: { status: "en_progreso", startedAt: todayISO(), attempts: 0 } };
    setCompletionsByCourse((prev) => ({ ...prev, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
  }

  async function openCourse(courseId, origin = "catalog") {
    setActiveCourseId(courseId);
    setQuizAnswers({});
    setQuizResult(null);
    setCourseOrigin(origin);
    setView("course");
    await ensureCourseCompletionsLoaded(courseId);
    markStarted(courseId);
  }

  async function submitQuiz() {
    if (!activeCourse || !currentUser) return;
    const quiz = activeCourse.quiz || [];
    let correctCount = 0;
    quiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) correctCount++;
    });
    const score = quiz.length ? Math.round((correctCount / quiz.length) * 100) : 100;
    const passed = score >= (activeCourse.passPct ?? 70);
    // lectura fresca justo antes de escribir, para minimizar la ventana de colisión
    // con otra persona completando la MISMA formación casi al mismo tiempo.
    const current = await loadKey(`mb_completions_course_${activeCourse.id}`, {});
    const prev = current[currentUser] || { attempts: 0 };
    const updated = {
      ...current,
      [currentUser]: {
        // Aprobar el test ya no marca "completada" directamente: falta la
        // valoración obligatoria. awaitingRating es lo que la interfaz usa
        // para saber que toca pedirla antes de dar la formación por hecha.
        status: "en_progreso",
        startedAt: prev.startedAt || todayISO(),
        completedAt: null,
        score,
        attempts: (prev.attempts || 0) + 1,
        awaitingRating: passed,
      },
    };
    setCompletionsByCourse((prevState) => ({ ...prevState, [activeCourse.id]: updated }));
    await saveKey(`mb_completions_course_${activeCourse.id}`, updated);
    setQuizResult({ score, passed, correctCount, total: quiz.length });
  }

  // Formaciones "por módulos": cada módulo tiene su propio mini-test, y hay que
  // aprobar uno para desbloquear el siguiente. Al aprobar el último módulo, la
  // formación queda "a la espera de valoración" — no se da por completada del
  // todo hasta que la persona puntúa (ver rateCourse).
  async function submitModuleQuiz(courseId, moduleObj) {
    if (!currentUser) return null;
    const quiz = moduleObj.quiz || [];
    let correctCount = 0;
    quiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) correctCount++;
    });
    const score = quiz.length ? Math.round((correctCount / quiz.length) * 100) : 100;
    const passed = score >= (moduleObj.passPct ?? 70);

    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const prevRec = current[currentUser] || { startedAt: todayISO(), moduleProgress: {} };
    const prevModuleRec = prevRec.moduleProgress?.[moduleObj.id];
    const moduleProgress = {
      ...(prevRec.moduleProgress || {}),
      [moduleObj.id]: {
        passed,
        score,
        completedAt: passed ? todayISO() : prevModuleRec?.completedAt || null,
        attempts: (prevModuleRec?.attempts || 0) + 1,
      },
    };

    const course = courses.find((c) => c.id === courseId);
    const allPassed = (course?.modules || []).every((m) => moduleProgress[m.id]?.passed);

    const updatedRec = {
      ...prevRec,
      status: "en_progreso",
      moduleProgress,
      completedAt: null,
      awaitingRating: allPassed,
    };
    const updated = { ...current, [currentUser]: updatedRec };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);

    const result = { score, passed, correctCount, total: quiz.length };
    setQuizResult(result);
    return result;
  }

  async function selfReportComplete(courseId) {
    if (!currentUser) return;
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const prev = current[currentUser] || { attempts: 0 };
    const updated = {
      ...current,
      [currentUser]: {
        status: "en_progreso",
        startedAt: prev.startedAt || todayISO(),
        completedAt: null,
        score: null,
        selfReported: true,
        attempts: (prev.attempts || 0) + 1,
        awaitingRating: true,
      },
    };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
  }

  // Valoración (1-5 estrellas + comentario opcional). Ahora es el paso que
  // realmente cierra una formación: si estaba "a la espera de valoración"
  // (awaitingRating), al valorar pasa a "completada" de verdad, con fecha de
  // hoy. Si ya estaba completada de antes (por ejemplo, alguien que cambia su
  // valoración más adelante), simplemente actualiza la nota sin tocar el resto.
  async function rateCourse(courseId, rating, comment) {
    if (!currentUser) return;
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const prev = current[currentUser];
    if (!prev) return;
    const wasAwaiting = !!prev.awaitingRating;
    const updated = {
      ...current,
      [currentUser]: {
        ...prev,
        rating,
        ratingComment: comment || "",
        ratedAt: todayISO(),
        status: wasAwaiting ? "completada" : prev.status,
        completedAt: wasAwaiting ? todayISO() : prev.completedAt,
        awaitingRating: false,
      },
    };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
  }

  async function manualSetStatus(courseId, employeeName, status) {
    if (!courseId || !employeeName) return;
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const prev = current[employeeName] || { attempts: 0 };
    const updated = {
      ...current,
      [employeeName]: {
        ...prev,
        status,
        completedAt: status === "completada" ? prev.completedAt || todayISO() : null,
        manualOverride: true,
      },
    };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
  }

  const pendingForUser = useMemo(() => {
    if (!currentUser) return [];
    return courses
      .filter((c) => isAssignedToUser(c, currentUser, groups) && getStatus(currentUser, c.id) !== "completada")
      .sort((a, b) => {
        const da = a.deadline ? daysUntil(a.deadline) : 9999;
        const db = b.deadline ? daysUntil(b.deadline) : 9999;
        return da - db;
      });
  }, [courses, completionsByCourse, currentUser, groups]);

  const completedForUser = useMemo(() => {
    if (!currentUser) return [];
    return courses.filter((c) => isAssignedToUser(c, currentUser, groups) && getStatus(currentUser, c.id) === "completada");
  }, [courses, completionsByCourse, currentUser, groups]);

  // Alertas: solo lo que ya venció, o lo que vence en 3 días o menos.
  const overdueForUser = useMemo(() => pendingForUser.filter((c) => c.deadline && daysUntil(c.deadline) < 0), [pendingForUser]);
  const dueSoonForUser = useMemo(() => pendingForUser.filter((c) => c.deadline && daysUntil(c.deadline) >= 0 && daysUntil(c.deadline) <= 3), [pendingForUser]);
  const alertCount = overdueForUser.length + dueSoonForUser.length;

  const pathsForUser = useMemo(() => {
    if (!currentUser) return [];
    return paths.filter((p) => isAssignedToUser(p, currentUser, groups));
  }, [paths, currentUser, groups]);

  // Rutas que todavía no ha terminado (al menos una formación pendiente dentro)
  // — esto es lo que dispara el aviso en Inicio y el número en la pestaña "Rutas".
  const pendingPathsForUser = useMemo(() => {
    if (!currentUser) return [];
    return pathsForUser.filter((p) => {
      const pathCourses = p.courseIds.map((id) => courses.find((c) => c.id === id)).filter(Boolean);
      if (pathCourses.length === 0) return false;
      return pathCourses.some((c) => getStatus(currentUser, c.id) !== "completada");
    });
  }, [pathsForUser, courses, currentUser, completionsByCourse]);

  // Si la persona que ha iniciado sesión es responsable de algún equipo, esto
  // no está vacío — determina si ve la pestaña "Mi equipo" y con qué alcance.
  const myManagedGroupIds = useMemo(() => {
    if (!currentUser) return [];
    return employees.find((e) => e.name === currentUser)?.managedGroupIds || [];
  }, [employees, currentUser]);

  const assignedCountForUser = useMemo(() => {
    if (!currentUser) return 0;
    return courses.filter((c) => isAssignedToUser(c, currentUser, groups)).length;
  }, [courses, currentUser, groups]);

  const progressPercent = useMemo(() => {
    if (!currentUser || assignedCountForUser === 0) return 0;
    return Math.round((completedForUser.length / assignedCountForUser) * 100);
  }, [completedForUser, assignedCountForUser, currentUser]);

  const POINTS_PER_COURSE = 100;
  const pointsForUser = useMemo(() => completedForUser.length * POINTS_PER_COURSE, [completedForUser]);
  const levelForUser = useMemo(() => levelForPoints(pointsForUser), [pointsForUser]);

  const badgesForUser = useMemo(() => {
    if (!currentUser) return [];
    const badges = [];
    const n = completedForUser.length;
    if (n >= 1) badges.push({ id: "first", label: "Primera formación completada", icon: Star });
    if (n >= 5) badges.push({ id: "five", label: "5 formaciones completadas", icon: Award });
    if (n >= 10) badges.push({ id: "ten", label: "10 formaciones completadas", icon: Trophy });
    for (const cat of CATEGORIES) {
      const assignedInCat = courses.filter((c) => c.category === cat.id && isAssignedToUser(c, currentUser, groups));
      if (assignedInCat.length > 0 && assignedInCat.every((c) => getStatus(currentUser, c.id) === "completada")) {
        badges.push({ id: `cat-${cat.id}`, label: `Experto en ${cat.label}`, icon: cat.icon });
      }
    }
    if (assignedCountForUser > 0 && pendingForUser.length === 0) {
      badges.push({ id: "uptodate", label: "Al día con todo", icon: PartyPopper });
    }
    return badges;
  }, [completedForUser, courses, currentUser, groups, pendingForUser, assignedCountForUser]);

  async function addGroup(name) {
    if (!name.trim() || groups.some((g) => g.name === name.trim())) return;
    const updated = [...groups, { id: uid(), name: name.trim(), memberNames: [] }];
    setGroups(updated);
    saveKey("mb_groups", updated);
  }
  async function deleteGroup(id) {
    const updated = groups.filter((g) => g.id !== id);
    setGroups(updated);
    saveKey("mb_groups", updated);
  }
  async function updateGroupMembers(id, memberNames) {
    const updated = groups.map((g) => (g.id === id ? { ...g, memberNames } : g));
    setGroups(updated);
    saveKey("mb_groups", updated);
  }

  // Rutas de aprendizaje: encadenan formaciones completas ya existentes, en un
  // orden fijo. No necesitan su propio sistema de progreso — se calcula sobre
  // la marcha a partir del estado real de cada formación (getStatus), así que
  // si alguien ya había completado una formación antes de que se creara la
  // ruta, ya cuenta hecha dentro de la ruta también.
  async function savePath(path) {
    let updated;
    if (paths.find((p) => p.id === path.id)) updated = paths.map((p) => (p.id === path.id ? path : p));
    else updated = [...paths, path];
    setPaths(updated);
    await saveKey("mb_paths", updated);
  }
  async function deletePath(id) {
    const updated = paths.filter((p) => p.id !== id);
    setPaths(updated);
    await saveKey("mb_paths", updated);
  }

  async function saveSheetsUrl(url) {
    setSheetsUrl(url);
    await saveKey("mb_sheets_webapp_url", url);
  }

  async function exportBackup(includeAttachments) {
    const allCompletions = {};
    for (const c of courses) {
      const rec = await loadKey(`mb_completions_course_${c.id}`, null);
      if (rec) allCompletions[c.id] = rec;
    }
    const payload = { exportedAt: new Date().toISOString(), courses, news, employees, groups, completionsByCourse: allCompletions, adminPasswordHash };
    if (includeAttachments) {
      const attachmentsData = {};
      for (const c of courses) {
        for (const att of c.attachments || []) {
          const data = await loadKey(att.storageKey, null);
          if (data) attachmentsData[att.storageKey] = data;
        }
      }
      payload.attachmentsData = attachmentsData;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aula-virtual-mb-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const now = new Date().toISOString();
    setLastBackupAt(now);
    await saveKey("mb_last_backup_at", now);
  }

  async function importBackup(payload) {
    if (payload.courses) {
      setCourses(payload.courses);
      await saveKey("mb_courses", payload.courses);
    }
    if (payload.news) {
      setNews(payload.news);
      await saveKey("mb_news", payload.news);
    }
    if (payload.employees) {
      setEmployees(payload.employees);
      await saveKey("mb_employees", payload.employees);
    }
    if (payload.groups) {
      setGroups(payload.groups);
      await saveKey("mb_groups", payload.groups);
    }
    if (payload.completionsByCourse) {
      for (const [courseId, data] of Object.entries(payload.completionsByCourse)) {
        await saveKey(`mb_completions_course_${courseId}`, data);
      }
      setCompletionsByCourse(payload.completionsByCourse);
    } else if (payload.completions) {
      // compatibilidad con copias antiguas (formato plano "empleado::curso")
      const grouped = {};
      for (const [key, rec] of Object.entries(payload.completions)) {
        const [user, courseId] = key.split("::");
        grouped[courseId] = grouped[courseId] || {};
        grouped[courseId][user] = rec;
      }
      for (const [courseId, data] of Object.entries(grouped)) {
        await saveKey(`mb_completions_course_${courseId}`, data);
      }
      setCompletionsByCourse(grouped);
    }
    if (payload.adminPasswordHash) {
      setAdminPasswordHash(payload.adminPasswordHash);
      await saveKey("mb_admin_pin", payload.adminPasswordHash);
    } else if (payload.adminPin) {
      // compatibilidad con copias muy antiguas (sistema de PIN previo) — ya no es
      // un hash válido para el nuevo sistema, así que no se restaura tal cual.
    }
    if (payload.attachmentsData) {
      for (const [key, val] of Object.entries(payload.attachmentsData)) {
        await saveKey(key, val);
      }
    }
  }

  async function addEmployee(name, email) {
    if (!name.trim() || employees.some((e) => e.name === name.trim())) return;
    const trimmedName = name.trim();
    const updated = [...employees, { name: trimmedName, passwordHash: null, email: email.trim() }];
    setEmployees(updated);
    await saveKey("mb_employees", updated);
    await assignWelcomePathsToNewEmployees([trimmedName]);
  }

  // Si hay alguna ruta marcada como "de bienvenida", cualquier persona nueva
  // (dada de alta una a una o importada por Excel) queda apuntada a ella sola,
  // sin que el administrador tenga que asignarla a mano cada vez. No toca el
  // modo de asignación de la ruta (todos/grupos/personas) — solo añade a la
  // lista de "extras" que isAssignedToUser también comprueba.
  async function assignWelcomePathsToNewEmployees(newNames) {
    if (newNames.length === 0) return;
    const current = await loadKey("mb_paths", paths);
    const welcomePaths = (current || []).filter((p) => p.isWelcomePath);
    if (welcomePaths.length === 0) return;
    const updated = (current || []).map((p) => {
      if (!p.isWelcomePath) return p;
      const existingExtra = p.assignment?.extraNames || [];
      const merged = Array.from(new Set([...existingExtra, ...newNames]));
      return { ...p, assignment: { ...(p.assignment || { mode: "individual", groupIds: [], employeeNames: [] }), extraNames: merged } };
    });
    setPaths(updated);
    await saveKey("mb_paths", updated);
  }
  async function removeEmployee(name) {
    const updated = employees.filter((e) => e.name !== name);
    setEmployees(updated);
    saveKey("mb_employees", updated);
    if (currentUser === name) setCurrentUser("");
  }
  // Borra la contraseña de alguien (no se puede "ver", solo restablecer) — la
  // próxima vez que esa persona entre, tendrá que crear una contraseña nueva
  // verificando su email, igual que la primera vez.
  async function resetEmployeePassword(name) {
    const updated = employees.map((e) => (e.name === name ? { ...e, passwordHash: null } : e));
    setEmployees(updated);
    saveKey("mb_employees", updated);
  }
  async function createEmployeePassword(name, passwordHash) {
    const updated = employees.map((e) => (e.name === name ? { ...e, passwordHash } : e));
    setEmployees(updated);
    await saveKey("mb_employees", updated);
    setCurrentUser(name);
    saveSession({ type: "employee", name });
    const assignedIds = courses.filter((c) => isAssignedToUser(c, name, groups)).map((c) => c.id);
    ensureCompletionsForCourses(assignedIds);
  }
  async function updateEmployeeEmail(name, email) {
    const updated = employees.map((e) => (e.name === name ? { ...e, email } : e));
    setEmployees(updated);
    saveKey("mb_employees", updated);
  }

  // Marca a alguien como "responsable" de uno o varios grupos: al entrar con su
  // nombre y contraseña de siempre, verá además la pestaña "Mi equipo" con
  // acceso reducido (su gente y su seguimiento, no toda la empresa) — pero
  // puede crear formaciones para cualquier equipo, no solo el suyo.
  async function updateEmployeeManagedGroups(name, groupIds) {
    const updated = employees.map((e) => (e.name === name ? { ...e, managedGroupIds: groupIds } : e));
    setEmployees(updated);
    await saveKey("mb_employees", updated);
  }

  // Renombrar a alguien es delicado: su nombre se usa como identificador en
  // grupos y en el progreso de cada formación. Antes de tocar nada, comprobamos
  // que el nuevo nombre no coincida con otra persona ya existente, y luego
  // actualizamos en cascada: empleados, grupos, y el progreso ya guardado en
  // cada formación (cargando primero los datos más recientes de Supabase para
  // no perder nada que no estuviera todavía en memoria).
  async function renameEmployee(oldName, newName) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return { ok: false, error: "Nombre no válido." };
    if (employees.some((e) => e.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: "Ya existe otra persona con ese nombre." };
    }

    const updatedEmployees = employees.map((e) => (e.name === oldName ? { ...e, name: trimmed } : e));
    setEmployees(updatedEmployees);
    await saveKey("mb_employees", updatedEmployees);

    const updatedGroups = groups.map((g) =>
      g.memberNames.includes(oldName) ? { ...g, memberNames: g.memberNames.map((n) => (n === oldName ? trimmed : n)) } : g
    );
    setGroups(updatedGroups);
    await saveKey("mb_groups", updatedGroups);

    // Progreso: cargamos el estado más reciente de cada formación y renombramos
    // la clave si esa persona tenía algo registrado ahí.
    const freshCompletions = {};
    for (const c of courses) {
      const rec = await loadKey(`mb_completions_course_${c.id}`, {});
      if (rec && rec[oldName]) {
        const renamed = { ...rec };
        renamed[trimmed] = renamed[oldName];
        delete renamed[oldName];
        await saveKey(`mb_completions_course_${c.id}`, renamed);
        freshCompletions[c.id] = renamed;
      } else {
        freshCompletions[c.id] = rec;
      }
    }
    setCompletionsByCourse((prev) => ({ ...prev, ...freshCompletions }));

    if (currentUser === oldName) {
      setCurrentUser(trimmed);
      saveSession({ type: "employee", name: trimmed });
    }

    return { ok: true };
  }

  // Importación masiva desde Excel/CSV. Empleados nuevos se crean sin contraseña
  // (la crean ellos mismos en su primer acceso, verificando su email). Empleados
  // que ya existían (mismo nombre) solo actualizan su email. Los equipos se crean
  // como grupos si no existían todavía.
  async function importEmployeesBulk(rows) {
    let updatedEmployees = [...employees];
    let updatedGroups = [...groups];
    const newlyCreatedNames = [];

    for (const row of rows) {
      const existingIdx = updatedEmployees.findIndex((e) => e.name.trim().toLowerCase() === row.name.trim().toLowerCase());
      if (existingIdx === -1) {
        updatedEmployees.push({ name: row.name, passwordHash: null, email: row.email || "" });
        newlyCreatedNames.push(row.name);
      } else {
        updatedEmployees[existingIdx] = {
          ...updatedEmployees[existingIdx],
          email: row.email || updatedEmployees[existingIdx].email,
        };
      }

      if (row.equipo) {
        const groupIdx = updatedGroups.findIndex((g) => g.name.trim().toLowerCase() === row.equipo.trim().toLowerCase());
        if (groupIdx === -1) {
          updatedGroups.push({ id: uid(), name: row.equipo, memberNames: [row.name] });
        } else {
          const g = updatedGroups[groupIdx];
          if (!g.memberNames.includes(row.name)) {
            updatedGroups[groupIdx] = { ...g, memberNames: [...g.memberNames, row.name] };
          }
        }
      }
    }

    setEmployees(updatedEmployees);
    setGroups(updatedGroups);
    await saveKey("mb_employees", updatedEmployees);
    await saveKey("mb_groups", updatedGroups);
    await assignWelcomePathsToNewEmployees(newlyCreatedNames);
  }

  async function saveCourse(course) {
    let updated;
    const existing = courses.find((c) => c.id === course.id);
    // Marca de tiempo de publicación: se fija la primera vez y no se toca en
    // ediciones posteriores — la usa el sistema de avisos para saber qué
    // formaciones son "nuevas" (publicadas en las últimas ~24-48h).
    const courseWithTimestamp = { ...course, createdAt: existing?.createdAt || course.createdAt || new Date().toISOString() };
    if (existing) updated = courses.map((c) => (c.id === course.id ? courseWithTimestamp : c));
    else updated = [...courses, courseWithTimestamp];
    setCourses(updated);
    await saveKey("mb_courses", updated);
  }
  async function deleteCourse(id) {
    const course = courses.find((c) => c.id === id);
    if (course?.attachments) {
      for (const att of course.attachments) {
        if (att.storageKey) await deleteKey(att.storageKey);
      }
    }
    await deleteKey(`mb_completions_course_${id}`);
    const updated = courses.filter((c) => c.id !== id);
    setCourses(updated);
    await saveKey("mb_courses", updated);
  }
  async function addNews(item) {
    const updated = [item, ...news];
    setNews(updated);
    await saveKey("mb_news", updated);
  }
  async function updateNews(id, fields) {
    const updated = news.map((n) => (n.id === id ? { ...n, ...fields } : n));
    setNews(updated);
    await saveKey("mb_news", updated);
  }
  async function deleteNews(id) {
    const updated = news.filter((n) => n.id !== id);
    setNews(updated);
    await saveKey("mb_news", updated);
  }

  async function loadSeedExamples() {
    // Sustituye (por título) cualquier formación/novedad de ejemplo que ya tuvieras
    // por la versión más reciente del código — así una actualización de contenido
    // (como añadir los PDF) llega aunque ya hubieras cargado los ejemplos antes.
    // Cualquier formación o novedad propia, con otro título, no se toca.
    const seedCourseTitles = new Set(SEED_COURSES.map((c) => c.title));
    const oldSeedCourses = courses.filter((c) => seedCourseTitles.has(c.title));
    for (const old of oldSeedCourses) {
      for (const att of old.attachments || []) {
        if (att.storageKey) await deleteKey(att.storageKey);
      }
      await deleteKey(`mb_completions_course_${old.id}`);
    }
    const keptCourses = courses.filter((c) => !seedCourseTitles.has(c.title));
    const refreshedSeedCourses = await materializeSeedCourses(SEED_COURSES);
    const updatedCourses = [...keptCourses, ...refreshedSeedCourses];
    setCourses(updatedCourses);
    await saveKey("mb_courses", updatedCourses);
    setCompletionsByCourse((prev) => {
      const next = { ...prev };
      for (const old of oldSeedCourses) delete next[old.id];
      return next;
    });

    const seedNewsTitles = new Set(SEED_NEWS.map((n) => n.title));
    const keptNews = news.filter((n) => !seedNewsTitles.has(n.title));
    const refreshedNews = SEED_NEWS.map((n) => ({ ...n, id: uid(), date: todayISO() }));
    const updatedNews = [...refreshedNews, ...keptNews];
    setNews(updatedNews);
    await saveKey("mb_news", updatedNews);

    return refreshedSeedCourses.length + refreshedNews.length;
  }

  async function handleAdminSetup(hash) {
    setAdminPasswordHash(hash);
    await saveKey("mb_admin_pin", hash);
    setIsAdmin(true);
    setView("admin");
    saveSession({ type: "admin" });
  }

  function logout() {
    setCurrentUser("");
    setView("dashboard");
    clearSession();
  }
  function logoutAdmin() {
    setIsAdmin(false);
    if (view === "admin") setView("dashboard");
    clearSession();
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--sp-4)", backgroundColor: "var(--bg-page)" }}>
        <img src="/logo-mb.png" alt="Muñoz Bosch" style={{ height: 32, width: "auto", opacity: 0.9 }} />
        <Loader2 className="animate-spin" size={22} style={{ color: "var(--brand)" }} />
      </div>
    );
  }

  if (!currentUser && !isAdmin) {
    return (
      <LoginGate
        employees={employees}
        adminPasswordHash={adminPasswordHash}
        onEmployeeLogin={(name) => {
          setCurrentUser(name);
          setView("dashboard");
          saveSession({ type: "employee", name });
          const assignedIds = courses.filter((c) => isAssignedToUser(c, name, groups)).map((c) => c.id);
          ensureCompletionsForCourses(assignedIds);
        }}
        onEmployeeCreatePassword={createEmployeePassword}
        onAdminLogin={() => {
          setIsAdmin(true);
          setView("admin");
          saveSession({ type: "admin" });
        }}
        onAdminSetup={handleAdminSetup}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", fontFamily: "var(--font-sans)", color: "var(--text-primary)" }}>
      {/* ── HEADER ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 var(--sp-4)" }}>
          <div className="mb-header-inner">
            {/* Logo + nombre */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <img src="/logo-mb.png" alt="Muñoz Bosch" style={{ height: 26, width: "auto" }} />
              <span className="mb-app-name" style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "-0.01em" }}>
                Aula Virtual
              </span>
            </div>

            {/* Nav tabs */}
            <nav style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: "auto", marginRight: 8, flexShrink: 1, overflowX: "auto" }}>
              {[
                { id: "dashboard", label: "Inicio", icon: Home },
                ...(currentUser ? [{ id: "alerts", label: "Alertas", icon: AlertTriangle, count: alertCount }] : []),
                { id: "catalog", label: "Catálogo", icon: LayoutGrid },
                ...(currentUser ? [{ id: "routes", label: "Rutas", icon: Map, count: pendingPathsForUser.length }] : []),
                ...(myManagedGroupIds.length > 0 ? [{ id: "team", label: "Mi equipo", icon: Users }] : []),
                ...(isAdmin ? [{ id: "admin", label: "Admin", icon: Settings }] : []),
              ].map((t) => {
                const active = view === t.id || (view === "course" && t.id === "catalog" && courseOrigin !== "path") || (view === "path-detail" && t.id === "routes") || (view === "course" && t.id === "routes" && courseOrigin === "path");
                return (
                  <button
                    key={t.id}
                    className="mb-nav-btn"
                    onClick={() => {
                      if (t.id === "catalog" && view !== "course") setSelectedCatalogCategory(null);
                      if (t.id === "routes") setSelectedPathId(null);
                      setView(t.id);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                      padding: "6px 14px", borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)", fontWeight: active ? 600 : 500,
                      color: active ? "var(--brand)" : "var(--text-secondary)",
                      backgroundColor: active ? "var(--brand-soft)" : "transparent",
                      border: "none", cursor: "pointer",
                      transition: "all var(--dur-fast) var(--ease-out)",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "var(--bg-inset)"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <t.icon size={16} />
                    <span className="mb-nav-label">{t.label}</span>
                    {!!t.count && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 18, height: 18, padding: "0 5px",
                        borderRadius: "var(--radius-full)", fontSize: 10, fontWeight: 700,
                        backgroundColor: "var(--danger)", color: "var(--text-inverse)",
                      }}>
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* User area */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {currentUser && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px", borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)" }}>
                  <Avatar name={currentUser} size={24} />
                  <span className="mb-user-name" style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{currentUser.split(" ")[0]}</span>
                  <button onClick={logout} title="Cerrar sesión" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 2 }}>
                    <LogOut size={13} />
                  </button>
                </div>
              )}
              {isAdmin && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: "var(--radius-full)", backgroundColor: "var(--brand-soft)" }}>
                  <ShieldCheck size={13} style={{ color: "var(--brand)" }} />
                  <span className="mb-admin-label" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--brand)" }}>Admin</span>
                  <button onClick={logoutAdmin} title="Salir" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--brand)", display: "flex", padding: 2, opacity: 0.7 }}>
                    <LogOut size={12} />
                  </button>
                </div>
              )}
              {isAdmin && !currentUser && (
                <select
                  className="mb-view-as-select"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setCurrentUser(e.target.value);
                    const assignedIds = courses.filter((c) => isAssignedToUser(c, e.target.value, groups)).map((c) => c.id);
                    ensureCompletionsForCourses(assignedIds);
                  }}
                  style={{ fontSize: "var(--text-xs)", padding: "4px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-secondary)", maxWidth: 160 }}
                >
                  <option value="">Ver como empleado…</option>
                  {employees.map((e) => (
                    <option key={e.name} value={e.name}>{e.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--sp-6) var(--sp-4) var(--sp-12)" }}>
        {storageError && (
          <div style={{
            marginBottom: "var(--sp-5)", padding: "var(--sp-3) var(--sp-4)",
            borderRadius: "var(--radius-md)", border: "1px solid #EF444444",
            backgroundColor: "var(--danger-soft)", color: "var(--danger-text)",
            fontSize: "var(--text-sm)", display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>No se ha podido guardar.</div>
              <div style={{ fontSize: "var(--text-xs)", marginTop: 2, opacity: 0.9 }}>{storageError}</div>
            </div>
            <button onClick={() => setStorageError("")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--danger-text)", padding: 2 }}>
              <X size={16} />
            </button>
          </div>
        )}
        {view === "dashboard" && (
          <Dashboard
            currentUser={currentUser}
            news={news}
            pendingForUser={pendingForUser}
            completedForUser={completedForUser}
            assignedCountForUser={assignedCountForUser}
            progressPercent={progressPercent}
            points={pointsForUser}
            level={levelForUser}
            badges={badgesForUser}
            pendingPaths={pendingPathsForUser}
            courses={courses}
            getStatus={getStatus}
            onOpenCourse={openCourse}
            onOpenRoutes={() => setView("routes")}
            onOpenNewsLink={(item) => {
              if (item.linkType === "course" && item.linkId) {
                openCourse(item.linkId);
              } else if (item.linkType === "category" && item.linkId) {
                setSelectedCatalogCategory(item.linkId);
                setView("catalog");
              }
            }}
          />
        )}
        {view === "alerts" && (
          <AlertsView overdueForUser={overdueForUser} dueSoonForUser={dueSoonForUser} onOpenCourse={openCourse} />
        )}
        {view === "routes" && (
          <RoutesListView
            paths={pathsForUser}
            courses={courses}
            currentUser={currentUser}
            getStatus={getStatus}
            onOpenPath={(id) => {
              setSelectedPathId(id);
              setView("path-detail");
            }}
          />
        )}
        {view === "path-detail" && selectedPathId && (
          <PathDetailView
            path={paths.find((p) => p.id === selectedPathId)}
            courses={courses}
            currentUser={currentUser}
            getStatus={getStatus}
            onOpenCourse={(courseId) => openCourse(courseId, "path")}
            onBack={() => setView("routes")}
          />
        )}
        {view === "catalog" && (
          <Catalog
            courses={courses}
            currentUser={currentUser}
            groups={groups}
            getStatus={getStatus}
            onOpenCourse={openCourse}
            selectedCategory={selectedCatalogCategory}
            onSelectCategory={setSelectedCatalogCategory}
          />
        )}
        {view === "course" && activeCourse && (
          <CourseDetail
            course={activeCourse}
            currentUser={currentUser}
            status={currentUser ? getStatus(currentUser, activeCourse.id) : "pendiente"}
            record={currentUser ? getRecord(currentUser, activeCourse.id) : null}
            quizAnswers={quizAnswers}
            setQuizAnswers={setQuizAnswers}
            quizResult={quizResult}
            onSubmitQuiz={submitQuiz}
            onSubmitModuleQuiz={(moduleObj) => submitModuleQuiz(activeCourse.id, moduleObj)}
            onResetQuiz={() => {
              setQuizAnswers({});
              setQuizResult(null);
            }}
            onSelfReport={() => selfReportComplete(activeCourse.id)}
            onRateCourse={(rating, comment) => rateCourse(activeCourse.id, rating, comment)}
            onBack={() => setView(courseOrigin === "path" ? "path-detail" : "catalog")}
            onRetry={() => {
              setQuizAnswers({});
              setQuizResult(null);
            }}
          />
        )}
        {view === "admin" && isAdmin && (
          <AdminPanel
            courses={courses}
            news={news}
            employees={employees}
            groups={groups}
            completionsByCourse={completionsByCourse}
            loadingTracking={loadingTracking}
            lastBackupAt={lastBackupAt}
            sheetsUrl={sheetsUrl}
            onSaveSheetsUrl={saveSheetsUrl}
            onLoadTracking={loadAllCompletionsForTracking}
            onSaveCourse={saveCourse}
            onDeleteCourse={deleteCourse}
            onAddNews={addNews}
            onUpdateNews={updateNews}
            onDeleteNews={deleteNews}
            onAddEmployee={addEmployee}
            onRemoveEmployee={removeEmployee}
            onResetEmployeePassword={resetEmployeePassword}
            onUpdateEmployeeEmail={updateEmployeeEmail}
            onUpdateEmployeeManagedGroups={updateEmployeeManagedGroups}
            paths={paths}
            onSavePath={savePath}
            onDeletePath={deletePath}
            onRenameEmployee={renameEmployee}
            onImportEmployeesBulk={importEmployeesBulk}
            onAddGroup={addGroup}
            onDeleteGroup={deleteGroup}
            onUpdateGroupMembers={updateGroupMembers}
            onManualSetStatus={manualSetStatus}
            onExportBackup={exportBackup}
            onImportBackup={importBackup}
          />
        )}
        {view === "team" && myManagedGroupIds.length > 0 && (
          <AdminPanel
            mode="team"
            restrictToGroupIds={myManagedGroupIds}
            courses={courses}
            news={news}
            employees={employees}
            groups={groups}
            completionsByCourse={completionsByCourse}
            loadingTracking={loadingTracking}
            lastBackupAt={lastBackupAt}
            sheetsUrl={sheetsUrl}
            onSaveSheetsUrl={saveSheetsUrl}
            onLoadTracking={loadAllCompletionsForTracking}
            onSaveCourse={saveCourse}
            onDeleteCourse={deleteCourse}
            onAddNews={addNews}
            onUpdateNews={updateNews}
            onDeleteNews={deleteNews}
            onAddEmployee={addEmployee}
            onRemoveEmployee={removeEmployee}
            onResetEmployeePassword={resetEmployeePassword}
            onUpdateEmployeeEmail={updateEmployeeEmail}
            onUpdateEmployeeManagedGroups={updateEmployeeManagedGroups}
            onRenameEmployee={renameEmployee}
            onImportEmployeesBulk={importEmployeesBulk}
            onAddGroup={addGroup}
            onDeleteGroup={deleteGroup}
            onUpdateGroupMembers={updateGroupMembers}
            onManualSetStatus={manualSetStatus}
            onExportBackup={exportBackup}
            onImportBackup={importBackup}
          />
        )}
      </main>
    </div>
  );
}

/* ---------- Vistas ---------- */


/* ════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — COMPONENTES VISUALES
   Tokens: ver index.css (:root)
   ════════════════════════════════════════════════════════════════ */

const DS = {
  card: {
    backgroundColor: "var(--bg-card)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--border)",
    overflow: "hidden",
  },
  cardHover: {
    boxShadow: "var(--shadow-md)",
    borderColor: "var(--border-strong)",
  },
};

function SectionTitle({ icon: Icon, children, extra }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
        {Icon && <Icon size={16} style={{ color: "var(--text-muted)" }} />}
        <h2 style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          {children}
        </h2>
      </div>
      {extra || null}
    </div>
  );
}

function StatusPill({ icon: Icon, label, variant }) {
  const styles = {
    success: { bg: "var(--success-soft)", color: "var(--success-text)" },
    warning: { bg: "var(--warning-soft)", color: "var(--warning-text)" },
    danger: { bg: "var(--danger-soft)", color: "var(--danger-text)" },
    neutral: { bg: "var(--bg-inset)", color: "var(--text-secondary)" },
  };
  const s = styles[variant] || styles.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: "var(--text-xs)", fontWeight: 500,
      padding: "3px 10px", borderRadius: "var(--radius-full)",
      backgroundColor: s.bg, color: s.color,
    }}>
      {Icon && <Icon size={12} />}
      {label}
    </span>
  );
}

function CourseCard({ course, status, onOpen }) {
  const meta = categoryMeta(course.category);
  const completed = status === "completada";
  const days = course.deadline ? daysUntil(course.deadline) : null;
  const isOverdue = days !== null && days < 0 && !completed;
  const isDueSoon = days !== null && days >= 0 && days <= 3 && !completed;

  return (
    <button
      onClick={onOpen}
      style={{
        ...DS.card,
        textAlign: "left", width: "100%", cursor: "pointer",
        display: "flex", flexDirection: "column",
        transition: "all var(--dur-base) var(--ease-out)",
        padding: 0,
      }}
      onMouseEnter={(e) => { Object.assign(e.currentTarget.style, { boxShadow: "var(--shadow-md)", transform: "translateY(-2px)", borderColor: "var(--border-strong)" }); }}
      onMouseLeave={(e) => { Object.assign(e.currentTarget.style, { boxShadow: "none", transform: "none", borderColor: "var(--border)" }); }}
    >
      {/* Accent line */}
      <div style={{ height: 3, backgroundColor: completed ? "var(--success)" : meta.color }} />

      <div style={{ padding: "var(--sp-4)", display: "flex", flexDirection: "column", gap: "var(--sp-2)", flex: 1 }}>
        {/* Category + deadline */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <CategoryTag id={course.category} small />
          <DeadlineChip deadline={course.deadline} completed={completed} />
        </div>

        {/* Title */}
        <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35 }}>
          {course.title}
        </div>

        {/* Description */}
        <div className="line-clamp-2" style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.5 }}>
          {course.description}
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--text-muted)", marginTop: "auto", paddingTop: "var(--sp-2)", borderTop: "1px solid var(--border)" }}>
          {course.videoUrl && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><PlayCircle size={11} /> Vídeo</span>}
          {(course.attachments || []).length > 0 && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><FileText size={11} /> {course.attachments.length} doc{course.attachments.length > 1 ? "s" : ""}</span>}
          <span>{course.testMode === "googleform" ? "Google Form" : `${(course.quiz || []).length} pregunta${(course.quiz || []).length === 1 ? "" : "s"}`}</span>
        </div>
      </div>

      {/* Urgency footer */}
      {(isOverdue || isDueSoon || completed) && (
        <div style={{
          padding: "var(--sp-2) var(--sp-4)", fontSize: "var(--text-xs)", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 6,
          backgroundColor: isOverdue ? "var(--danger-soft)" : isDueSoon ? "var(--warning-soft)" : "var(--success-soft)",
          color: isOverdue ? "var(--danger-text)" : isDueSoon ? "var(--warning-text)" : "var(--success-text)",
        }}>
          {isOverdue ? <AlertTriangle size={12} /> : isDueSoon ? <Clock size={12} /> : <CheckCircle2 size={12} />}
          {isOverdue ? `Vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}` : isDueSoon ? `Vence en ${days} día${days === 1 ? "" : "s"}` : "Completada"}
        </div>
      )}
    </button>
  );
}

/* ── HOME ── */

function WelcomeBar({ currentUser, pendingForUser, completedForUser, assignedCountForUser, progressPercent, points, level }) {
  if (!currentUser) return null;
  const firstName = currentUser.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";

  const overdueCount = pendingForUser.filter((c) => c.deadline && daysUntil(c.deadline) < 0).length;
  const allDone = assignedCountForUser > 0 && pendingForUser.length === 0;
  const noneAssigned = assignedCountForUser === 0;

  let statusVariant = "warning", statusIcon = Clock, statusLabel = `${pendingForUser.length} formación${pendingForUser.length === 1 ? "" : "es"} pendiente${pendingForUser.length === 1 ? "" : "s"}`;
  if (noneAssigned) { statusVariant = "neutral"; statusIcon = Home; statusLabel = "Sin formaciones asignadas"; }
  else if (allDone) { statusVariant = "success"; statusIcon = CheckCircle2; statusLabel = "Estás al día"; }
  else if (overdueCount > 0) { statusVariant = "danger"; statusIcon = AlertTriangle; statusLabel = `${overdueCount} vencida${overdueCount === 1 ? "" : "s"}`; }

  return (
    <div style={{ ...DS.card, padding: "var(--sp-5)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-4)", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <Avatar name={currentUser} size={44} />
        <div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)" }}>
            {greeting}, {firstName}
          </div>
          <div style={{ marginTop: 4 }}>
            <StatusPill icon={statusIcon} label={statusLabel} variant={statusVariant} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-5)" }}>
        {!noneAssigned && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <Trophy size={16} style={{ color: level.color }} />
            <div>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>{points} pts · {level.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{level.nextMin != null ? `${level.nextMin - points} para subir` : "Máximo"}</div>
            </div>
          </div>
        )}
        {!noneAssigned && <ProgressRing percent={progressPercent} size={52} color="var(--brand)" label={`${completedForUser.length}/${assignedCountForUser}`} />}
      </div>
    </div>
  );
}

function ContinueCard({ course, onOpen }) {
  if (!course) return null;
  const meta = categoryMeta(course.category);
  const days = course.deadline ? daysUntil(course.deadline) : null;
  return (
    <div style={{ ...DS.card, padding: "var(--sp-5)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-4)", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", flex: 1, minWidth: 200 }}>
        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", backgroundColor: `${meta.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <meta.icon size={22} style={{ color: meta.color }} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 2 }}>Continúa con</div>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{course.title}</div>
          {days !== null && days <= 3 && (
            <div style={{ fontSize: 11, color: days < 0 ? "var(--danger)" : "var(--warning)", fontWeight: 500, marginTop: 3 }}>
              {days < 0 ? `Vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}` : `Vence en ${days} día${days === 1 ? "" : "s"}`}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onOpen}
        style={{
          padding: "8px 20px", borderRadius: "var(--radius-md)",
          backgroundColor: "var(--brand)", color: "var(--text-inverse)",
          border: "none", cursor: "pointer", fontSize: "var(--text-sm)",
          fontWeight: 600, transition: "background var(--dur-fast) var(--ease-out)",
          display: "flex", alignItems: "center", gap: 6,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--brand-hover)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--brand)"; }}
      >
        Continuar <ChevronRight size={15} />
      </button>
    </div>
  );
}

function QuickStats({ pending, completed, total, progressPercent }) {
  const stats = [
    { label: "Pendientes", value: pending, color: pending > 0 ? "var(--warning)" : "var(--text-muted)" },
    { label: "Completadas", value: completed, color: "var(--success)" },
    { label: "Progreso", value: `${progressPercent}%`, color: "var(--brand)" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "var(--sp-3)" }}>
      {stats.map((s) => (
        <div key={s.label} style={{ padding: "var(--sp-4)", borderRadius: "var(--radius-lg)", backgroundColor: "var(--bg-inset)", textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function BadgesRow({ badges }) {
  if (!badges || badges.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
      {badges.map((b) => {
        const Icon = b.icon || Award;
        return (
          <span key={b.id} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 500, padding: "3px 10px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--warning-soft)", color: "var(--warning-text)",
          }}>
            <Icon size={12} />
            {b.label}
          </span>
        );
      })}
    </div>
  );
}

function NewsCard({ item, featured, onOpen }) {
  const cat = item.linkType === "category" ? categoryMeta(item.linkId) : null;
  const accentColor = cat ? cat.color : "var(--info)";
  const clickable = item.linkType === "course" || item.linkType === "category";
  const daysDiff = daysUntil(item.date);
  const isNew = daysDiff != null && Math.abs(daysDiff) <= 3;
  const Icon = cat ? cat.icon : Newspaper;

  return (
    <div
      onClick={clickable ? onOpen : undefined}
      style={{
        ...DS.card, cursor: clickable ? "pointer" : "default",
        display: "flex", transition: "all var(--dur-base) var(--ease-out)",
      }}
      onMouseEnter={(e) => { if (clickable) Object.assign(e.currentTarget.style, DS.cardHover, { transform: "translateY(-1px)" }); }}
      onMouseLeave={(e) => { if (clickable) Object.assign(e.currentTarget.style, { boxShadow: "none", transform: "none", borderColor: "var(--border)" }); }}
    >
      <div style={{ width: 4, flexShrink: 0, backgroundColor: accentColor, borderRadius: "var(--radius-lg) 0 0 var(--radius-lg)" }} />
      <div style={{ padding: featured ? "var(--sp-5)" : "var(--sp-4)", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: "var(--sp-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {isNew && <StatusPill label="Nuevo" variant="success" />}
            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Icon size={11} /> {cat ? cat.label : "General"}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.date}</span>
        </div>
        <div style={{ fontSize: featured ? "var(--text-md)" : "var(--text-base)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35 }}>
          {item.title}
        </div>
        {featured && item.body && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5, marginTop: "var(--sp-2)" }}>{item.body}</div>}
        {clickable && (
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--brand)", display: "flex", alignItems: "center", gap: 4, marginTop: "var(--sp-3)" }}>
            {item.linkType === "course" ? "Ir a la formación" : "Ver campo"} <ChevronRight size={13} />
          </div>
        )}
      </div>
    </div>
  );
}

function NewsPanel({ news, onOpenNewsLink }) {
  if (news.length === 0) return null;
  const [featured, ...rest] = news;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <NewsCard item={featured} featured onOpen={() => onOpenNewsLink(featured)} />
      {rest.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-3)" }}>
          {rest.slice(0, 4).map((n) => (
            <NewsCard key={n.id} item={n} onOpen={() => onOpenNewsLink(n)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Dashboard({ currentUser, news, pendingForUser, completedForUser, assignedCountForUser, progressPercent, points, level, badges, pendingPaths, courses, getStatus, onOpenCourse, onOpenRoutes, onOpenNewsLink }) {
  // Formación más urgente para "Continuar"
  const continueTarget = pendingForUser.length > 0 ? pendingForUser[0] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      {currentUser && pendingPaths && pendingPaths.length > 0 && (
        <button
          onClick={onOpenRoutes}
          style={{
            ...DS.card, textAlign: "left", cursor: "pointer", padding: "var(--sp-4)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-3)", flexWrap: "wrap",
            borderLeft: "4px solid var(--info)", transition: "all var(--dur-base) var(--ease-out)",
          }}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, { boxShadow: "var(--shadow-md)" })}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, { boxShadow: "none" })}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", backgroundColor: "var(--info-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Map size={17} style={{ color: "var(--info)" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                Tienes {pendingPaths.length} ruta{pendingPaths.length === 1 ? "" : "s"} de aprendizaje en marcha
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pendingPaths.map((p) => p.title).join(" · ")}
              </div>
            </div>
          </div>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--info)", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            Ver rutas <ChevronRight size={14} />
          </span>
        </button>
      )}

      <WelcomeBar
        currentUser={currentUser}
        pendingForUser={pendingForUser}
        completedForUser={completedForUser}
        assignedCountForUser={assignedCountForUser}
        progressPercent={progressPercent}
        points={points}
        level={level}
      />

      {currentUser && continueTarget && (
        <ContinueCard course={continueTarget} onOpen={() => onOpenCourse(continueTarget.id)} />
      )}

      {currentUser && assignedCountForUser > 0 && (
        <QuickStats pending={pendingForUser.length} completed={completedForUser.length} total={assignedCountForUser} progressPercent={progressPercent} />
      )}

      {currentUser && badges.length > 0 && <BadgesRow badges={badges} />}

      {currentUser && pendingForUser.length > 1 && (
        <div>
          <SectionTitle icon={Clock}>Formaciones pendientes</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)" }}>
            {pendingForUser.slice(1).map((c) => (
              <CourseCard key={c.id} course={c} status="pendiente" onOpen={() => onOpenCourse(c.id)} />
            ))}
          </div>
        </div>
      )}

      {news.length > 0 && (
        <div>
          <SectionTitle icon={Newspaper}>Novedades</SectionTitle>
          <NewsPanel news={news} onOpenNewsLink={onOpenNewsLink} />
        </div>
      )}

      {currentUser && completedForUser.length > 0 && (
        <div>
          <SectionTitle icon={CheckCircle2}>Completadas</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)", opacity: 0.7 }}>
            {completedForUser.map((c) => (
              <CourseCard key={c.id} course={c} status="completada" onOpen={() => onOpenCourse(c.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AlertsView({ overdueForUser, dueSoonForUser, onOpenCourse }) {
  const total = overdueForUser.length + dueSoonForUser.length;

  if (total === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-4)", padding: "var(--sp-16) 0", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "var(--radius-full)", backgroundColor: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle2 size={24} style={{ color: "var(--success)" }} />
        </div>
        <div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)" }}>Sin alertas</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", maxWidth: 300, marginTop: "var(--sp-1)" }}>
            Aquí aparecerá lo que esté vencido o a punto de vencer (3 días o menos).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-8)" }}>
      {overdueForUser.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", backgroundColor: "var(--danger-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={16} style={{ color: "var(--danger)" }} />
            </div>
            <div>
              <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--danger-text)" }}>Vencidas</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{overdueForUser.length} formación{overdueForUser.length === 1 ? "" : "es"} con el plazo pasado</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)" }}>
            {overdueForUser.map((c) => <CourseCard key={c.id} course={c} status="pendiente" onOpen={() => onOpenCourse(c.id)} />)}
          </div>
        </div>
      )}

      {dueSoonForUser.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", backgroundColor: "var(--warning-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={16} style={{ color: "var(--warning)" }} />
            </div>
            <div>
              <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--warning-text)" }}>Próximas a vencer</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{dueSoonForUser.length} formación{dueSoonForUser.length === 1 ? "" : "es"} con 3 días o menos</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)" }}>
            {dueSoonForUser.map((c) => <CourseCard key={c.id} course={c} status="pendiente" onOpen={() => onOpenCourse(c.id)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Rutas de aprendizaje (encadenan formaciones completas) ---------- */

function RoutesListView({ paths, courses, currentUser, getStatus, onOpenPath }) {
  if (paths.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-3)", padding: "var(--sp-16) 0", textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Map size={20} style={{ color: "var(--text-muted)" }} />
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", maxWidth: 300 }}>
          Todavía no tienes ninguna ruta de aprendizaje asignada. Una ruta agrupa varias formaciones en un orden concreto.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "var(--sp-5)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Rutas de aprendizaje</h2>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 2 }}>Itinerarios de varias formaciones, en orden</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)" }}>
        {paths.map((p) => {
          const pathCourses = p.courseIds.map((id) => courses.find((c) => c.id === id)).filter(Boolean);
          const doneCount = currentUser ? pathCourses.filter((c) => getStatus(currentUser, c.id) === "completada").length : 0;
          const percent = pathCourses.length ? Math.round((doneCount / pathCourses.length) * 100) : 0;
          return (
            <button
              key={p.id}
              onClick={() => onOpenPath(p.id)}
              style={{ ...DS.card, textAlign: "left", cursor: "pointer", padding: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-3)", transition: "all var(--dur-base) var(--ease-out)" }}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, { boxShadow: "var(--shadow-md)", transform: "translateY(-2px)" })}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, { boxShadow: "none", transform: "none" })}
            >
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", backgroundColor: "var(--info-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Map size={19} style={{ color: "var(--info)" }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "var(--text-md)", color: "var(--text-primary)" }}>{p.title}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{pathCourses.length} formación{pathCourses.length === 1 ? "" : "es"}</div>
              </div>
              <div>
                <div style={{ height: 6, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ height: "100%", width: `${percent}%`, backgroundColor: percent === 100 ? "var(--success)" : "var(--brand)", borderRadius: "var(--radius-full)" }} />
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{doneCount}/{pathCourses.length} completadas · {percent}%</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PathDetailView({ path, courses, currentUser, getStatus, onOpenCourse, onBack }) {
  if (!path) return null;
  const pathCourses = path.courseIds.map((id) => courses.find((c) => c.id === id)).filter(Boolean);
  const statuses = pathCourses.map((c) => (currentUser ? getStatus(currentUser, c.id) : "pendiente"));
  const doneCount = statuses.filter((s) => s === "completada").length;
  const percent = pathCourses.length ? Math.round((doneCount / pathCourses.length) * 100) : 0;
  const firstUnpassedIndex = statuses.findIndex((s) => s !== "completada");
  const activeIndex = firstUnpassedIndex === -1 ? pathCourses.length - 1 : firstUnpassedIndex;
  const allDone = firstUnpassedIndex === -1;

  return (
    <div style={{ maxWidth: 720 }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)", border: "none", background: "none", cursor: "pointer", padding: 0, width: "fit-content", marginBottom: "var(--sp-4)" }}>
        <ChevronLeft size={15} /> Rutas de aprendizaje
      </button>

      <div style={{ marginBottom: "var(--sp-4)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 var(--sp-1) 0" }}>{path.title}</h1>
        {path.description && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0, maxWidth: 600 }}>{path.description}</p>}
      </div>

      <div style={{ ...DS.card, padding: "var(--sp-4)", marginBottom: "var(--sp-5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
            {allDone ? "🎉 Ruta completada" : `${doneCount} de ${pathCourses.length} formaciones completadas`}
          </span>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--brand)" }}>{percent}%</span>
        </div>
        <div style={{ height: 8, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${percent}%`, backgroundColor: allDone ? "var(--success)" : "var(--brand)", borderRadius: "var(--radius-full)", transition: "width 0.4s var(--ease-out)" }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        {pathCourses.map((c, i) => {
          const status = statuses[i];
          const passed = status === "completada";
          const locked = i > activeIndex;
          return (
            <button
              key={c.id}
              disabled={locked}
              onClick={() => onOpenCourse(c.id)}
              style={{
                ...DS.card, textAlign: "left", cursor: locked ? "not-allowed" : "pointer",
                padding: "var(--sp-3) var(--sp-4)", display: "flex", alignItems: "center", gap: "var(--sp-3)",
                opacity: locked ? 0.55 : 1, transition: "all var(--dur-fast) var(--ease-out)",
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: "var(--radius-full)", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
                backgroundColor: passed ? "var(--success)" : locked ? "var(--bg-inset)" : "var(--brand)",
                color: passed || !locked ? "white" : "var(--text-muted)",
              }}>
                {passed ? <CheckCircle2 size={14} /> : locked ? <Lock size={12} /> : i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                <CategoryTag id={c.category} small />
              </div>
              {!locked && !passed && <ChevronRight size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}



function shadeColor(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  let r = (num >> 16) + Math.round(255 * percent);
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * percent);
  let b = (num & 0x0000ff) + Math.round(255 * percent);
  r = Math.max(Math.min(255, r), 0);
  g = Math.max(Math.min(255, g), 0);
  b = Math.max(Math.min(255, b), 0);
  return "#" + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

function sortByUrgency(list) {
  return [...list].sort((a, b) => {
    const da = a.deadline ? daysUntil(a.deadline) : 9999;
    const db = b.deadline ? daysUntil(b.deadline) : 9999;
    return da - db;
  });
}

function CategoryBubble({ cat, onClick }) {
  const Icon = cat.icon;
  return (
    <button
      onClick={onClick}
      style={{
        ...DS.card, cursor: "pointer", padding: "var(--sp-6)",
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--sp-3)",
        transition: "all var(--dur-base) var(--ease-out)", textAlign: "left",
      }}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, { boxShadow: "var(--shadow-md)", borderColor: cat.color, transform: "translateY(-2px)" })}
      onMouseLeave={(e) => Object.assign(e.currentTarget.style, { boxShadow: "none", borderColor: "var(--border)", transform: "none" })}
    >
      <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", backgroundColor: `${cat.color}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={22} style={{ color: cat.color }} />
      </div>
      <div>
        <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{cat.label}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)", fontWeight: 500, color: cat.color, marginTop: "auto" }}>
        Ver formaciones <ChevronRight size={13} />
      </div>
    </button>
  );
}

function CategoryPicker({ onSelectCategory }) {
  return (
    <div>
      <div style={{ marginBottom: "var(--sp-5)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Catálogo</h2>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 2 }}>Elige un campo para ver sus formaciones</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--sp-4)" }}>
        {CATEGORIES.map((cat) => (
          <CategoryBubble key={cat.id} cat={cat} onClick={() => onSelectCategory(cat.id)} />
        ))}
      </div>
    </div>
  );
}

function Catalog({ courses, currentUser, groups, getStatus, onOpenCourse, selectedCategory, onSelectCategory }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const visibleCourses = currentUser ? courses.filter((c) => isAssignedToUser(c, currentUser, groups)) : courses;

  if (visibleCourses.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-3)", padding: "var(--sp-16) 0", textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LayoutGrid size={20} style={{ color: "var(--text-muted)" }} />
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", maxWidth: 280 }}>
          {courses.length === 0 ? "Aún no hay formaciones. Añade la primera desde Administración." : "No tienes formaciones asignadas todavía."}
        </div>
      </div>
    );
  }

  const searchBar = (
    <div style={{ position: "relative", marginBottom: "var(--sp-5)" }}>
      <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Buscar una formación por su nombre o tema…"
        style={{
          width: "100%", padding: "10px 12px 10px 38px", borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)", fontSize: "var(--text-sm)", color: "var(--text-primary)",
          backgroundColor: "var(--bg-card)",
        }}
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery("")}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );

  const query = searchQuery.trim().toLowerCase();
  if (query) {
    const matches = visibleCourses.filter(
      (c) => c.title.toLowerCase().includes(query) || (c.description || "").toLowerCase().includes(query) || categoryMeta(c.category).label.toLowerCase().includes(query)
    );
    return (
      <div>
        {searchBar}
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
          {matches.length} resultado{matches.length === 1 ? "" : "s"} para "{searchQuery}"
        </div>
        {matches.length === 0 ? (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", padding: "var(--sp-6) 0", textAlign: "center" }}>
            No hay ninguna formación que coincida. Prueba con otra palabra.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)" }}>
            {matches.map((c) => (
              <CourseCard key={c.id} course={c} status={currentUser ? getStatus(currentUser, c.id) : "pendiente"} onOpen={() => onOpenCourse(c.id)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!selectedCategory) {
    return (
      <div>
        {searchBar}
        <CategoryPicker onSelectCategory={onSelectCategory} />
      </div>
    );
  }

  const cat = categoryMeta(selectedCategory);
  const categoryCourses = visibleCourses.filter((c) => c.category === selectedCategory);
  const pendingCourses = sortByUrgency(categoryCourses.filter((c) => !currentUser || getStatus(currentUser, c.id) !== "completada"));
  const completedCourses = currentUser ? categoryCourses.filter((c) => getStatus(currentUser, c.id) === "completada") : [];
  const CatIcon = cat.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      {searchBar}
      <button onClick={() => onSelectCategory(null)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)", border: "none", background: "none", cursor: "pointer", padding: 0, width: "fit-content" }}>
        <ChevronLeft size={15} /> Catálogo
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", backgroundColor: `${cat.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <CatIcon size={19} style={{ color: cat.color }} />
        </div>
        <div>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--text-primary)", margin: 0, lineHeight: 1.3 }}>{cat.label}</h2>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Ordenadas por plazo más urgente</div>
        </div>
      </div>

      {pendingCourses.length === 0 ? (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", padding: "var(--sp-4) 0" }}>
          {completedCourses.length > 0 ? "No tienes formaciones pendientes en este campo. Al día." : "Todavía no hay formaciones en este campo."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)" }}>
          {pendingCourses.map((c) => (
            <CourseCard key={c.id} course={c} status={currentUser ? getStatus(currentUser, c.id) : "pendiente"} onOpen={() => onOpenCourse(c.id)} />
          ))}
        </div>
      )}

      {currentUser && completedCourses.length > 0 && (
        <div>
          <button onClick={() => setShowCompleted((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--sp-3)", width: "100%", textAlign: "left", border: "none", background: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 24, height: 24, borderRadius: "var(--radius-md)", backgroundColor: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={13} style={{ color: "var(--success)" }} />
            </div>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>Completadas ({completedCourses.length})</span>
            {showCompleted ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
          </button>
          {showCompleted && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)", opacity: 0.7 }}>
              {completedCourses.map((c) => (
                <CourseCard key={c.id} course={c} status="completada" onOpen={() => onOpenCourse(c.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function CourseDetail({ course, currentUser, status, record, quizAnswers, setQuizAnswers, quizResult, onSubmitQuiz, onSubmitModuleQuiz, onResetQuiz, onSelfReport, onRateCourse, onBack, onRetry }) {
  if (course.modules && course.modules.length > 0) {
    return (
      <ModularCourseDetail
        course={course}
        currentUser={currentUser}
        record={record}
        quizAnswers={quizAnswers}
        setQuizAnswers={setQuizAnswers}
        quizResult={quizResult}
        onSubmitModuleQuiz={onSubmitModuleQuiz}
        onResetQuiz={onResetQuiz}
        onRateCourse={onRateCourse}
        onBack={onBack}
      />
    );
  }

  const embed = getVideoEmbedUrl(course.videoUrl);
  const quiz = course.quiz || [];
  const allAnswered = quiz.every((_, i) => quizAnswers[i] !== undefined);
  const isGoogleForm = course.testMode === "googleform" && course.googleFormUrl;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: 760 }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)", border: "none", background: "none", cursor: "pointer", padding: 0, width: "fit-content" }}>
        <ChevronLeft size={15} /> Volver al catálogo
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-3)", flexWrap: "wrap" }}>
        <div>
          <CategoryTag id={course.category} />
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", marginTop: "var(--sp-2)", marginBottom: "var(--sp-1)", lineHeight: 1.3 }}>
            {course.title}
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: 640, margin: 0, lineHeight: 1.5 }}>{course.description}</p>
        </div>
        <DeadlineChip deadline={course.deadline} completed={status === "completada"} />
      </div>

      {course.videoUrl && (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <PlayCircle size={14} /> VÍDEO DE LA FORMACIÓN
          </div>
          <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", backgroundColor: "#000", aspectRatio: "16/9" }}>
            <iframe src={embed} style={{ width: "100%", height: "100%", border: "none" }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={course.title} />
          </div>
          <a href={course.videoUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--info)", marginTop: "var(--sp-2)" }}>
            <PlayCircle size={14} /> Ver el vídeo en su web de origen ↗
          </a>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Si el reproductor no carga, usa este enlace — se abre en una pestaña aparte.
          </div>
        </div>
      )}

      {course.presentationUrl && (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={14} /> PRESENTACIÓN / MATERIAL
          </div>
          <div style={{ ...DS.card }}>
            <iframe src={course.presentationUrl} style={{ width: "100%", height: 420, border: "none", display: "block" }} title={`${course.title}-material`} />
          </div>
          <a href={course.presentationUrl} target="_blank" rel="noreferrer" style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--info)", marginTop: "var(--sp-2)", display: "inline-block" }}>
            Abrir en una pestaña nueva ↗
          </a>
        </div>
      )}

      {course.attachments && course.attachments.length > 0 && (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={14} /> DOCUMENTOS ADJUNTOS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {course.attachments.map((att) => (
              <AttachmentViewer key={att.id} att={att} />
            ))}
          </div>
        </div>
      )}

      {isGoogleForm && (
        <div style={{ ...DS.card, padding: "var(--sp-4)" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <ClipboardList size={16} style={{ color: "var(--brand)" }} />
            Test final (Google Form)
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
            Este test se completa en el formulario de abajo. Cuando termines, indícalo con el botón.
          </div>
          <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border)", marginBottom: "var(--sp-2)" }}>
            <iframe src={getFormEmbedUrl(course.googleFormUrl)} style={{ width: "100%", height: 480, border: "none", display: "block" }} title={`${course.title}-form`}>
              Cargando…
            </iframe>
          </div>
          <a href={course.googleFormUrl} target="_blank" rel="noreferrer" style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--info)", display: "inline-block", marginBottom: "var(--sp-3)" }}>
            Abrir el formulario en una pestaña nueva ↗
          </a>
          <div>
            {status === "completada" ? (
              <StatusPill icon={CheckCircle2} label={`Completado ${record?.completedAt ? `el ${record.completedAt}` : ""}`} variant="success" />
            ) : record?.awaitingRating ? (
              <StatusPill icon={Star} label="Formulario recibido — valóralo abajo para terminar" variant="warning" />
            ) : (
              <button
                disabled={!currentUser}
                onClick={onSelfReport}
                style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: !currentUser ? 0.4 : 1 }}
              >
                Ya he completado el formulario
              </button>
            )}
          </div>
        </div>
      )}

      {!isGoogleForm && quiz.length > 0 && (
        <div style={{ ...DS.card, padding: "var(--sp-4)" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: "var(--sp-3)", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <ClipboardList size={16} style={{ color: "var(--brand)" }} />
            Test final {record?.attempts ? `· intento ${record.attempts + (quizResult ? 0 : 1)}` : ""}
          </div>

          {status === "completada" && !quizResult ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <StatusPill icon={CheckCircle2} label={`Superado ${record?.score != null ? `(${record.score}%)` : ""}`} variant="success" />
              <button onClick={onRetry} style={{ fontSize: "var(--text-xs)", fontWeight: 500, textDecoration: "underline", color: "var(--text-muted)", border: "none", background: "none", cursor: "pointer" }}>
                Repetir de todas formas
              </button>
            </div>
          ) : quizResult ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              <div style={{
                borderRadius: "var(--radius-md)", padding: "var(--sp-3)", fontSize: "var(--text-sm)", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
                backgroundColor: quizResult.passed ? "var(--success-soft)" : "var(--danger-soft)",
                color: quizResult.passed ? "var(--success-text)" : "var(--danger-text)",
              }}>
                {quizResult.passed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {quizResult.passed
                  ? `Superado — ${quizResult.correctCount}/${quizResult.total} correctas (${quizResult.score}%). Valórala abajo para completar la formación.`
                  : `No alcanzado — ${quizResult.correctCount}/${quizResult.total} correctas (${quizResult.score}%). Necesitas ${course.passPct ?? 70}%.`}
              </div>
              {!quizResult.passed && (
                <button onClick={onRetry} style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "6px 14px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", width: "fit-content" }}>
                  Reintentar test
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
              {quiz.map((q, qi) => (
                <div key={qi}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--sp-2)", color: "var(--text-primary)" }}>
                    {qi + 1}. {q.question}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {q.options.map((opt, oi) => {
                      const selected = quizAnswers[qi] === oi;
                      return (
                        <div
                          key={oi}
                          onClick={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)",
                            borderRadius: "var(--radius-md)", border: `1px solid ${selected ? "var(--brand)" : "var(--border)"}`,
                            padding: "8px 12px", cursor: "pointer", transition: "all var(--dur-fast) var(--ease-out)",
                            backgroundColor: selected ? "var(--brand-soft)" : "var(--bg-card)", color: "var(--text-primary)",
                          }}
                        >
                          <span style={{ width: 14, height: 14, borderRadius: "var(--radius-full)", border: `1.5px solid ${selected ? "var(--brand)" : "var(--border-strong)"}`, backgroundColor: selected ? "var(--brand)" : "transparent", flexShrink: 0 }} />
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                disabled={!allAnswered || !currentUser}
                onClick={onSubmitQuiz}
                style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: (!allAnswered || !currentUser) ? 0.4 : 1, width: "fit-content" }}
              >
                Enviar test
              </button>
            </div>
          )}
        </div>
      )}

      {(status === "completada" || record?.awaitingRating) && currentUser && (
        <RatingStars rating={record?.rating || 0} ratingComment={record?.ratingComment} awaitingRating={!!record?.awaitingRating} onRate={onRateCourse} />
      )}
    </div>
  );
}

/* ---------- Formaciones por módulos (secuenciales, con desbloqueo) ---------- */

function ModuleStepper({ modules, moduleProgress, activeIndex, viewedIndex, onSelect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {modules.map((m, i) => {
        const passed = moduleProgress[m.id]?.passed;
        const locked = i > activeIndex;
        const isViewed = i === viewedIndex;
        let icon = <span style={{ fontSize: 11, fontWeight: 700 }}>{i + 1}</span>;
        let iconBg = "var(--bg-inset)";
        let iconColor = "var(--text-muted)";
        if (passed) {
          icon = <CheckCircle2 size={13} />;
          iconBg = "var(--success)";
          iconColor = "white";
        } else if (locked) {
          icon = <Lock size={11} />;
        } else if (i === activeIndex) {
          iconBg = "var(--brand)";
          iconColor = "white";
        }
        return (
          <button
            key={m.id}
            disabled={locked}
            onClick={() => onSelect(i)}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: "var(--radius-md)", border: "none", textAlign: "left",
              backgroundColor: isViewed ? "var(--brand-soft)" : "transparent",
              cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.55 : 1,
              width: "100%",
            }}
          >
            <span style={{ width: 22, height: 22, borderRadius: "var(--radius-full)", backgroundColor: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icon}
            </span>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: isViewed ? 600 : 500, color: locked ? "var(--text-muted)" : "var(--text-primary)" }}>
              {m.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ModuleContent({ module: mod, alreadyPassed, quizAnswers, setQuizAnswers, quizResult, onSubmit, onResetQuiz, onContinue, isLastModule }) {
  const embed = getVideoEmbedUrl(mod.videoUrl);
  const quiz = mod.quiz || [];
  const allAnswered = quiz.every((_, i) => quizAnswers[i] !== undefined);
  // Mostrar el formulario del test solo si el módulo no está ya superado Y no
  // hay un resultado reciente en pantalla (si lo hay, mostramos ESE resultado
  // primero, sin que el aviso "ya lo superaste" lo tape).
  const showResultBanner = !!quizResult;
  const showReadOnlyPassed = alreadyPassed && !showResultBanner;
  const showQuizForm = !alreadyPassed && !showResultBanner && quiz.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{mod.title}</h2>

      {mod.body && (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-line" }}>
          {mod.body}
        </div>
      )}

      {mod.videoUrl && (
        <div>
          <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", backgroundColor: "#000", aspectRatio: "16/9" }}>
            <iframe src={embed} style={{ width: "100%", height: "100%", border: "none" }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={mod.title} />
          </div>
          <a href={mod.videoUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--info)", marginTop: "var(--sp-2)" }}>
            <PlayCircle size={13} /> Ver el vídeo en su web de origen ↗
          </a>
        </div>
      )}

      {showReadOnlyPassed && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", backgroundColor: "var(--bg-inset)", padding: "var(--sp-3)", borderRadius: "var(--radius-md)" }}>
          Ya superaste este módulo — lo estás revisando. No hace falta repetir el test.
        </div>
      )}

      {(showResultBanner || showQuizForm) && quiz.length > 0 && (
        <div style={{ ...DS.card, padding: "var(--sp-4)" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: "var(--sp-3)", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <ClipboardList size={16} style={{ color: "var(--brand)" }} />
            Test de este módulo
          </div>

          {showResultBanner ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              <div style={{
                borderRadius: "var(--radius-md)", padding: "var(--sp-3)", fontSize: "var(--text-sm)", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
                backgroundColor: quizResult.passed ? "var(--success-soft)" : "var(--danger-soft)",
                color: quizResult.passed ? "var(--success-text)" : "var(--danger-text)",
              }}>
                {quizResult.passed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {quizResult.passed
                  ? `Superado — ${quizResult.correctCount}/${quizResult.total} correctas (${quizResult.score}%). Módulo desbloqueado.`
                  : `No alcanzado — ${quizResult.correctCount}/${quizResult.total} correctas (${quizResult.score}%). Necesitas ${mod.passPct ?? 70}%.`}
              </div>
              {!quizResult.passed && (
                <button onClick={onResetQuiz} style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", width: "fit-content" }}>
                  Reintentar
                </button>
              )}
              {quizResult.passed && !isLastModule && (
                <button onClick={onContinue} style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", width: "fit-content", display: "flex", alignItems: "center", gap: 6 }}>
                  Ir al siguiente módulo <ChevronRight size={15} />
                </button>
              )}
              {quizResult.passed && isLastModule && (
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--success-text)" }}>
                  🎉 ¡Último módulo superado! Solo falta valorar la formación, abajo del todo, para darla por completada.
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
              {quiz.map((q, qi) => (
                <div key={qi}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--sp-2)", color: "var(--text-primary)" }}>
                    {qi + 1}. {q.question}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {q.options.map((opt, oi) => {
                      const selected = quizAnswers[qi] === oi;
                      return (
                        <div
                          key={oi}
                          onClick={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)",
                            borderRadius: "var(--radius-md)", border: `1px solid ${selected ? "var(--brand)" : "var(--border)"}`,
                            padding: "8px 12px", cursor: "pointer", transition: "all var(--dur-fast) var(--ease-out)",
                            backgroundColor: selected ? "var(--brand-soft)" : "var(--bg-card)", color: "var(--text-primary)",
                          }}
                        >
                          <span style={{ width: 14, height: 14, borderRadius: "var(--radius-full)", border: `1.5px solid ${selected ? "var(--brand)" : "var(--border-strong)"}`, backgroundColor: selected ? "var(--brand)" : "transparent", flexShrink: 0 }} />
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                disabled={!allAnswered}
                onClick={onSubmit}
                style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: !allAnswered ? 0.4 : 1, width: "fit-content" }}
              >
                Enviar respuestas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModularCourseDetail({ course, currentUser, record, quizAnswers, setQuizAnswers, quizResult, onSubmitModuleQuiz, onResetQuiz, onRateCourse, onBack }) {
  const modules = course.modules;
  const moduleProgress = record?.moduleProgress || {};
  const passedCount = modules.filter((m) => moduleProgress[m.id]?.passed).length;
  const percent = Math.round((passedCount / modules.length) * 100);
  const firstUnpassedIndex = modules.findIndex((m) => !moduleProgress[m.id]?.passed);
  const allDone = firstUnpassedIndex === -1;
  const activeIndex = allDone ? modules.length - 1 : firstUnpassedIndex;

  const [viewedIndex, setViewedIndex] = useState(activeIndex);

  function selectModule(i) {
    if (i > activeIndex) return; // bloqueado
    onResetQuiz();
    setViewedIndex(i);
  }

  function goToNextModule() {
    onResetQuiz();
    setViewedIndex((i) => Math.min(i + 1, modules.length - 1));
  }

  const viewedModule = modules[viewedIndex];
  const viewedAlreadyPassed = !!moduleProgress[viewedModule?.id]?.passed;

  return (
    <div style={{ maxWidth: 900 }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)", border: "none", background: "none", cursor: "pointer", padding: 0, width: "fit-content", marginBottom: "var(--sp-4)" }}>
        <ChevronLeft size={15} /> Volver al catálogo
      </button>

      <div style={{ marginBottom: "var(--sp-2)" }}>
        <CategoryTag id={course.category} />
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", margin: "var(--sp-2) 0 var(--sp-1) 0", lineHeight: 1.3 }}>
          {course.title}
        </h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5, maxWidth: 640 }}>{course.description}</p>
      </div>

      {/* Progreso dentro de la propia formación */}
      <div style={{ ...DS.card, padding: "var(--sp-4)", marginBottom: "var(--sp-5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
            {allDone ? "🎉 Formación completada" : `${passedCount} de ${modules.length} módulos completados`}
          </span>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--brand)" }}>{percent}%</span>
        </div>
        <div style={{ height: 8, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${percent}%`, backgroundColor: allDone ? "var(--success)" : "var(--brand)", borderRadius: "var(--radius-full)", transition: "width 0.4s var(--ease-out)" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "var(--sp-5)", alignItems: "flex-start" }}>
        <div style={{ ...DS.card, padding: "var(--sp-2)", position: "sticky", top: 72 }}>
          <ModuleStepper modules={modules} moduleProgress={moduleProgress} activeIndex={activeIndex} viewedIndex={viewedIndex} onSelect={selectModule} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <div style={{ ...DS.card, padding: "var(--sp-5)" }}>
            {viewedModule && (
              <ModuleContent
                module={viewedModule}
                alreadyPassed={viewedAlreadyPassed}
                isLastModule={viewedIndex === modules.length - 1}
                quizAnswers={quizAnswers}
                setQuizAnswers={setQuizAnswers}
                quizResult={quizResult}
                onContinue={goToNextModule}
                onSubmit={async () => {
                  await onSubmitModuleQuiz(viewedModule);
                }}
                onResetQuiz={onResetQuiz}
              />
            )}
          </div>
          {allDone && currentUser && (
            <RatingStars rating={record?.rating || 0} ratingComment={record?.ratingComment} awaitingRating={!!record?.awaitingRating} onRate={onRateCourse} />
          )}
        </div>
      </div>
    </div>
  );
}


function TextInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900"
        style={{ borderColor: "#00000020" }}
      />
    </label>
  );
}

function PathsAdminTab({ paths, courses, groups, employees, onSavePath, onDeletePath }) {
  const emptyAssignment = { mode: "todos", groupIds: [], employeeNames: [] };
  const [editingId, setEditingId] = useState(undefined); // undefined = lista, null = nueva, id = editando
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseIds, setCourseIds] = useState([]);
  const [assignment, setAssignment] = useState({ ...emptyAssignment });
  const [addCourseId, setAddCourseId] = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [isWelcomePath, setIsWelcomePath] = useState(false);

  function startNew() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setCourseIds([]);
    setAssignment({ ...emptyAssignment });
    setAddCourseId("");
    setIsWelcomePath(false);
  }
  function startEdit(p) {
    setEditingId(p.id);
    setTitle(p.title);
    setDescription(p.description || "");
    setCourseIds([...p.courseIds]);
    setAssignment(p.assignment ? { ...p.assignment } : { ...emptyAssignment });
    setAddCourseId("");
    setIsWelcomePath(!!p.isWelcomePath);
  }
  function moveCourse(i, dir) {
    setCourseIds((prev) => {
      const arr = [...prev];
      const target = i + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[i], arr[target]] = [arr[target], arr[i]];
      return arr;
    });
  }

  if (editingId === undefined) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        <button
          onClick={startNew}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 14px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", width: "fit-content" }}
        >
          <Plus size={15} /> Nueva ruta
        </button>
        {paths.length === 0 && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>No hay rutas de aprendizaje todavía.</div>}
        {paths.map((p) => (
          <div key={p.id} style={{ ...DS.card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--sp-3)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{p.title}</div>
                {p.isWelcomePath && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: "var(--radius-full)", backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}>
                    Ruta de bienvenida
                  </span>
                )}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{p.courseIds.length} formación{p.courseIds.length === 1 ? "" : "es"}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => startEdit(p)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--info)", border: "none", background: "none", cursor: "pointer" }}>Editar</button>
              <button onClick={() => onDeletePath(p.id)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--danger)", border: "none", background: "none", cursor: "pointer" }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const availableCourses = courses.filter((c) => !courseIds.includes(c.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", maxWidth: 640 }}>
      <button onClick={() => setEditingId(undefined)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", color: "var(--text-secondary)", border: "none", background: "none", cursor: "pointer", padding: 0, width: "fit-content" }}>
        <ChevronLeft size={15} /> Rutas
      </button>

      <TextInput label="Título de la ruta" value={title} onChange={setTitle} placeholder="Ej. Ruta de bienvenida" />
      <label className="block text-xs font-semibold text-gray-500 mb-1">
        Descripción
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }} />
      </label>

      <div>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)" }}>
          Formaciones de la ruta, en el orden en que se desbloquean
        </div>
        <div className="flex gap-2 mb-3">
          <select value={addCourseId} onChange={(e) => setAddCourseId(e.target.value)} className="flex-1 text-sm rounded-md border px-3 py-2" style={{ borderColor: "#00000020" }}>
            <option value="">Selecciona una formación para añadir…</option>
            {availableCourses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <button
            disabled={!addCourseId}
            onClick={() => {
              setCourseIds((prev) => [...prev, addCourseId]);
              setAddCourseId("");
            }}
            style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 14px", color: "var(--brand)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer", opacity: !addCourseId ? 0.4 : 1 }}
          >
            Añadir
          </button>
        </div>
        {courseIds.length === 0 ? (
          <div className="text-xs text-gray-400">Añade al menos una formación.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {courseIds.map((cid, i) => {
              const c = courses.find((cc) => cc.id === cid);
              if (!c) return null;
              return (
                <div key={cid} style={{ ...DS.card, display: "flex", alignItems: "center", gap: 8, padding: "var(--sp-2) var(--sp-3)" }}>
                  <span style={{ width: 20, height: 20, borderRadius: "var(--radius-full)", backgroundColor: "var(--brand)", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{c.title}</div>
                  <button disabled={i === 0} onClick={() => moveCourse(i, -1)} className="text-gray-400 disabled:opacity-30"><ChevronUp size={15} /></button>
                  <button disabled={i === courseIds.length - 1} onClick={() => moveCourse(i, 1)} className="text-gray-400 disabled:opacity-30"><ChevronDown size={15} /></button>
                  <button onClick={() => setCourseIds((prev) => prev.filter((id) => id !== cid))} className="text-red-500"><X size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)" }}>Asignar ruta a</div>
        <div className="flex gap-2 flex-wrap mb-2">
          {[
            { id: "todos", label: "Todos los empleados" },
            { id: "grupos", label: "Grupos concretos" },
            { id: "individual", label: "Personas concretas" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setAssignment((a) => ({ ...a, mode: m.id }))}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border"
              style={{
                backgroundColor: assignment.mode === m.id ? "var(--brand)" : "white",
                color: assignment.mode === m.id ? "white" : "var(--text-primary)",
                borderColor: assignment.mode === m.id ? "var(--brand)" : "#00000018",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {assignment.mode === "grupos" && (
          <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: "#00000018" }}>
            {groups.length === 0 ? (
              <div className="text-xs text-gray-400">No hay grupos creados todavía.</div>
            ) : (
              groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={(assignment.groupIds || []).includes(g.id)}
                    onChange={() => {
                      const has = (assignment.groupIds || []).includes(g.id);
                      setAssignment((a) => ({ ...a, groupIds: has ? a.groupIds.filter((id) => id !== g.id) : [...(a.groupIds || []), g.id] }));
                    }}
                  />
                  {g.name} <span className="text-[11px] text-gray-400">({(g.memberNames || []).length} personas)</span>
                </label>
              ))
            )}
          </div>
        )}
        {assignment.mode === "individual" && (
          <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: "#00000018" }}>
            {employees.length > 8 && (
              <input value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} placeholder="Buscar por nombre..." className="w-full text-xs rounded-md border px-2 py-1.5 mb-1.5" style={{ borderColor: "#00000020" }} />
            )}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {employees
                .filter((e) => e.name.toLowerCase().includes(assignSearch.trim().toLowerCase()))
                .map((e) => (
                  <label key={e.name} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(assignment.employeeNames || []).includes(e.name)}
                      onChange={() => {
                        const has = (assignment.employeeNames || []).includes(e.name);
                        setAssignment((a) => ({ ...a, employeeNames: has ? a.employeeNames.filter((n) => n !== e.name) : [...(a.employeeNames || []), e.name] }));
                      }}
                    />
                    {e.name}
                  </label>
                ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ ...DS.card, padding: "var(--sp-3)", display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" checked={isWelcomePath} onChange={(e) => setIsWelcomePath(e.target.checked)} id="welcome-path-check" />
        <label htmlFor="welcome-path-check" style={{ fontSize: "var(--text-sm)", cursor: "pointer" }}>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Ruta de bienvenida</span>
          <span style={{ color: "var(--text-muted)" }}> — se asigna sola a cada persona nueva que se dé de alta, además de a quien ya hayas asignado arriba.</span>
        </label>
      </div>

      <button
        disabled={!title.trim() || courseIds.length === 0}
        onClick={async () => {
          await onSavePath({ id: editingId || uid(), title: title.trim(), description, courseIds, assignment, isWelcomePath });
          setEditingId(undefined);
        }}
        style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: (!title.trim() || courseIds.length === 0) ? 0.4 : 1, width: "fit-content" }}
      >
        Guardar ruta
      </button>
    </div>
  );
}

function AdminPanel({
  courses,
  news,
  employees,
  groups,
  completionsByCourse,
  loadingTracking,
  lastBackupAt,
  sheetsUrl,
  onSaveSheetsUrl,
  onLoadTracking,
  onSaveCourse,
  onDeleteCourse,
  onAddNews,
  onUpdateNews,
  onDeleteNews,
  onAddEmployee,
  onRemoveEmployee,
  onResetEmployeePassword,
  onUpdateEmployeeEmail,
  onRenameEmployee,
  onImportEmployeesBulk,
  onAddGroup,
  onDeleteGroup,
  onUpdateGroupMembers,
  onManualSetStatus,
  onExportBackup,
  onImportBackup,
  onUpdateEmployeeManagedGroups,
  paths,
  onSavePath,
  onDeletePath,
  mode = "full",
  restrictToGroupIds = [],
}) {
  const [tab, setTab] = useState("courses");
  const emptyQuestion = { question: "", options: ["", "", "", ""], correct: 0 };
  const emptyAssignment = { mode: "todos", groupIds: [], employeeNames: [] };
  const [draft, setDraft] = useState({
    id: null,
    title: "",
    category: "protocolos",
    description: "",
    videoUrl: "",
    presentationUrl: "",
    deadline: "",
    passPct: 70,
    testMode: "interno",
    googleFormUrl: "",
    quiz: [{ ...emptyQuestion }],
    attachments: [],
    assignment: { ...emptyAssignment },
  });
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [editingEmailFor, setEditingEmailFor] = useState(null);
  const [editingNameFor, setEditingNameFor] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [renameError, setRenameError] = useState("");
  const [editingEmailValue, setEditingEmailValue] = useState("");
  const [editingManagedGroupsFor, setEditingManagedGroupsFor] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [importPreviewRows, setImportPreviewRows] = useState(null);
  const [importFileError, setImportFileError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(null);
  const [groupMemberSearch, setGroupMemberSearch] = useState({});
  const [assignSearch, setAssignSearch] = useState("");
  const [newNewsTitle, setNewNewsTitle] = useState("");
  const [newNewsBody, setNewNewsBody] = useState("");
  const [newNewsLinkType, setNewNewsLinkType] = useState("none");
  const [newNewsLinkId, setNewNewsLinkId] = useState("");
  const [editingNewsId, setEditingNewsId] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importPending, setImportPending] = useState(null);
  const [importError, setImportError] = useState("");
  const [sheetsUrlDraft, setSheetsUrlDraft] = useState(sheetsUrl || "");
  const [syncStatus, setSyncStatus] = useState("");
  const [manualCourseId, setManualCourseId] = useState("");
  const [manualEmployeeName, setManualEmployeeName] = useState("");

  function resetDraft() {
    setDraft({
      id: null,
      title: "",
      category: "protocolos",
      description: "",
      videoUrl: "",
      presentationUrl: "",
      deadline: "",
      passPct: 70,
      testMode: "interno",
      googleFormUrl: "",
      quiz: [{ ...emptyQuestion }],
      attachments: [],
      assignment: { ...emptyAssignment },
      modules: [],
      validityMonths: null,
    });
    setFileError("");
  }
  function loadDraft(course) {
    setDraft({
      ...course,
      testMode: course.testMode || "interno",
      googleFormUrl: course.googleFormUrl || "",
      quiz: (course.quiz && course.quiz.length ? course.quiz : [{ ...emptyQuestion }]).map((q) => ({ ...q, options: [...q.options] })),
      attachments: course.attachments ? [...course.attachments] : [],
      assignment: course.assignment ? { ...course.assignment } : { ...emptyAssignment },
      modules: course.modules ? course.modules.map((m) => ({ ...m, quiz: (m.quiz || []).map((q) => ({ ...q, options: [...q.options] })) })) : [],
    });
    setFileError("");
    setTab("editor");
  }
  function setAssignmentMode(mode) {
    setDraft((d) => ({ ...d, assignment: { ...d.assignment, mode } }));
  }
  function toggleAssignGroup(groupId) {
    setDraft((d) => {
      const current = d.assignment.groupIds || [];
      const next = current.includes(groupId) ? current.filter((g) => g !== groupId) : [...current, groupId];
      return { ...d, assignment: { ...d.assignment, groupIds: next } };
    });
  }
  function toggleAssignEmployee(name) {
    setDraft((d) => {
      const current = d.assignment.employeeNames || [];
      const next = current.includes(name) ? current.filter((n) => n !== name) : [...current, name];
      return { ...d, assignment: { ...d.assignment, employeeNames: next } };
    });
  }
  function handleFileInput(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setFileError(`"${file.name}" pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El límite para adjuntar aquí dentro es de ~3,5 MB. Para archivos más grandes o vídeo, usa un enlace (SharePoint/YouTube/Vimeo/Drive) en los campos de arriba.`);
      e.target.value = "";
      return;
    }
    setFileError("");
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((d) => ({
        ...d,
        attachments: [...(d.attachments || []), { id: uid(), name: file.name, mimeType: file.type || "application/octet-stream", sizeKB: Math.round(file.size / 1024), data: reader.result }],
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  function removeDraftAttachment(id) {
    const att = (draft.attachments || []).find((a) => a.id === id);
    if (att?.storageKey) deleteKey(att.storageKey);
    setDraft((d) => ({ ...d, attachments: (d.attachments || []).filter((a) => a.id !== id) }));
  }
  function updateQuizQuestion(qi, field, value) {
    setDraft((d) => ({ ...d, quiz: d.quiz.map((q, i) => (i === qi ? { ...q, [field]: value } : q)) }));
  }
  function updateQuizOption(qi, oi, value) {
    setDraft((d) => ({
      ...d,
      quiz: d.quiz.map((q, i) => (i !== qi ? q : { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) })),
    }));
  }
  function addQuestion() {
    setDraft((d) => ({ ...d, quiz: [...d.quiz, { ...emptyQuestion }] }));
  }
  function removeQuestion(qi) {
    setDraft((d) => ({ ...d, quiz: d.quiz.filter((_, i) => i !== qi) }));
  }

  // ---- Gestión de módulos (formaciones secuenciales) ----
  function toggleModularMode() {
    setDraft((d) => {
      const turningOn = !(d.modules && d.modules.length > 0);
      return { ...d, modules: turningOn ? [{ id: uid(), title: "Módulo 1", body: "", videoUrl: "", passPct: 70, quiz: [{ ...emptyQuestion }] }] : [] };
    });
  }
  function addModule() {
    setDraft((d) => ({ ...d, modules: [...(d.modules || []), { id: uid(), title: `Módulo ${(d.modules || []).length + 1}`, body: "", videoUrl: "", passPct: 70, quiz: [{ ...emptyQuestion }] }] }));
  }
  function removeModule(mi) {
    setDraft((d) => ({ ...d, modules: d.modules.filter((_, i) => i !== mi) }));
  }
  function moveModule(mi, direction) {
    setDraft((d) => {
      const modules = [...d.modules];
      const target = mi + direction;
      if (target < 0 || target >= modules.length) return d;
      [modules[mi], modules[target]] = [modules[target], modules[mi]];
      return { ...d, modules };
    });
  }
  function updateModuleField(mi, field, value) {
    setDraft((d) => ({ ...d, modules: d.modules.map((m, i) => (i === mi ? { ...m, [field]: value } : m)) }));
  }
  function addModuleQuestion(mi) {
    setDraft((d) => ({ ...d, modules: d.modules.map((m, i) => (i === mi ? { ...m, quiz: [...m.quiz, { ...emptyQuestion }] } : m)) }));
  }
  function removeModuleQuestion(mi, qi) {
    setDraft((d) => ({ ...d, modules: d.modules.map((m, i) => (i === mi ? { ...m, quiz: m.quiz.filter((_, j) => j !== qi) } : m)) }));
  }
  function updateModuleQuestion(mi, qi, field, value) {
    setDraft((d) => ({
      ...d,
      modules: d.modules.map((m, i) => (i !== mi ? m : { ...m, quiz: m.quiz.map((q, j) => (j === qi ? { ...q, [field]: value } : q)) })),
    }));
  }
  function updateModuleOption(mi, qi, oi, value) {
    setDraft((d) => ({
      ...d,
      modules: d.modules.map((m, i) =>
        i !== mi ? m : { ...m, quiz: m.quiz.map((q, j) => (j !== qi ? q : { ...q, options: q.options.map((o, k) => (k === oi ? value : o)) })) }
      ),
    }));
  }
  function canSave() {
    return draft.title.trim().length > 0;
  }
  async function handleSave() {
    setSaving(true);
    const finalAttachments = [];
    for (const att of draft.attachments || []) {
      if (att.storageKey) {
        finalAttachments.push({ id: att.id, name: att.name, mimeType: att.mimeType, sizeKB: att.sizeKB, storageKey: att.storageKey });
        continue;
      }
      const storageKey = `mb_att_${att.id}`;
      await saveKey(storageKey, { name: att.name, mimeType: att.mimeType, data: att.data });
      finalAttachments.push({ id: att.id, name: att.name, mimeType: att.mimeType, sizeKB: att.sizeKB, storageKey });
    }
    await onSaveCourse({ ...draft, id: draft.id || uid(), attachments: finalAttachments });
    setSaving(false);
    resetDraft();
    setTab("courses");
  }

  const completionRows = useMemo(() => {
    const rows = [];
    for (const c of courses) {
      const data = completionsByCourse[c.id] || {};
      for (const [employee, rec] of Object.entries(data)) {
        rows.push({ employee, courseTitle: c.title, ...rec });
      }
    }
    return rows;
  }, [completionsByCourse, courses]);

  // Valoración media por formación (solo con quien haya puntuado, 1-5 estrellas).
  const avgRatingByCourse = useMemo(() => {
    const result = {};
    for (const c of courses) {
      const data = completionsByCourse[c.id] || {};
      const ratings = Object.values(data).map((r) => r.rating).filter((r) => typeof r === "number" && r > 0);
      if (ratings.length > 0) {
        result[c.id] = { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length };
      }
    }
    return result;
  }, [completionsByCourse, courses]);

  const pendingReportRows = useMemo(() => {
    const rows = [];
    for (const emp of employees) {
      for (const c of courses) {
        if (!isAssignedToUser(c, emp.name, groups)) continue;
        const rec = (completionsByCourse[c.id] || {})[emp.name];
        const status = rec ? rec.status : "pendiente";
        if (status === "completada") continue;
        const d = c.deadline ? daysUntil(c.deadline) : null;
        rows.push({
          nombre: emp.name,
          email: emp.email || "",
          formacion: c.title,
          categoria: categoryMeta(c.category).label,
          fechaLimite: c.deadline || "",
          diasRestantes: d,
          estado: d !== null && d < 0 ? "Vencida" : "Pendiente",
        });
      }
    }
    return rows;
  }, [employees, courses, groups, completionsByCourse]);

  // Modo "equipo" (responsables): solo la gente de los grupos que gestionan.
  const teamMemberNames = useMemo(() => {
    if (mode !== "team") return null;
    const names = new Set();
    for (const g of groups) {
      if (restrictToGroupIds.includes(g.id)) {
        for (const n of g.memberNames || []) names.add(n);
      }
    }
    return names;
  }, [mode, groups, restrictToGroupIds]);

  const teamEmployees = useMemo(() => {
    if (!teamMemberNames) return [];
    return employees.filter((e) => teamMemberNames.has(e.name));
  }, [employees, teamMemberNames]);

  const teamCompletionRows = useMemo(() => {
    if (!teamMemberNames) return [];
    return completionRows.filter((r) => teamMemberNames.has(r.employee));
  }, [completionRows, teamMemberNames]);

  const [teamNewMemberName, setTeamNewMemberName] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <div>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 var(--sp-4) 0" }}>
          {mode === "team" ? "Mi equipo" : "Administración"}
        </h1>
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
          {(mode === "team"
            ? [
                { id: "courses", label: "Formaciones" },
                { id: "editor", label: draft.id ? "Editar formación" : "Nueva formación" },
                { id: "team", label: "Mi equipo" },
              ]
            : [
                { id: "courses", label: "Formaciones" },
                { id: "editor", label: draft.id ? "Editar formación" : "Nueva formación" },
                { id: "paths", label: "Rutas" },
                { id: "news", label: "Novedades" },
                { id: "employees", label: "Empleados" },
                { id: "groups", label: "Grupos" },
                { id: "seguimiento", label: "Seguimiento" },
                { id: "reviews", label: "Reseñas" },
                { id: "notificaciones", label: "Notificaciones" },
                { id: "backup", label: "Copia de seguridad" },
              ]
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  if (t.id === "editor" && !draft.title && tab !== "editor") resetDraft();
                  setTab(t.id);
                }}
                style={{
                  fontSize: "var(--text-sm)", fontWeight: active ? 600 : 500,
                  padding: "10px 14px", whiteSpace: "nowrap", flexShrink: 0,
                  color: active ? "var(--brand)" : "var(--text-muted)",
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: active ? "2px solid var(--brand)" : "2px solid transparent",
                  marginBottom: -1, transition: "color var(--dur-fast) var(--ease-out)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "courses" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "center", marginBottom: "var(--sp-2)" }}>
            <button
              onClick={() => {
                resetDraft();
                setTab("editor");
              }}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 14px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer" }}
            >
              <Plus size={15} /> Nueva formación
            </button>
          </div>
          {courses.length === 0 && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>No hay formaciones todavía.</div>}
          {courses.map((c) => (
            <div key={c.id} style={{ ...DS.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "var(--sp-3)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                <CategoryTag id={c.category} small />
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                {avgRatingByCourse[c.id] && (
                  <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "var(--warning)", flexShrink: 0 }} title={`${avgRatingByCourse[c.id].count} valoración${avgRatingByCourse[c.id].count === 1 ? "" : "es"}`}>
                    <Star size={11} fill="var(--warning)" /> {avgRatingByCourse[c.id].avg.toFixed(1)}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <button onClick={() => loadDraft(c)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, padding: "6px 10px", borderRadius: "var(--radius-md)", color: "var(--info)", background: "none", border: "none", cursor: "pointer" }}>
                  Editar
                </button>
                <button onClick={() => onDeleteCourse(c.id)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, padding: "6px 10px", borderRadius: "var(--radius-md)", color: "var(--danger)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Trash2 size={13} /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "editor" && (
        <div className="rounded-xl border bg-white p-4 space-y-4 shadow-sm" style={{ borderColor: "#00000012" }}>
          <TextInput label="Título de la formación" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder="Ej. Protocolo de picking pasillo 4" />

          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Categoría
            <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Descripción
            <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={2} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }} />
          </label>

          <div className="rounded-lg p-3 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--bg-inset)" }}>
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Formación por módulos secuenciales
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Varias partes que hay que ir aprobando una a una para desbloquear la siguiente, con su propio progreso dentro de la formación. Si lo desactivas, vuelve a ser una formación normal (un único vídeo/test).
              </div>
            </div>
            <button
              onClick={toggleModularMode}
              style={{
                width: 44, height: 24, borderRadius: 999, flexShrink: 0, position: "relative", border: "none", cursor: "pointer",
                backgroundColor: draft.modules && draft.modules.length > 0 ? "var(--brand)" : "#00000025",
                transition: "background-color 0.2s",
              }}
            >
              <span style={{ position: "absolute", top: 2, left: draft.modules && draft.modules.length > 0 ? 22 : 2, width: 20, height: 20, borderRadius: "50%", backgroundColor: "white", transition: "left 0.2s" }} />
            </button>
          </div>

          <div className="flex gap-4 flex-wrap">
            <div className="w-40">
              <TextInput label="Fecha límite" type="date" value={draft.deadline} onChange={(v) => setDraft((d) => ({ ...d, deadline: v }))} />
            </div>
            {(!draft.modules || draft.modules.length === 0) && draft.testMode !== "googleform" && (
              <div className="w-40">
                <TextInput label="% para aprobar el test" type="number" value={draft.passPct} onChange={(v) => setDraft((d) => ({ ...d, passPct: Number(v) }))} />
              </div>
            )}
            <div className="w-48">
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Caduca cada (meses, opcional)
                <input
                  type="number"
                  min="0"
                  value={draft.validityMonths || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, validityMonths: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="Ej. 12 — vacío = no caduca"
                  className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900"
                  style={{ borderColor: "#00000020" }}
                />
              </label>
            </div>
          </div>
          {draft.validityMonths > 0 && (
            <div className="text-[11px] text-gray-400 -mt-2">
              Pasados {draft.validityMonths} mes{draft.validityMonths === 1 ? "" : "es"} desde que alguien la complete, le volverá a aparecer como pendiente automáticamente (recertificación).
            </div>
          )}

          {draft.modules && draft.modules.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-gray-500 -mb-1">Módulos, en el orden en que se desbloquean</div>
              {draft.modules.map((mod, mi) => (
                <div key={mod.id} className="rounded-lg border p-3 space-y-2.5" style={{ borderColor: "#00000018", backgroundColor: "white" }}>
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 flex items-center justify-center rounded-full font-bold text-white text-xs" style={{ backgroundColor: "var(--brand)", width: 22, height: 22 }}>
                      {mi + 1}
                    </span>
                    <input
                      value={mod.title}
                      onChange={(e) => updateModuleField(mi, "title", e.target.value)}
                      placeholder={`Título del módulo ${mi + 1}`}
                      className="flex-1 text-sm font-semibold rounded-md border px-2 py-1.5"
                      style={{ borderColor: "#00000020" }}
                    />
                    <button disabled={mi === 0} onClick={() => moveModule(mi, -1)} className="text-gray-400 disabled:opacity-30" title="Subir">
                      <ChevronUp size={16} />
                    </button>
                    <button disabled={mi === draft.modules.length - 1} onClick={() => moveModule(mi, 1)} className="text-gray-400 disabled:opacity-30" title="Bajar">
                      <ChevronDown size={16} />
                    </button>
                    {draft.modules.length > 1 && (
                      <button onClick={() => removeModule(mi)} className="text-red-500" title="Eliminar módulo">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <textarea
                    value={mod.body}
                    onChange={(e) => updateModuleField(mi, "body", e.target.value)}
                    placeholder="Contenido / explicación de este módulo (texto)"
                    rows={3}
                    className="w-full text-xs rounded-md border px-2 py-1.5"
                    style={{ borderColor: "#00000018" }}
                  />
                  <input
                    value={mod.videoUrl}
                    onChange={(e) => updateModuleField(mi, "videoUrl", e.target.value)}
                    placeholder="URL de vídeo para este módulo (opcional)"
                    className="w-full text-xs rounded-md border px-2 py-1.5"
                    style={{ borderColor: "#00000018" }}
                  />

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-xs font-semibold text-gray-500">Test de este módulo</div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-gray-400 flex items-center gap-1">
                        % para aprobar
                        <input
                          type="number"
                          value={mod.passPct}
                          onChange={(e) => updateModuleField(mi, "passPct", Number(e.target.value))}
                          className="w-14 text-xs rounded-md border px-1.5 py-1"
                          style={{ borderColor: "#00000018" }}
                        />
                      </label>
                      <button onClick={() => addModuleQuestion(mi)} className="text-xs font-semibold flex items-center gap-1" style={{ color: BRAND.blue }}>
                        <Plus size={12} /> Pregunta
                      </button>
                    </div>
                  </div>

                  {mod.quiz.map((q, qi) => (
                    <div key={qi} className="rounded-md p-2 space-y-1.5" style={{ backgroundColor: "var(--bg-inset)" }}>
                      <div className="flex items-center gap-2">
                        <input
                          value={q.question}
                          onChange={(e) => updateModuleQuestion(mi, qi, "question", e.target.value)}
                          placeholder={`Pregunta ${qi + 1}`}
                          className="flex-1 text-xs rounded-md border px-2 py-1"
                          style={{ borderColor: "#00000018" }}
                        />
                        {mod.quiz.length > 1 && (
                          <button onClick={() => removeModuleQuestion(mi, qi)} className="text-red-500">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="radio" checked={q.correct === oi} onChange={() => updateModuleQuestion(mi, qi, "correct", oi)} className="flex-shrink-0" />
                          <input
                            value={opt}
                            onChange={(e) => updateModuleOption(mi, qi, oi, e.target.value)}
                            placeholder={`Opción ${oi + 1}`}
                            className="flex-1 text-xs rounded-md border px-2 py-1"
                            style={{ borderColor: "#00000015" }}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              <button onClick={addModule} className="text-sm font-semibold flex items-center gap-1.5" style={{ color: BRAND.red }}>
                <Plus size={15} /> Añadir otro módulo
              </button>
            </div>
          ) : (
            <>
              <TextInput label="URL del vídeo (YouTube o Vimeo)" value={draft.videoUrl} onChange={(v) => setDraft((d) => ({ ...d, videoUrl: v }))} placeholder="https://www.youtube.com/watch?v=..." />
              <TextInput label="URL de la presentación (link embebible)" value={draft.presentationUrl} onChange={(v) => setDraft((d) => ({ ...d, presentationUrl: v }))} placeholder="https://..." />

          <div>

            <div className="text-xs font-semibold text-gray-500 mb-2">Cómo se hace el test</div>
            <div className="flex gap-2 flex-wrap mb-2">
              {[
                { id: "interno", label: "Preguntas dentro de la app" },
                { id: "googleform", label: "Google Form (externo)" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setDraft((d) => ({ ...d, testMode: m.id }))}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: draft.testMode === m.id ? BRAND.red : "white",
                    color: draft.testMode === m.id ? "white" : BRAND.ink,
                    borderColor: draft.testMode === m.id ? BRAND.red : "#00000018",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {draft.testMode === "googleform" ? (
              <div className="rounded-lg border p-3" style={{ borderColor: "#00000018" }}>
                <TextInput
                  label="Enlace del Google Form"
                  value={draft.googleFormUrl}
                  onChange={(v) => setDraft((d) => ({ ...d, googleFormUrl: v }))}
                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                />
                <div className="text-[11px] text-gray-400 mt-1.5">
                  El formulario es totalmente tuyo — créalo, edítalo y cámbialo cuando quieras directamente en Google Forms, sin tocar esta app. La app solo lo muestra embebido y deja que la persona marque "completado" al terminar; no puede leer las respuestas ni corregirlo automáticamente. Si necesitas saber quién acertó qué, revisa las respuestas del propio Form (o su Hoja de cálculo vinculada), y usa "Marcar manualmente" en Seguimiento si quieres reflejarlo en la app.
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-gray-500">Preguntas del test</div>
                  <button onClick={addQuestion} className="text-xs font-semibold flex items-center gap-1" style={{ color: BRAND.blue }}>
                    <Plus size={13} /> Añadir pregunta
                  </button>
                </div>
                <div className="space-y-3">
                  {draft.quiz.map((q, qi) => (
                    <div key={qi} className="rounded-lg border p-3" style={{ borderColor: "#00000018" }}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <input value={q.question} onChange={(e) => updateQuizQuestion(qi, "question", e.target.value)} placeholder={`Pregunta ${qi + 1}`} className="flex-1 text-sm rounded-md border px-2 py-1.5" style={{ borderColor: "#00000020" }} />
                        {draft.quiz.length > 1 && (
                          <button onClick={() => removeQuestion(qi)} className="text-red-500">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input type="radio" checked={q.correct === oi} onChange={() => updateQuizQuestion(qi, "correct", oi)} className="flex-shrink-0" />
                            <input value={opt} onChange={(e) => updateQuizOption(qi, oi, e.target.value)} placeholder={`Opción ${oi + 1}`} className="flex-1 text-sm rounded-md border px-2 py-1" style={{ borderColor: "#00000018" }} />
                          </div>
                        ))}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1">Marca con el círculo cuál es la respuesta correcta.</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
            </>
          )}

          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">Asignar formación a</div>
            <div className="flex gap-2 flex-wrap mb-2">
              {[
                { id: "todos", label: "Todos los empleados" },
                { id: "grupos", label: "Grupos concretos" },
                { id: "individual", label: "Personas concretas" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setAssignmentMode(m.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: draft.assignment.mode === m.id ? BRAND.red : "white",
                    color: draft.assignment.mode === m.id ? "white" : BRAND.ink,
                    borderColor: draft.assignment.mode === m.id ? BRAND.red : "#00000018",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {draft.assignment.mode === "grupos" && (
              <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: "#00000018" }}>
                {groups.length === 0 ? (
                  <div className="text-xs text-gray-400">No hay grupos creados todavía. Créalos en la pestaña "Grupos".</div>
                ) : (
                  groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={(draft.assignment.groupIds || []).includes(g.id)} onChange={() => toggleAssignGroup(g.id)} />
                      {g.name} <span className="text-[11px] text-gray-400">({(g.memberNames || []).length} personas)</span>
                    </label>
                  ))
                )}
              </div>
            )}

            {draft.assignment.mode === "individual" && (
              <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: "#00000018" }}>
                {employees.length === 0 ? (
                  <div className="text-xs text-gray-400">No hay empleados registrados todavía.</div>
                ) : (
                  <>
                    {employees.length > 8 && (
                      <input
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        placeholder="Buscar por nombre..."
                        className="w-full text-xs rounded-md border px-2 py-1.5 mb-1.5"
                        style={{ borderColor: "#00000020" }}
                      />
                    )}
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {employees
                        .filter((e) => e.name.toLowerCase().includes(assignSearch.trim().toLowerCase()))
                        .map((e) => (
                          <label key={e.name} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={(draft.assignment.employeeNames || []).includes(e.name)} onChange={() => toggleAssignEmployee(e.name)} />
                            {e.name}
                          </label>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1.5">Adjuntar documento (PDF, Word, imagen... máx. ~3,5 MB)</div>
            <input type="file" onChange={handleFileInput} accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*" className="text-sm" />
            {fileError && <div className="text-xs text-red-600 mt-1.5">{fileError}</div>}
            <div className="text-[11px] text-gray-400 mt-1">
              Para vídeo o archivos más grandes: pégalo como enlace arriba (YouTube, Vimeo, SharePoint, Drive).
            </div>
            {(draft.attachments || []).length > 0 && (
              <div className="space-y-1.5 mt-2">
                {draft.attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm rounded-md border px-2 py-1.5" style={{ borderColor: "#00000018" }}>
                    <span className="truncate flex items-center gap-1.5">
                      <FileText size={13} style={{ color: BRAND.blue }} /> {a.name} <span className="text-[11px] text-gray-400">({a.sizeKB} KB)</span>
                    </span>
                    <button onClick={() => removeDraftAttachment(a.id)} className="text-red-500 flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button disabled={!canSave() || saving} onClick={handleSave} className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 transition-all duration-150 active:scale-[0.98]" style={{ backgroundColor: BRAND.red }}>
              {saving ? "Guardando..." : "Guardar formación"}
            </button>
            <button
              onClick={() => {
                resetDraft();
                setTab("courses");
              }}
              className="text-sm font-semibold rounded-md px-4 py-2"
              style={{ color: BRAND.ink }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {tab === "paths" && mode !== "team" && (
        <PathsAdminTab paths={paths} courses={courses} groups={groups} employees={employees} onSavePath={onSavePath} onDeletePath={onDeletePath} />
      )}

      {tab === "news" && mode !== "team" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 space-y-3 shadow-sm" style={{ borderColor: "#00000012" }}>
            {editingNewsId && (
              <div className="text-xs font-semibold rounded-md px-3 py-2" style={{ backgroundColor: "var(--info-soft)", color: "var(--info-text)" }}>
                Editando novedad existente
              </div>
            )}
            <TextInput label="Título de la novedad" value={newNewsTitle} onChange={setNewNewsTitle} placeholder="Ej. Nueva formación disponible" />
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Contenido
              <textarea value={newNewsBody} onChange={(e) => setNewNewsBody(e.target.value)} rows={2} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }} />
            </label>

            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1.5">Vincular a (opcional — para que se pueda pinchar y llevar directo)</div>
              <div className="flex gap-2 flex-wrap mb-2">
                {[
                  { id: "none", label: "Nada" },
                  { id: "course", label: "Una formación" },
                  { id: "category", label: "Un campo" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setNewNewsLinkType(opt.id);
                      setNewNewsLinkId("");
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                    style={{
                      backgroundColor: newNewsLinkType === opt.id ? BRAND.red : "white",
                      color: newNewsLinkType === opt.id ? "white" : BRAND.ink,
                      borderColor: newNewsLinkType === opt.id ? BRAND.red : "#00000018",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {newNewsLinkType === "course" && (
                <select value={newNewsLinkId} onChange={(e) => setNewNewsLinkId(e.target.value)} className="w-full text-sm rounded-md border px-3 py-2 text-gray-900" style={{ borderColor: "#00000020" }}>
                  <option value="">Selecciona una formación...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}
              {newNewsLinkType === "category" && (
                <select value={newNewsLinkId} onChange={(e) => setNewNewsLinkId(e.target.value)} className="w-full text-sm rounded-md border px-3 py-2 text-gray-900" style={{ borderColor: "#00000020" }}>
                  <option value="">Selecciona un campo...</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={!newNewsTitle.trim() || (newNewsLinkType !== "none" && !newNewsLinkId)}
                onClick={() => {
                  const fields = {
                    title: newNewsTitle,
                    body: newNewsBody,
                    linkType: newNewsLinkType === "none" ? null : newNewsLinkType,
                    linkId: newNewsLinkType === "none" ? null : newNewsLinkId,
                  };
                  if (editingNewsId) {
                    onUpdateNews(editingNewsId, fields);
                    setEditingNewsId(null);
                  } else {
                    onAddNews({ id: uid(), date: todayISO(), ...fields });
                  }
                  setNewNewsTitle("");
                  setNewNewsBody("");
                  setNewNewsLinkType("none");
                  setNewNewsLinkId("");
                }}
                className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40"
                style={{ backgroundColor: BRAND.red }}
              >
                {editingNewsId ? "Guardar cambios" : "Publicar novedad"}
              </button>
              {editingNewsId && (
                <button
                  onClick={() => {
                    setEditingNewsId(null);
                    setNewNewsTitle("");
                    setNewNewsBody("");
                    setNewNewsLinkType("none");
                    setNewNewsLinkId("");
                  }}
                  className="text-sm font-semibold px-3 py-2"
                  style={{ color: BRAND.ink }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {news.map((n) => {
              const linkedCourse = n.linkType === "course" ? courses.find((c) => c.id === n.linkId) : null;
              const linkedCategory = n.linkType === "category" ? categoryMeta(n.linkId) : null;
              return (
                <div key={n.id} className="flex items-start justify-between gap-2 rounded-lg border bg-white p-3 shadow-sm" style={{ borderColor: "#00000012" }}>
                  <div>
                    <div className="font-semibold text-sm">{n.title}</div>
                    <div className="text-xs text-gray-500">{n.body}</div>
                    <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2">
                      {n.date}
                      {linkedCourse && <span className="text-blue-600 font-semibold">→ {linkedCourse.title}</span>}
                      {linkedCategory && <span className="text-blue-600 font-semibold">→ {linkedCategory.label}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingNewsId(n.id);
                        setNewNewsTitle(n.title);
                        setNewNewsBody(n.body || "");
                        setNewNewsLinkType(n.linkType || "none");
                        setNewNewsLinkId(n.linkId || "");
                      }}
                      className="text-xs font-semibold"
                      style={{ color: BRAND.blue }}
                    >
                      Editar
                    </button>
                    <button onClick={() => onDeleteNews(n.id)} className="text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "employees" && mode !== "team" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 flex items-end gap-2 flex-wrap shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="flex-1 min-w-[160px]">
              <TextInput label="Nombre del empleado" value={newEmployeeName} onChange={setNewEmployeeName} placeholder="Nombre y apellido" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <TextInput label="Email" value={newEmployeeEmail} onChange={setNewEmployeeEmail} placeholder="nombre@munozbosch.com" type="email" />
            </div>
            <button
              disabled={!newEmployeeName.trim() || !newEmployeeEmail.trim()}
              onClick={() => {
                onAddEmployee(newEmployeeName, newEmployeeEmail);
                setNewEmployeeName("");
                setNewEmployeeEmail("");
              }}
              className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 mb-1"
              style={{ backgroundColor: BRAND.red }}
            >
              Añadir
            </button>
          </div>
          <div className="text-[11px] text-gray-400 -mt-2">
            No hace falta poner contraseña aquí — cada persona crea la suya en su primer acceso, verificando este email.
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="font-bold text-sm mb-1 flex items-center gap-2">
              <FileSpreadsheet size={16} style={{ color: BRAND.blue }} />
              Importar varios de golpe desde Excel
            </div>
            <div className="text-xs text-gray-500 mb-3">
              Sube un archivo .xlsx o .csv con columnas <strong>Nombre</strong> (obligatoria), y opcionalmente{" "}
              <strong>Email</strong> y <strong>Equipo</strong>. No hace falta contraseña — cada persona crea la suya en
              su primer acceso, verificando el email que pongas aquí. Si la columna Equipo nombra un grupo que no
              existe todavía, se crea solo.
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                setImportFileError("");
                setImportDone(null);
                const { rows, error } = await parseEmployeeExcelFile(file);
                if (error) {
                  setImportFileError(error);
                  setImportPreviewRows(null);
                } else if (rows.length === 0) {
                  setImportFileError("No se encontró ninguna fila con nombre.");
                  setImportPreviewRows(null);
                } else {
                  setImportPreviewRows(rows);
                }
                e.target.value = "";
              }}
              className="text-sm"
            />
            {importFileError && <div className="text-xs text-red-600 mt-2">{importFileError}</div>}

            {importPreviewRows && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-gray-500 mb-2">
                  Previsualización — {importPreviewRows.length} persona{importPreviewRows.length === 1 ? "" : "s"}. Revisa
                  antes de confirmar.
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border" style={{ borderColor: "#00000018" }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b sticky top-0 bg-white" style={{ borderColor: "#00000012" }}>
                        <th className="px-2 py-1.5">Nombre</th>
                        <th className="px-2 py-1.5">Email</th>
                        <th className="px-2 py-1.5">Equipo</th>
                        <th className="px-2 py-1.5">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreviewRows.map((r, i) => {
                        const exists = employees.some((e) => e.name.trim().toLowerCase() === r.name.trim().toLowerCase());
                        return (
                          <tr key={i} className="border-b last:border-0" style={{ borderColor: "#00000008" }}>
                            <td className="px-2 py-1.5 font-medium">{r.name}</td>
                            <td className="px-2 py-1.5 text-gray-500">{r.email || "—"}</td>
                            <td className="px-2 py-1.5 text-gray-500">{r.equipo || "—"}</td>
                            <td className="px-2 py-1.5">
                              {exists ? (
                                <span className="text-amber-700 font-semibold">Ya existe — se actualiza</span>
                              ) : (
                                <span className="text-green-700 font-semibold">Nuevo</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    disabled={importing}
                    onClick={async () => {
                      setImporting(true);
                      await onImportEmployeesBulk(importPreviewRows);
                      setImportDone(importPreviewRows);
                      setImportPreviewRows(null);
                      setImporting(false);
                    }}
                    className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 flex items-center gap-1.5"
                    style={{ backgroundColor: BRAND.red }}
                  >
                    {importing && <Loader2 size={14} className="animate-spin" />}
                    <Upload size={14} />
                    Confirmar importación
                  </button>
                  <button
                    onClick={() => setImportPreviewRows(null)}
                    className="text-sm font-semibold rounded-md px-4 py-2 border"
                    style={{ borderColor: "#00000020", color: BRAND.ink }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {importDone && (
              <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: "#DCFCE7" }}>
                <div className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Importación completada — {importDone.length} persona{importDone.length === 1 ? "" : "s"}
                </div>
                <div className="text-xs text-green-800 mt-1">
                  Ya pueden entrar con su nombre y crear su contraseña verificando el email que has importado.
                </div>
              </div>
            )}
          </div>

          {employees.length > 8 && (
            <input
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder={`Buscar entre ${employees.length} empleados...`}
              className="w-full text-sm rounded-md border px-3 py-2"
              style={{ borderColor: "#00000020" }}
            />
          )}

          <div className="space-y-1.5">
            {employees.length === 0 && <div className="text-sm text-gray-400">Sin empleados añadidos.</div>}
            {employees
              .filter((e) => e.name.toLowerCase().includes(employeeSearch.trim().toLowerCase()))
              .map((e) => (
                <div key={e.name} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 flex-wrap" style={{ borderColor: "#00000012" }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={e.name} size={30} />
                    <div className="min-w-0">
                      {editingNameFor === e.name ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            value={editingNameValue}
                            onChange={(ev) => {
                              setEditingNameValue(ev.target.value);
                              setRenameError("");
                            }}
                            onKeyDown={async (ev) => {
                              if (ev.key === "Enter") {
                                const res = await onRenameEmployee(e.name, editingNameValue);
                                if (res.ok) setEditingNameFor(null);
                                else setRenameError(res.error);
                              }
                            }}
                            className="text-sm rounded-md border px-2 py-1 w-40"
                            style={{ borderColor: "#00000020" }}
                            autoFocus
                          />
                          <button
                            onClick={async () => {
                              const res = await onRenameEmployee(e.name, editingNameValue);
                              if (res.ok) setEditingNameFor(null);
                              else setRenameError(res.error);
                            }}
                            className="text-[11px] font-semibold"
                            style={{ color: BRAND.blue }}
                          >
                            Guardar
                          </button>
                          <button onClick={() => { setEditingNameFor(null); setRenameError(""); }} className="text-[11px] text-gray-400">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="text-sm font-medium truncate">{e.name}</div>
                          <button
                            onClick={() => {
                              setEditingNameFor(e.name);
                              setEditingNameValue(e.name);
                              setRenameError("");
                            }}
                            title="Cambiar nombre"
                            className="text-gray-300 hover:text-gray-500 flex-shrink-0"
                          >
                            <Settings size={11} />
                          </button>
                        </div>
                      )}
                      {renameError && editingNameFor === e.name && <div className="text-[10px] text-red-600 mt-0.5">{renameError}</div>}
                      {editingEmailFor === e.name ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <input
                            value={editingEmailValue}
                            onChange={(ev) => setEditingEmailValue(ev.target.value)}
                            placeholder="nombre@munozbosch.com"
                            className="text-xs rounded-md border px-2 py-1 w-40"
                            style={{ borderColor: "#00000020" }}
                          />
                          <button
                            onClick={() => {
                              onUpdateEmployeeEmail(e.name, editingEmailValue);
                              setEditingEmailFor(null);
                            }}
                            className="text-[11px] font-semibold"
                            style={{ color: BRAND.blue }}
                          >
                            Guardar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingEmailFor(e.name);
                            setEditingEmailValue(e.email || "");
                          }}
                          className="text-[11px] text-gray-400 hover:underline truncate block"
                        >
                          {e.email || "Sin email — añadir"} <span style={{ opacity: 0.6 }}>(editar)</span>
                        </button>
                      )}
                    </div>
                    {!e.passwordHash && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 flex-shrink-0">Sin contraseña todavía</span>}
                    {mode !== "team" && (e.managedGroupIds || []).length > 0 && (
                      <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0" style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}>
                        Responsable de {e.managedGroupIds.length} equipo{e.managedGroupIds.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {mode !== "team" && (
                      <button
                        onClick={() => setEditingManagedGroupsFor(editingManagedGroupsFor === e.name ? null : e.name)}
                        className="text-xs font-semibold"
                        style={{ color: BRAND.blue }}
                      >
                        Responsable de…
                      </button>
                    )}
                    {e.passwordHash && (
                      <button
                        onClick={() => onResetEmployeePassword(e.name)}
                        className="text-xs font-semibold"
                        style={{ color: BRAND.blue }}
                        title="Borra su contraseña actual; en su próximo acceso deberá crear una nueva verificando su email"
                      >
                        Restablecer contraseña
                      </button>
                    )}
                    <button onClick={() => onRemoveEmployee(e.name)} className="text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {editingManagedGroupsFor === e.name && (
                    <div style={{ ...DS.card, padding: "var(--sp-3)", width: "100%", marginTop: "var(--sp-2)" }}>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--sp-2)" }}>
                        Hacer a {e.name} responsable de estos equipos (verá "Mi equipo" al entrar, y podrá subir formaciones para cualquier equipo):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {groups.length === 0 && <div className="text-xs text-gray-400">Crea grupos primero, en la pestaña Grupos.</div>}
                        {groups.map((g) => {
                          const checked = (e.managedGroupIds || []).includes(g.id);
                          return (
                            <label key={g.id} className="flex items-center gap-1.5 text-xs" style={{ cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const current = e.managedGroupIds || [];
                                  const next = checked ? current.filter((id) => id !== g.id) : [...current, g.id];
                                  onUpdateEmployeeManagedGroups(e.name, next);
                                }}
                              />
                              {g.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {tab === "groups" && mode !== "team" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 flex items-end gap-2 flex-wrap shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="flex-1 min-w-[200px]">
              <TextInput label="Nombre del grupo" value={newGroupName} onChange={setNewGroupName} placeholder="Ej. Administración, Aprovisionamiento..." />
            </div>
            <button
              disabled={!newGroupName.trim()}
              onClick={() => {
                onAddGroup(newGroupName);
                setNewGroupName("");
              }}
              className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 mb-1"
              style={{ backgroundColor: BRAND.red }}
            >
              Crear grupo
            </button>
          </div>

          {groups.length === 0 && <div className="text-sm text-gray-400">No hay grupos creados todavía.</div>}

          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.id} className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-sm flex items-center gap-2">
                    <Users size={15} style={{ color: BRAND.blue }} />
                    {g.name}
                    <span className="text-[11px] font-normal text-gray-400">({(g.memberNames || []).length} personas)</span>
                  </div>
                  <button onClick={() => onDeleteGroup(g.id)} className="text-red-500 flex items-center gap-1 text-xs font-semibold">
                    <Trash2 size={13} /> Eliminar grupo
                  </button>
                </div>
                {employees.length === 0 ? (
                  <div className="text-xs text-gray-400">Añade empleados primero desde la pestaña Empleados.</div>
                ) : (
                  <>
                    {employees.length > 8 && (
                      <input
                        value={groupMemberSearch[g.id] || ""}
                        onChange={(e) => setGroupMemberSearch((prev) => ({ ...prev, [g.id]: e.target.value }))}
                        placeholder="Buscar por nombre..."
                        className="w-full text-xs rounded-md border px-2 py-1.5 mb-2"
                        style={{ borderColor: "#00000020" }}
                      />
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1">
                      {employees
                        .filter((e) => e.name.toLowerCase().includes((groupMemberSearch[g.id] || "").trim().toLowerCase()))
                        .map((e) => {
                          const isMember = (g.memberNames || []).includes(e.name);
                          return (
                            <label key={e.name} className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={isMember}
                                onChange={() => {
                                  const next = isMember ? g.memberNames.filter((n) => n !== e.name) : [...(g.memberNames || []), e.name];
                                  onUpdateGroupMembers(g.id, next);
                                }}
                              />
                              {e.name}
                            </label>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "seguimiento" && mode !== "team" && (
        <div className="space-y-3">
          <button
            onClick={onLoadTracking}
            disabled={loadingTracking}
            className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 flex items-center gap-2 transition-all duration-150 active:scale-[0.98]"
            style={{ backgroundColor: BRAND.red }}
          >
            {loadingTracking && <Loader2 size={14} className="animate-spin" />}
            {loadingTracking ? "Cargando..." : "Cargar / actualizar seguimiento"}
          </button>
          <div className="text-[11px] text-gray-400">
            Con muchos empleados y formaciones esto puede tardar unos segundos — cada formación guarda su progreso por separado, precisamente para que nadie pierda datos si varias personas terminan un test a la vez.
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="font-bold text-sm mb-1">Marcar manualmente</div>
            <div className="text-xs text-gray-500 mb-3">
              Útil para formaciones con Google Form externo (revisas sus respuestas tú y confirmas aquí) o para corregir cualquier registro a mano.
            </div>
            <div className="flex gap-2 flex-wrap items-end">
              <label className="block text-xs font-semibold text-gray-500 flex-1 min-w-[160px]">
                Formación
                <select value={manualCourseId} onChange={(e) => setManualCourseId(e.target.value)} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }}>
                  <option value="">Selecciona...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-500 flex-1 min-w-[160px]">
                Empleado
                <select value={manualEmployeeName} onChange={(e) => setManualEmployeeName(e.target.value)} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }}>
                  <option value="">Selecciona...</option>
                  {employees.map((e) => (
                    <option key={e.name} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={!manualCourseId || !manualEmployeeName}
                onClick={() => onManualSetStatus(manualCourseId, manualEmployeeName, "completada")}
                className="text-sm font-bold rounded-md px-3 py-2 text-white disabled:opacity-40"
                style={{ backgroundColor: BRAND.red }}
              >
                Marcar completada
              </button>
              <button
                disabled={!manualCourseId || !manualEmployeeName}
                onClick={() => onManualSetStatus(manualCourseId, manualEmployeeName, "pendiente")}
                className="text-sm font-semibold rounded-md px-3 py-2 border disabled:opacity-40"
                style={{ borderColor: "#00000020", color: BRAND.ink }}
              >
                Marcar pendiente
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden shadow-sm" style={{ borderColor: "#00000012" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b" style={{ borderColor: "#00000012" }}>
                  <th className="px-3 py-2">Empleado</th>
                  <th className="px-3 py-2">Formación</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Nota</th>
                  <th className="px-3 py-2">Intentos</th>
                </tr>
              </thead>
              <tbody>
                {completionRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                      Todavía no hay actividad cargada. Pulsa "Cargar / actualizar seguimiento".
                    </td>
                  </tr>
                )}
                {completionRows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: "#00000008" }}>
                    <td className="px-3 py-2 font-medium">{r.employee}</td>
                    <td className="px-3 py-2">{r.courseTitle}</td>
                    <td className="px-3 py-2">
                      {r.status === "completada" ? (
                        <span className="text-green-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={13} /> Completada
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold">En progreso</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{r.score != null ? `${r.score}%` : "—"}</td>
                    <td className="px-3 py-2">{r.attempts || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "team" && mode === "team" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--sp-2)" }}>
              Miembros de tu equipo ({teamEmployees.length})
            </div>
            <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-3)", flexWrap: "wrap" }}>
              <input
                value={teamNewMemberName}
                onChange={(e) => setTeamNewMemberName(e.target.value)}
                placeholder="Nombre de la persona a añadir a tu equipo"
                className="text-sm rounded-md border px-3 py-2"
                style={{ borderColor: "#00000020", minWidth: 260 }}
              />
              <button
                disabled={!teamNewMemberName.trim()}
                onClick={() => {
                  const name = teamNewMemberName.trim();
                  const exists = employees.some((e) => e.name.trim().toLowerCase() === name.toLowerCase());
                  if (!exists) {
                    onAddEmployee(name, "");
                  }
                  for (const gid of restrictToGroupIds) {
                    const g = groups.find((gr) => gr.id === gid);
                    if (g && !g.memberNames.includes(name)) {
                      onUpdateGroupMembers(gid, [...g.memberNames, name]);
                    }
                  }
                  setTeamNewMemberName("");
                }}
                style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 14px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: !teamNewMemberName.trim() ? 0.4 : 1 }}
              >
                Añadir a mi equipo
              </button>
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
              Si la persona ya existe en la aplicación, se añade a tu equipo. Si es nueva, se crea sin contraseña — la creará ella misma en su primer acceso.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              {teamEmployees.length === 0 && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Todavía no tienes a nadie en tu equipo.</div>}
              {teamEmployees.map((e) => (
                <div key={e.name} style={{ ...DS.card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--sp-2) var(--sp-3)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={e.name} size={26} />
                    <div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{e.name}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{e.email || "Sin email"}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      for (const gid of restrictToGroupIds) {
                        const g = groups.find((gr) => gr.id === gid);
                        if (g) onUpdateGroupMembers(gid, g.memberNames.filter((n) => n !== e.name));
                      }
                    }}
                    style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--danger)", border: "none", background: "none", cursor: "pointer" }}
                  >
                    Quitar de mi equipo
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--sp-3)" }}>
              Cumplimiento de tu equipo
            </div>
            {teamCompletionRows.length === 0 ? (
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Todavía no hay progreso registrado en tu equipo.</div>
            ) : (
              <div style={{ ...DS.card, overflow: "auto" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                      <th className="px-3 py-2">Persona</th>
                      <th className="px-3 py-2">Formación</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamCompletionRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-3 py-2">{r.employee}</td>
                        <td className="px-3 py-2">{r.courseTitle}</td>
                        <td className="px-3 py-2">
                          {r.status === "completada" ? (
                            <span style={{ color: "var(--success)", fontWeight: 600 }}>Completada</span>
                          ) : (
                            <span style={{ color: "var(--warning)", fontWeight: 600 }}>En progreso</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{r.score != null ? `${r.score}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "reviews" && mode !== "team" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            Valoraciones y comentarios que ha dejado cada persona al completar una formación.
          </div>
          {courses.filter((c) => avgRatingByCourse[c.id]).length === 0 ? (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Todavía no hay ninguna valoración registrada.</div>
          ) : (
            courses
              .filter((c) => avgRatingByCourse[c.id])
              .map((c) => {
                const entries = Object.entries(completionsByCourse[c.id] || {}).filter(([, r]) => typeof r.rating === "number" && r.rating > 0);
                return (
                  <div key={c.id} style={{ ...DS.card, padding: "var(--sp-4)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: "var(--sp-3)", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{c.title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--warning)" }}>
                        <Star size={14} fill="var(--warning)" /> {avgRatingByCourse[c.id].avg.toFixed(1)}
                        <span style={{ fontSize: "var(--text-xs)", fontWeight: 400, color: "var(--text-muted)" }}>
                          ({avgRatingByCourse[c.id].count} valoración{avgRatingByCourse[c.id].count === 1 ? "" : "es"})
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                      {entries.map(([name, r]) => (
                        <div key={name} style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--sp-2)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Avatar name={name} size={22} />
                              <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{name}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ display: "flex", gap: 1 }}>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Star key={n} size={12} fill={r.rating >= n ? "var(--warning)" : "none"} color={r.rating >= n ? "var(--warning)" : "var(--border-strong)"} />
                                ))}
                              </div>
                              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{r.ratedAt || ""}</span>
                            </div>
                          </div>
                          {r.ratingComment && (
                            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 4, marginLeft: 30, fontStyle: "italic" }}>
                              "{r.ratingComment}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}

      {tab === "notificaciones" && mode !== "team" && (
        <div className="space-y-4">
          <button
            onClick={onLoadTracking}
            disabled={loadingTracking}
            className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 flex items-center gap-2 transition-all duration-150 active:scale-[0.98]"
            style={{ backgroundColor: BRAND.red }}
          >
            {loadingTracking && <Loader2 size={14} className="animate-spin" />}
            {loadingTracking ? "Cargando..." : "Actualizar lista de pendientes"}
          </button>

          <div className="rounded-xl border bg-white overflow-hidden shadow-sm" style={{ borderColor: "#00000012" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b" style={{ borderColor: "#00000012" }}>
                  <th className="px-3 py-2">Empleado</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Formación</th>
                  <th className="px-3 py-2">Fecha límite</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pendingReportRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                      Nadie tiene formaciones pendientes ahora mismo (o falta pulsar "Actualizar lista de pendientes").
                    </td>
                  </tr>
                )}
                {pendingReportRows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: "#00000008" }}>
                    <td className="px-3 py-2 font-medium">{r.nombre}</td>
                    <td className="px-3 py-2 text-gray-500">{r.email || <span className="text-amber-600">sin email</span>}</td>
                    <td className="px-3 py-2">{r.formacion}</td>
                    <td className="px-3 py-2">{r.fechaLimite || "—"}</td>
                    <td className="px-3 py-2">
                      {r.estado === "Vencida" ? (
                        <span className="text-red-700 font-semibold">Vencida ({Math.abs(r.diasRestantes)}d)</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-3 shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="font-bold text-sm">Enviar avisos por correo (Outlook)</div>
            <div className="text-xs text-gray-500">
              Esta app no puede enviar correos por sí sola. Para avisos automáticos de verdad, la vía recomendada es un Google Apps Script con un disparador programado que lea una Hoja de cálculo y envíe los correos — pídeme el script y las instrucciones de despliegue. Mientras tanto, puedes:
            </div>
            <button
              onClick={() => downloadCsv(pendingReportRows)}
              disabled={pendingReportRows.length === 0}
              className="text-sm font-semibold rounded-md px-4 py-2 border disabled:opacity-40"
              style={{ borderColor: BRAND.red, color: BRAND.red }}
            >
              Descargar CSV para Google Sheets
            </button>

            <div className="border-t pt-3" style={{ borderColor: "#00000012" }}>
              <div className="text-xs font-semibold text-gray-500 mb-1">
                Sincronización automática (experimental)
              </div>
              <div className="text-[11px] text-gray-400 mb-2">
                Pega aquí la URL de un Google Apps Script publicado como "Aplicación web". Al pulsar "Sincronizar" el navegador intentará enviarle la lista directamente. Puede fallar por CORS (Apps Script debe devolver las cabeceras adecuadas) — si falla, usa el CSV de arriba, que siempre funciona.
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <input
                  value={sheetsUrlDraft}
                  onChange={(e) => setSheetsUrlDraft(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="flex-1 min-w-[220px] text-sm rounded-md border px-3 py-2"
                  style={{ borderColor: "#00000020" }}
                />
                <button onClick={() => onSaveSheetsUrl(sheetsUrlDraft)} className="text-xs font-semibold px-3 py-2 rounded-md border" style={{ borderColor: "#00000020", color: BRAND.ink }}>
                  Guardar URL
                </button>
                <button
                  disabled={!sheetsUrl || syncStatus === "loading"}
                  onClick={async () => {
                    setSyncStatus("loading");
                    try {
                      const res = await fetch(sheetsUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rows: pendingReportRows }),
                      });
                      setSyncStatus(res.ok ? "ok" : "error");
                    } catch {
                      setSyncStatus("error");
                    }
                  }}
                  className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40"
                  style={{ backgroundColor: BRAND.red }}
                >
                  {syncStatus === "loading" ? "Enviando..." : "Sincronizar ahora"}
                </button>
              </div>
              {syncStatus === "ok" && <div className="text-xs text-green-700 font-semibold mt-2">Enviado correctamente.</div>}
              {syncStatus === "error" && (
                <div className="text-xs text-red-600 font-semibold mt-2">
                  No se pudo enviar (puede ser un bloqueo de CORS del script de Google, o la URL/despliegue no es correcto). Usa el CSV como alternativa segura.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "backup" && mode !== "team" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="font-bold text-sm mb-1">Estado de la copia de seguridad</div>
            <div className="text-xs text-gray-500 mb-3">
              {lastBackupAt
                ? `Última copia exportada: ${new Date(lastBackupAt).toLocaleString("es-ES")}`
                : "Todavía no has exportado ninguna copia de seguridad."}
            </div>
            <div className="text-[11px] text-gray-400 rounded-md p-2.5 mb-3" style={{ backgroundColor: "#00000008" }}>
              Esto descarga un archivo a tu ordenador con todo lo que hay guardado ahora mismo. Guárdalo en SharePoint, Drive o donde tengáis vuestras copias — cuanto más lejos de este mismo sistema, mejor protegido está. El archivo incluye las contraseñas cifradas (hash) de acceso: no son legibles directamente, pero trátalo igualmente como información sensible.
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  await onExportBackup(false);
                  setExporting(false);
                }}
                className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40"
                style={{ backgroundColor: BRAND.red }}
              >
                {exporting ? "Exportando..." : "Exportar copia (rápida)"}
              </button>
              <button
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  await onExportBackup(true);
                  setExporting(false);
                }}
                className="text-sm font-semibold rounded-md px-4 py-2 border disabled:opacity-40"
                style={{ borderColor: BRAND.red, color: BRAND.red }}
              >
                {exporting ? "Exportando..." : "Exportar copia completa (con documentos adjuntos)"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="font-bold text-sm mb-1">Restaurar desde una copia</div>
            <div className="text-xs text-gray-500 mb-3">
              Sube un archivo exportado desde aquí. Esto reemplaza todos los datos actuales — formaciones, empleados, grupos, novedades y progreso — por los del archivo.
            </div>
            <input
              type="file"
              accept="application/json"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                setImportError("");
                try {
                  const text = await file.text();
                  const parsed = JSON.parse(text);
                  setImportPending(parsed);
                } catch {
                  setImportError("No se pudo leer el archivo. Comprueba que sea una copia de seguridad exportada desde aquí.");
                }
                e.target.value = "";
              }}
              className="text-sm"
            />
            {importError && <div className="text-xs text-red-600 mt-2">{importError}</div>}
            {importPending && (
              <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: "#FEE2E2" }}>
                <div className="text-sm font-semibold text-red-800 mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> ¿Restaurar esta copia?
                </div>
                <div className="text-xs text-red-700 mb-2">
                  Copia del {payloadDate(importPending)}. Esto sobrescribirá todos los datos actuales. Esta acción no se puede deshacer.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await onImportBackup(importPending);
                      setImportPending(null);
                    }}
                    className="text-xs font-bold rounded-md px-3 py-1.5 text-white"
                    style={{ backgroundColor: BRAND.red }}
                  >
                    Confirmar restauración
                  </button>
                  <button onClick={() => setImportPending(null)} className="text-xs font-semibold rounded-md px-3 py-1.5" style={{ color: BRAND.ink }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function payloadDate(payload) {
  try {
    return new Date(payload.exportedAt).toLocaleString("es-ES");
  } catch {
    return "fecha desconocida";
  }
}

function toCsv(rows) {
  const headers = ["Nombre", "Email", "Formacion", "Categoria", "FechaLimite", "DiasRestantes", "Estado"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const vals = [r.nombre, r.email, r.formacion, r.categoria, r.fechaLimite, r.diasRestantes ?? "", r.estado];
    lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(rows) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pendientes-formacion-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
