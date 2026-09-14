// Aviso visible de errores de guardado: la app se suscribe a esto para mostrar
// un banner cuando el servidor rechaza una lectura/escritura, en vez de
// fallar en silencio (que es lo que ocultaba el problema real de que algunos
// guardados no llegaban a persistir).
let globalStorageErrorHandler = null;
export function setGlobalStorageErrorHandler(fn) {
  globalStorageErrorHandler = fn;
}
export function reportStorageError(action, key, err) {
  const msg = (err && err.message) || String(err);
  console.error(`[Servidor] Fallo al ${action} "${key}": ${msg}`);
  if (globalStorageErrorHandler) globalStorageErrorHandler(`No se pudo ${action} "${key}". Detalle: ${msg}`);
}

// Antes estas tres funciones hablaban directamente con Supabase desde el
// navegador. Ahora hablan con NUESTRO PROPIO servidor (server/index.js), que
// es quien de verdad conoce la contraseña de SQL Server — el navegador nunca
// la ve. El resto de la aplicación no se entera del cambio: siguen
// llamándose loadKey/saveKey/deleteKey exactamente igual que antes.
const API_BASE = "/api/storage";

export async function loadKey(key, fallback) {
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(key)}`);
    if (res.status === 404) return fallback;
    if (!res.ok) {
      reportStorageError("leer", key, new Error(`HTTP ${res.status}`));
      return fallback;
    }
    const { value } = await res.json();
    return value;
  } catch (err) {
    reportStorageError("leer", key, err);
    return fallback;
  }
}

export async function saveKey(key, value) {
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) {
      reportStorageError("guardar", key, new Error(`HTTP ${res.status}`));
      return false;
    }
    return true;
  } catch (err) {
    reportStorageError("guardar", key, err);
    return false;
  }
}

export async function deleteKey(key) {
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(key)}`, { method: "DELETE" });
    if (!res.ok) reportStorageError("borrar", key, new Error(`HTTP ${res.status}`));
  } catch (err) {
    reportStorageError("borrar", key, err);
  }
}
