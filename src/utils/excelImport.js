import * as XLSX from "xlsx";

export function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita acentos
}

export const HEADER_ALIASES = {
  nombre: ["nombre", "name", "empleado", "nombre y apellido", "nombre completo"],
  email: ["email", "correo", "e-mail", "correo electronico", "mail"],
  equipo: ["equipo", "grupo", "team", "departamento", "area"],
  puesto: ["puesto", "cargo", "posicion", "position", "job", "role", "rol"],
};

// Importar preguntas de test desde un Excel: reconoce columnas Pregunta,
// Opción 1-4, y Correcta (que puede ser un número 1-4, una letra a-d, o el
// texto exacto de la opción correcta — lo que resulte más cómodo de escribir
// según de dónde venga el archivo). Se usa tanto en el test principal de una
// formación como en el de cada módulo.
export const QUIZ_HEADER_ALIASES = {
  pregunta: ["pregunta", "question", "enunciado"],
  opcion1: ["opcion 1", "opcion1", "option 1", "respuesta 1", "a"],
  opcion2: ["opcion 2", "opcion2", "option 2", "respuesta 2", "b"],
  opcion3: ["opcion 3", "opcion3", "option 3", "respuesta 3", "c"],
  opcion4: ["opcion 4", "opcion4", "option 4", "respuesta 4", "d"],
  correcta: ["correcta", "correct", "respuesta correcta", "solucion", "opcion correcta"],
};
export function matchQuizColumn(headers, field) {
  const aliases = QUIZ_HEADER_ALIASES[field];
  return headers.findIndex((h) => aliases.includes(normalizeHeader(h)));
}
export async function parseQuizExcelFile(file) {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  if (rows.length === 0) return { questions: [], error: "El archivo está vacío." };

  const headers = rows[0];
  const pIdx = matchQuizColumn(headers, "pregunta");
  if (pIdx === -1) {
    return { questions: [], error: 'No encuentro una columna de pregunta. Usa una cabecera como "Pregunta" en la primera fila.' };
  }
  const optIdx = [1, 2, 3, 4].map((n) => matchQuizColumn(headers, `opcion${n}`));
  const correctIdx = matchQuizColumn(headers, "correcta");

  const questions = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const question = String(row[pIdx] || "").trim();
    if (!question) continue;
    const options = optIdx.map((idx) => (idx !== -1 ? String(row[idx] || "").trim() : ""));
    let correct = 0;
    if (correctIdx !== -1) {
      const raw = String(row[correctIdx] || "").trim();
      const asNumber = Number(raw);
      if (!isNaN(asNumber) && asNumber >= 1 && asNumber <= 4) {
        correct = asNumber - 1;
      } else if (/^[a-dA-D]$/.test(raw)) {
        correct = raw.toLowerCase().charCodeAt(0) - 97;
      } else {
        const matchIdx = options.findIndex((o) => o.toLowerCase() === raw.toLowerCase());
        if (matchIdx !== -1) correct = matchIdx;
      }
    }
    questions.push({ question, options, correct });
  }
  if (questions.length === 0) return { questions: [], error: "No he encontrado ninguna fila con una pregunta rellenada." };
  return { questions, error: null };
}

export function matchColumn(headers, field) {
  const aliases = HEADER_ALIASES[field];
  const idx = headers.findIndex((h) => aliases.includes(normalizeHeader(h)));
  return idx;
}

// Lee un Excel/CSV de empleados y devuelve filas normalizadas + errores de formato.
// Columnas reconocidas (en cualquier orden, mayúsc./minúsc. y con o sin acentos):
// Nombre (obligatoria), Email (opcional), Equipo (opcional), Puesto (opcional —
// se empareja por nombre con un Puesto ya creado en Admin → Puestos; si no
// coincide con ninguno, simplemente no se asigna nada, no da error). Las
// contraseñas no se importan — cada persona crea la suya en su primer acceso.
export async function parseEmployeeExcelFile(file) {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  if (rows.length === 0) return { rows: [], error: "El archivo está vacío." };

  const headers = rows[0];
  const nameIdx = matchColumn(headers, "nombre");
  if (nameIdx === -1) {
    return { rows: [], error: 'No se encontró una columna de nombre. Usa una cabecera como "Nombre" en la primera fila.' };
  }
  const emailIdx = matchColumn(headers, "email");
  const equipoIdx = matchColumn(headers, "equipo");
  const puestoIdx = matchColumn(headers, "puesto");

  const parsed = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row[nameIdx] || "").trim();
    if (!name) continue;
    const email = emailIdx !== -1 ? String(row[emailIdx] || "").trim() : "";
    const equipo = equipoIdx !== -1 ? String(row[equipoIdx] || "").trim() : "";
    const puesto = puestoIdx !== -1 ? String(row[puestoIdx] || "").trim() : "";
    parsed.push({ name, email, equipo, puesto });
  }
  return { rows: parsed, error: null };
}
