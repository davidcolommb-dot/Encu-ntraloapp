export const LEVELS = [
  { min: 0, name: "Iniciando", color: "#6B655D" },
  { min: 200, name: "En marcha", color: "#3E7C96" },
  { min: 500, name: "Consolidado", color: "#C9A227" },
  { min: 1000, name: "Experto", color: "#E9312B" },
];

export function levelForPoints(points) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (points >= lvl.min) current = lvl;
  }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  return { ...current, tier: idx + 1, totalTiers: LEVELS.length, nextMin: next ? next.min : null };
}
