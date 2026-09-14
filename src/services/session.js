// Sesión recordada en este navegador (no en el servidor), para no pedir
// contraseña de nuevo cada vez que se recarga la página.
export const SESSION_KEY = "mb_session_v1";
export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // almacenamiento no disponible (modo privado, etc.); la sesión simplemente no se recuerda
  }
}
export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // nada que limpiar
  }
}
