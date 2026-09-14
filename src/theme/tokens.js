export const BRAND = {
  red: "#E9312B",
  redDark: "#AF2520",
  gold: "#C9A227",
  blue: "#3E7C96",
  teal: "#2E5F5A",
  cream: "#FAF7F2",
  ink: "#2B2420",
};

export const AVATAR_PALETTE = [BRAND.red, BRAND.blue, BRAND.gold, BRAND.teal, "#7A5C3E", "#5B6B79"];

// Límite de archivo adjunto: ~3.5MB en crudo para que, tras la codificación base64
// (+33% de tamaño), el elemento guardado no supere el límite de 5MB por clave.
export const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024;
