import { todayISO } from "./dates";

export function payloadDate(payload) {
  try {
    return new Date(payload.exportedAt).toLocaleString("es-ES");
  } catch {
    return "fecha desconocida";
  }
}

export function toCsv(rows) {
  const headers = ["Nombre", "Email", "Formacion", "Categoria", "FechaLimite", "DiasRestantes", "Estado"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const vals = [r.nombre, r.email, r.formacion, r.categoria, r.fechaLimite, r.diasRestantes ?? "", r.estado];
    lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(rows) {
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
