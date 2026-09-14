import { supabase } from "../lib/supabaseClient";

// Aviso visible de errores de guardado: la app se suscribe a esto para mostrar
// un banner cuando Supabase rechaza una lectura/escritura, en vez de fallar en
// silencio (que es lo que ocultaba el problema real de que algunos guardados
// no llegaban a persistir).
let globalStorageErrorHandler = null;
export function setGlobalStorageErrorHandler(fn) {
  globalStorageErrorHandler = fn;
}
export function reportStorageError(action, key, err) {
  const msg = (err && (err.message || err.hint || err.details)) || String(err);
  console.error(`[Supabase] Fallo al ${action} "${key}": ${msg}`);
  if (globalStorageErrorHandler) globalStorageErrorHandler(`No se pudo ${action} "${key}". Detalle: ${msg}`);
}

export async function loadKey(key, fallback) {
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

export async function saveKey(key, value) {
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

export async function deleteKey(key) {
  try {
    const { error } = await supabase.from("app_storage").delete().eq("key", key);
    if (error) reportStorageError("borrar", key, error);
  } catch (err) {
    reportStorageError("borrar", key, err);
  }
}
