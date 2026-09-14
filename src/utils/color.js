export function shadeColor(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  let r = (num >> 16) + Math.round(255 * percent);
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * percent);
  let b = (num & 0x0000ff) + Math.round(255 * percent);
  r = Math.max(Math.min(255, r), 0);
  g = Math.max(Math.min(255, g), 0);
  b = Math.max(Math.min(255, b), 0);
  return "#" + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

// Genera un par "píldora" (fondo muy suave + texto oscuro del mismo tono) a partir
// de cualquier color de marca — así toda la web usa el mismo lenguaje visual de
// etiquetas sin tener que definir a mano cada combinación fondo/texto.
export function pillColors(hex) {
  return { bg: shadeColor(hex, 0.86), text: shadeColor(hex, -0.38) };
}
