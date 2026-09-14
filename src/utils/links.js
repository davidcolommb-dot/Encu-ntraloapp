// Enlace directo compartible a una formación o ruta concreta — cualquiera que
// lo abra entra primero por el acceso normal (con su propio usuario) y, en
// cuanto se identifica, aterriza directo ahí, sin tener que buscarlo.
export function buildShareLink(type, id) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set(type, id);
  return url.toString();
}
