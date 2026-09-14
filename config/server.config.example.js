// ============================================================================
// CONFIGURACIÓN DEL SERVIDOR — Aula Virtual Muñoz Bosch
// ============================================================================
// Este archivo reúne TODOS los datos sensibles en un solo sitio, tal como
// pidió Lisbet — nunca se sube a GitHub (por eso el nombre termina en
// ".example.js": esta es la plantilla, sin datos reales; la copia con los
// datos de verdad se llama "server.config.js", sin ".example", y esa NUNCA
// se sube a ningún sitio público).
//
// Solo la gestiona quien tenga acceso al servidor — hoy, Lisbet y David.
// ============================================================================


// ---------------------------------------------------------------------------
// FASE 8 — Servidor donde corre la aplicación
// ---------------------------------------------------------------------------
export const APP_SERVER = {
  operatingSystem: "",
  nodeJsAllowed: null,
  internalIp: "",
  port: 3000,
};


// ---------------------------------------------------------------------------
// FASE 2 — Base de datos SQL Server
// ---------------------------------------------------------------------------
export const SQL_SERVER = {
  host: "",
  port: 1433,
  databaseName: "",
  // Usuario específico para esta app (NUNCA un usuario "sysadmin")
  user: "",
  password: "",
};


// ---------------------------------------------------------------------------
// FASE 3 — Servidor de vídeos
// ---------------------------------------------------------------------------
export const VIDEO_SERVER = {
  // Ruta LOCAL en este servidor donde está montada la carpeta compartida de
  // vídeos (ej. "Z:\\videos" en Windows, o "/mnt/videos" en Linux)
  address: "",
  folderStructureNotes: "",
};


// ---------------------------------------------------------------------------
// FASE 5 — Dominio propio
// ---------------------------------------------------------------------------
export const DOMAIN = {
  internalHostname: "",
};


// ---------------------------------------------------------------------------
// FASE 4 — Microsoft 365 / Azure AD
// ---------------------------------------------------------------------------
export const MICROSOFT_AUTH = {
  clientId: "",
  tenantId: "",
  adminGroupOrAccounts: "",
};
