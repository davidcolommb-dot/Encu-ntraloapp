// Hash de contraseña de un solo sentido (SHA-256): nadie, ni el admin, puede
// "leer" la contraseña original a partir de esto — solo comparar si una
// contraseña introducida coincide. No es tan robusto como bcrypt/argon2 (no
// hay "salt" ni ralentización deliberada), pero es muchísimo más seguro que
// guardar la contraseña tal cual, y no requiere librerías externas.
export async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Un hash SHA-256 real siempre son 64 caracteres hexadecimales. Si lo guardado no
// tiene esa forma (por ejemplo, un PIN de 4 dígitos del sistema anterior), lo
// tratamos como si no hubiera contraseña configurada, en vez de dejar a alguien
// bloqueado comparando su contraseña nueva contra un valor que nunca coincidirá.
export function isValidHash(h) {
  return typeof h === "string" && /^[0-9a-f]{64}$/.test(h);
}
