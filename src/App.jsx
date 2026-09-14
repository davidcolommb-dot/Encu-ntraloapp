import { useState, useEffect, useMemo, useRef } from "react";
import {
  ClipboardList, Users, Package, Cpu, CheckCircle2, Clock, AlertTriangle,
  Plus, Trash2, X, PlayCircle, FileText, Newspaper, ChevronLeft, ChevronDown, ChevronUp, ChevronRight,
  ShieldCheck, LayoutGrid, Home, Settings, Loader2, LogOut, Lock, KeyRound,
  Trophy, Award, Star, PartyPopper, Upload, FileSpreadsheet, Search, Map, Link2, Check, Eye, BookOpen, Sparkles, Wrench, Archive, Copy, Save, GripVertical, Building2
} from "lucide-react";
import * as XLSX from "xlsx";

// --- Módulos propios (ver src/lib, src/theme, src/constants, src/utils, src/services) ---
import { supabase } from "./lib/supabaseClient";
import { msalClientId, msalTenantId, msalIsConfigured, getMsalInstance, loginWithMicrosoftPopup } from "./lib/msalAuth";
import { BRAND, AVATAR_PALETTE, MAX_ATTACHMENT_BYTES } from "./theme/tokens";
import { CATEGORIES, categoryMeta, CHECKLIST_LEVELS, CHECKLIST_CATEGORIES, checklistCategoryMeta, EMPLOYEE_STATUS } from "./constants/categories";
import { SEED_PUESTOS, SEED_COURSES, SEED_NEWS } from "./constants/seedData";
import { uid } from "./utils/ids";
import { todayISO, daysUntil, daysFromNow } from "./utils/dates";
import {
  isCourseExpired, computeAwaitingRating, isModulePassed, isChecklistComplete, isPathFullyCompleted,
  getChecklistDeadlineInfo, isAssignedToUser, isAssignedIgnoringArchived, computeEmployeeCompliance, sortByUrgency,
} from "./utils/courseLogic";
import { normalizeHeader, HEADER_ALIASES, QUIZ_HEADER_ALIASES, matchQuizColumn, parseQuizExcelFile, matchColumn, parseEmployeeExcelFile } from "./utils/excelImport";
import { getVideoEmbedUrl } from "./utils/video";
import { buildShareLink } from "./utils/links";
import { setGlobalStorageErrorHandler, reportStorageError, loadKey, saveKey, deleteKey } from "./services/storage";
import { initials, avatarColor } from "./utils/avatar";
import { hashPassword, isValidHash } from "./utils/auth";
import { SESSION_KEY, saveSession, loadSession, clearSession } from "./services/session";
import { LEVELS, levelForPoints } from "./constants/levels";
import { getFormEmbedUrl } from "./utils/googleForms";
import { VIDEO_BUCKET, VIDEO_MAX_SIZE_MB, uploadVideoFile, deleteVideoFile } from "./services/videoStorage";
import { materializeSeedCourses } from "./services/seedMaterializer";
import { shadeColor, pillColors } from "./utils/color";
import { dataUriToBlobUrl } from "./utils/blob";
import { payloadDate, toCsv, downloadCsv } from "./utils/csvExport";


// Caducidad y recertificación: si una formación tiene validityMonths configurado,
// una vez pasado ese tiempo desde que se completó, vuelve a contar como pendiente
// — sin borrar el historial de que ya se hizo una vez (eso se conserva en el
// propio registro, solo cambia lo que se considera "vigente ahora mismo").





function CopyLinkButton({ url, label = "Copiar enlace", compact = false }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      // Si el navegador bloquea el portapapeles (poco común), no hay mucho más que hacer aquí.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      title="Copiar un enlace directo a esto"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: compact ? 11 : "var(--text-xs)", fontWeight: 600,
        color: copied ? "var(--success)" : "var(--info)",
        border: "none", background: "none", cursor: "pointer", padding: 0,
      }}
    >
      {copied ? <Check size={compact ? 11 : 13} /> : <Link2 size={compact ? 11 : 13} />}
      {copied ? "¡Copiado!" : label}
    </button>
  );
}


// Celebración breve al completar de verdad una formación (justo al valorarla,
// que es el paso que la cierra). Confeti hecho con CSS puro — nada de
// librerías nuevas para algo tan pequeño. Se cierra sola a los pocos segundos,
// o si la persona pincha fuera.
function CelebrationOverlay({ celebration, onClose }) {
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [celebration]);

  if (!celebration) return null;

  const confettiColors = ["#E9312B", "#C9A227", "#2E7D6A", "#3E7C96", "#2D8A4E"];
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.8 + Math.random() * 1.2,
    color: confettiColors[i % confettiColors.length],
    rotate: Math.random() * 360,
    size: 6 + Math.random() * 6,
  }));

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(26,24,22,0.35)", cursor: "pointer", overflow: "hidden",
      }}
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute", top: -20, left: `${p.left}%`,
            width: p.size, height: p.size * 0.4, backgroundColor: p.color,
            transform: `rotate(${p.rotate}deg)`, borderRadius: 2,
            animation: `mb-confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...DS.card, padding: "var(--sp-8) var(--sp-6)", textAlign: "center", maxWidth: 320,
          display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-3)",
          animation: "mb-celebration-pop 0.4s var(--ease-out)",
        }}
      >
        <div style={{ width: 64, height: 64, borderRadius: "var(--radius-full)", backgroundColor: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PartyPopper size={30} style={{ color: "var(--success)" }} />
        </div>
        <div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)" }}>¡Formación completada!</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 4 }}>{celebration.title}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--warning)" }}>
          <Trophy size={16} /> +100 puntos
        </div>
      </div>
    </div>
  );
}


// Panel de cumplimiento reutilizable: lo usan tanto el Admin completo (con
// todos los empleados) como el panel "Mi equipo" de un responsable (con solo
// los suyos) — misma calidad de herramienta para los dos casos.
function ComplianceView({ employees, courses, groups, completionsByCourse, onMarkFormReviewed, puestos = [], checklistResponses = {}, onValidateChecklistItem, myManagedGroupIds = null, onCorrectPracticalCase, onCorrectModulePracticalCase }) {
  const [viewMode, setViewMode] = useState("person"); // "person" | "course"
  const [personSearch, setPersonSearch] = useState("");
  const [personSort, setPersonSort] = useState("overdue");
  const [expandedPerson, setExpandedPerson] = useState(null);
  const [correctingCase, setCorrectingCase] = useState(null); // "courseId__employeeName" o null
  const [correctionText, setCorrectionText] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  // Filtros rápidos que se activan pinchando en una tarjeta de resumen o en
  // un departamento — para que el panel lleve de verdad a algún sitio, en
  // vez de ser solo un número bonito que no hace nada.
  const [departmentFilter, setDepartmentFilter] = useState(null); // groupId o null
  const [attentionFilter, setAttentionFilter] = useState(null); // "overdue" | "formReview" | "caseReview" | null

  function goToPerson(filters) {
    setViewMode("person");
    if ("departmentFilter" in filters) setDepartmentFilter(filters.departmentFilter);
    if ("attentionFilter" in filters) setAttentionFilter(filters.attentionFilter);
  }

  const compliance = useMemo(
    () => computeEmployeeCompliance(employees, courses, groups, completionsByCourse),
    [employees, courses, groups, completionsByCourse]
  );

  const overallStats = useMemo(() => {
    const totalOverdue = compliance.reduce((sum, c) => sum + c.overdueCount, 0);
    const avgPercent = compliance.length ? Math.round(compliance.reduce((sum, c) => sum + c.percent, 0) / compliance.length) : 0;
    const upToDate = compliance.filter((c) => c.percent === 100).length;
    const totalFormReview = compliance.reduce((sum, c) => sum + c.needsFormReview, 0);
    const totalCaseReview = compliance.reduce((sum, c) => sum + c.needsCaseReview, 0);
    return { totalOverdue, avgPercent, upToDate, totalFormReview, totalCaseReview };
  }, [compliance]);

  const departmentFilterGroup = departmentFilter ? groups.find((g) => g.id === departmentFilter) : null;

  const filteredSorted = useMemo(() => {
    let list = compliance.filter((c) => c.employee.name.toLowerCase().includes(personSearch.trim().toLowerCase()));
    if (departmentFilterGroup) {
      list = list.filter((c) => (departmentFilterGroup.memberNames || []).includes(c.employee.name));
    }
    if (attentionFilter === "overdue") list = list.filter((c) => c.overdueCount > 0);
    else if (attentionFilter === "formReview") list = list.filter((c) => c.needsFormReview > 0);
    else if (attentionFilter === "caseReview") list = list.filter((c) => c.needsCaseReview > 0);
    if (personSort === "name") list = [...list].sort((a, b) => a.employee.name.localeCompare(b.employee.name));
    else if (personSort === "compliance") list = [...list].sort((a, b) => a.percent - b.percent);
    else list = [...list].sort((a, b) => b.overdueCount - a.overdueCount || a.percent - b.percent);
    return list;
  }, [compliance, personSearch, personSort, departmentFilterGroup, attentionFilter]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const courseRows = useMemo(() => {
    if (!selectedCourse) return [];
    return employees
      .filter((e) => isAssignedToUser(selectedCourse, e.name, groups))
      .filter((e) => e.name.toLowerCase().includes(courseSearch.trim().toLowerCase()))
      .map((e) => {
        const rec = completionsByCourse[selectedCourse.id]?.[e.name];
        const rawDone = rec?.status === "completada";
        const expired = rawDone && isCourseExpired(selectedCourse, rec);
        const done = rawDone && !expired;
        const overdue = !done && selectedCourse.deadline && daysUntil(selectedCourse.deadline) < 0;
        const pendingFormReview = done && selectedCourse.testMode === "googleform" && !rec?.formReviewed;
        return { employee: e, record: rec, done, overdue, expired, pendingFormReview };
      });
  }, [selectedCourse, employees, groups, completionsByCourse, courseSearch]);
  const courseDoneCount = courseRows.filter((r) => r.done).length;
  const coursePercent = courseRows.length ? Math.round((courseDoneCount / courseRows.length) * 100) : 0;

  if (employees.length === 0) {
    return <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Todavía no hay nadie que seguir aquí.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      {/* Resumen visual de un vistazo — cada tarjeta lleva a algún sitio, no
          son solo números decorativos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--sp-3)" }}>
        <div style={{ ...DS.card, padding: "var(--sp-3)", textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--brand)" }}>{overallStats.avgPercent}%</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Cumplimiento medio</div>
        </div>
        <button
          onClick={() => goToPerson({ departmentFilter: null, attentionFilter: null })}
          style={{ ...DS.card, padding: "var(--sp-3)", textAlign: "center", cursor: "pointer", border: "none" }}
        >
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--success)" }}>{overallStats.upToDate}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Personas al día del todo</div>
        </button>
        <button
          onClick={() => goToPerson({ departmentFilter: null, attentionFilter: "overdue" })}
          disabled={overallStats.totalOverdue === 0}
          style={{ ...DS.card, padding: "var(--sp-3)", textAlign: "center", cursor: overallStats.totalOverdue === 0 ? "default" : "pointer", border: "none" }}
        >
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: overallStats.totalOverdue > 0 ? "var(--danger)" : "var(--text-muted)" }}>{overallStats.totalOverdue}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Formaciones vencidas (total)</div>
        </button>
        <button
          onClick={() => goToPerson({ departmentFilter: null, attentionFilter: "formReview" })}
          disabled={overallStats.totalFormReview === 0}
          style={{ ...DS.card, padding: "var(--sp-3)", textAlign: "center", cursor: overallStats.totalFormReview === 0 ? "default" : "pointer", border: "none" }}
        >
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: overallStats.totalFormReview > 0 ? "var(--info)" : "var(--text-muted)" }}>{overallStats.totalFormReview}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Forms externos por revisar</div>
        </button>
        <button
          onClick={() => goToPerson({ departmentFilter: null, attentionFilter: "caseReview" })}
          disabled={overallStats.totalCaseReview === 0}
          style={{ ...DS.card, padding: "var(--sp-3)", textAlign: "center", cursor: overallStats.totalCaseReview === 0 ? "default" : "pointer", border: "none" }}
        >
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: overallStats.totalCaseReview > 0 ? "var(--info)" : "var(--text-muted)" }}>{overallStats.totalCaseReview}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Casos prácticos por corregir</div>
        </button>
      </div>

      {/* Aviso de filtro activo, con forma de quitarlo */}
      {(departmentFilterGroup || attentionFilter) && viewMode === "person" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Filtrando:</span>
          {departmentFilterGroup && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: "var(--radius-full)", backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}>
              {departmentFilterGroup.name}
              <button onClick={() => setDepartmentFilter(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", display: "flex", padding: 0 }}><X size={11} /></button>
            </span>
          )}
          {attentionFilter && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: "var(--radius-full)", backgroundColor: "var(--warning-soft)", color: "var(--warning)" }}>
              {attentionFilter === "overdue" ? "Con algo vencido" : attentionFilter === "formReview" ? "Form por revisar" : "Caso por corregir"}
              <button onClick={() => setAttentionFilter(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", display: "flex", padding: 0 }}><X size={11} /></button>
            </span>
          )}
        </div>
      )}

      {/* Alternar entre ver por persona, por formación, por checklist de puesto, o comparar departamentos */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {[
          { id: "person", label: "Por persona" },
          { id: "course", label: "Por formación" },
          ...((myManagedGroupIds === null ? puestos.length > 0 : puestos.some((p) => p.groupId && myManagedGroupIds.includes(p.groupId))) ? [{ id: "checklist", label: "Checklists de puesto" }] : []),
          ...(myManagedGroupIds === null && groups.length > 1 ? [{ id: "departments", label: "Comparar departamentos" }] : []),
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setViewMode(m.id)}
            style={{
              fontSize: "var(--text-sm)", fontWeight: viewMode === m.id ? 600 : 500,
              padding: "6px 14px", borderRadius: "var(--radius-full)",
              color: viewMode === m.id ? "white" : "var(--text-secondary)",
              backgroundColor: viewMode === m.id ? "var(--brand)" : "var(--bg-inset)",
              border: "none", cursor: "pointer",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {viewMode === "person" ? (
        <div>
          <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", marginBottom: "var(--sp-3)" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                style={{ width: "100%", padding: "7px 10px 7px 32px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "var(--text-sm)" }}
              />
            </div>
            <select
              value={personSort}
              onChange={(e) => setPersonSort(e.target.value)}
              style={{ padding: "7px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}
            >
              <option value="overdue">Vencidas primero</option>
              <option value="compliance">Menor cumplimiento primero</option>
              <option value="name">Nombre (A-Z)</option>
            </select>
            {myManagedGroupIds === null && groups.length > 1 && (
              <select
                value={departmentFilter || ""}
                onChange={(e) => setDepartmentFilter(e.target.value || null)}
                style={{ padding: "7px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}
              >
                <option value="">Todos los departamentos</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
          </div>

          {filteredSorted.length === 0 ? (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Nadie coincide con esa búsqueda.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              {filteredSorted.map((c) => {
                const isExpanded = expandedPerson === c.employee.name;
                return (
                  <div key={c.employee.name} style={{ ...DS.card, overflow: "hidden" }}>
                    <button
                      onClick={() => setExpandedPerson(isExpanded ? null : c.employee.name)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: "var(--sp-3)", padding: "var(--sp-3)", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}
                    >
                      <Avatar name={c.employee.name} size={30} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{c.employee.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                          <div style={{ width: 80, height: 5, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${c.percent}%`, backgroundColor: c.percent === 100 ? "var(--success)" : "var(--brand)", borderRadius: "var(--radius-full)" }} />
                          </div>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.completed}/{c.totalAssigned} · {c.percent}%</span>
                        </div>
                      </div>
                      {c.overdueCount > 0 && <StatusPill icon={AlertTriangle} label={`${c.overdueCount} vencida${c.overdueCount === 1 ? "" : "s"}`} variant="danger" />}
                      {isExpanded ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
                    </button>
                    {isExpanded && (
                      <div style={{ padding: "0 var(--sp-3) var(--sp-3)", display: "flex", flexDirection: "column", gap: 6 }}>
                        {c.courseDetails.length === 0 && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Sin formaciones asignadas.</div>}
                        {c.courseDetails.map((d) => {
                          const courseCaseKey = `${d.course.id}::course::${c.employee.name}`;
                          return (
                          <div key={d.course.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "6px 8px", borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-inset)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)" }}>{d.course.title}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                {d.pendingFormReview && (
                                  <button
                                    onClick={() => onMarkFormReviewed(d.course.id, c.employee.name)}
                                    title="Marcar como revisado tras comprobar sus respuestas en el propio Google Form"
                                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: "var(--radius-full)", backgroundColor: "var(--info-soft)", color: "var(--info)", border: "none", cursor: "pointer" }}
                                  >
                                    <FileText size={10} /> Revisar Form
                                  </button>
                                )}
                                {d.courseCaseReview && (
                                  <button
                                    onClick={() => { setCorrectingCase(courseCaseKey); setCorrectionText(""); }}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: "var(--radius-full)", backgroundColor: "var(--warning-soft)", color: "var(--warning)", border: "none", cursor: "pointer" }}
                                  >
                                    <ClipboardList size={10} /> Corregir caso
                                  </button>
                                )}
                                {d.modulePendingCases.map((mc) => (
                                  <button
                                    key={mc.moduleId}
                                    onClick={() => { setCorrectingCase(`${d.course.id}::${mc.moduleId}::${c.employee.name}`); setCorrectionText(""); }}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: "var(--radius-full)", backgroundColor: "var(--warning-soft)", color: "var(--warning)", border: "none", cursor: "pointer" }}
                                  >
                                    <ClipboardList size={10} /> Corregir caso ({mc.moduleTitle})
                                  </button>
                                ))}
                                <StatusPill
                                  icon={d.done ? CheckCircle2 : d.overdue ? AlertTriangle : Clock}
                                  label={d.done ? "Completada" : d.overdue ? "Vencida" : d.expired ? "Caducada" : "Pendiente"}
                                  variant={d.done ? "success" : d.overdue ? "danger" : "warning"}
                                />
                              </div>
                            </div>

                            {correctingCase === courseCaseKey && (
                              <div style={{ ...DS.card, padding: "var(--sp-3)" }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>RESPUESTA DE {c.employee.name.toUpperCase()}</div>
                                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", whiteSpace: "pre-line", marginBottom: 8, backgroundColor: "var(--bg-inset)", padding: "var(--sp-2)", borderRadius: "var(--radius-md)" }}>
                                  {d.record?.practicalCaseAnswer?.text}
                                </div>
                                <textarea
                                  value={correctionText}
                                  onChange={(e) => setCorrectionText(e.target.value)}
                                  placeholder="Escribe tu corrección o comentario..."
                                  rows={3}
                                  style={{ width: "100%", fontSize: "var(--text-xs)", padding: "6px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", marginBottom: 8 }}
                                />
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    disabled={!correctionText.trim()}
                                    onClick={() => {
                                      onCorrectPracticalCase(d.course.id, c.employee.name, correctionText);
                                      setCorrectingCase(null);
                                    }}
                                    style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: "var(--radius-md)", color: "white", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: !correctionText.trim() ? 0.4 : 1 }}
                                  >
                                    Enviar corrección
                                  </button>
                                  <button onClick={() => setCorrectingCase(null)} style={{ fontSize: 11, color: "var(--text-muted)", border: "none", background: "none", cursor: "pointer" }}>Cancelar</button>
                                </div>
                              </div>
                            )}

                            {d.modulePendingCases.map((mc) => {
                              const moduleCaseKey = `${d.course.id}::${mc.moduleId}::${c.employee.name}`;
                              if (correctingCase !== moduleCaseKey) return null;
                              const moduleRec = d.record?.moduleProgress?.[mc.moduleId];
                              return (
                                <div key={mc.moduleId} style={{ ...DS.card, padding: "var(--sp-3)" }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                                    RESPUESTA DE {c.employee.name.toUpperCase()} — {mc.moduleTitle.toUpperCase()}
                                  </div>
                                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", whiteSpace: "pre-line", marginBottom: 8, backgroundColor: "var(--bg-inset)", padding: "var(--sp-2)", borderRadius: "var(--radius-md)" }}>
                                    {moduleRec?.practicalCaseAnswer?.text}
                                  </div>
                                  <textarea
                                    value={correctionText}
                                    onChange={(e) => setCorrectionText(e.target.value)}
                                    placeholder="Escribe tu corrección o comentario..."
                                    rows={3}
                                    style={{ width: "100%", fontSize: "var(--text-xs)", padding: "6px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", marginBottom: 8 }}
                                  />
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                      disabled={!correctionText.trim()}
                                      onClick={() => {
                                        onCorrectModulePracticalCase(d.course.id, mc.moduleId, c.employee.name, correctionText);
                                        setCorrectingCase(null);
                                      }}
                                      style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: "var(--radius-md)", color: "white", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: !correctionText.trim() ? 0.4 : 1 }}
                                    >
                                      Enviar corrección
                                    </button>
                                    <button onClick={() => setCorrectingCase(null)} style={{ fontSize: 11, color: "var(--text-muted)", border: "none", background: "none", cursor: "pointer" }}>Cancelar</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : viewMode === "course" ? (
        <div>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "var(--text-sm)", color: "var(--text-primary)", marginBottom: "var(--sp-3)" }}
          >
            <option value="">Selecciona una formación...</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>

          {selectedCourse && (
            <div>
              <div style={{ ...DS.card, padding: "var(--sp-3)", marginBottom: "var(--sp-3)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{courseDoneCount}/{courseRows.length} completada</span>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--brand)" }}>{coursePercent}%</span>
                </div>
                <div style={{ height: 6, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${coursePercent}%`, backgroundColor: coursePercent === 100 ? "var(--success)" : "var(--brand)", borderRadius: "var(--radius-full)" }} />
                </div>
              </div>

              <div style={{ position: "relative", marginBottom: "var(--sp-3)" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Buscar por nombre..."
                  style={{ width: "100%", padding: "7px 10px 7px 32px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "var(--text-sm)" }}
                />
              </div>

              {courseRows.length === 0 ? (
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Nadie coincide, o nadie tiene esta formación asignada.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {courseRows.map((r) => (
                    <div key={r.employee.name} style={{ ...DS.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "var(--sp-2) var(--sp-3)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar name={r.employee.name} size={24} />
                        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{r.employee.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        {r.record?.score != null && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.record.score}%</span>}
                        {r.pendingFormReview && (
                          <button
                            onClick={() => onMarkFormReviewed(selectedCourse.id, r.employee.name)}
                            title="Marcar como revisado tras comprobar sus respuestas en el propio Google Form"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: "var(--radius-full)", backgroundColor: "var(--info-soft)", color: "var(--info)", border: "none", cursor: "pointer" }}
                          >
                            <FileText size={10} /> Revisar Form
                          </button>
                        )}
                        <StatusPill
                          icon={r.done ? CheckCircle2 : r.overdue ? AlertTriangle : Clock}
                          label={r.done ? "Completada" : r.overdue ? "Vencida" : r.expired ? "Caducada" : "Pendiente"}
                          variant={r.done ? "success" : r.overdue ? "danger" : "warning"}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : viewMode === "checklist" ? (
        <div>
          {(() => {
            // Solo puestos del departamento (grupo) que gestiona quien mira esto —
            // el administrador completo (myManagedGroupIds === null) los ve todos.
            const visiblePuestos = myManagedGroupIds === null ? puestos : puestos.filter((p) => p.groupId && myManagedGroupIds.includes(p.groupId));
            const employeesWithPuesto = employees
              .map((e) => ({ employee: e, puesto: visiblePuestos.find((p) => p.id === e.puestoId) }))
              .filter((x) => !!x.puesto);
            if (employeesWithPuesto.length === 0) {
              return (
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                  {myManagedGroupIds !== null && puestos.some((p) => p.groupId && myManagedGroupIds.includes(p.groupId))
                    ? "Nadie de tu departamento tiene todavía un puesto con checklist asignado."
                    : "No hay ningún puesto con checklist asignado a tu departamento."}
                </div>
              );
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                {employeesWithPuesto.map(({ employee, puesto }) => {
                  const entry = checklistResponses[employee.name];
                  const responses = entry?.responses || {};
                  const answered = puesto.checklistItems.filter((i) => !!responses[i.id]?.level).length;
                  const pendingValidation = puesto.checklistItems.filter((i) => responses[i.id]?.level && !responses[i.id]?.validated).length;
                  const key = employee.name;
                  const isExpanded = expandedPerson === `checklist:${key}`;
                  return (
                    <div key={key} style={{ ...DS.card, overflow: "hidden" }}>
                      <button
                        onClick={() => setExpandedPerson(isExpanded ? null : `checklist:${key}`)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: "var(--sp-3)", padding: "var(--sp-3)", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}
                      >
                        <Avatar name={employee.name} size={30} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{employee.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{puesto.name} · {answered}/{puesto.checklistItems.length} evaluados</div>
                        </div>
                        {pendingValidation > 0 && <StatusPill icon={ShieldCheck} label={`${pendingValidation} por confirmar`} variant="warning" />}
                        {isExpanded ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
                      </button>
                      {isExpanded && (
                        <div style={{ padding: "0 var(--sp-3) var(--sp-3)", display: "flex", flexDirection: "column", gap: 6 }}>
                          {puesto.checklistItems.map((item) => {
                            const resp = responses[item.id];
                            return (
                              <div key={item.id} style={{ padding: "8px 10px", borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-inset)" }}>
                                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", marginBottom: 6 }}>{item.text}</div>
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                                  {CHECKLIST_LEVELS.map((lvl) => {
                                    const selected = resp?.level === lvl.id;
                                    return (
                                      <button
                                        key={lvl.id}
                                        onClick={() => onValidateChecklistItem(employee.name, item.id, lvl.id)}
                                        style={{
                                          display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600,
                                          padding: "3px 8px", borderRadius: "var(--radius-full)", cursor: "pointer",
                                          border: selected ? "1.5px solid transparent" : "1.5px solid var(--border)",
                                          backgroundColor: selected ? `var(--${lvl.variant})` : "var(--bg-card)",
                                          color: selected ? "white" : "var(--text-secondary)",
                                        }}
                                      >
                                        <lvl.icon size={10} /> {lvl.label}
                                      </button>
                                    );
                                  })}
                                  {!resp?.level ? (
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Sin evaluar todavía</span>
                                  ) : resp.validated ? (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--info)", display: "flex", alignItems: "center", gap: 3 }}>
                                      <ShieldCheck size={10} /> Confirmado por {resp.updatedBy}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 10, color: "var(--warning)", fontWeight: 600 }}>Pendiente de confirmar</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : viewMode === "departments" ? (
        <div>
          {(() => {
            const deptStats = groups.map((g) => {
              const members = employees.filter((e) => (g.memberNames || []).includes(e.name));
              const memberCompliance = computeEmployeeCompliance(members, courses, groups, completionsByCourse);
              const avgPercent = memberCompliance.length ? Math.round(memberCompliance.reduce((s, c) => s + c.percent, 0) / memberCompliance.length) : null;
              const totalOverdue = memberCompliance.reduce((s, c) => s + c.overdueCount, 0);

              // Si este departamento tiene uno o varios puestos con checklist,
              // calculamos también qué porcentaje de sus ítems ya se ha evaluado.
              const deptPuestos = puestos.filter((p) => p.groupId === g.id);
              let checklistPercent = null;
              if (deptPuestos.length > 0) {
                let totalItems = 0, answeredItems = 0;
                for (const p of deptPuestos) {
                  const peopleWithThisPuesto = employees.filter((e) => e.puestoId === p.id);
                  for (const person of peopleWithThisPuesto) {
                    const responses = checklistResponses[person.name]?.responses || {};
                    totalItems += p.checklistItems.length;
                    answeredItems += p.checklistItems.filter((i) => !!responses[i.id]?.level).length;
                  }
                }
                if (totalItems > 0) checklistPercent = Math.round((answeredItems / totalItems) * 100);
              }

              return { group: g, memberCount: members.length, avgPercent, totalOverdue, checklistPercent };
            });
            const sorted = [...deptStats].sort((a, b) => (a.avgPercent ?? 999) - (b.avgPercent ?? 999));
            const withData = sorted.filter((d) => d.memberCount > 0);
            const withoutData = sorted.filter((d) => d.memberCount === 0);

            if (withData.length === 0) {
              return <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Ningún departamento tiene miembros todavía.</div>;
            }

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Ordenados de peor a mejor cumplimiento medio. Pincha uno para ver a sus personas.</div>
                {withData.map((d) => (
                  <button
                    key={d.group.id}
                    onClick={() => goToPerson({ departmentFilter: d.group.id, attentionFilter: null })}
                    style={{ ...DS.card, padding: "var(--sp-3)", textAlign: "left", cursor: "pointer", border: "none", width: "100%", transition: "box-shadow var(--dur-fast) var(--ease-out)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{d.group.name}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.memberCount} persona{d.memberCount === 1 ? "" : "s"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {d.totalOverdue > 0 && <StatusPill icon={AlertTriangle} label={`${d.totalOverdue} vencida${d.totalOverdue === 1 ? "" : "s"} en total`} variant="danger" />}
                        <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: d.checklistPercent !== null ? 8 : 0 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", width: 110, flexShrink: 0 }}>Formaciones</span>
                      <div style={{ flex: 1, height: 7, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${d.avgPercent}%`, backgroundColor: d.avgPercent === 100 ? "var(--success)" : d.avgPercent < 50 ? "var(--danger)" : "var(--brand)", borderRadius: "var(--radius-full)" }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", width: 36, textAlign: "right" }}>{d.avgPercent}%</span>
                    </div>
                    {d.checklistPercent !== null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", width: 110, flexShrink: 0 }}>Checklist puesto</span>
                        <div style={{ flex: 1, height: 7, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${d.checklistPercent}%`, backgroundColor: d.checklistPercent === 100 ? "var(--success)" : "var(--info)", borderRadius: "var(--radius-full)" }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", width: 36, textAlign: "right" }}>{d.checklistPercent}%</span>
                      </div>
                    )}
                  </button>
                ))}
                {withoutData.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                    Sin miembros todavía: {withoutData.map((d) => d.group.name).join(", ")}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}


// Puesto de ejemplo, construido a partir de un plan de acogida real de
// Picker de Salidas (formación PRL, maquinaria, PDA, casuísticas de pedidos,
// y el propio checklist de calidad que ya usan en el almacén). Sirve como
// ejemplo de partida — se puede editar o borrar libremente desde Admin →
// Puestos, igual que con las formaciones de ejemplo.







/* ---------- Piezas visuales pequeñas ---------- */

function Avatar({ name, size = 36 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: avatarColor(name), fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}

function ProgressRing({ percent, size = 64, color = BRAND.red, label }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#00000014" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
        <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={size * 0.24} fontWeight="bold" fill={BRAND.ink}>
          {percent}%
        </text>
      </svg>
      {label && <div className="text-[11px] text-gray-500 font-medium">{label}</div>}
    </div>
  );
}

function RatingStars({ rating, ratingComment, awaitingRating, onRate }) {
  const [selected, setSelected] = useState(rating || 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(ratingComment || "");
  const [submitted, setSubmitted] = useState(!awaitingRating && !!rating);

  if (submitted) {
    return (
      <div style={{ ...DS.card, padding: "var(--sp-4)", display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <div style={{ display: "flex", gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={16} fill={selected >= n ? "var(--warning)" : "none"} color={selected >= n ? "var(--warning)" : "var(--border-strong)"} />
          ))}
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Gracias por tu valoración.</div>
        <button onClick={() => setSubmitted(false)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--info)", border: "none", background: "none", cursor: "pointer", marginLeft: "auto" }}>
          Cambiarla
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...DS.card, padding: "var(--sp-4)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <div>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
          ¿Qué te ha parecido esta formación?
        </div>
        {awaitingRating && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--warning-text)", backgroundColor: "var(--warning-soft)", display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-full)", marginTop: 4, fontWeight: 500 }}>
            Falta esto para dar la formación por completada
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setSelected(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex" }}
            title={`${n} estrella${n === 1 ? "" : "s"}`}
          >
            <Star size={24} fill={(hover || selected) >= n ? "var(--warning)" : "none"} color={(hover || selected) >= n ? "var(--warning)" : "var(--border-strong)"} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Algún comentario, sugerencia o mejora (opcional)"
        rows={2}
        style={{ width: "100%", fontSize: "var(--text-sm)", padding: "8px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontFamily: "inherit", resize: "vertical" }}
      />
      <button
        disabled={selected === 0}
        onClick={() => {
          onRate(selected, comment);
          setSubmitted(true);
        }}
        style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: selected === 0 ? 0.4 : 1, width: "fit-content" }}
      >
        {awaitingRating ? "Enviar y completar formación" : "Guardar valoración"}
      </button>
    </div>
  );
}

// Caso práctico: la persona escribe su respuesta, la envía, y espera a que
// alguien (admin o responsable) le devuelva una corrección. Enviarlo cuenta
// para completar la formación; la corrección en sí es un paso aparte que
// llega después, sin bloquear nada.
function PracticalCaseSection({ practicalCase, answer, onSubmit }) {
  const [text, setText] = useState(answer?.text || "");
  const [editing, setEditing] = useState(!answer);

  if (!practicalCase) return null;

  const hasAnswer = !!answer;
  const isCorrected = answer?.status === "corregido";

  return (
    <div style={{ ...DS.card, padding: "var(--sp-4)" }}>
      <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
        <ClipboardList size={16} style={{ color: "var(--brand)" }} />
        Caso práctico{practicalCase.title ? `: ${practicalCase.title}` : ""}
      </div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "var(--sp-3)", whiteSpace: "pre-line" }}>
        {practicalCase.description}
      </div>

      {hasAnswer && !editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>TU RESPUESTA</div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", backgroundColor: "var(--bg-inset)", padding: "var(--sp-3)", borderRadius: "var(--radius-md)", whiteSpace: "pre-line" }}>
              {answer.text}
            </div>
          </div>

          {isCorrected ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--success-text)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={12} /> CORRECCIÓN{answer.correctedBy ? ` DE ${answer.correctedBy.toUpperCase()}` : ""}
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", backgroundColor: "var(--success-soft)", padding: "var(--sp-3)", borderRadius: "var(--radius-md)", whiteSpace: "pre-line" }}>
                {answer.feedback}
              </div>
            </div>
          ) : (
            <StatusPill icon={Clock} label="Enviado — a la espera de corrección" variant="warning" />
          )}

          {!isCorrected && (
            <button
              onClick={() => setEditing(true)}
              style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--info)", border: "none", background: "none", cursor: "pointer", width: "fit-content" }}
            >
              Editar mi respuesta
            </button>
          )}
        </div>
      )}

      {(editing || !hasAnswer) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe aquí tu respuesta a este caso..."
            rows={5}
            style={{ width: "100%", fontSize: "var(--text-sm)", padding: "8px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontFamily: "inherit", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={!text.trim()}
              onClick={() => {
                onSubmit(text);
                setEditing(false);
              }}
              style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: !text.trim() ? 0.4 : 1, width: "fit-content" }}
            >
              Enviar respuesta
            </button>
            {hasAnswer && (
              <button onClick={() => { setText(answer.text); setEditing(false); }} style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-muted)", border: "none", background: "none", cursor: "pointer" }}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DeadlineChip({ deadline, completed }) {
  if (completed) {
    return <StatusPill icon={CheckCircle2} label="Completada" variant="success" />;
  }
  if (!deadline) {
    return <StatusPill label="Sin plazo" variant="neutral" />;
  }
  const d = daysUntil(deadline);
  if (d < 0) {
    return <StatusPill icon={AlertTriangle} label={`Vencida hace ${Math.abs(d)} día${Math.abs(d) === 1 ? "" : "s"}`} variant="danger" />;
  }
  if (d <= 3) {
    return <StatusPill icon={Clock} label={`Quedan ${d} día${d === 1 ? "" : "s"}`} variant="warning" />;
  }
  return <StatusPill icon={Clock} label={`${d} días restantes`} variant="neutral" />;
}


function CategoryTag({ id, small }) {
  const meta = categoryMeta(id);
  const Icon = meta.icon;
  const { bg, text } = pillColors(meta.color);
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 500,
        borderRadius: "var(--radius-full)", backgroundColor: bg, color: text,
        fontSize: small ? 11 : 12, padding: small ? "3px 10px" : "4px 12px",
      }}
    >
      <Icon size={small ? 11 : 12} />
      {meta.label}
    </span>
  );
}


function AttachmentViewer({ att }) {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const parsed = await loadKey(att.storageKey, null);
      if (parsed && parsed.data) {
        // Las URI "data:" a veces no se dejan cargar dentro de un iframe por
        // restricciones del navegador. Las convertimos a un Blob URL, que es
        // más fiable tanto para la vista previa como para la descarga.
        const url = dataUriToBlobUrl(parsed.data, att.mimeType || parsed.mimeType);
        setBlobUrl(url);
      } else {
        setError("No se pudo cargar el archivo — puede que se haya guardado en una sesión anterior sin completarse. Prueba a volver a subirlo desde Admin.");
      }
    } catch {
      setError("No se pudo cargar el archivo.");
    }
    setLoading(false);
  }

  const isImage = att.mimeType?.startsWith("image/");
  const isPdf = att.mimeType === "application/pdf";

  return (
    <div className="rounded-lg border p-3 bg-white" style={{ borderColor: "#00000012" }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} style={{ color: BRAND.blue }} />
          <div className="text-sm font-medium truncate">{att.name}</div>
          <span className="text-[11px] text-gray-400 flex-shrink-0">{att.sizeKB} KB</span>
        </div>
        {!blobUrl && (
          <button onClick={load} disabled={loading} className="text-xs font-semibold flex-shrink-0 flex items-center gap-1" style={{ color: BRAND.red }}>
            {loading && <Loader2 size={12} className="animate-spin" />}
            {loading ? "Cargando..." : "Abrir documento"}
          </button>
        )}
      </div>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      {blobUrl && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <a
              href={blobUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold rounded-md px-3 py-1.5 text-white"
              style={{ backgroundColor: BRAND.red }}
            >
              Abrir en pestaña nueva ↗
            </a>
            <a
              href={blobUrl}
              download={att.name}
              className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-md px-3 py-1.5 border"
              style={{ borderColor: "#00000020", color: BRAND.ink }}
            >
              Descargar ↓
            </a>
          </div>
          {isImage && <img src={blobUrl} alt={att.name} className="max-h-72 rounded-md border mt-2" style={{ borderColor: "#00000012" }} />}
          {isPdf && (
            <div className="text-[11px] text-gray-400">
              La vista previa incrustada de PDF no funciona de forma fiable dentro de este espacio — usa "Abrir en pestaña nueva" o "Descargar" para verlo con el visor de tu navegador.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Pantalla de acceso ---------- */

function TextField({ label, value, onChange, type = "text", placeholder, onEnter, autoFocus }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter && onEnter()}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="mt-1 w-full text-sm rounded-lg border px-3 py-2.5 font-normal text-gray-900"
        style={{ borderColor: "#00000020" }}
      />
    </label>
  );
}

function MicrosoftLogo({ size = 16 }) {
  const s = size / 2;
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function LoginGate({ employees, adminPasswordHash, onEmployeeLogin, onEmployeeCreatePassword, onAdminLogin, onAdminSetup }) {
  // menu | employee-password | employee-verify-email | employee-create-password | admin-password | admin-create-password
  const [mode, setMode] = useState("menu");
  const [typedName, setTypedName] = useState("");
  const [password, setPassword] = useState("");
  const [emailCheck, setEmailCheck] = useState("");
  const [newPass1, setNewPass1] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msBusy, setMsBusy] = useState(false);
  const [msError, setMsError] = useState("");

  async function handleMicrosoftLogin() {
    setMsError("");
    setMsBusy(true);
    try {
      const { email } = await loginWithMicrosoftPopup();
      const normalized = email.trim().toLowerCase();
      const match = employees.find((e) => e.email && e.email.trim().toLowerCase() === normalized);
      if (match) {
        onEmployeeLogin(match.name);
      } else {
        setMsError(`Tu cuenta de Microsoft (${email}) todavía no está registrada aquí. Pide a tu administrador que te dé de alta con este mismo email.`);
      }
    } catch (err) {
      console.error("Error de inicio de sesión con Microsoft:", err);
      if (err?.errorCode !== "user_cancelled") {
        // Mostramos el detalle técnico (código + mensaje de MSAL) para poder
        // diagnosticar problemas de configuración de Azure — no es un dato
        // sensible, es información de depuración normal en este tipo de fallo.
        const detail = err?.errorCode ? `${err.errorCode}${err.errorMessage ? " — " + err.errorMessage.split("\n")[0] : ""}` : String(err?.message || err);
        setMsError(`No se pudo completar el inicio de sesión con Microsoft. Detalle: ${detail}`);
      }
    } finally {
      setMsBusy(false);
    }
  }

  function normalize(s) {
    return s.trim().replace(/\s+/g, " ").toLowerCase();
  }

  function findMatch() {
    const target = normalize(typedName);
    return employees.find((e) => normalize(e.name) === target);
  }

  function goToPassword() {
    if (!typedName.trim()) return;
    setError("");
    setPassword("");
    const match = findMatch();
    if (match && !match.passwordHash) {
      setMode("employee-verify-email");
    } else {
      setMode("employee-password");
    }
  }

  async function submitEmployeePassword() {
    setBusy(true);
    const match = findMatch();
    const hash = await hashPassword(password);
    if (match && match.passwordHash && hash === match.passwordHash) {
      onEmployeeLogin(match.name);
    } else {
      setError("Nombre o contraseña incorrectos.");
    }
    setBusy(false);
  }

  function submitEmailCheck() {
    const match = findMatch();
    if (match && match.email && normalize(match.email) === normalize(emailCheck)) {
      setError("");
      setMode("employee-create-password");
    } else {
      setError("Ese email no coincide con el registrado para ese nombre. Consulta con tu administrador.");
    }
  }

  async function submitCreatePassword() {
    if (newPass1.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPass1 !== newPass2) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError("");
    const hash = await hashPassword(newPass1);
    const match = findMatch();
    await onEmployeeCreatePassword(match.name, hash);
    setBusy(false);
  }

  async function submitAdminPassword() {
    setBusy(true);
    const hash = await hashPassword(password);
    if (hash === adminPasswordHash) {
      onAdminLogin();
    } else {
      setError("Contraseña de administrador incorrecta.");
    }
    setBusy(false);
  }

  async function submitAdminCreate() {
    if (newPass1.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPass1 !== newPass2) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError("");
    const hash = await hashPassword(newPass1);
    await onAdminSetup(hash);
    setBusy(false);
  }

  return (
    <div
      style={{ minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "var(--bg-page)", fontFamily: "var(--font-sans)" }}
    >
      <div style={{ width: "100%", maxWidth: 400, borderRadius: "var(--radius-xl)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", padding: "var(--sp-6)" }}>
        <div className="flex flex-col items-center text-center mb-5">
          <img src="/logo-mb.png" alt="Muñoz Bosch" className="h-14 w-auto mb-3" />
          <div className="font-bold text-lg" style={{ color: BRAND.ink }}>
            Aula Virtual
          </div>
          <div className="text-xs text-gray-400">Acceso con nombre y contraseña</div>
        </div>

        {mode === "menu" && (
          <div>
            {msalIsConfigured && (
              <>
                <button
                  disabled={msBusy}
                  onClick={handleMicrosoftLogin}
                  className="w-full flex items-center justify-center gap-2.5 text-sm font-semibold rounded-lg py-2.5 border transition hover:bg-gray-50 disabled:opacity-60"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  {msBusy ? <Loader2 size={15} className="animate-spin" /> : <MicrosoftLogo size={15} />}
                  Iniciar sesión con Microsoft
                </button>
                {msError && <div className="text-xs mt-2" style={{ color: "var(--danger)" }}>{msError}</div>}
                <div className="flex items-center gap-2 my-4">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] text-gray-400">o con tu nombre y contraseña</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              </>
            )}
            {employees.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4 px-2">
                Todavía no hay empleados registrados. Entra como administrador para añadir el primero.
              </div>
            ) : (
              <div>
                <TextField label="Nombre y apellido" value={typedName} onChange={setTypedName} placeholder="Como está registrado en el equipo" onEnter={goToPassword} autoFocus />
                <button
                  disabled={!typedName.trim()}
                  onClick={goToPassword}
                  className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40 transition-all duration-150 active:scale-[0.98]"
                  style={{ backgroundColor: "var(--brand)" }}
                >
                  Continuar
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] text-gray-400">o</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <button
              onClick={() => {
                setError("");
                setPassword("");
                setNewPass1("");
                setNewPass2("");
                setMode(adminPasswordHash ? "admin-password" : "admin-create-password");
              }}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-lg py-2.5 border transition hover:bg-gray-50"
              style={{ borderColor: "var(--border)", color: "var(--brand)" }}
            >
              <ShieldCheck size={15} /> Acceder como administrador
            </button>
          </div>
        )}

        {mode === "employee-password" && (
          <div>
            <button onClick={() => { setMode("menu"); setError(""); }} className="flex items-center gap-1 text-xs font-semibold text-gray-400 mb-3">
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="flex flex-col items-center mb-3">
              <Avatar name={typedName} size={52} />
              <div className="font-semibold text-sm mt-2">{typedName}</div>
            </div>
            <TextField label="Contraseña" type="password" value={password} onChange={setPassword} onEnter={submitEmployeePassword} autoFocus placeholder="Tu contraseña" />
            <button
              disabled={!password || busy}
              onClick={submitEmployeePassword}
              className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {busy ? "Comprobando..." : "Entrar"}
            </button>
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}

        {mode === "employee-verify-email" && (
          <div>
            <button onClick={() => { setMode("menu"); setError(""); }} className="flex items-center gap-1 text-xs font-semibold text-gray-400 mb-3">
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="flex flex-col items-center mb-3 text-center">
              <Avatar name={typedName} size={52} />
              <div className="font-semibold text-sm mt-2">{typedName}</div>
              <div className="text-[11px] text-gray-400">Primer acceso — confirma tu email registrado para crear tu contraseña</div>
            </div>
            <TextField label="Tu email" type="email" value={emailCheck} onChange={setEmailCheck} onEnter={submitEmailCheck} autoFocus placeholder="nombre@munozbosch.com" />
            <button
              disabled={!emailCheck}
              onClick={submitEmailCheck}
              className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--brand)" }}
            >
              Continuar
            </button>
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}

        {mode === "employee-create-password" && (
          <div>
            <div className="flex flex-col items-center mb-3 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--warning-soft)" }}>
                <KeyRound size={20} style={{ color: "var(--warning)" }} />
              </div>
              <div className="font-semibold text-sm mt-2">Crea tu contraseña</div>
              <div className="text-[11px] text-gray-400">Mínimo 6 caracteres. Que no sea una que uses en otro sitio importante.</div>
            </div>
            <TextField label="Nueva contraseña" type="password" value={newPass1} onChange={setNewPass1} placeholder="Mínimo 6 caracteres" />
            <div className="mt-2">
              <TextField label="Repítela" type="password" value={newPass2} onChange={setNewPass2} onEnter={submitCreatePassword} placeholder="Repite la contraseña" />
            </div>
            <button
              disabled={!newPass1 || !newPass2 || busy}
              onClick={submitCreatePassword}
              className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {busy ? "Creando..." : "Crear contraseña y entrar"}
            </button>
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}

        {mode === "admin-password" && (
          <div>
            <button onClick={() => { setMode("menu"); setError(""); }} className="flex items-center gap-1 text-xs font-semibold text-gray-400 mb-3">
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="flex flex-col items-center mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--brand-soft)" }}>
                <Lock size={20} style={{ color: "var(--brand)" }} />
              </div>
              <div className="font-semibold text-sm mt-2">Acceso administrador</div>
            </div>
            <TextField label="Contraseña de administrador" type="password" value={password} onChange={setPassword} onEnter={submitAdminPassword} autoFocus placeholder="Contraseña" />
            <button
              disabled={!password || busy}
              onClick={submitAdminPassword}
              className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {busy ? "Comprobando..." : "Entrar"}
            </button>
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}

        {mode === "admin-create-password" && (
          <div>
            <button onClick={() => { setMode("menu"); setError(""); }} className="flex items-center gap-1 text-xs font-semibold text-gray-400 mb-3">
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="flex flex-col items-center mb-3 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--warning-soft)" }}>
                <KeyRound size={20} style={{ color: "var(--warning)" }} />
              </div>
              <div className="font-semibold text-sm mt-2">Crea el acceso de administrador</div>
              <div className="text-[11px] text-gray-400">Primer acceso — mínimo 6 caracteres</div>
            </div>
            <TextField label="Contraseña" type="password" value={newPass1} onChange={setNewPass1} placeholder="Mínimo 6 caracteres" />
            <div className="mt-2">
              <TextField label="Repítela" type="password" value={newPass2} onChange={setNewPass2} onEnter={submitAdminCreate} placeholder="Repite la contraseña" />
            </div>
            <button
              disabled={!newPass1 || !newPass2 || busy}
              onClick={submitAdminCreate}
              className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {busy ? "Creando..." : "Crear y entrar"}
            </button>
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- App principal ---------- */

export default function AulaVirtualMB() {
  // Ancho de ventana calculado en JS, no por CSS con media queries — así el
  // texto de las pestañas de arriba (Inicio, Alertas...) se decide aquí
  // mismo, sin depender de que cuadren dos archivos distintos ni de reglas
  // "!important". Umbral generoso a propósito: cualquier portátil, incluso
  // uno modesto, debe quedar muy por encima de esto.
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const isCompactHeader = windowWidth < 700;

  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [courses, setCourses] = useState([]);
  const [news, setNews] = useState([]);
  const [completionsByCourse, setCompletionsByCourse] = useState({});
  const [employees, setEmployees] = useState([]);
  const [groups, setGroups] = useState([]);
  const [paths, setPaths] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [checklistResponses, setChecklistResponses] = useState({});
  const [adminPasswordHash, setAdminPasswordHash] = useState("");
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [loadingTracking, setLoadingTracking] = useState(false);

  const [currentUser, setCurrentUser] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState("dashboard");
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState(null);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [courseOrigin, setCourseOrigin] = useState("catalog");
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [pendingDeepLink, setPendingDeepLink] = useState(null);
  const [deepLinkPuestoTarget, setDeepLinkPuestoTarget] = useState(null);
  const [deepLinkError, setDeepLinkError] = useState("");
  const [celebration, setCelebration] = useState(null);

  // Enlace directo a una formación o ruta: se lee de la URL una sola vez, al
  // cargar la página — antes de que la persona haya iniciado sesión siquiera.
  // Se guarda para aplicarlo en cuanto haya alguien identificado.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkCourseId = params.get("course");
    const linkPathId = params.get("path");
    const linkPuestoId = params.get("puesto");
    if (linkCourseId) {
      setPendingDeepLink({ type: "course", id: linkCourseId });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (linkPathId) {
      setPendingDeepLink({ type: "path", id: linkPathId });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (linkPuestoId) {
      setPendingDeepLink({ type: "puesto", id: linkPuestoId });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    setGlobalStorageErrorHandler((msg) => setStorageError(msg));
    return () => setGlobalStorageErrorHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      const [c, n, emp, grp, pwHash, lastBk, sUrl, pth, pst, chkResp] = await Promise.all([
        loadKey("mb_courses", null),
        loadKey("mb_news", null),
        loadKey("mb_employees", []),
        loadKey("mb_groups", []),
        loadKey("mb_admin_pin", ""),
        loadKey("mb_last_backup_at", null),
        loadKey("mb_sheets_webapp_url", ""),
        loadKey("mb_paths", []),
        loadKey("mb_puestos", null),
        loadKey("mb_checklist_responses", {}),
      ]);
      let finalCourses = c;
      let finalNews = n;
      if (finalCourses === null) {
        finalCourses = await materializeSeedCourses(SEED_COURSES);
        saveKey("mb_courses", finalCourses);
      }
      if (finalNews === null) {
        finalNews = SEED_NEWS;
        saveKey("mb_news", finalNews);
      }
      // migración: empleados antiguos guardados como strings, o con "pin" (sistema anterior) ->
      // objetos {name, passwordHash, email}. Un "pin" antiguo no se puede convertir en hash
      // (no sabemos el valor original una vez creado), así que esas personas simplemente
      // crean su contraseña de nuevo la próxima vez, verificando su email.
      const normalizedEmployees = (emp || []).map((e) => {
        if (typeof e === "string") return { name: e, passwordHash: null, email: "", managedGroupIds: [] };
        const { pin, pinProvided, ...rest } = e;
        const validHash = isValidHash(rest.passwordHash) ? rest.passwordHash : null;
        return { email: "", managedGroupIds: [], ...rest, passwordHash: validHash };
      });
      setCourses(finalCourses);
      setNews(finalNews);
      setEmployees(normalizedEmployees);
      setGroups(grp || []);
      // Igual que con los empleados: un PIN antiguo de 4 dígitos no es un hash válido.
      // Si detectamos que lo guardado no tiene forma de hash SHA-256, lo tratamos como
      // "sin configurar todavía", para que se pueda crear una contraseña nueva sin
      // quedarse bloqueado.
      setAdminPasswordHash(isValidHash(pwHash) ? pwHash : "");
      setLastBackupAt(lastBk);
      setSheetsUrl(sUrl || "");
      setPaths(pth || []);
      let finalPuestos = pst;
      if (!finalPuestos || finalPuestos.length === 0) {
        finalPuestos = SEED_PUESTOS;
        saveKey("mb_puestos", finalPuestos);
      }
      setPuestos(finalPuestos);
      setChecklistResponses(chkResp || {});

      // Sesión recordada en este navegador: si hay una guardada y sigue siendo válida,
      // entra directamente sin volver a pedir nombre/contraseña.
      const session = loadSession();
      if (session?.type === "admin") {
        setIsAdmin(true);
      } else if (session?.type === "employee") {
        const stillExists = normalizedEmployees.some((e) => e.name === session.name);
        if (stillExists) {
          setCurrentUser(session.name);
          const assignedIds = finalCourses.filter((c2) => isAssignedToUser(c2, session.name, grp || [])).map((c2) => c2.id);
          ensureCompletionsForCourses(assignedIds);
        } else {
          clearSession();
        }
      }

      setLoading(false);
    })();
  }, []);

  // Aplicar el enlace directo en cuanto haya alguien identificado (recién
  // logueado, o con sesión ya recordada) y los datos estén cargados.
  useEffect(() => {
    if (loading || !pendingDeepLink) return;
    if (pendingDeepLink.type === "puesto") {
      // Los puestos solo los gestiona un admin (o un responsable, dentro de
      // "Mi equipo") — a diferencia de formaciones y rutas, no hace falta
      // haber entrado como un empleado concreto para que esto se aplique.
      if (!isAdmin) return;
      const exists = puestos.some((p) => p.id === pendingDeepLink.id);
      if (exists) {
        setDeepLinkPuestoTarget(pendingDeepLink.id);
        setView("admin");
      } else {
        setDeepLinkError("El enlace que has abierto no corresponde a ningún puesto existente. Puede que se haya eliminado.");
      }
      setPendingDeepLink(null);
      return;
    }
    if (!currentUser) return;
    if (pendingDeepLink.type === "course") {
      const exists = courses.some((c) => c.id === pendingDeepLink.id);
      if (exists) {
        openCourse(pendingDeepLink.id);
      } else {
        setDeepLinkError("El enlace que has abierto no corresponde a ninguna formación existente. Puede que se haya eliminado.");
      }
    } else if (pendingDeepLink.type === "path") {
      const exists = paths.some((p) => p.id === pendingDeepLink.id);
      if (exists) {
        setSelectedPathId(pendingDeepLink.id);
        setView("path-detail");
      } else {
        setDeepLinkError("El enlace que has abierto no corresponde a ninguna ruta existente. Puede que se haya eliminado.");
      }
    }
    setPendingDeepLink(null);
  }, [loading, currentUser, isAdmin, pendingDeepLink, courses, paths, puestos]);

  const activeCourse = useMemo(() => courses.find((c) => c.id === activeCourseId) || null, [courses, activeCourseId]);

  async function ensureCourseCompletionsLoaded(courseId, force = false) {
    if (!force && completionsByCourse[courseId] !== undefined) return completionsByCourse[courseId];
    const data = await loadKey(`mb_completions_course_${courseId}`, {});
    setCompletionsByCourse((prev) => ({ ...prev, [courseId]: data }));
    return data;
  }
  async function ensureCompletionsForCourses(courseIds) {
    await Promise.all(courseIds.map((id) => ensureCourseCompletionsLoaded(id)));
  }
  async function loadAllCompletionsForTracking() {
    setLoadingTracking(true);
    await Promise.all(courses.map((c) => ensureCourseCompletionsLoaded(c.id, true)));
    setLoadingTracking(false);
  }

  function getStatus(user, courseId) {
    const rec = completionsByCourse[courseId]?.[user];
    if (!rec) return "pendiente";
    if (rec.status === "completada") {
      const course = courses.find((c) => c.id === courseId);
      if (isCourseExpired(course, rec)) return "pendiente";
    }
    return rec.status;
  }
  function getRecord(user, courseId) {
    return completionsByCourse[courseId]?.[user] || null;
  }

  async function markStarted(courseId) {
    if (!currentUser) return;
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    if (current[currentUser]) {
      setCompletionsByCourse((prev) => ({ ...prev, [courseId]: current }));
      return;
    }
    const updated = { ...current, [currentUser]: { status: "en_progreso", startedAt: todayISO(), attempts: 0 } };
    setCompletionsByCourse((prev) => ({ ...prev, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
  }

  const [moduleOriginCourseId, setModuleOriginCourseId] = useState(null);

  async function openCourse(courseId, origin = "catalog") {
    if (origin === "module") setModuleOriginCourseId(activeCourseId);
    setActiveCourseId(courseId);
    setQuizAnswers({});
    setQuizResult(null);
    setCourseOrigin(origin);
    setView("course");
    await ensureCourseCompletionsLoaded(courseId);
    markStarted(courseId);
  }

  async function submitQuiz() {
    if (!activeCourse || !currentUser) return;
    const quiz = activeCourse.quiz || [];
    let correctCount = 0;
    quiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) correctCount++;
    });
    const score = quiz.length ? Math.round((correctCount / quiz.length) * 100) : 100;
    const passed = score >= (activeCourse.passPct ?? 70);
    // lectura fresca justo antes de escribir, para minimizar la ventana de colisión
    // con otra persona completando la MISMA formación casi al mismo tiempo.
    const current = await loadKey(`mb_completions_course_${activeCourse.id}`, {});
    const prev = current[currentUser] || { attempts: 0 };
    const newRec = {
      ...prev,
      status: "en_progreso",
      startedAt: prev.startedAt || todayISO(),
      completedAt: null,
      score,
      attempts: (prev.attempts || 0) + 1,
      quizPassed: passed,
    };
    newRec.awaitingRating = computeAwaitingRating(activeCourse, newRec);
    const updated = { ...current, [currentUser]: newRec };
    setCompletionsByCourse((prevState) => ({ ...prevState, [activeCourse.id]: updated }));
    await saveKey(`mb_completions_course_${activeCourse.id}`, updated);
    setQuizResult({ score, passed, correctCount, total: quiz.length });
  }

  // Formaciones "por módulos": cada módulo tiene su propio mini-test, y hay que
  // aprobar uno para desbloquear el siguiente. Al aprobar el último módulo, la
  // formación queda "a la espera de valoración" — no se da por completada del
  // todo hasta que la persona puntúa (ver rateCourse) y, si la formación tiene
  // caso práctico, hasta que lo envía también.
  //
  // Un módulo ahora puede depender de más cosas que su propio test (ver
  // isModulePassed) — esta función central recalcula el estado de un módulo
  // concreto y, con eso, si la formación entera queda lista para valorar.
  // La usan submitModuleQuiz, submitModulePracticalCase y
  // toggleModuleChecklistStep, para no repetir la misma lógica tres veces.
  async function recomputeModuleState(courseId, moduleId, progressPatch) {
    const course = courses.find((c) => c.id === courseId);
    const moduleObj = course?.modules?.find((m) => m.id === moduleId);
    if (!course || !moduleObj) return null;

    // Comprobamos las formaciones requisito leyendo directamente de Supabase,
    // no del estado de React — que podría no estar actualizado todavía si la
    // persona nunca abrió esa formación en esta misma sesión.
    const requiredIds = (moduleObj.relatedCourses || []).filter((rc) => rc.mode === "requisito").map((rc) => rc.courseId);
    const requiredCompletionsFresh = {};
    for (const rid of requiredIds) {
      requiredCompletionsFresh[rid] = await ensureCourseCompletionsLoaded(rid);
    }
    const completionsForCheck = { ...completionsByCourse, ...requiredCompletionsFresh };

    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const prevRec = current[currentUser] || { startedAt: todayISO(), moduleProgress: {} };
    const prevModuleRec = prevRec.moduleProgress?.[moduleId] || {};
    const mergedModuleRec = { ...prevModuleRec, ...progressPatch };
    const quizPassed = "quizPassed" in mergedModuleRec ? mergedModuleRec.quizPassed : !!prevModuleRec.quizPassed;
    const passed = isModulePassed(moduleObj, quizPassed, currentUser, completionsForCheck, mergedModuleRec);

    const moduleProgress = { ...(prevRec.moduleProgress || {}), [moduleId]: { ...mergedModuleRec, quizPassed, passed } };
    const allPassed = (course.modules || []).every((m) => moduleProgress[m.id]?.passed);
    const updatedRec = { ...prevRec, status: "en_progreso", moduleProgress, completedAt: null, quizPassed: allPassed };
    updatedRec.awaitingRating = computeAwaitingRating(course, updatedRec);
    const updated = { ...current, [currentUser]: updatedRec };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
    return moduleProgress[moduleId];
  }

  async function submitModuleQuiz(courseId, moduleObj) {
    if (!currentUser) return null;
    const quiz = moduleObj.quiz || [];
    let correctCount = 0;
    quiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) correctCount++;
    });
    const score = quiz.length ? Math.round((correctCount / quiz.length) * 100) : 100;
    const quizPassed = score >= (moduleObj.passPct ?? 70);

    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const prevModuleRec = current[currentUser]?.moduleProgress?.[moduleObj.id];
    const attempts = (prevModuleRec?.attempts || 0) + 1;

    const finalModuleRec = await recomputeModuleState(courseId, moduleObj.id, {
      quizPassed, score, attempts,
      completedAt: quizPassed ? todayISO() : prevModuleRec?.completedAt || null,
    });

    const result = { score, passed: finalModuleRec?.passed ?? quizPassed, quizPassed, correctCount, total: quiz.length };
    setQuizResult(result);
    return result;
  }

  // Enviar el caso práctico de un módulo concreto — recalcula si eso era lo
  // único que faltaba para dar el módulo por aprobado.
  async function submitModulePracticalCase(courseId, moduleId, text) {
    if (!currentUser || !text.trim()) return;
    await recomputeModuleState(courseId, moduleId, {
      practicalCaseAnswer: { text: text.trim(), submittedAt: todayISO(), status: "enviado" },
    });
  }

  // Marcar/desmarcar un paso del checklist rápido de un módulo.
  async function toggleModuleChecklistStep(courseId, moduleId, stepId) {
    if (!currentUser) return;
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const prevChecked = current[currentUser]?.moduleProgress?.[moduleId]?.checklistChecked || {};
    await recomputeModuleState(courseId, moduleId, {
      checklistChecked: { ...prevChecked, [stepId]: !prevChecked[stepId] },
    });
  }

  async function selfReportComplete(courseId) {
    if (!currentUser) return;
    const course = courses.find((c) => c.id === courseId);
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const prev = current[currentUser] || { attempts: 0 };
    const newRec = {
      ...prev,
      status: "en_progreso",
      startedAt: prev.startedAt || todayISO(),
      completedAt: null,
      score: null,
      selfReported: true,
      attempts: (prev.attempts || 0) + 1,
      quizPassed: true,
    };
    newRec.awaitingRating = computeAwaitingRating(course, newRec);
    const updated = { ...current, [currentUser]: newRec };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
  }

  // Caso práctico: la persona escribe su respuesta libremente. Contar como
  // "enviado" es lo que hace falta para poder completar la formación — la
  // corrección de un admin/responsable es un paso aparte, después, que no
  // bloquea que la persona siga adelante con su día.
  async function submitPracticalCase(courseId, text) {
    if (!currentUser || !text.trim()) return;
    const course = courses.find((c) => c.id === courseId);
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const prev = current[currentUser] || { attempts: 0, startedAt: todayISO() };
    const newRec = {
      ...prev,
      practicalCaseAnswer: {
        text: text.trim(),
        submittedAt: todayISO(),
        status: "enviado",
        feedback: null,
        correctedBy: null,
        correctedAt: null,
      },
    };
    newRec.awaitingRating = computeAwaitingRating(course, newRec);
    const updated = { ...current, [currentUser]: newRec };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
  }

  // Corrección de un caso práctico: la hace un admin o un responsable, nunca
  // la propia persona que respondió. No cambia si la formación cuenta como
  // completada (eso ya pasó al enviarlo) — es solo la devolución de feedback.
  async function correctPracticalCase(courseId, employeeName, feedback) {
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    if (!current[employeeName]?.practicalCaseAnswer) return;
    const updated = {
      ...current,
      [employeeName]: {
        ...current[employeeName],
        practicalCaseAnswer: {
          ...current[employeeName].practicalCaseAnswer,
          status: "corregido",
          feedback: feedback.trim(),
          correctedBy: currentUser || "Administrador",
          correctedAt: todayISO(),
        },
      },
    };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
  }

  // Igual que correctPracticalCase, pero para el caso práctico DENTRO de un
  // módulo concreto, que se guarda anidado en moduleProgress — se le había
  // construido su envío pero nunca su corrección.
  async function correctModulePracticalCase(courseId, moduleId, employeeName, feedback) {
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const moduleRec = current[employeeName]?.moduleProgress?.[moduleId];
    if (!moduleRec?.practicalCaseAnswer) return;
    const updated = {
      ...current,
      [employeeName]: {
        ...current[employeeName],
        moduleProgress: {
          ...current[employeeName].moduleProgress,
          [moduleId]: {
            ...moduleRec,
            practicalCaseAnswer: {
              ...moduleRec.practicalCaseAnswer,
              status: "corregido",
              feedback: feedback.trim(),
              correctedBy: currentUser || "Administrador",
              correctedAt: todayISO(),
            },
          },
        },
      },
    };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
  }

  // Valoración (1-5 estrellas + comentario opcional). Ahora es el paso que
  // realmente cierra una formación: si estaba "a la espera de valoración"
  // (awaitingRating), al valorar pasa a "completada" de verdad, con fecha de
  // hoy. Si ya estaba completada de antes (por ejemplo, alguien que cambia su
  // valoración más adelante), simplemente actualiza la nota sin tocar el resto.
  // El único caso en que un formulario externo (Google Form) queda marcado
  // "revisado" es cuando alguien con permiso de administración lo comprueba a
  // mano por fuera de la app — la propia app nunca puede saber qué se
  // respondió, así que esto es deliberadamente manual.
  async function markFormReviewed(courseId, employeeName) {
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    if (!current[employeeName]) return;
    const updated = { ...current, [employeeName]: { ...current[employeeName], formReviewed: true } };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
  }

  async function rateCourse(courseId, rating, comment) {
    if (!currentUser) return;
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const prev = current[currentUser];
    if (!prev) return;
    const wasAwaiting = !!prev.awaitingRating;
    const updated = {
      ...current,
      [currentUser]: {
        ...prev,
        rating,
        ratingComment: comment || "",
        ratedAt: todayISO(),
        status: wasAwaiting ? "completada" : prev.status,
        completedAt: wasAwaiting ? todayISO() : prev.completedAt,
        awaitingRating: false,
      },
    };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
    if (wasAwaiting) {
      const course = courses.find((c) => c.id === courseId);
      setCelebration({ title: course?.title || "Formación completada" });
    }
  }

  async function manualSetStatus(courseId, employeeName, status) {
    if (!courseId || !employeeName) return;
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const prev = current[employeeName] || { attempts: 0 };
    const updated = {
      ...current,
      [employeeName]: {
        ...prev,
        status,
        completedAt: status === "completada" ? prev.completedAt || todayISO() : null,
        manualOverride: true,
      },
    };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
  }

  const pendingForUser = useMemo(() => {
    if (!currentUser) return [];
    return courses
      .filter((c) => isAssignedToUser(c, currentUser, groups) && getStatus(currentUser, c.id) !== "completada")
      .sort((a, b) => {
        const da = a.deadline ? daysUntil(a.deadline) : 9999;
        const db = b.deadline ? daysUntil(b.deadline) : 9999;
        return da - db;
      });
  }, [courses, completionsByCourse, currentUser, groups]);

  const completedForUser = useMemo(() => {
    if (!currentUser) return [];
    return courses.filter((c) => isAssignedToUser(c, currentUser, groups) && getStatus(currentUser, c.id) === "completada");
  }, [courses, completionsByCourse, currentUser, groups]);

  // Para puntos e insignias: cuenta TODO lo que la persona alguna vez
  // completó, aunque esa formación se haya archivado después — archivar es
  // para despejar el catálogo, nunca para quitarle a nadie algo ya ganado.
  const completedForUserIncludingArchived = useMemo(() => {
    if (!currentUser) return [];
    return courses.filter((c) => isAssignedIgnoringArchived(c, currentUser, groups) && getStatus(currentUser, c.id) === "completada");
  }, [courses, completionsByCourse, currentUser, groups]);

  // Alertas: solo lo que ya venció, o lo que vence en 3 días o menos.
  const overdueForUser = useMemo(() => pendingForUser.filter((c) => c.deadline && daysUntil(c.deadline) < 0), [pendingForUser]);
  const dueSoonForUser = useMemo(() => pendingForUser.filter((c) => c.deadline && daysUntil(c.deadline) >= 0 && daysUntil(c.deadline) <= 3), [pendingForUser]);
  const alertCount = overdueForUser.length + dueSoonForUser.length;

  const pathsForUser = useMemo(() => {
    if (!currentUser) return [];
    return paths.filter((p) => isAssignedToUser(p, currentUser, groups));
  }, [paths, currentUser, groups]);

  // Rutas que todavía no ha terminado (al menos una formación pendiente dentro)
  // — esto es lo que dispara el aviso en Inicio y el número en la pestaña "Rutas".
  const pendingPathsForUser = useMemo(() => {
    if (!currentUser) return [];
    return pathsForUser.filter((p) => {
      const pathCourses = p.courseIds.map((id) => courses.find((c) => c.id === id)).filter(Boolean);
      if (pathCourses.length === 0) return false;
      return pathCourses.some((c) => getStatus(currentUser, c.id) !== "completada");
    });
  }, [pathsForUser, courses, currentUser, completionsByCourse]);

  // Si la persona que ha iniciado sesión es responsable de algún equipo, esto
  // no está vacío — determina si ve la pestaña "Mi equipo" y con qué alcance.
  const myManagedGroupIds = useMemo(() => {
    if (!currentUser) return [];
    return employees.find((e) => e.name === currentUser)?.managedGroupIds || [];
  }, [employees, currentUser]);

  // Estado de cada miembro del equipo que gestiona esta persona (si es
  // responsable de alguno) — para el panel visual en su propio Inicio.
  const myTeamStatus = useMemo(() => {
    if (myManagedGroupIds.length === 0) return [];
    const memberNames = new Set();
    for (const g of groups) {
      if (myManagedGroupIds.includes(g.id)) {
        for (const n of g.memberNames || []) memberNames.add(n);
      }
    }
    return Array.from(memberNames).map((name) => {
      let pending = 0, overdue = 0;
      for (const c of courses) {
        if (!isAssignedToUser(c, name, groups)) continue;
        if (getStatus(name, c.id) === "completada") continue;
        pending++;
        if (c.deadline && daysUntil(c.deadline) < 0) overdue++;
      }
      return { name, pending, overdue };
    });
  }, [myManagedGroupIds, groups, courses, completionsByCourse]);

  const assignedCountForUser = useMemo(() => {
    if (!currentUser) return 0;
    return courses.filter((c) => isAssignedToUser(c, currentUser, groups)).length;
  }, [courses, currentUser, groups]);

  const progressPercent = useMemo(() => {
    if (!currentUser || assignedCountForUser === 0) return 0;
    return Math.round((completedForUser.length / assignedCountForUser) * 100);
  }, [completedForUser, assignedCountForUser, currentUser]);

  const POINTS_PER_COURSE = 100;
  const pointsForUser = useMemo(() => completedForUserIncludingArchived.length * POINTS_PER_COURSE, [completedForUserIncludingArchived]);
  const levelForUser = useMemo(() => levelForPoints(pointsForUser), [pointsForUser]);

  const badgesForUser = useMemo(() => {
    if (!currentUser) return [];
    const badges = [];
    const n = completedForUserIncludingArchived.length;
    if (n >= 1) badges.push({ id: "first", label: "Primera formación completada", icon: Star });
    if (n >= 5) badges.push({ id: "five", label: "5 formaciones completadas", icon: Award });
    if (n >= 10) badges.push({ id: "ten", label: "10 formaciones completadas", icon: Trophy });
    for (const cat of CATEGORIES) {
      // Igual que con los puntos: si alguien ya se había hecho todas las
      // formaciones de una categoría y luego se archiva alguna, la insignia
      // de "Experto" no debe desaparecer por eso.
      const assignedInCat = courses.filter((c) => c.category === cat.id && isAssignedIgnoringArchived(c, currentUser, groups));
      if (assignedInCat.length > 0 && assignedInCat.every((c) => getStatus(currentUser, c.id) === "completada")) {
        badges.push({ id: `cat-${cat.id}`, label: `Experto en ${cat.label}`, icon: cat.icon });
      }
    }
    if (assignedCountForUser > 0 && pendingForUser.length === 0) {
      badges.push({ id: "uptodate", label: "Al día con todo", icon: PartyPopper });
    }
    if (pathsForUser.length > 0 && pathsForUser.every((p) => isPathFullyCompleted(p, courses, currentUser, getStatus))) {
      badges.push({ id: "path-master", label: "Ruta completada", icon: Map });
    }
    return badges;
  }, [completedForUserIncludingArchived, courses, currentUser, groups, pendingForUser, assignedCountForUser, pathsForUser, completionsByCourse]);

  async function addGroup(name) {
    if (!name.trim() || groups.some((g) => g.name === name.trim())) return;
    const updated = [...groups, { id: uid(), name: name.trim(), memberNames: [] }];
    setGroups(updated);
    saveKey("mb_groups", updated);
  }
  async function deleteGroup(id) {
    const updated = groups.filter((g) => g.id !== id);
    setGroups(updated);
    saveKey("mb_groups", updated);
    // Si algún puesto pertenecía a este departamento, se queda sin
    // departamento en vez de apuntar a uno que ya no existe — si no, su
    // checklist se volvería invisible para cualquier responsable, sin que
    // nadie se enterara.
    const affectedPuestos = puestos.filter((p) => p.groupId === id);
    if (affectedPuestos.length > 0) {
      const updatedPuestos = puestos.map((p) => (p.groupId === id ? { ...p, groupId: null } : p));
      setPuestos(updatedPuestos);
      await saveKey("mb_puestos", updatedPuestos);
    }
  }
  async function updateGroupMembers(id, memberNames) {
    const updated = groups.map((g) => (g.id === id ? { ...g, memberNames } : g));
    setGroups(updated);
    saveKey("mb_groups", updated);
  }

  // Rutas de aprendizaje: encadenan formaciones completas ya existentes, en un
  // orden fijo. No necesitan su propio sistema de progreso — se calcula sobre
  // la marcha a partir del estado real de cada formación (getStatus), así que
  // si alguien ya había completado una formación antes de que se creara la
  // ruta, ya cuenta hecha dentro de la ruta también.
  async function savePath(path) {
    let updated;
    if (paths.find((p) => p.id === path.id)) updated = paths.map((p) => (p.id === path.id ? path : p));
    else updated = [...paths, path];
    setPaths(updated);
    await saveKey("mb_paths", updated);
  }
  async function deletePath(id) {
    const updated = paths.filter((p) => p.id !== id);
    setPaths(updated);
    await saveKey("mb_paths", updated);
  }

  // Puestos: cada uno lleva su propio checklist de conocimientos/aptitudes/
  // habilidades. Asignarle un puesto a alguien es opcional — si no tiene, no
  // le aparece ningún checklist, sin más.
  async function savePuesto(puesto) {
    let updated;
    if (puestos.find((p) => p.id === puesto.id)) updated = puestos.map((p) => (p.id === puesto.id ? puesto : p));
    else updated = [...puestos, puesto];
    setPuestos(updated);
    await saveKey("mb_puestos", updated);
  }
  async function deletePuesto(id) {
    const updated = puestos.filter((p) => p.id !== id);
    setPuestos(updated);
    await saveKey("mb_puestos", updated);
    // A quien tuviera este puesto, se lo quitamos — que no se quede alguien
    // apuntando a un puesto que ya no existe.
    const updatedEmployees = employees.map((e) => (e.puestoId === id ? { ...e, puestoId: null, puestoAssignedAt: null } : e));
    setEmployees(updatedEmployees);
    await saveKey("mb_employees", updatedEmployees);
    // Las evaluaciones de checklist ya dadas para este puesto también se
    // limpian — si no, se quedan guardadas para siempre apuntando a un
    // puesto que ya no existe, sin que nadie las vuelva a ver nunca.
    const affectedNames = Object.keys(checklistResponses).filter((name) => checklistResponses[name]?.puestoId === id);
    if (affectedNames.length > 0) {
      const updatedResponses = { ...checklistResponses };
      for (const name of affectedNames) delete updatedResponses[name];
      setChecklistResponses(updatedResponses);
      await saveKey("mb_checklist_responses", updatedResponses);
    }
  }

  // Asignar puesto a una persona (o a varias de golpe, para la asignación en
  // masa). Se guarda también la fecha en que se le asignó — es lo que
  // permite calcular su plazo individual, ya que cada persona puede empezar
  // en un momento distinto.
  async function assignPuesto(employeeNames, puestoId) {
    const updated = employees.map((e) =>
      employeeNames.includes(e.name) ? { ...e, puestoId: puestoId || null, puestoAssignedAt: puestoId ? todayISO() : null } : e
    );
    setEmployees(updated);
    await saveKey("mb_employees", updated);
  }

  // El checklist de puesto ya no lo rellena la propia persona — lo evalúa
  // directamente su responsable o un admin (ver validateChecklistItem, más
  // abajo). Se guarda igual, sin importar quién lo puso, así que un solo
  // formato de registro vale para todo.

  // Validación de un admin/responsable: confirma o ajusta el nivel que puso
  // la propia persona. No hace falta esperar a validar todos los ítems de
  // golpe — se puede ir revisando uno a uno, a su ritmo.
  // Quien evalúa cada ítem es siempre el responsable o un admin — nunca la
  // propia persona. Funciona igual la primera vez (no hay nada guardado
  // todavía) que al corregir algo puesto anteriormente.
  async function validateChecklistItem(employeeName, itemId, level) {
    const current = await loadKey("mb_checklist_responses", {});
    const prevEntry = current[employeeName] || { responses: {} };
    const updated = {
      ...current,
      [employeeName]: {
        ...prevEntry,
        responses: {
          ...prevEntry.responses,
          [itemId]: { level, updatedAt: todayISO(), updatedBy: currentUser || "Administrador", validated: true },
        },
      },
    };
    setChecklistResponses(updated);
    await saveKey("mb_checklist_responses", updated);
  }

  async function saveSheetsUrl(url) {
    setSheetsUrl(url);
    await saveKey("mb_sheets_webapp_url", url);
  }

  async function exportBackup(includeAttachments) {
    const allCompletions = {};
    for (const c of courses) {
      const rec = await loadKey(`mb_completions_course_${c.id}`, null);
      if (rec) allCompletions[c.id] = rec;
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      courses, news, employees, groups, completionsByCourse: allCompletions, adminPasswordHash,
      // Añadido cuando se construyeron Rutas, Puestos y el checklist —
      // antes de esto, la copia de seguridad se quedaba corta y no lo
      // incluía, con el riesgo de perderlo todo si alguna vez hiciera falta
      // restaurar.
      paths, puestos, checklistResponses,
    };
    if (includeAttachments) {
      const attachmentsData = {};
      for (const c of courses) {
        for (const att of c.attachments || []) {
          const data = await loadKey(att.storageKey, null);
          if (data) attachmentsData[att.storageKey] = data;
        }
        // Los documentos adjuntos dentro de cada módulo son adjuntos aparte,
        // con su propia storageKey — hay que recorrerlos también, o se
        // quedarían fuera de la copia igual que antes.
        for (const mod of c.modules || []) {
          for (const att of mod.attachments || []) {
            if (att.storageKey) {
              const data = await loadKey(att.storageKey, null);
              if (data) attachmentsData[att.storageKey] = data;
            }
          }
        }
      }
      payload.attachmentsData = attachmentsData;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aula-virtual-mb-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const now = new Date().toISOString();
    setLastBackupAt(now);
    await saveKey("mb_last_backup_at", now);
  }

  async function importBackup(payload) {
    if (payload.courses) {
      setCourses(payload.courses);
      await saveKey("mb_courses", payload.courses);
    }
    if (payload.news) {
      setNews(payload.news);
      await saveKey("mb_news", payload.news);
    }
    if (payload.employees) {
      setEmployees(payload.employees);
      await saveKey("mb_employees", payload.employees);
    }
    if (payload.groups) {
      setGroups(payload.groups);
      await saveKey("mb_groups", payload.groups);
    }
    if (payload.paths) {
      setPaths(payload.paths);
      await saveKey("mb_paths", payload.paths);
    }
    if (payload.puestos) {
      setPuestos(payload.puestos);
      await saveKey("mb_puestos", payload.puestos);
    }
    if (payload.checklistResponses) {
      setChecklistResponses(payload.checklistResponses);
      await saveKey("mb_checklist_responses", payload.checklistResponses);
    }
    if (payload.completionsByCourse) {
      for (const [courseId, data] of Object.entries(payload.completionsByCourse)) {
        await saveKey(`mb_completions_course_${courseId}`, data);
      }
      setCompletionsByCourse(payload.completionsByCourse);
    } else if (payload.completions) {
      // compatibilidad con copias antiguas (formato plano "empleado::curso")
      const grouped = {};
      for (const [key, rec] of Object.entries(payload.completions)) {
        const [user, courseId] = key.split("::");
        grouped[courseId] = grouped[courseId] || {};
        grouped[courseId][user] = rec;
      }
      for (const [courseId, data] of Object.entries(grouped)) {
        await saveKey(`mb_completions_course_${courseId}`, data);
      }
      setCompletionsByCourse(grouped);
    }
    if (payload.adminPasswordHash) {
      setAdminPasswordHash(payload.adminPasswordHash);
      await saveKey("mb_admin_pin", payload.adminPasswordHash);
    } else if (payload.adminPin) {
      // compatibilidad con copias muy antiguas (sistema de PIN previo) — ya no es
      // un hash válido para el nuevo sistema, así que no se restaura tal cual.
    }
    if (payload.attachmentsData) {
      for (const [key, val] of Object.entries(payload.attachmentsData)) {
        await saveKey(key, val);
      }
    }
  }

  async function addEmployee(name, email) {
    if (!name.trim() || employees.some((e) => e.name === name.trim())) return;
    const trimmedName = name.trim();
    const updated = [
      ...employees,
      { name: trimmedName, passwordHash: null, email: email.trim(), phone: "", hireDate: todayISO(), status: "activo", statusNote: "", notes: "" },
    ];
    setEmployees(updated);
    await saveKey("mb_employees", updated);
    await assignWelcomePathsToNewEmployees([trimmedName]);
  }

  // Actualiza cualquier combinación de campos de la ficha de una persona de
  // una sola vez — nombre, teléfono, fecha de incorporación, estado, notas.
  // El nombre es especial: si cambia, hay que renombrar también sus datos en
  // otros sitios (progreso de formaciones, checklist de puesto), así que se
  // delega en renameEmployee para esa parte concreta.
  async function updateEmployeeProfile(name, fields) {
    if (fields.name && fields.name.trim() !== name) {
      const result = await renameEmployee(name, fields.name);
      if (!result.ok) return result;
      name = fields.name.trim();
    }
    const { name: _omit, ...rest } = fields;
    if (Object.keys(rest).length > 0) {
      const updated = employees.map((e) => (e.name === name ? { ...e, ...rest } : e));
      setEmployees(updated);
      await saveKey("mb_employees", updated);
    }
    return { ok: true };
  }

  // Añade o quita a una persona de un departamento (grupo) desde su propia
  // ficha — antes solo se podía hacer al revés, entrando a editar el grupo.
  async function toggleEmployeeGroup(employeeName, groupId) {
    const updated = groups.map((g) => {
      if (g.id !== groupId) return g;
      const isMember = (g.memberNames || []).includes(employeeName);
      return { ...g, memberNames: isMember ? g.memberNames.filter((n) => n !== employeeName) : [...(g.memberNames || []), employeeName] };
    });
    setGroups(updated);
    await saveKey("mb_groups", updated);
  }

  // Si hay alguna ruta marcada como "de bienvenida", cualquier persona nueva
  // (dada de alta una a una o importada por Excel) queda apuntada a ella sola,
  // sin que el administrador tenga que asignarla a mano cada vez. No toca el
  // modo de asignación de la ruta (todos/grupos/personas) — solo añade a la
  // lista de "extras" que isAssignedToUser también comprueba.
  async function assignWelcomePathsToNewEmployees(newNames) {
    if (newNames.length === 0) return;
    const current = await loadKey("mb_paths", paths);
    const welcomePaths = (current || []).filter((p) => p.isWelcomePath);
    if (welcomePaths.length === 0) return;
    const updated = (current || []).map((p) => {
      if (!p.isWelcomePath) return p;
      const existingExtra = p.assignment?.extraNames || [];
      const merged = Array.from(new Set([...existingExtra, ...newNames]));
      return { ...p, assignment: { ...(p.assignment || { mode: "individual", groupIds: [], employeeNames: [] }), extraNames: merged } };
    });
    setPaths(updated);
    await saveKey("mb_paths", updated);
  }
  async function removeEmployee(name) {
    const updated = employees.filter((e) => e.name !== name);
    setEmployees(updated);
    saveKey("mb_employees", updated);
    if (currentUser === name) setCurrentUser("");

    // Se le quita también de cualquier grupo al que perteneciera — si no, se
    // queda "fantasma" en la lista de miembros de un equipo del que ya no
    // forma parte.
    const affectedGroups = groups.filter((g) => (g.memberNames || []).includes(name));
    if (affectedGroups.length > 0) {
      const updatedGroups = groups.map((g) => ((g.memberNames || []).includes(name) ? { ...g, memberNames: g.memberNames.filter((n) => n !== name) } : g));
      setGroups(updatedGroups);
      await saveKey("mb_groups", updatedGroups);
    }

    // Y su checklist de puesto, si tenía uno — igual que al borrar el propio
    // puesto, no tiene sentido dejarlo apuntando a alguien que ya no existe.
    if (checklistResponses[name]) {
      const updatedChecklist = { ...checklistResponses };
      delete updatedChecklist[name];
      setChecklistResponses(updatedChecklist);
      await saveKey("mb_checklist_responses", updatedChecklist);
    }
  }
  // Borra la contraseña de alguien (no se puede "ver", solo restablecer) — la
  // próxima vez que esa persona entre, tendrá que crear una contraseña nueva
  // verificando su email, igual que la primera vez.
  async function resetEmployeePassword(name) {
    const updated = employees.map((e) => (e.name === name ? { ...e, passwordHash: null } : e));
    setEmployees(updated);
    saveKey("mb_employees", updated);
  }
  async function createEmployeePassword(name, passwordHash) {
    const updated = employees.map((e) => (e.name === name ? { ...e, passwordHash } : e));
    setEmployees(updated);
    await saveKey("mb_employees", updated);
    setCurrentUser(name);
    saveSession({ type: "employee", name });
    const assignedIds = courses.filter((c) => isAssignedToUser(c, name, groups)).map((c) => c.id);
    ensureCompletionsForCourses(assignedIds);
  }
  async function updateEmployeeEmail(name, email) {
    const updated = employees.map((e) => (e.name === name ? { ...e, email } : e));
    setEmployees(updated);
    saveKey("mb_employees", updated);
  }

  // Marca a alguien como "responsable" de uno o varios grupos: al entrar con su
  // nombre y contraseña de siempre, verá además la pestaña "Mi equipo" con
  // acceso reducido (su gente y su seguimiento, no toda la empresa) — pero
  // puede crear formaciones para cualquier equipo, no solo el suyo.
  async function updateEmployeeManagedGroups(name, groupIds) {
    const updated = employees.map((e) => (e.name === name ? { ...e, managedGroupIds: groupIds } : e));
    setEmployees(updated);
    await saveKey("mb_employees", updated);
  }

  // Renombrar a alguien es delicado: su nombre se usa como identificador en
  // grupos y en el progreso de cada formación. Antes de tocar nada, comprobamos
  // que el nuevo nombre no coincida con otra persona ya existente, y luego
  // actualizamos en cascada: empleados, grupos, y el progreso ya guardado en
  // cada formación (cargando primero los datos más recientes de Supabase para
  // no perder nada que no estuviera todavía en memoria).
  async function renameEmployee(oldName, newName) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return { ok: false, error: "Nombre no válido." };
    if (employees.some((e) => e.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: "Ya existe otra persona con ese nombre." };
    }

    const updatedEmployees = employees.map((e) => (e.name === oldName ? { ...e, name: trimmed } : e));
    setEmployees(updatedEmployees);
    await saveKey("mb_employees", updatedEmployees);

    const updatedGroups = groups.map((g) =>
      g.memberNames.includes(oldName) ? { ...g, memberNames: g.memberNames.map((n) => (n === oldName ? trimmed : n)) } : g
    );
    setGroups(updatedGroups);
    await saveKey("mb_groups", updatedGroups);

    // Progreso: cargamos el estado más reciente de cada formación y renombramos
    // la clave si esa persona tenía algo registrado ahí.
    const freshCompletions = {};
    for (const c of courses) {
      const rec = await loadKey(`mb_completions_course_${c.id}`, {});
      if (rec && rec[oldName]) {
        const renamed = { ...rec };
        renamed[trimmed] = renamed[oldName];
        delete renamed[oldName];
        await saveKey(`mb_completions_course_${c.id}`, renamed);
        freshCompletions[c.id] = renamed;
      } else {
        freshCompletions[c.id] = rec;
      }
    }
    setCompletionsByCourse((prev) => ({ ...prev, ...freshCompletions }));

    // El checklist de puesto se guarda por nombre — hay que renombrar la
    // clave igual que hicimos arriba con el progreso de formaciones, o el
    // historial de evaluación se queda huérfano apuntando al nombre antiguo.
    if (checklistResponses[oldName]) {
      const updatedChecklist = { ...checklistResponses };
      updatedChecklist[trimmed] = updatedChecklist[oldName];
      delete updatedChecklist[oldName];
      setChecklistResponses(updatedChecklist);
      await saveKey("mb_checklist_responses", updatedChecklist);
    }

    if (currentUser === oldName) {
      setCurrentUser(trimmed);
      saveSession({ type: "employee", name: trimmed });
    }

    return { ok: true };
  }

  // Importación masiva desde Excel/CSV. Empleados nuevos se crean sin contraseña
  // (la crean ellos mismos en su primer acceso, verificando su email). Empleados
  // que ya existían (mismo nombre) solo actualizan su email. Los equipos se crean
  // como grupos si no existían todavía.
  async function importEmployeesBulk(rows) {
    let updatedEmployees = [...employees];
    let updatedGroups = [...groups];
    const newlyCreatedNames = [];

    for (const row of rows) {
      const existingIdx = updatedEmployees.findIndex((e) => e.name.trim().toLowerCase() === row.name.trim().toLowerCase());
      // El puesto se empareja por nombre con uno ya existente — no se crea
      // ninguno nuevo desde aquí, eso se hace a propósito solo desde Admin →
      // Puestos, para no acabar con puestos duplicados por una errata.
      const matchedPuesto = row.puesto ? puestos.find((p) => p.name.trim().toLowerCase() === row.puesto.trim().toLowerCase()) : null;
      if (existingIdx === -1) {
        updatedEmployees.push({
          name: row.name, passwordHash: null, email: row.email || "",
          puestoId: matchedPuesto ? matchedPuesto.id : null,
          puestoAssignedAt: matchedPuesto ? todayISO() : null,
        });
        newlyCreatedNames.push(row.name);
      } else {
        updatedEmployees[existingIdx] = {
          ...updatedEmployees[existingIdx],
          email: row.email || updatedEmployees[existingIdx].email,
          ...(matchedPuesto ? { puestoId: matchedPuesto.id, puestoAssignedAt: todayISO() } : {}),
        };
      }

      if (row.equipo) {
        const groupIdx = updatedGroups.findIndex((g) => g.name.trim().toLowerCase() === row.equipo.trim().toLowerCase());
        if (groupIdx === -1) {
          updatedGroups.push({ id: uid(), name: row.equipo, memberNames: [row.name] });
        } else {
          const g = updatedGroups[groupIdx];
          if (!g.memberNames.includes(row.name)) {
            updatedGroups[groupIdx] = { ...g, memberNames: [...g.memberNames, row.name] };
          }
        }
      }
    }

    setEmployees(updatedEmployees);
    setGroups(updatedGroups);
    await saveKey("mb_employees", updatedEmployees);
    await saveKey("mb_groups", updatedGroups);
    await assignWelcomePathsToNewEmployees(newlyCreatedNames);
  }

  async function saveCourse(course) {
    let updated;
    const existing = courses.find((c) => c.id === course.id);
    // Marca de tiempo de publicación: se fija la primera vez y no se toca en
    // ediciones posteriores — la usa el sistema de avisos para saber qué
    // formaciones son "nuevas" (publicadas en las últimas ~24-48h).
    const courseWithTimestamp = { ...course, createdAt: existing?.createdAt || course.createdAt || new Date().toISOString() };
    if (existing) updated = courses.map((c) => (c.id === course.id ? courseWithTimestamp : c));
    else updated = [...courses, courseWithTimestamp];
    setCourses(updated);
    await saveKey("mb_courses", updated);
  }
  // Archivar una formación la quita de en medio (catálogo, alertas, listado
  // normal de Admin) sin borrar nada de verdad — ni el progreso de la gente,
  // ni los adjuntos. Cualquiera con acceso al editor puede archivar o
  // desarchivar; borrar de verdad es solo para el administrador completo.
  async function setCourseArchived(id, archived) {
    const updated = courses.map((c) => (c.id === id ? { ...c, archived } : c));
    setCourses(updated);
    await saveKey("mb_courses", updated);
  }

  // Borra un documento concreto desde la lista consolidada de Documentos —
  // sin tener que entrar a editar la formación entera para quitarlo.
  async function deleteAttachmentFrom(courseId, moduleId, attachmentId) {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;
    let storageKey = null;
    let updated;
    if (moduleId) {
      updated = courses.map((c) => {
        if (c.id !== courseId) return c;
        return {
          ...c,
          modules: c.modules.map((m) => {
            if (m.id !== moduleId) return m;
            const att = (m.attachments || []).find((a) => a.id === attachmentId);
            if (att) storageKey = att.storageKey;
            return { ...m, attachments: (m.attachments || []).filter((a) => a.id !== attachmentId) };
          }),
        };
      });
    } else {
      updated = courses.map((c) => {
        if (c.id !== courseId) return c;
        const att = (c.attachments || []).find((a) => a.id === attachmentId);
        if (att) storageKey = att.storageKey;
        return { ...c, attachments: (c.attachments || []).filter((a) => a.id !== attachmentId) };
      });
    }
    if (storageKey) await deleteKey(storageKey);
    setCourses(updated);
    await saveKey("mb_courses", updated);
  }

  async function deleteCourse(id) {
    const course = courses.find((c) => c.id === id);
    if (course?.attachments) {
      for (const att of course.attachments) {
        if (att.storageKey) await deleteKey(att.storageKey);
      }
    }
    if (course?.videoFile?.path) await deleteVideoFile(course.videoFile.path);
    if (course?.modules) {
      for (const mod of course.modules) {
        for (const att of mod.attachments || []) {
          if (att.storageKey) await deleteKey(att.storageKey);
        }
        if (mod.videoFile?.path) await deleteVideoFile(mod.videoFile.path);
      }
    }
    await deleteKey(`mb_completions_course_${id}`);
    const updated = courses.filter((c) => c.id !== id);

    // Quitamos también cualquier referencia a esta formación desde otros
    // sitios — si no, quedan huecos silenciosos: una ruta a la que "le falta
    // un paso" sin explicación, o un módulo cuyo requisito señala a algo que
    // ya no existe.
    const cleanedCourses = updated.map((c) => {
      if (!c.modules || c.modules.length === 0) return c;
      const hasRef = c.modules.some((m) => (m.relatedCourses || []).some((rc) => rc.courseId === id));
      if (!hasRef) return c;
      return { ...c, modules: c.modules.map((m) => ({ ...m, relatedCourses: (m.relatedCourses || []).filter((rc) => rc.courseId !== id) })) };
    });
    setCourses(cleanedCourses);
    await saveKey("mb_courses", cleanedCourses);

    const affectedPaths = paths.filter((p) => p.courseIds.includes(id));
    if (affectedPaths.length > 0) {
      const updatedPaths = paths.map((p) => (p.courseIds.includes(id) ? { ...p, courseIds: p.courseIds.filter((cid) => cid !== id) } : p));
      setPaths(updatedPaths);
      await saveKey("mb_paths", updatedPaths);
    }
  }
  async function addNews(item) {
    const updated = [item, ...news];
    setNews(updated);
    await saveKey("mb_news", updated);
  }
  async function updateNews(id, fields) {
    const updated = news.map((n) => (n.id === id ? { ...n, ...fields } : n));
    setNews(updated);
    await saveKey("mb_news", updated);
  }
  async function deleteNews(id) {
    const updated = news.filter((n) => n.id !== id);
    setNews(updated);
    await saveKey("mb_news", updated);
  }

  async function loadSeedExamples() {
    // Sustituye (por título) cualquier formación/novedad de ejemplo que ya tuvieras
    // por la versión más reciente del código — así una actualización de contenido
    // (como añadir los PDF) llega aunque ya hubieras cargado los ejemplos antes.
    // Cualquier formación o novedad propia, con otro título, no se toca.
    const seedCourseTitles = new Set(SEED_COURSES.map((c) => c.title));
    const oldSeedCourses = courses.filter((c) => seedCourseTitles.has(c.title));
    for (const old of oldSeedCourses) {
      for (const att of old.attachments || []) {
        if (att.storageKey) await deleteKey(att.storageKey);
      }
      await deleteKey(`mb_completions_course_${old.id}`);
    }
    const keptCourses = courses.filter((c) => !seedCourseTitles.has(c.title));
    const refreshedSeedCourses = await materializeSeedCourses(SEED_COURSES);
    const updatedCourses = [...keptCourses, ...refreshedSeedCourses];
    setCourses(updatedCourses);
    await saveKey("mb_courses", updatedCourses);
    setCompletionsByCourse((prev) => {
      const next = { ...prev };
      for (const old of oldSeedCourses) delete next[old.id];
      return next;
    });

    const seedNewsTitles = new Set(SEED_NEWS.map((n) => n.title));
    const keptNews = news.filter((n) => !seedNewsTitles.has(n.title));
    const refreshedNews = SEED_NEWS.map((n) => ({ ...n, id: uid(), date: todayISO() }));
    const updatedNews = [...refreshedNews, ...keptNews];
    setNews(updatedNews);
    await saveKey("mb_news", updatedNews);

    return refreshedSeedCourses.length + refreshedNews.length;
  }

  async function handleAdminSetup(hash) {
    setAdminPasswordHash(hash);
    await saveKey("mb_admin_pin", hash);
    setIsAdmin(true);
    setView("admin");
    saveSession({ type: "admin" });
  }

  function logout() {
    setCurrentUser("");
    setView("dashboard");
    clearSession();
  }
  function logoutAdmin() {
    setIsAdmin(false);
    if (view === "admin") setView("dashboard");
    clearSession();
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--sp-4)", backgroundColor: "var(--bg-page)" }}>
        <img src="/logo-mb.png" alt="Muñoz Bosch" style={{ height: 32, width: "auto", opacity: 0.9 }} />
        <Loader2 className="animate-spin" size={22} style={{ color: "var(--brand)" }} />
      </div>
    );
  }

  if (!currentUser && !isAdmin) {
    return (
      <LoginGate
        employees={employees}
        adminPasswordHash={adminPasswordHash}
        onEmployeeLogin={(name) => {
          setCurrentUser(name);
          setView("dashboard");
          saveSession({ type: "employee", name });
          const assignedIds = courses.filter((c) => isAssignedToUser(c, name, groups)).map((c) => c.id);
          ensureCompletionsForCourses(assignedIds);
        }}
        onEmployeeCreatePassword={createEmployeePassword}
        onAdminLogin={() => {
          setIsAdmin(true);
          setView("admin");
          saveSession({ type: "admin" });
        }}
        onAdminSetup={handleAdminSetup}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", fontFamily: "var(--font-sans)", color: "var(--text-primary)" }}>
      {/* ── HEADER ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: isCompactHeader ? "0 8px" : "0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: isCompactHeader ? 52 : 56, gap: isCompactHeader ? 4 : 12 }}>
            {/* Logo + nombre */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <img src="/logo-mb.png" alt="Muñoz Bosch" style={{ height: isCompactHeader ? 22 : 26, width: "auto" }} />
            </div>

            {/* Nav tabs */}
            <nav style={{ display: "flex", alignItems: "center", gap: isCompactHeader ? 0 : 2, marginRight: isCompactHeader ? 4 : 8, marginLeft: "auto", flexShrink: 1, overflowX: "auto" }}>
              {[
                { id: "dashboard", label: "Inicio", icon: Home },
                ...(currentUser ? [{ id: "alerts", label: "Alertas", icon: AlertTriangle, count: alertCount }] : []),
                { id: "catalog", label: "Catálogo", icon: LayoutGrid },
                ...(currentUser ? [{ id: "routes", label: "Rutas", icon: Map, count: pendingPathsForUser.length }] : []),
              ].map((t) => {
                const active = view === t.id || (view === "course" && t.id === "catalog" && courseOrigin !== "path") || (view === "path-detail" && t.id === "routes") || (view === "course" && t.id === "routes" && courseOrigin === "path");
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (t.id === "catalog" && view !== "course") setSelectedCatalogCategory(null);
                      if (t.id === "routes") setSelectedPathId(null);
                      setView(t.id);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                      padding: isCompactHeader ? "8px" : "6px 14px", borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)", fontWeight: active ? 600 : 500,
                      color: active ? "var(--brand)" : "var(--text-secondary)",
                      backgroundColor: active ? "var(--brand-soft)" : "transparent",
                      border: "none", cursor: "pointer",
                      transition: "all var(--dur-fast) var(--ease-out)",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "var(--bg-inset)"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <t.icon size={16} />
                    {!isCompactHeader && <span>{t.label}</span>}
                    {!!t.count && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 18, height: 18, padding: "0 5px",
                        borderRadius: "var(--radius-full)", fontSize: 10, fontWeight: 700,
                        backgroundColor: "var(--danger)", color: "var(--text-inverse)",
                      }}>
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* User area */}
            <div style={{ display: "flex", alignItems: "center", gap: isCompactHeader ? 4 : 6, flexShrink: 0 }}>
              {currentUser && (
                <div style={{ display: "flex", alignItems: "center", gap: isCompactHeader ? 2 : 6, padding: isCompactHeader ? "2px 4px 2px 2px" : "4px 10px 4px 4px", borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)" }}>
                  <Avatar name={currentUser} size={24} />
                  {!isCompactHeader && <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{currentUser.split(" ")[0]}</span>}
                  <button onClick={logout} title="Cerrar sesión" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 2 }}>
                    <LogOut size={13} />
                  </button>
                </div>
              )}
              {myManagedGroupIds.length > 0 && (
                <button
                  onClick={() => setView("team")}
                  style={{
                    display: "flex", alignItems: "center", gap: isCompactHeader ? 0 : 5, borderRadius: "var(--radius-full)",
                    padding: isCompactHeader ? "4px 5px" : "4px 8px",
                    backgroundColor: "var(--info-soft)", border: view === "team" ? "1.5px solid var(--info)" : "1.5px solid transparent", cursor: "pointer",
                  }}
                  title="Mi equipo"
                >
                  <Users size={13} style={{ color: "var(--info)" }} />
                  {!isCompactHeader && <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--info)" }}>Mi equipo</span>}
                </button>
              )}
              {isAdmin && (
                <div style={{
                  display: "flex", alignItems: "center", gap: isCompactHeader ? 0 : 5, borderRadius: "var(--radius-full)",
                  padding: isCompactHeader ? "4px 5px" : "4px 8px",
                  backgroundColor: "var(--brand-soft)", border: view === "admin" ? "1.5px solid var(--brand)" : "1.5px solid transparent",
                }}>
                  <button
                    onClick={() => setView("admin")}
                    style={{ display: "flex", alignItems: "center", gap: 5, border: "none", background: "none", cursor: "pointer", padding: 0 }}
                    title="Ir a Administración"
                  >
                    <ShieldCheck size={13} style={{ color: "var(--brand)" }} />
                    {!isCompactHeader && <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--brand)" }}>Admin</span>}
                  </button>
                  <button onClick={logoutAdmin} title="Salir" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--brand)", display: "flex", padding: 2, opacity: 0.7 }}>
                    <LogOut size={12} />
                  </button>
                </div>
              )}
              {isAdmin && !currentUser && !isCompactHeader && (
                <ViewAsEmployeeSearch
                  employees={employees}
                  onSelect={(name) => {
                    setCurrentUser(name);
                    const assignedIds = courses.filter((c) => isAssignedToUser(c, name, groups)).map((c) => c.id);
                    ensureCompletionsForCourses(assignedIds);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--sp-6) var(--sp-4) var(--sp-12)" }}>
        {storageError && (
          <div style={{
            marginBottom: "var(--sp-5)", padding: "var(--sp-3) var(--sp-4)",
            borderRadius: "var(--radius-md)", border: "1px solid #EF444444",
            backgroundColor: "var(--danger-soft)", color: "var(--danger-text)",
            fontSize: "var(--text-sm)", display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>No se ha podido guardar.</div>
              <div style={{ fontSize: "var(--text-xs)", marginTop: 2, opacity: 0.9 }}>{storageError}</div>
            </div>
            <button onClick={() => setStorageError("")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--danger-text)", padding: 2 }}>
              <X size={16} />
            </button>
          </div>
        )}
        {deepLinkError && (
          <div style={{
            marginBottom: "var(--sp-5)", padding: "var(--sp-3) var(--sp-4)",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
            backgroundColor: "var(--warning-soft)", color: "var(--warning-text)",
            fontSize: "var(--text-sm)", display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <Link2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>{deepLinkError}</div>
            <button onClick={() => setDeepLinkError("")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--warning-text)", padding: 2 }}>
              <X size={16} />
            </button>
          </div>
        )}
        {view === "dashboard" && (
          <Dashboard
            currentUser={currentUser}
            news={news}
            pendingForUser={pendingForUser}
            completedForUser={completedForUser}
            assignedCountForUser={assignedCountForUser}
            progressPercent={progressPercent}
            points={pointsForUser}
            level={levelForUser}
            badges={badgesForUser}
            pendingPaths={pendingPathsForUser}
            courses={courses}
            getStatus={getStatus}
            onOpenCourse={openCourse}
            onContinuePath={(path) => {
              const pathCourses = path.courseIds.map((id) => courses.find((c) => c.id === id)).filter(Boolean);
              const next = currentUser ? pathCourses.find((c) => getStatus(currentUser, c.id) !== "completada") : pathCourses[0];
              setSelectedPathId(path.id);
              if (next) {
                openCourse(next.id, "path");
              } else {
                setView("path-detail");
              }
            }}
            onGoToCatalog={() => {
              setSelectedCatalogCategory(null);
              setView("catalog");
            }}
            myTeamStatus={myTeamStatus}
            onOpenTeam={() => setView("team")}
            onOpenNewsLink={(item) => {
              if (item.linkType === "course" && item.linkId) {
                openCourse(item.linkId);
              } else if (item.linkType === "category" && item.linkId) {
                setSelectedCatalogCategory(item.linkId);
                setView("catalog");
              }
            }}
          />
        )}
        {view === "alerts" && (
          <AlertsView overdueForUser={overdueForUser} dueSoonForUser={dueSoonForUser} onOpenCourse={openCourse} />
        )}
        {view === "routes" && (
          <RoutesListView
            paths={pathsForUser}
            courses={courses}
            currentUser={currentUser}
            getStatus={getStatus}
            onOpenPath={(id) => {
              setSelectedPathId(id);
              setView("path-detail");
            }}
          />
        )}
        {view === "path-detail" && selectedPathId && (
          <PathDetailView
            path={paths.find((p) => p.id === selectedPathId)}
            courses={courses}
            currentUser={currentUser}
            getStatus={getStatus}
            onOpenCourse={(courseId) => openCourse(courseId, "path")}
            onBack={() => setView("routes")}
          />
        )}
        {view === "catalog" && (
          <Catalog
            courses={courses}
            currentUser={currentUser}
            groups={groups}
            getStatus={getStatus}
            onOpenCourse={openCourse}
            selectedCategory={selectedCatalogCategory}
            onSelectCategory={setSelectedCatalogCategory}
            paths={paths}
            onOpenPath={(id) => {
              setSelectedPathId(id);
              setView("path-detail");
            }}
          />
        )}
        {view === "course" && activeCourse && (
          <CourseDetail
            course={activeCourse}
            currentUser={currentUser}
            status={currentUser ? getStatus(currentUser, activeCourse.id) : "pendiente"}
            record={currentUser ? getRecord(currentUser, activeCourse.id) : null}
            quizAnswers={quizAnswers}
            setQuizAnswers={setQuizAnswers}
            quizResult={quizResult}
            onSubmitQuiz={submitQuiz}
            onSubmitModuleQuiz={(moduleObj) => submitModuleQuiz(activeCourse.id, moduleObj)}
            onResetQuiz={() => {
              setQuizAnswers({});
              setQuizResult(null);
            }}
            onSelfReport={() => selfReportComplete(activeCourse.id)}
            onRateCourse={(rating, comment) => rateCourse(activeCourse.id, rating, comment)}
            onSubmitPracticalCase={(text) => submitPracticalCase(activeCourse.id, text)}
            courses={courses}
            completionsByCourse={completionsByCourse}
            onOpenRelatedCourse={(courseId) => openCourse(courseId, "module")}
            onToggleModuleChecklistStep={(moduleId, stepId) => toggleModuleChecklistStep(activeCourse.id, moduleId, stepId)}
            onSubmitModulePracticalCase={(moduleId, text) => submitModulePracticalCase(activeCourse.id, moduleId, text)}
            onBack={() => {
              if (courseOrigin === "module" && moduleOriginCourseId) {
                openCourse(moduleOriginCourseId, "catalog");
              } else if (courseOrigin === "path") {
                setView("path-detail");
              } else {
                setView("catalog");
              }
            }}
            onRetry={() => {
              setQuizAnswers({});
              setQuizResult(null);
            }}
          />
        )}
        {view === "admin" && isAdmin && (
          <AdminPanel
            deepLinkPuestoTarget={deepLinkPuestoTarget}
            onConsumeDeepLinkPuestoTarget={() => setDeepLinkPuestoTarget(null)}
            courses={courses}
            news={news}
            employees={employees}
            groups={groups}
            completionsByCourse={completionsByCourse}
            loadingTracking={loadingTracking}
            lastBackupAt={lastBackupAt}
            sheetsUrl={sheetsUrl}
            onSaveSheetsUrl={saveSheetsUrl}
            onLoadTracking={loadAllCompletionsForTracking}
            onSaveCourse={saveCourse}
            onDeleteCourse={deleteCourse}
            onSetCourseArchived={setCourseArchived}
            onDeleteAttachment={deleteAttachmentFrom}
            onUpdateEmployeeProfile={updateEmployeeProfile}
            onToggleEmployeeGroup={toggleEmployeeGroup}
            onAddNews={addNews}
            onUpdateNews={updateNews}
            onDeleteNews={deleteNews}
            onAddEmployee={addEmployee}
            onRemoveEmployee={removeEmployee}
            onResetEmployeePassword={resetEmployeePassword}
            onUpdateEmployeeEmail={updateEmployeeEmail}
            onUpdateEmployeeManagedGroups={updateEmployeeManagedGroups}
            paths={paths}
            onSavePath={savePath}
            onDeletePath={deletePath}
            puestos={puestos}
            onSavePuesto={savePuesto}
            onDeletePuesto={deletePuesto}
            onAssignPuesto={assignPuesto}
            checklistResponses={checklistResponses}
            onValidateChecklistItem={validateChecklistItem}
            onCorrectPracticalCase={correctPracticalCase}
            onCorrectModulePracticalCase={correctModulePracticalCase}
            onRenameEmployee={renameEmployee}
            onImportEmployeesBulk={importEmployeesBulk}
            onAddGroup={addGroup}
            onDeleteGroup={deleteGroup}
            onUpdateGroupMembers={updateGroupMembers}
            onManualSetStatus={manualSetStatus}
            onMarkFormReviewed={markFormReviewed}
            onExportBackup={exportBackup}
            onImportBackup={importBackup}
          />
        )}
        {view === "team" && myManagedGroupIds.length > 0 && (
          <AdminPanel
            mode="team"
            restrictToGroupIds={myManagedGroupIds}
            courses={courses}
            news={news}
            employees={employees}
            groups={groups}
            completionsByCourse={completionsByCourse}
            loadingTracking={loadingTracking}
            lastBackupAt={lastBackupAt}
            sheetsUrl={sheetsUrl}
            onSaveSheetsUrl={saveSheetsUrl}
            onLoadTracking={loadAllCompletionsForTracking}
            onSaveCourse={saveCourse}
            onDeleteCourse={deleteCourse}
            onSetCourseArchived={setCourseArchived}
            onDeleteAttachment={deleteAttachmentFrom}
            onUpdateEmployeeProfile={updateEmployeeProfile}
            onToggleEmployeeGroup={toggleEmployeeGroup}
            onAddNews={addNews}
            onUpdateNews={updateNews}
            onDeleteNews={deleteNews}
            onAddEmployee={addEmployee}
            onRemoveEmployee={removeEmployee}
            onResetEmployeePassword={resetEmployeePassword}
            onUpdateEmployeeEmail={updateEmployeeEmail}
            onUpdateEmployeeManagedGroups={updateEmployeeManagedGroups}
            paths={paths}
            onSavePath={savePath}
            onDeletePath={deletePath}
            puestos={puestos}
            onSavePuesto={savePuesto}
            onDeletePuesto={deletePuesto}
            onAssignPuesto={assignPuesto}
            checklistResponses={checklistResponses}
            onValidateChecklistItem={validateChecklistItem}
            onCorrectPracticalCase={correctPracticalCase}
            onCorrectModulePracticalCase={correctModulePracticalCase}
            onRenameEmployee={renameEmployee}
            onImportEmployeesBulk={importEmployeesBulk}
            onAddGroup={addGroup}
            onDeleteGroup={deleteGroup}
            onUpdateGroupMembers={updateGroupMembers}
            onManualSetStatus={manualSetStatus}
            onMarkFormReviewed={markFormReviewed}
            onExportBackup={exportBackup}
            onImportBackup={importBackup}
          />
        )}
      </main>
      <CelebrationOverlay celebration={celebration} onClose={() => setCelebration(null)} />
    </div>
  );
}

/* ---------- Vistas ---------- */


/* ════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — COMPONENTES VISUALES
   Tokens: ver index.css (:root)
   ════════════════════════════════════════════════════════════════ */

const DS = {
  card: {
    backgroundColor: "var(--bg-card)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--border)",
    overflow: "hidden",
  },
  cardHover: {
    boxShadow: "var(--shadow-md)",
    borderColor: "var(--border-strong)",
  },
};

function SectionTitle({ icon: Icon, children, extra }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
        {Icon && <Icon size={16} style={{ color: "var(--text-muted)" }} />}
        <h2 style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          {children}
        </h2>
      </div>
      {extra || null}
    </div>
  );
}

function StatusPill({ icon: Icon, label, variant }) {
  const styles = {
    success: { bg: "var(--success-soft)", color: "var(--success-text)" },
    warning: { bg: "var(--warning-soft)", color: "var(--warning-text)" },
    danger: { bg: "var(--danger-soft)", color: "var(--danger-text)" },
    neutral: { bg: "var(--bg-inset)", color: "var(--text-secondary)" },
  };
  const s = styles[variant] || styles.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: "var(--text-xs)", fontWeight: 500,
      padding: "3px 10px", borderRadius: "var(--radius-full)",
      backgroundColor: s.bg, color: s.color,
    }}>
      {Icon && <Icon size={12} />}
      {label}
    </span>
  );
}

function CourseCard({ course, status, onOpen, pathTitle }) {
  const meta = categoryMeta(course.category);
  const completed = status === "completada";
  const days = course.deadline ? daysUntil(course.deadline) : null;
  const isOverdue = days !== null && days < 0 && !completed;
  const isDueSoon = days !== null && days >= 0 && days <= 3 && !completed;

  return (
    <button
      onClick={onOpen}
      style={{
        ...DS.card,
        textAlign: "left", width: "100%", cursor: "pointer",
        display: "flex", flexDirection: "column",
        transition: "all var(--dur-base) var(--ease-out)",
        padding: 0,
      }}
      onMouseEnter={(e) => { Object.assign(e.currentTarget.style, { boxShadow: "var(--shadow-md)", transform: "translateY(-2px)", borderColor: "var(--border-strong)" }); }}
      onMouseLeave={(e) => { Object.assign(e.currentTarget.style, { boxShadow: "none", transform: "none", borderColor: "var(--border)" }); }}
    >
      {/* Accent line */}
      <div style={{ height: 3, backgroundColor: completed ? "var(--success)" : meta.color }} />

      <div style={{ padding: "var(--sp-4)", display: "flex", flexDirection: "column", gap: "var(--sp-2)", flex: 1 }}>
        {/* Category + deadline */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <CategoryTag id={course.category} small />
          <DeadlineChip deadline={course.deadline} completed={completed} />
        </div>

        {pathTitle && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: "var(--info)" }}>
            <Map size={11} /> Parte de la ruta: {pathTitle}
          </div>
        )}

        {/* Title */}
        <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35 }}>
          {course.title}
        </div>

        {/* Description */}
        <div className="line-clamp-2" style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.5 }}>
          {course.description}
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--text-muted)", marginTop: "auto", paddingTop: "var(--sp-2)", borderTop: "1px solid var(--border)" }}>
          {(course.videoUrl || course.videoFile) && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><PlayCircle size={11} /> Vídeo</span>}
          {(course.attachments || []).length > 0 && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><FileText size={11} /> {course.attachments.length} doc{course.attachments.length > 1 ? "s" : ""}</span>}
          <span>{course.testMode === "googleform" ? "Google Form" : `${(course.quiz || []).length} pregunta${(course.quiz || []).length === 1 ? "" : "s"}`}</span>
        </div>
      </div>

      {/* Urgency footer */}
      {(isOverdue || isDueSoon || completed) && (
        <div style={{
          padding: "var(--sp-2) var(--sp-4)", fontSize: "var(--text-xs)", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 6,
          backgroundColor: isOverdue ? "var(--danger-soft)" : isDueSoon ? "var(--warning-soft)" : "var(--success-soft)",
          color: isOverdue ? "var(--danger-text)" : isDueSoon ? "var(--warning-text)" : "var(--success-text)",
        }}>
          {isOverdue ? <AlertTriangle size={12} /> : isDueSoon ? <Clock size={12} /> : <CheckCircle2 size={12} />}
          {isOverdue ? `Vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}` : isDueSoon ? `Vence en ${days} día${days === 1 ? "" : "s"}` : "Completada"}
        </div>
      )}
    </button>
  );
}

/* ── HOME ── */

function WelcomeBar({ currentUser, pendingForUser, completedForUser, assignedCountForUser, progressPercent, points, level, badges }) {
  if (!currentUser) return null;
  const firstName = currentUser.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";

  const overdueCount = pendingForUser.filter((c) => c.deadline && daysUntil(c.deadline) < 0).length;
  const allDone = assignedCountForUser > 0 && pendingForUser.length === 0;
  const noneAssigned = assignedCountForUser === 0;

  let statusVariant = "warning", statusIcon = Clock, statusLabel = `${pendingForUser.length} formaci${pendingForUser.length === 1 ? "ón" : "ones"} pendiente${pendingForUser.length === 1 ? "" : "s"}`;
  if (noneAssigned) { statusVariant = "neutral"; statusIcon = Home; statusLabel = "Sin formaciones asignadas"; }
  else if (allDone) { statusVariant = "success"; statusIcon = CheckCircle2; statusLabel = "Estás al día"; }
  else if (overdueCount > 0) { statusVariant = "danger"; statusIcon = AlertTriangle; statusLabel = `${overdueCount} vencida${overdueCount === 1 ? "" : "s"}`; }

  return (
    <div style={{ ...DS.card, padding: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-4)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <Avatar name={currentUser} size={44} />
          <div>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)" }}>
              {greeting}, {firstName}
            </div>
            <div style={{ marginTop: 4 }}>
              <StatusPill icon={statusIcon} label={statusLabel} variant={statusVariant} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-5)" }}>
          {!noneAssigned && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
              <Trophy size={16} style={{ color: level.color }} />
              <div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>{points} pts · {level.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{level.nextMin != null ? `${level.nextMin - points} para subir` : "Máximo"}</div>
              </div>
            </div>
          )}
          {!noneAssigned && <ProgressRing percent={progressPercent} size={52} color="var(--brand)" label={`${completedForUser.length}/${assignedCountForUser}`} />}
        </div>
      </div>
      {badges && badges.length > 0 && (
        <div style={{ paddingTop: "var(--sp-2)", borderTop: "1px solid var(--border)" }}>
          <BadgesRow badges={badges} />
        </div>
      )}
    </div>
  );
}

function ContinueCard({ course, onOpen }) {
  if (!course) return null;
  const meta = categoryMeta(course.category);
  const days = course.deadline ? daysUntil(course.deadline) : null;
  return (
    <div style={{ ...DS.card, padding: "var(--sp-5)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-4)", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", flex: 1, minWidth: 200 }}>
        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", backgroundColor: `${meta.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <meta.icon size={22} style={{ color: meta.color }} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 2 }}>Continúa con</div>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{course.title}</div>
          {days !== null && days <= 3 && (
            <div style={{ fontSize: 11, color: days < 0 ? "var(--danger)" : "var(--warning)", fontWeight: 500, marginTop: 3 }}>
              {days < 0 ? `Vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}` : `Vence en ${days} día${days === 1 ? "" : "s"}`}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onOpen}
        style={{
          padding: "8px 20px", borderRadius: "var(--radius-md)",
          backgroundColor: "var(--brand)", color: "var(--text-inverse)",
          border: "none", cursor: "pointer", fontSize: "var(--text-sm)",
          fontWeight: 600, transition: "background var(--dur-fast) var(--ease-out)",
          display: "flex", alignItems: "center", gap: 6,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--brand-hover)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--brand)"; }}
      >
        Continuar <ChevronRight size={15} />
      </button>
    </div>
  );
}

function RouteCard({ path, courses, currentUser, getStatus, onContinue }) {
  if (!path) return null;
  const pathCourses = path.courseIds.map((id) => courses.find((c) => c.id === id)).filter(Boolean);
  const doneCount = pathCourses.filter((c) => getStatus(currentUser, c.id) === "completada").length;
  const percent = pathCourses.length ? Math.round((doneCount / pathCourses.length) * 100) : 0;
  return (
    <div style={{ ...DS.card, padding: "var(--sp-5)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-4)", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", flex: 1, minWidth: 200 }}>
        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", backgroundColor: "var(--info-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Map size={22} style={{ color: "var(--info)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 2 }}>Ruta en marcha</div>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{path.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <div style={{ flex: 1, maxWidth: 140, height: 6, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${percent}%`, backgroundColor: "var(--info)", borderRadius: "var(--radius-full)" }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{doneCount}/{pathCourses.length}</span>
          </div>
        </div>
      </div>
      <button
        onClick={onContinue}
        style={{
          padding: "8px 20px", borderRadius: "var(--radius-md)",
          backgroundColor: "var(--info)", color: "var(--text-inverse)",
          border: "none", cursor: "pointer", fontSize: "var(--text-sm)",
          fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
        }}
      >
        Continuar <ChevronRight size={15} />
      </button>
    </div>
  );
}

function TeamStatusPanel({ teamStatus, onOpenTeam }) {
  const withIssues = teamStatus.filter((m) => m.pending > 0).sort((a, b) => b.overdue - a.overdue || b.pending - a.pending);
  const allGood = withIssues.length === 0;
  return (
    <div style={{ ...DS.card, padding: "var(--sp-4)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: allGood ? 0 : "var(--sp-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={16} style={{ color: "var(--brand)" }} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Tu equipo</span>
        </div>
        <button onClick={onOpenTeam} style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--info)", border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          Ver todo <ChevronRight size={13} />
        </button>
      </div>
      {allGood ? (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--success-text)", display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={14} /> Todo tu equipo está al día.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {withIssues.slice(0, 5).map((m) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Avatar name={m.name} size={22} />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
              </div>
              <StatusPill
                icon={m.overdue > 0 ? AlertTriangle : Clock}
                label={m.overdue > 0 ? `${m.overdue} vencida${m.overdue === 1 ? "" : "s"}` : `${m.pending} pendiente${m.pending === 1 ? "" : "s"}`}
                variant={m.overdue > 0 ? "danger" : "warning"}
              />
            </div>
          ))}
          {withIssues.length > 5 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>y {withIssues.length - 5} persona{withIssues.length - 5 === 1 ? "" : "s"} más con algo pendiente…</div>
          )}
        </div>
      )}
    </div>
  );
}

function BadgesRow({ badges }) {
  if (!badges || badges.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
      {badges.map((b) => {
        const Icon = b.icon || Award;
        return (
          <span key={b.id} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 500, padding: "3px 10px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--warning-soft)", color: "var(--warning-text)",
          }}>
            <Icon size={12} />
            {b.label}
          </span>
        );
      })}
    </div>
  );
}

function NewsCard({ item, featured, onOpen, isDone }) {
  const cat = item.linkType === "category" ? categoryMeta(item.linkId) : null;
  const accentColor = cat ? cat.color : "var(--info)";
  const clickable = item.linkType === "course" || item.linkType === "category";
  const daysDiff = daysUntil(item.date);
  const isNew = daysDiff != null && Math.abs(daysDiff) <= 3;
  const Icon = cat ? cat.icon : Newspaper;

  return (
    <div
      onClick={clickable ? onOpen : undefined}
      style={{
        ...DS.card, cursor: clickable ? "pointer" : "default",
        display: "flex", transition: "all var(--dur-base) var(--ease-out)",
        opacity: isDone ? 0.65 : 1,
      }}
      onMouseEnter={(e) => { if (clickable) Object.assign(e.currentTarget.style, DS.cardHover, { transform: "translateY(-1px)" }); }}
      onMouseLeave={(e) => { if (clickable) Object.assign(e.currentTarget.style, { boxShadow: "none", transform: "none", borderColor: "var(--border)" }); }}
    >
      <div style={{ width: 4, flexShrink: 0, backgroundColor: accentColor, borderRadius: "var(--radius-lg) 0 0 var(--radius-lg)" }} />
      <div style={{ padding: featured ? "var(--sp-5)" : "var(--sp-4)", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: "var(--sp-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {isNew && !isDone && <StatusPill label="Nuevo" variant="success" />}
            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Icon size={11} /> {cat ? cat.label : "General"}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.date}</span>
        </div>
        <div style={{ fontSize: featured ? "var(--text-md)" : "var(--text-base)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35 }}>
          {item.title}
        </div>
        {featured && item.body && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5, marginTop: "var(--sp-2)" }}>{item.body}</div>}
        {clickable && (
          isDone ? (
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--success)", display: "flex", alignItems: "center", gap: 4, marginTop: "var(--sp-3)" }}>
              <CheckCircle2 size={13} /> Ya completada
            </div>
          ) : (
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--brand)", display: "flex", alignItems: "center", gap: 4, marginTop: "var(--sp-3)" }}>
              {item.linkType === "course" ? "Ir a la formación" : "Ver campo"} <ChevronRight size={13} />
            </div>
          )
        )}
      </div>
    </div>
  );
}

function NewsPanel({ news, onOpenNewsLink, currentUser, getStatus }) {
  if (news.length === 0) return null;
  const [featured, ...rest] = news;
  function isItemDone(item) {
    return !!(currentUser && item.linkType === "course" && item.linkId && getStatus(currentUser, item.linkId) === "completada");
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <NewsCard item={featured} featured onOpen={() => onOpenNewsLink(featured)} isDone={isItemDone(featured)} />
      {rest.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-3)" }}>
          {rest.slice(0, 4).map((n) => (
            <NewsCard key={n.id} item={n} onOpen={() => onOpenNewsLink(n)} isDone={isItemDone(n)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Dashboard({ currentUser, news, pendingForUser, completedForUser, assignedCountForUser, progressPercent, points, level, badges, pendingPaths, courses, getStatus, onOpenCourse, onContinuePath, onOpenNewsLink, onGoToCatalog, myTeamStatus, onOpenTeam }) {
  const topPending = pendingForUser.length > 0 ? pendingForUser[0] : null;
  const topIsOverdue = !!(topPending && topPending.deadline && daysUntil(topPending.deadline) < 0);
  const activePath = pendingPaths && pendingPaths.length > 0 ? pendingPaths[0] : null;

  // Prioridad de la tarjeta principal: una formación vencida se cuela siempre
  // por delante; si no hay nada vencido, manda la ruta en marcha; si no hay
  // ruta, la formación pendiente más urgente de siempre.
  let mainCardType = "none";
  if (topIsOverdue) mainCardType = "course";
  else if (activePath) mainCardType = "path";
  else if (topPending) mainCardType = "course";

  const remainingPendingCount = pendingForUser.length - (mainCardType === "course" && topPending ? 1 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <WelcomeBar
        currentUser={currentUser}
        pendingForUser={pendingForUser}
        completedForUser={completedForUser}
        assignedCountForUser={assignedCountForUser}
        progressPercent={progressPercent}
        points={points}
        level={level}
        badges={badges}
      />

      {myTeamStatus && myTeamStatus.length > 0 && (
        <TeamStatusPanel teamStatus={myTeamStatus} onOpenTeam={onOpenTeam} />
      )}

      {mainCardType === "path" && (
        <RouteCard path={activePath} courses={courses} currentUser={currentUser} getStatus={getStatus} onContinue={() => onContinuePath(activePath)} />
      )}
      {mainCardType === "course" && topPending && (
        <ContinueCard course={topPending} onOpen={() => onOpenCourse(topPending.id)} />
      )}

      {remainingPendingCount > 0 && (
        <button
          onClick={onGoToCatalog}
          style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--info)", border: "none", background: "none", cursor: "pointer", textAlign: "left", padding: 0, display: "flex", alignItems: "center", gap: 4, width: "fit-content" }}
        >
          Y {remainingPendingCount} {remainingPendingCount === 1 ? "formación" : "formaciones"} más pendiente{remainingPendingCount === 1 ? "" : "s"} <ChevronRight size={14} />
        </button>
      )}

      {news.length > 0 && (
        <div>
          <SectionTitle icon={Newspaper}>Novedades</SectionTitle>
          <NewsPanel news={news} onOpenNewsLink={onOpenNewsLink} currentUser={currentUser} getStatus={getStatus} />
        </div>
      )}
    </div>
  );
}

function AlertsView({ overdueForUser, dueSoonForUser, onOpenCourse }) {
  const total = overdueForUser.length + dueSoonForUser.length;

  if (total === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-4)", padding: "var(--sp-16) 0", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "var(--radius-full)", backgroundColor: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle2 size={24} style={{ color: "var(--success)" }} />
        </div>
        <div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)" }}>Sin alertas</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", maxWidth: 300, marginTop: "var(--sp-1)" }}>
            Aquí aparecerá lo que esté vencido o a punto de vencer (3 días o menos).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-8)" }}>
      {overdueForUser.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", backgroundColor: "var(--danger-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={16} style={{ color: "var(--danger)" }} />
            </div>
            <div>
              <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--danger-text)" }}>Vencidas</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{overdueForUser.length} {overdueForUser.length === 1 ? "formación" : "formaciones"} con el plazo pasado</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)" }}>
            {overdueForUser.map((c) => <CourseCard key={c.id} course={c} status="pendiente" onOpen={() => onOpenCourse(c.id)} />)}
          </div>
        </div>
      )}

      {dueSoonForUser.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", backgroundColor: "var(--warning-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={16} style={{ color: "var(--warning)" }} />
            </div>
            <div>
              <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--warning-text)" }}>Próximas a vencer</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{dueSoonForUser.length} {dueSoonForUser.length === 1 ? "formación" : "formaciones"} con 3 días o menos</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)" }}>
            {dueSoonForUser.map((c) => <CourseCard key={c.id} course={c} status="pendiente" onOpen={() => onOpenCourse(c.id)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Rutas de aprendizaje (encadenan formaciones completas) ---------- */

function RoutesListView({ paths, courses, currentUser, getStatus, onOpenPath }) {
  if (paths.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-3)", padding: "var(--sp-16) 0", textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Map size={20} style={{ color: "var(--text-muted)" }} />
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", maxWidth: 300 }}>
          Todavía no tienes ninguna ruta de aprendizaje asignada. Una ruta agrupa varias formaciones en un orden concreto.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "var(--sp-5)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Rutas de aprendizaje</h2>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 2 }}>Itinerarios de varias formaciones, en orden</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)" }}>
        {paths.map((p) => {
          const pathCourses = p.courseIds.map((id) => courses.find((c) => c.id === id)).filter(Boolean);
          const doneCount = currentUser ? pathCourses.filter((c) => getStatus(currentUser, c.id) === "completada").length : 0;
          const percent = pathCourses.length ? Math.round((doneCount / pathCourses.length) * 100) : 0;
          return (
            <button
              key={p.id}
              onClick={() => onOpenPath(p.id)}
              style={{ ...DS.card, textAlign: "left", cursor: "pointer", padding: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-3)", transition: "all var(--dur-base) var(--ease-out)" }}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, { boxShadow: "var(--shadow-md)", transform: "translateY(-2px)" })}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, { boxShadow: "none", transform: "none" })}
            >
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", backgroundColor: "var(--info-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Map size={19} style={{ color: "var(--info)" }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "var(--text-md)", color: "var(--text-primary)" }}>{p.title}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{pathCourses.length} {pathCourses.length === 1 ? "formación" : "formaciones"}</div>
              </div>
              <div>
                <div style={{ height: 6, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ height: "100%", width: `${percent}%`, backgroundColor: percent === 100 ? "var(--success)" : "var(--brand)", borderRadius: "var(--radius-full)" }} />
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{doneCount}/{pathCourses.length} completadas · {percent}%</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


function MyChecklistView({ puesto, employee, responseEntry, onSetLevel }) {
  if (!puesto) return null;
  const responses = responseEntry?.responses || {};
  const answeredCount = puesto.checklistItems.filter((i) => !!responses[i.id]?.level).length;
  const total = puesto.checklistItems.length;
  const percent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
  const deadlineInfo = getChecklistDeadlineInfo(employee, puesto, responseEntry);

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <ClipboardList size={20} style={{ color: "var(--success)" }} />
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{puesto.name}</h1>
        </div>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0 }}>
          Checklist de conocimientos, aptitudes y habilidades de tu puesto. Marca con sinceridad lo que sabes de verdad — no es un examen, es para que tú y RRHH tengáis claro de dónde partes.
        </p>
        {deadlineInfo.hasDeadline && (
          <div style={{ marginTop: 8 }}>
            <StatusPill
              icon={deadlineInfo.overdue ? AlertTriangle : Clock}
              label={deadlineInfo.complete ? "Completado" : deadlineInfo.overdue ? `Plazo vencido hace ${Math.abs(deadlineInfo.daysLeft)} día${Math.abs(deadlineInfo.daysLeft) === 1 ? "" : "s"}` : `${deadlineInfo.daysLeft} día${deadlineInfo.daysLeft === 1 ? "" : "s"} de plazo`}
              variant={deadlineInfo.complete ? "success" : deadlineInfo.overdue ? "danger" : "warning"}
            />
          </div>
        )}
      </div>

      {/* Resumen visual: progreso general + una tarjeta por categoría */}
      <div style={{ ...DS.card, padding: "var(--sp-4)", marginBottom: "var(--sp-4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{answeredCount}/{total} autoevaluados</span>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--brand)" }}>{percent}%</span>
        </div>
        <div style={{ height: 8, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${percent}%`, backgroundColor: percent === 100 ? "var(--success)" : "var(--brand)", borderRadius: "var(--radius-full)", transition: "width 0.4s var(--ease-out)" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--sp-3)", marginBottom: "var(--sp-6)" }}>
        {CHECKLIST_CATEGORIES.map((cat) => {
          const catItems = puesto.checklistItems.filter((i) => i.category === cat.id);
          if (catItems.length === 0) return null;
          const catAnswered = catItems.filter((i) => !!responses[i.id]?.level).length;
          const catDomina = catItems.filter((i) => responses[i.id]?.level === "domina").length;
          const catPercent = catItems.length ? Math.round((catAnswered / catItems.length) * 100) : 0;
          return (
            <div key={cat.id} style={{ ...DS.card, padding: "var(--sp-3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: "var(--radius-md)", backgroundColor: cat.soft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <cat.icon size={13} style={{ color: cat.color }} />
                </div>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: cat.color }}>{cat.label.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{catDomina}/{catItems.length} dominados</div>
              <div style={{ height: 5, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${catPercent}%`, backgroundColor: cat.color, borderRadius: "var(--radius-full)" }} />
              </div>
            </div>
          );
        })}
      </div>

      {CHECKLIST_CATEGORIES.map((cat) => {
        const catItems = puesto.checklistItems.filter((i) => i.category === cat.id);
        if (catItems.length === 0) return null;
        return (
          <div key={cat.id} style={{ marginBottom: "var(--sp-6)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--sp-3)" }}>
              <div style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", backgroundColor: cat.soft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <cat.icon size={15} style={{ color: cat.color }} />
              </div>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: cat.color }}>{cat.label.toUpperCase()}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              {catItems.map((item) => {
                const resp = responses[item.id];
                return (
                  <div key={item.id} style={{ ...DS.card, padding: "var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4)", borderLeft: `4px solid ${cat.color}` }}>
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", marginBottom: 10, lineHeight: 1.4 }}>{item.text}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {CHECKLIST_LEVELS.map((lvl) => {
                        const selected = resp?.level === lvl.id;
                        return (
                          <button
                            key={lvl.id}
                            onClick={() => onSetLevel(item.id, lvl.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
                              padding: "6px 12px", borderRadius: "var(--radius-full)", cursor: "pointer",
                              border: selected ? "1.5px solid transparent" : "1.5px solid var(--border)",
                              backgroundColor: selected ? `var(--${lvl.variant})` : "var(--bg-card)",
                              color: selected ? "white" : "var(--text-secondary)",
                              transition: "all var(--dur-fast) var(--ease-out)",
                            }}
                          >
                            <lvl.icon size={12} /> {lvl.label}
                          </button>
                        );
                      })}
                      {resp?.validated && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--info)", display: "flex", alignItems: "center", gap: 3, marginLeft: 4 }}>
                          <ShieldCheck size={11} /> Confirmado por {resp.updatedBy}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PathDetailView({ path, courses, currentUser, getStatus, onOpenCourse, onBack }) {
  if (!path) return null;
  const pathCourses = path.courseIds.map((id) => courses.find((c) => c.id === id)).filter(Boolean);
  const statuses = pathCourses.map((c) => (currentUser ? getStatus(currentUser, c.id) : "pendiente"));
  const doneCount = statuses.filter((s) => s === "completada").length;
  const percent = pathCourses.length ? Math.round((doneCount / pathCourses.length) * 100) : 0;
  const firstUnpassedIndex = statuses.findIndex((s) => s !== "completada");
  const activeIndex = firstUnpassedIndex === -1 ? pathCourses.length - 1 : firstUnpassedIndex;
  const allDone = firstUnpassedIndex === -1;

  return (
    <div style={{ maxWidth: 720 }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)", border: "none", background: "none", cursor: "pointer", padding: 0, width: "fit-content", marginBottom: "var(--sp-4)" }}>
        <ChevronLeft size={15} /> Rutas de aprendizaje
      </button>

      <div style={{ marginBottom: "var(--sp-4)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 var(--sp-1) 0" }}>{path.title}</h1>
        {path.description && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0, maxWidth: 600 }}>{path.description}</p>}
        <div style={{ marginTop: "var(--sp-2)" }}>
          <CopyLinkButton url={buildShareLink("path", path.id)} />
        </div>
      </div>

      <div style={{ ...DS.card, padding: "var(--sp-4)", marginBottom: "var(--sp-5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
            {allDone ? "🎉 Ruta completada" : `${doneCount} de ${pathCourses.length} formaciones completadas`}
          </span>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--brand)" }}>{percent}%</span>
        </div>
        <div style={{ height: 8, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${percent}%`, backgroundColor: allDone ? "var(--success)" : "var(--brand)", borderRadius: "var(--radius-full)", transition: "width 0.4s var(--ease-out)" }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        {pathCourses.map((c, i) => {
          const status = statuses[i];
          const passed = status === "completada";
          const locked = i > activeIndex;
          return (
            <button
              key={c.id}
              disabled={locked}
              onClick={() => onOpenCourse(c.id)}
              style={{
                ...DS.card, textAlign: "left", cursor: locked ? "not-allowed" : "pointer",
                padding: "var(--sp-3) var(--sp-4)", display: "flex", alignItems: "center", gap: "var(--sp-3)",
                opacity: locked ? 0.55 : 1, transition: "all var(--dur-fast) var(--ease-out)",
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: "var(--radius-full)", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
                backgroundColor: passed ? "var(--success)" : locked ? "var(--bg-inset)" : "var(--brand)",
                color: passed || !locked ? "white" : "var(--text-muted)",
              }}>
                {passed ? <CheckCircle2 size={14} /> : locked ? <Lock size={12} /> : i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                <CategoryTag id={c.category} small />
              </div>
              {!locked && !passed && <ChevronRight size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}





function CategoryBubble({ cat, onClick, pendingCount }) {
  const Icon = cat.icon;
  return (
    <button
      onClick={onClick}
      style={{
        ...DS.card, cursor: "pointer", padding: "var(--sp-6)", position: "relative",
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--sp-3)",
        transition: "all var(--dur-base) var(--ease-out)", textAlign: "left",
      }}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, { boxShadow: "var(--shadow-md)", borderColor: cat.color, transform: "translateY(-2px)" })}
      onMouseLeave={(e) => Object.assign(e.currentTarget.style, { boxShadow: "none", borderColor: "var(--border)", transform: "none" })}
    >
      {!!pendingCount && (
        <span style={{
          position: "absolute", top: 12, right: 12, minWidth: 22, height: 22, padding: "0 6px",
          borderRadius: "var(--radius-full)", backgroundColor: "var(--danger)", color: "white",
          fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {pendingCount}
        </span>
      )}
      <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", backgroundColor: `${cat.color}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={22} style={{ color: cat.color }} />
      </div>
      <div>
        <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{cat.label}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)", fontWeight: 500, color: cat.color, marginTop: "auto" }}>
        {pendingCount ? `${pendingCount} pendiente${pendingCount === 1 ? "" : "s"}` : "Ver formaciones"} <ChevronRight size={13} />
      </div>
    </button>
  );
}

function CategoryPicker({ onSelectCategory, pendingCountByCategory }) {
  return (
    <div>
      <div style={{ marginBottom: "var(--sp-5)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Catálogo</h2>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 2 }}>Elige un campo para ver sus formaciones</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--sp-4)" }}>
        {CATEGORIES.map((cat) => (
          <CategoryBubble key={cat.id} cat={cat} onClick={() => onSelectCategory(cat.id)} pendingCount={pendingCountByCategory ? pendingCountByCategory[cat.id] : null} />
        ))}
      </div>
    </div>
  );
}

function Catalog({ courses, currentUser, groups, getStatus, onOpenCourse, selectedCategory, onSelectCategory, paths = [], onOpenPath }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // El filtro de departamento vive aquí arriba, a nivel de todo el Catálogo
  // — no dentro de un campo concreto — y se mantiene aunque cambies de
  // campo, para que sea de verdad un filtro general, no algo que hay que
  // volver a elegir cada vez que entras a Protocolos, Genérica, etc.
  const [departmentFilter, setDepartmentFilter] = useState(null);
  const visibleCoursesRaw = currentUser ? courses.filter((c) => isAssignedToUser(c, currentUser, groups)) : courses.filter((c) => !c.archived);

  // Una formación "General / Interdepartamental" (sin departamento puesto)
  // se ve siempre, filtres por el departamento que filtres — el filtro solo
  // hace desaparecer las que son específicas de OTRO departamento distinto.
  const visibleCourses = departmentFilter
    ? visibleCoursesRaw.filter((c) => c.departmentGroupId === departmentFilter || !c.departmentGroupId)
    : visibleCoursesRaw;

  // Departamentos que existen de verdad en el catálogo (con al menos una
  // formación puesta), para no mostrar chips vacíos que no llevan a nada.
  const departmentsInCatalog = groups.filter((g) => visibleCoursesRaw.some((c) => c.departmentGroupId === g.id));

  const departmentFilterBar = departmentsInCatalog.length > 0 && (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginRight: 2 }}>Departamento:</span>
      <button
        onClick={() => setDepartmentFilter(null)}
        style={{
          display: "flex", alignItems: "center", gap: 5, fontSize: "var(--text-xs)", fontWeight: 600,
          padding: "6px 12px", borderRadius: "var(--radius-full)", cursor: "pointer", border: "none",
          backgroundColor: !departmentFilter ? "var(--brand)" : "var(--bg-inset)",
          color: !departmentFilter ? "white" : "var(--text-secondary)",
        }}
      >
        <Building2 size={12} /> Todos
      </button>
      {departmentsInCatalog.map((g) => (
        <button
          key={g.id}
          onClick={() => setDepartmentFilter(g.id)}
          style={{
            display: "flex", alignItems: "center", gap: 5, fontSize: "var(--text-xs)", fontWeight: 600,
            padding: "6px 12px", borderRadius: "var(--radius-full)", cursor: "pointer", border: "none",
            backgroundColor: departmentFilter === g.id ? "var(--brand)" : "var(--bg-inset)",
            color: departmentFilter === g.id ? "white" : "var(--text-secondary)",
          }}
        >
          <Building2 size={12} /> {g.name}
        </button>
      ))}
    </div>
  );

  // Pendientes por campo, y el total — cuentan aunque la formación no tenga
  // fecha límite puesta; lo único que importa es que esté asignada y no
  // completada todavía. Se ve desde fuera, antes de entrar a ningún campo.
  const pendingCountByCategory = useMemo(() => {
    const map = {};
    for (const cat of CATEGORIES) {
      map[cat.id] = visibleCourses.filter((c) => c.category === cat.id && (!currentUser || getStatus(currentUser, c.id) !== "completada")).length;
    }
    return map;
  }, [visibleCourses, currentUser, getStatus]);
  const totalPendingInCatalog = useMemo(() => Object.values(pendingCountByCategory).reduce((s, n) => s + n, 0), [pendingCountByCategory]);

  const totalPendingBanner = currentUser && totalPendingInCatalog > 0 && (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "var(--sp-3) var(--sp-4)",
      borderRadius: "var(--radius-md)", backgroundColor: "var(--warning-soft)", marginBottom: "var(--sp-4)",
    }}>
      <Clock size={16} style={{ color: "var(--warning)", flexShrink: 0 }} />
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--warning-text)" }}>
        {totalPendingInCatalog} formación{totalPendingInCatalog === 1 ? "" : "es"} pendiente{totalPendingInCatalog === 1 ? "" : "s"} en total, entre todos los campos.
      </span>
    </div>
  );

  // Mapa courseId -> título de la primera ruta a la que pertenece (si alguna),
  // para la etiqueta "Parte de la ruta: ..." en las tarjetas.
  const pathTitleByCourseId = useMemo(() => {
    const map = {};
    for (const p of paths) {
      for (const cid of p.courseIds) {
        if (!map[cid]) map[cid] = p.title;
      }
    }
    return map;
  }, [paths]);

  if (visibleCourses.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-3)", padding: "var(--sp-16) 0", textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LayoutGrid size={20} style={{ color: "var(--text-muted)" }} />
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", maxWidth: 280 }}>
          {courses.length === 0 ? "Aún no hay formaciones. Añade la primera desde Administración." : "No tienes formaciones asignadas todavía."}
        </div>
      </div>
    );
  }

  const searchBar = (
    <div style={{ position: "relative", marginBottom: "var(--sp-5)" }}>
      <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Buscar una formación por su nombre o tema…"
        style={{
          width: "100%", padding: "10px 12px 10px 38px", borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)", fontSize: "var(--text-sm)", color: "var(--text-primary)",
          backgroundColor: "var(--bg-card)",
        }}
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery("")}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );

  const query = searchQuery.trim().toLowerCase();
  if (query) {
    const matches = visibleCourses.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        (c.description || "").toLowerCase().includes(query) ||
        categoryMeta(c.category).label.toLowerCase().includes(query) ||
        (c.modules || []).some((m) => m.title.toLowerCase().includes(query) || (m.body || "").toLowerCase().includes(query))
    );
    const pathMatches = paths.filter(
      (p) => p.title.toLowerCase().includes(query) || (p.description || "").toLowerCase().includes(query)
    );
    const totalResults = matches.length + pathMatches.length;
    return (
      <div>
        {searchBar}
        {departmentFilterBar && <div style={{ marginBottom: "var(--sp-3)" }}>{departmentFilterBar}</div>}
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
          {totalResults} resultado{totalResults === 1 ? "" : "s"} para "{searchQuery}"
        </div>
        {totalResults === 0 ? (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", padding: "var(--sp-6) 0", textAlign: "center" }}>
            No hay nada que coincida. Prueba con otra palabra.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
            {pathMatches.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 5 }}>
                  <Map size={12} /> RUTAS DE APRENDIZAJE
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)" }}>
                  {pathMatches.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onOpenPath && onOpenPath(p.id)}
                      style={{ ...DS.card, textAlign: "left", cursor: "pointer", padding: "var(--sp-4)", display: "flex", alignItems: "center", gap: "var(--sp-3)" }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", backgroundColor: "var(--info-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Map size={17} style={{ color: "var(--info)" }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{p.title}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.courseIds.length} formación{p.courseIds.length === 1 ? "" : "es"}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {matches.length > 0 && (
              <div>
                {pathMatches.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 5 }}>
                    <LayoutGrid size={12} /> FORMACIONES
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)" }}>
                  {matches.map((c) => (
                    <CourseCard key={c.id} course={c} status={currentUser ? getStatus(currentUser, c.id) : "pendiente"} onOpen={() => onOpenCourse(c.id)} pathTitle={pathTitleByCourseId[c.id]} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!selectedCategory) {
    return (
      <div>
        {searchBar}
        {totalPendingBanner}
        {departmentFilterBar && <div style={{ marginBottom: "var(--sp-4)" }}>{departmentFilterBar}</div>}
        <CategoryPicker onSelectCategory={onSelectCategory} pendingCountByCategory={currentUser ? pendingCountByCategory : null} />
      </div>
    );
  }

  const cat = categoryMeta(selectedCategory);
  const categoryCourses = visibleCourses.filter((c) => c.category === selectedCategory);
  const pendingCourses = sortByUrgency(categoryCourses.filter((c) => !currentUser || getStatus(currentUser, c.id) !== "completada"));
  const completedCourses = currentUser ? categoryCourses.filter((c) => getStatus(currentUser, c.id) === "completada") : [];
  const CatIcon = cat.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      {searchBar}
      {totalPendingBanner}
      {departmentFilterBar}
      <button onClick={() => onSelectCategory(null)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)", border: "none", background: "none", cursor: "pointer", padding: 0, width: "fit-content" }}>
        <ChevronLeft size={15} /> Catálogo
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", backgroundColor: `${cat.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <CatIcon size={19} style={{ color: cat.color }} />
        </div>
        <div>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--text-primary)", margin: 0, lineHeight: 1.3 }}>{cat.label}</h2>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Ordenadas por plazo más urgente</div>
        </div>
      </div>

      {pendingCourses.length === 0 ? (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", padding: "var(--sp-4) 0" }}>
          {departmentFilter ? "No hay formaciones pendientes de este departamento en este campo." : completedCourses.length > 0 ? "No tienes formaciones pendientes en este campo. Al día." : "Todavía no hay formaciones en este campo."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)" }}>
          {pendingCourses.map((c) => (
            <CourseCard key={c.id} course={c} status={currentUser ? getStatus(currentUser, c.id) : "pendiente"} onOpen={() => onOpenCourse(c.id)} pathTitle={pathTitleByCourseId[c.id]} />
          ))}
        </div>
      )}

      {currentUser && completedCourses.length > 0 && (
        <div>
          <button onClick={() => setShowCompleted((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--sp-3)", width: "100%", textAlign: "left", border: "none", background: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 24, height: 24, borderRadius: "var(--radius-md)", backgroundColor: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={13} style={{ color: "var(--success)" }} />
            </div>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>Completadas ({completedCourses.length})</span>
            {showCompleted ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
          </button>
          {showCompleted && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-4)", opacity: 0.7 }}>
              {completedCourses.map((c) => (
                <CourseCard key={c.id} course={c} status="completada" onOpen={() => onOpenCourse(c.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function CourseDetail({ course, currentUser, status, record, quizAnswers, setQuizAnswers, quizResult, onSubmitQuiz, onSubmitModuleQuiz, onResetQuiz, onSelfReport, onRateCourse, onSubmitPracticalCase, courses, completionsByCourse, onOpenRelatedCourse, onToggleModuleChecklistStep, onSubmitModulePracticalCase, onBack, onRetry }) {
  if (course.modules && course.modules.length > 0) {
    return (
      <ModularCourseDetail
        course={course}
        currentUser={currentUser}
        record={record}
        quizAnswers={quizAnswers}
        setQuizAnswers={setQuizAnswers}
        quizResult={quizResult}
        onSubmitModuleQuiz={onSubmitModuleQuiz}
        onResetQuiz={onResetQuiz}
        onRateCourse={onRateCourse}
        onSubmitPracticalCase={onSubmitPracticalCase}
        courses={courses}
        completionsByCourse={completionsByCourse}
        onOpenRelatedCourse={onOpenRelatedCourse}
        onToggleModuleChecklistStep={onToggleModuleChecklistStep}
        onSubmitModulePracticalCase={onSubmitModulePracticalCase}
        onBack={onBack}
      />
    );
  }

  const embed = getVideoEmbedUrl(course.videoUrl);
  const quiz = course.quiz || [];
  const allAnswered = quiz.every((_, i) => quizAnswers[i] !== undefined);
  const isGoogleForm = course.testMode === "googleform" && course.googleFormUrl;
  const isNoTest = course.testMode === "ninguno";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: 760 }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)", border: "none", background: "none", cursor: "pointer", padding: 0, width: "fit-content" }}>
        <ChevronLeft size={15} /> Volver al catálogo
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-3)", flexWrap: "wrap" }}>
        <div>
          <CategoryTag id={course.category} />
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", marginTop: "var(--sp-2)", marginBottom: "var(--sp-1)", lineHeight: 1.3 }}>
            {course.title}
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: 640, margin: 0, lineHeight: 1.5 }}>{course.description}</p>
          <div style={{ marginTop: "var(--sp-2)" }}>
            <CopyLinkButton url={buildShareLink("course", course.id)} />
          </div>
        </div>
        <DeadlineChip deadline={course.deadline} completed={status === "completada"} />
      </div>

      {course.videoFile ? (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <PlayCircle size={14} /> VÍDEO DE LA FORMACIÓN
          </div>
          <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", backgroundColor: "#000", aspectRatio: "16/9" }}>
            <video controls src={course.videoFile.url} style={{ width: "100%", height: "100%" }} title={course.title} />
          </div>
        </div>
      ) : course.videoUrl && (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <PlayCircle size={14} /> VÍDEO DE LA FORMACIÓN
          </div>
          <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", backgroundColor: "#000", aspectRatio: "16/9" }}>
            <iframe src={embed} style={{ width: "100%", height: "100%", border: "none" }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={course.title} />
          </div>
          <a href={course.videoUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--info)", marginTop: "var(--sp-2)" }}>
            <PlayCircle size={14} /> Ver el vídeo en su web de origen ↗
          </a>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Si el reproductor no carga, usa este enlace — se abre en una pestaña aparte.
          </div>
        </div>
      )}

      {course.presentationUrl && (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={14} /> PRESENTACIÓN / MATERIAL
          </div>
          <div style={{ ...DS.card }}>
            <iframe src={course.presentationUrl} style={{ width: "100%", height: 420, border: "none", display: "block" }} title={`${course.title}-material`} />
          </div>
          <a href={course.presentationUrl} target="_blank" rel="noreferrer" style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--info)", marginTop: "var(--sp-2)", display: "inline-block" }}>
            Abrir en una pestaña nueva ↗
          </a>
        </div>
      )}

      {course.attachments && course.attachments.length > 0 && (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={14} /> DOCUMENTOS ADJUNTOS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {course.attachments.map((att) => (
              <AttachmentViewer key={att.id} att={att} />
            ))}
          </div>
        </div>
      )}

      {isGoogleForm && (
        <div style={{ ...DS.card, padding: "var(--sp-4)" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <ClipboardList size={16} style={{ color: "var(--brand)" }} />
            Test final (Google Form)
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
            Este test se completa en el formulario de abajo. Cuando termines, indícalo con el botón.
          </div>
          <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border)", marginBottom: "var(--sp-2)" }}>
            <iframe src={getFormEmbedUrl(course.googleFormUrl)} style={{ width: "100%", height: 480, border: "none", display: "block" }} title={`${course.title}-form`}>
              Cargando…
            </iframe>
          </div>
          <a href={course.googleFormUrl} target="_blank" rel="noreferrer" style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--info)", display: "inline-block", marginBottom: "var(--sp-3)" }}>
            Abrir el formulario en una pestaña nueva ↗
          </a>
          <div>
            {status === "completada" ? (
              <StatusPill icon={CheckCircle2} label={`Completado ${record?.completedAt ? `el ${record.completedAt}` : ""}`} variant="success" />
            ) : record?.awaitingRating ? (
              <StatusPill icon={Star} label="Formulario recibido — valóralo abajo para terminar" variant="warning" />
            ) : (
              <button
                disabled={!currentUser}
                onClick={onSelfReport}
                style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: !currentUser ? 0.4 : 1 }}
              >
                Ya he completado el formulario
              </button>
            )}
          </div>
        </div>
      )}

      {isNoTest && (
        <div style={{ ...DS.card, padding: "var(--sp-4)" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: "var(--sp-3)", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <CheckCircle2 size={16} style={{ color: "var(--brand)" }} />
            Esta formación no tiene test
          </div>
          <div>
            {status === "completada" ? (
              <StatusPill icon={CheckCircle2} label={`Completado ${record?.completedAt ? `el ${record.completedAt}` : ""}`} variant="success" />
            ) : record?.awaitingRating ? (
              <StatusPill icon={Star} label="Visto — valóralo abajo para terminar" variant="warning" />
            ) : (
              <button
                disabled={!currentUser}
                onClick={onSelfReport}
                style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: !currentUser ? 0.4 : 1 }}
              >
                Ya la he visto
              </button>
            )}
          </div>
        </div>
      )}

      {!isGoogleForm && !isNoTest && quiz.length > 0 && (
        <div style={{ ...DS.card, padding: "var(--sp-4)" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: "var(--sp-3)", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <ClipboardList size={16} style={{ color: "var(--brand)" }} />
            Test final {record?.attempts ? `· intento ${record.attempts + (quizResult ? 0 : 1)}` : ""}
          </div>

          {status === "completada" && !quizResult ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <StatusPill icon={CheckCircle2} label={`Superado ${record?.score != null ? `(${record.score}%)` : ""}`} variant="success" />
              <button onClick={onRetry} style={{ fontSize: "var(--text-xs)", fontWeight: 500, textDecoration: "underline", color: "var(--text-muted)", border: "none", background: "none", cursor: "pointer" }}>
                Repetir de todas formas
              </button>
            </div>
          ) : quizResult ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              <div style={{
                borderRadius: "var(--radius-md)", padding: "var(--sp-3)", fontSize: "var(--text-sm)", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
                backgroundColor: quizResult.passed ? "var(--success-soft)" : "var(--danger-soft)",
                color: quizResult.passed ? "var(--success-text)" : "var(--danger-text)",
              }}>
                {quizResult.passed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {quizResult.passed
                  ? `Superado — ${quizResult.correctCount}/${quizResult.total} correctas (${quizResult.score}%). Valórala abajo para completar la formación.`
                  : `No alcanzado — ${quizResult.correctCount}/${quizResult.total} correctas (${quizResult.score}%). Necesitas ${course.passPct ?? 70}%.`}
              </div>
              {!quizResult.passed && (
                <button onClick={onRetry} style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "6px 14px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", width: "fit-content" }}>
                  Reintentar test
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
              {quiz.map((q, qi) => (
                <div key={qi}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--sp-2)", color: "var(--text-primary)" }}>
                    {qi + 1}. {q.question}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {q.options.map((opt, oi) => {
                      const selected = quizAnswers[qi] === oi;
                      return (
                        <div
                          key={oi}
                          onClick={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)",
                            borderRadius: "var(--radius-md)", border: `1px solid ${selected ? "var(--brand)" : "var(--border)"}`,
                            padding: "8px 12px", cursor: "pointer", transition: "all var(--dur-fast) var(--ease-out)",
                            backgroundColor: selected ? "var(--brand-soft)" : "var(--bg-card)", color: "var(--text-primary)",
                          }}
                        >
                          <span style={{ width: 14, height: 14, borderRadius: "var(--radius-full)", border: `1.5px solid ${selected ? "var(--brand)" : "var(--border-strong)"}`, backgroundColor: selected ? "var(--brand)" : "transparent", flexShrink: 0 }} />
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                disabled={!allAnswered || !currentUser}
                onClick={onSubmitQuiz}
                style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: (!allAnswered || !currentUser) ? 0.4 : 1, width: "fit-content" }}
              >
                Enviar test
              </button>
            </div>
          )}
        </div>
      )}

      {course.practicalCase && currentUser && (
        <PracticalCaseSection
          practicalCase={course.practicalCase}
          answer={record?.practicalCaseAnswer}
          onSubmit={(text) => onSubmitPracticalCase(text)}
        />
      )}

      {(status === "completada" || record?.awaitingRating) && currentUser && (
        <RatingStars rating={record?.rating || 0} ratingComment={record?.ratingComment} awaitingRating={!!record?.awaitingRating} onRate={onRateCourse} />
      )}
    </div>
  );
}

/* ---------- Formaciones por módulos (secuenciales, con desbloqueo) ---------- */

function ModuleStepper({ modules, moduleProgress, activeIndex, viewedIndex, onSelect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {modules.map((m, i) => {
        const passed = moduleProgress[m.id]?.passed;
        const locked = i > activeIndex;
        const isViewed = i === viewedIndex;
        let icon = <span style={{ fontSize: 11, fontWeight: 700 }}>{i + 1}</span>;
        let iconBg = "var(--bg-inset)";
        let iconColor = "var(--text-muted)";
        if (passed) {
          icon = <CheckCircle2 size={13} />;
          iconBg = "var(--success)";
          iconColor = "white";
        } else if (locked) {
          icon = <Lock size={11} />;
        } else if (i === activeIndex) {
          iconBg = "var(--brand)";
          iconColor = "white";
        }
        return (
          <button
            key={m.id}
            disabled={locked}
            onClick={() => onSelect(i)}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: "var(--radius-md)", border: "none", textAlign: "left",
              backgroundColor: isViewed ? "var(--brand-soft)" : "transparent",
              cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.55 : 1,
              width: "100%",
            }}
          >
            <span style={{ width: 22, height: 22, borderRadius: "var(--radius-full)", backgroundColor: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icon}
            </span>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: isViewed ? 600 : 500, color: locked ? "var(--text-muted)" : "var(--text-primary)" }}>
              {m.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ModuleContent({ module: mod, alreadyPassed, quizAnswers, setQuizAnswers, quizResult, onSubmit, onResetQuiz, onContinue, isLastModule, courses = [], completionsByCourse = {}, currentUser, moduleProgressEntry, onOpenRelatedCourse, onToggleChecklistStep, onSubmitPracticalCase }) {
  const embed = getVideoEmbedUrl(mod.videoUrl);
  const quiz = mod.quiz || [];
  const allAnswered = quiz.every((_, i) => quizAnswers[i] !== undefined);
  // Mostrar el formulario del test solo si el módulo no está ya superado Y no
  // hay un resultado reciente en pantalla (si lo hay, mostramos ESE resultado
  // primero, sin que el aviso "ya lo superaste" lo tape).
  const showResultBanner = !!quizResult;
  const showReadOnlyPassed = alreadyPassed && !showResultBanner;
  const showQuizForm = !alreadyPassed && !showResultBanner && quiz.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{mod.title}</h2>

      {mod.body && (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-line" }}>
          {mod.body}
        </div>
      )}

      {mod.videoFile ? (
        <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", backgroundColor: "#000", aspectRatio: "16/9" }}>
          <video controls src={mod.videoFile.url} style={{ width: "100%", height: "100%" }} title={mod.title} />
        </div>
      ) : mod.videoUrl && (
        <div>
          <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", backgroundColor: "#000", aspectRatio: "16/9" }}>
            <iframe src={embed} style={{ width: "100%", height: "100%", border: "none" }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={mod.title} />
          </div>
          <a href={mod.videoUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--info)", marginTop: "var(--sp-2)" }}>
            <PlayCircle size={13} /> Ver el vídeo en su web de origen ↗
          </a>
        </div>
      )}

      {(mod.attachments || []).length > 0 && (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={13} /> DOCUMENTOS DE ESTE MÓDULO
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {mod.attachments.map((att) => (
              <AttachmentViewer key={att.id} att={att} />
            ))}
          </div>
        </div>
      )}

      {(mod.relatedCourses || []).length > 0 && (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <Map size={13} /> FORMACIÓN RELACIONADA
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {mod.relatedCourses.map((rc) => {
              const relCourse = courses.find((c) => c.id === rc.courseId);
              if (!relCourse) return null;
              const relDone = currentUser && completionsByCourse[rc.courseId]?.[currentUser]?.status === "completada";
              return (
                <button
                  key={rc.courseId}
                  onClick={() => onOpenRelatedCourse && onOpenRelatedCourse(rc.courseId)}
                  style={{ ...DS.card, textAlign: "left", cursor: "pointer", padding: "var(--sp-3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    {relDone ? <CheckCircle2 size={15} style={{ color: "var(--success)", flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{relCourse.title}</span>
                  </div>
                  {rc.mode === "requisito" && !relDone && <StatusPill icon={AlertTriangle} label="Requisito" variant="warning" />}
                  {rc.mode === "requisito" && relDone && <StatusPill icon={CheckCircle2} label="Hecho" variant="success" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(mod.externalLinks || []).length > 0 && (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <Link2 size={13} /> ENLACES DE ESTE MÓDULO
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {mod.externalLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                style={{ ...DS.card, padding: "var(--sp-3)", display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)", color: "var(--info)", textDecoration: "none" }}
              >
                <Link2 size={14} /> {link.label || link.url}
              </a>
            ))}
          </div>
        </div>
      )}

      {(mod.checklistSteps || []).length > 0 && (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <ClipboardList size={13} /> ANTES DE CONTINUAR
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {mod.checklistSteps.map((step) => {
              const checked = !!moduleProgressEntry?.checklistChecked?.[step.id];
              return (
                <label key={step.id} style={{ ...DS.card, padding: "var(--sp-3)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={checked} onChange={() => onToggleChecklistStep && onToggleChecklistStep(step.id)} />
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", textDecoration: checked ? "line-through" : "none", opacity: checked ? 0.6 : 1 }}>{step.text}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {mod.practicalCase && (
        <PracticalCaseSection
          practicalCase={mod.practicalCase}
          answer={moduleProgressEntry?.practicalCaseAnswer}
          onSubmit={(text) => onSubmitPracticalCase && onSubmitPracticalCase(text)}
        />
      )}

      {showReadOnlyPassed && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", backgroundColor: "var(--bg-inset)", padding: "var(--sp-3)", borderRadius: "var(--radius-md)" }}>
          Ya superaste este módulo — lo estás revisando. No hace falta repetir el test.
        </div>
      )}

      {/* Módulo sin preguntas: no hay nada que responder, solo un botón para
          seguir adelante — sin este botón, un módulo sin test se quedaría
          bloqueado para siempre, porque nunca se dispararía el desbloqueo. */}
      {!alreadyPassed && !showResultBanner && quiz.length === 0 && (
        <button
          onClick={onSubmit}
          style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", width: "fit-content" }}
        >
          Continuar
        </button>
      )}
      {showResultBanner && quiz.length === 0 && quizResult.passed && !isLastModule && (
        <button onClick={onContinue} style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", width: "fit-content", display: "flex", alignItems: "center", gap: 6 }}>
          Ir al siguiente módulo <ChevronRight size={15} />
        </button>
      )}
      {showResultBanner && quiz.length === 0 && quizResult.passed && isLastModule && (
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--success-text)" }}>
          🎉 ¡Último módulo visto! Solo falta valorar la formación, abajo del todo, para darla por completada.
        </div>
      )}

      {(showResultBanner || showQuizForm) && quiz.length > 0 && (
        <div style={{ ...DS.card, padding: "var(--sp-4)" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: "var(--sp-3)", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <ClipboardList size={16} style={{ color: "var(--brand)" }} />
            Test de este módulo
          </div>

          {showResultBanner ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              <div style={{
                borderRadius: "var(--radius-md)", padding: "var(--sp-3)", fontSize: "var(--text-sm)", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
                backgroundColor: quizResult.passed ? "var(--success-soft)" : "var(--danger-soft)",
                color: quizResult.passed ? "var(--success-text)" : "var(--danger-text)",
              }}>
                {quizResult.passed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {quizResult.passed
                  ? `Superado — ${quizResult.correctCount}/${quizResult.total} correctas (${quizResult.score}%). Módulo desbloqueado.`
                  : `No alcanzado — ${quizResult.correctCount}/${quizResult.total} correctas (${quizResult.score}%). Necesitas ${mod.passPct ?? 70}%.`}
              </div>
              {!quizResult.passed && (
                <button onClick={onResetQuiz} style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", width: "fit-content" }}>
                  Reintentar
                </button>
              )}
              {quizResult.passed && !isLastModule && (
                <button onClick={onContinue} style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", width: "fit-content", display: "flex", alignItems: "center", gap: 6 }}>
                  Ir al siguiente módulo <ChevronRight size={15} />
                </button>
              )}
              {quizResult.passed && isLastModule && (
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--success-text)" }}>
                  🎉 ¡Último módulo superado! Solo falta valorar la formación, abajo del todo, para darla por completada.
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
              {quiz.map((q, qi) => (
                <div key={qi}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--sp-2)", color: "var(--text-primary)" }}>
                    {qi + 1}. {q.question}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {q.options.map((opt, oi) => {
                      const selected = quizAnswers[qi] === oi;
                      return (
                        <div
                          key={oi}
                          onClick={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)",
                            borderRadius: "var(--radius-md)", border: `1px solid ${selected ? "var(--brand)" : "var(--border)"}`,
                            padding: "8px 12px", cursor: "pointer", transition: "all var(--dur-fast) var(--ease-out)",
                            backgroundColor: selected ? "var(--brand-soft)" : "var(--bg-card)", color: "var(--text-primary)",
                          }}
                        >
                          <span style={{ width: 14, height: 14, borderRadius: "var(--radius-full)", border: `1.5px solid ${selected ? "var(--brand)" : "var(--border-strong)"}`, backgroundColor: selected ? "var(--brand)" : "transparent", flexShrink: 0 }} />
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                disabled={!allAnswered}
                onClick={onSubmit}
                style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: !allAnswered ? 0.4 : 1, width: "fit-content" }}
              >
                Enviar respuestas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModularCourseDetail({ course, currentUser, record, quizAnswers, setQuizAnswers, quizResult, onSubmitModuleQuiz, onResetQuiz, onRateCourse, onSubmitPracticalCase, courses, completionsByCourse, onOpenRelatedCourse, onToggleModuleChecklistStep, onSubmitModulePracticalCase, onBack }) {
  const modules = course.modules;
  const moduleProgress = record?.moduleProgress || {};
  const passedCount = modules.filter((m) => moduleProgress[m.id]?.passed).length;
  const percent = Math.round((passedCount / modules.length) * 100);
  const firstUnpassedIndex = modules.findIndex((m) => !moduleProgress[m.id]?.passed);
  const allDone = firstUnpassedIndex === -1;
  const activeIndex = allDone ? modules.length - 1 : firstUnpassedIndex;

  const [viewedIndex, setViewedIndex] = useState(activeIndex);

  function selectModule(i) {
    if (i > activeIndex) return; // bloqueado
    onResetQuiz();
    setViewedIndex(i);
  }

  function goToNextModule() {
    onResetQuiz();
    setViewedIndex((i) => Math.min(i + 1, modules.length - 1));
  }

  const viewedModule = modules[viewedIndex];
  const viewedAlreadyPassed = !!moduleProgress[viewedModule?.id]?.passed;

  return (
    <div style={{ maxWidth: 900 }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)", border: "none", background: "none", cursor: "pointer", padding: 0, width: "fit-content", marginBottom: "var(--sp-4)" }}>
        <ChevronLeft size={15} /> Volver al catálogo
      </button>

      <div style={{ marginBottom: "var(--sp-2)" }}>
        <CategoryTag id={course.category} />
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", margin: "var(--sp-2) 0 var(--sp-1) 0", lineHeight: 1.3 }}>
          {course.title}
        </h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5, maxWidth: 640 }}>{course.description}</p>
        <div style={{ marginTop: "var(--sp-2)" }}>
          <CopyLinkButton url={buildShareLink("course", course.id)} />
        </div>
      </div>

      {/* Progreso dentro de la propia formación */}
      <div style={{ ...DS.card, padding: "var(--sp-4)", marginBottom: "var(--sp-5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
            {allDone ? "🎉 Formación completada" : `${passedCount} de ${modules.length} módulos completados`}
          </span>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--brand)" }}>{percent}%</span>
        </div>
        <div style={{ height: 8, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${percent}%`, backgroundColor: allDone ? "var(--success)" : "var(--brand)", borderRadius: "var(--radius-full)", transition: "width 0.4s var(--ease-out)" }} />
        </div>
      </div>

      <div className="mb-module-layout">
        <div className="mb-module-stepper-wrap" style={{ ...DS.card, padding: "var(--sp-2)" }}>
          <ModuleStepper modules={modules} moduleProgress={moduleProgress} activeIndex={activeIndex} viewedIndex={viewedIndex} onSelect={selectModule} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <div style={{ ...DS.card, padding: "var(--sp-5)" }}>
            {viewedModule && (
              <ModuleContent
                module={viewedModule}
                alreadyPassed={viewedAlreadyPassed}
                isLastModule={viewedIndex === modules.length - 1}
                quizAnswers={quizAnswers}
                setQuizAnswers={setQuizAnswers}
                quizResult={quizResult}
                onContinue={goToNextModule}
                onSubmit={async () => {
                  await onSubmitModuleQuiz(viewedModule);
                }}
                onResetQuiz={onResetQuiz}
                courses={courses}
                completionsByCourse={completionsByCourse}
                currentUser={currentUser}
                moduleProgressEntry={moduleProgress[viewedModule?.id]}
                onOpenRelatedCourse={onOpenRelatedCourse}
                onToggleChecklistStep={(stepId) => onToggleModuleChecklistStep(viewedModule.id, stepId)}
                onSubmitPracticalCase={(text) => onSubmitModulePracticalCase(viewedModule.id, text)}
              />
            )}
          </div>
          {allDone && course.practicalCase && currentUser && (
            <PracticalCaseSection
              practicalCase={course.practicalCase}
              answer={record?.practicalCaseAnswer}
              onSubmit={(text) => onSubmitPracticalCase(text)}
            />
          )}
          {allDone && currentUser && (
            <RatingStars rating={record?.rating || 0} ratingComment={record?.ratingComment} awaitingRating={!!record?.awaitingRating} onRate={onRateCourse} />
          )}
        </div>
      </div>
    </div>
  );
}


// Editor de vídeo: alternar entre pegar un enlace externo (YouTube/Vimeo/
// Drive) o subir un archivo de vídeo propio, que se reproduce dentro de la
// app sin salir a ningún sitio. Se usa tanto para el vídeo principal de una
// formación como para el de cada módulo.
// El vídeo propio (subir un archivo) se probó y se descartó — con 1 GB de
// almacenamiento en el plan gratuito de Supabase, unos pocos vídeos lo
// habrían llenado del todo. Se deja solo el enlace externo (YouTube, Vimeo,
// Google Drive...), que no ocupa nada de tu espacio.
function VideoFieldEditor({ videoUrl, videoFile, onSetVideoUrl, label = "Vídeo" }) {
  return (
    <div>
      <TextInput label={label} value={videoUrl} onChange={onSetVideoUrl} placeholder="https://www.youtube.com/watch?v=..." />
      {videoFile && (
        <div className="text-[11px] mt-1" style={{ color: "var(--warning)" }}>
          Esta formación tiene un vídeo propio subido de antes ({videoFile.name || "sin nombre"}). Sigue funcionando, pero ya no se pueden subir vídeos nuevos — si quieres quitarlo, pégale un enlace externo aquí arriba y lo sustituye.
        </div>
      )}
    </div>
  );
}

// Buscador de "ver como empleado" — antes era una lista desplegable con
// todos los empleados de golpe, que se volvía interminable con muchas
// personas. Esto filtra a medida que escribes, y solo muestra unos pocos
// resultados a la vez.
function ViewAsEmployeeSearch({ employees, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const matches = query.trim()
    ? employees.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : employees.slice(0, 8);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Ver como empleado…"
        style={{ fontSize: "var(--text-xs)", padding: "4px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", backgroundColor: "var(--bg-card)", color: "var(--text-secondary)", width: 130 }}
      />
      {open && matches.length > 0 && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, marginTop: 4, minWidth: 180, maxHeight: 260, overflowY: "auto",
            backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)", zIndex: 50,
          }}
        >
          {matches.map((e) => (
            <button
              key={e.name}
              onClick={() => {
                onSelect(e.name);
                setQuery("");
                setOpen(false);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                padding: "7px 10px", fontSize: "var(--text-sm)", color: "var(--text-primary)",
                border: "none", background: "none", cursor: "pointer",
              }}
              onMouseEnter={(ev) => (ev.currentTarget.style.backgroundColor = "var(--bg-inset)")}
              onMouseLeave={(ev) => (ev.currentTarget.style.backgroundColor = "transparent")}
            >
              <Avatar name={e.name} size={20} />
              {e.name}
            </button>
          ))}
          {employees.length > 8 && !query.trim() && (
            <div style={{ padding: "6px 10px", fontSize: 11, color: "var(--text-muted)" }}>Escribe para buscar entre {employees.length} personas...</div>
          )}
        </div>
      )}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900"
        style={{ borderColor: "#00000020" }}
      />
    </label>
  );
}


function ModuleChecklistStepInput({ onAdd }) {
  const [text, setText] = useState("");
  return (
    <div className="flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onAdd(text);
            setText("");
          }
        }}
        placeholder="Ej. Firma la hoja de recepción antes de continuar"
        className="flex-1 text-xs rounded-md border px-2 py-1.5"
        style={{ borderColor: "#00000018" }}
      />
      <button
        onClick={() => {
          onAdd(text);
          setText("");
        }}
        disabled={!text.trim()}
        className="text-xs font-semibold px-2"
        style={{ color: BRAND.blue, opacity: !text.trim() ? 0.4 : 1 }}
      >
        Añadir
      </button>
    </div>
  );
}

// Lista consolidada de todos los documentos (PDF/Word) subidos en cualquier
// formación o módulo, en un solo sitio — antes había que entrar formación
// por formación para verlos.
function DocumentosAdminTab({ courses, onDeleteAttachment }) {
  const [search, setSearch] = useState("");
  const allDocs = useMemo(() => {
    const docs = [];
    for (const c of courses) {
      for (const att of c.attachments || []) {
        docs.push({ att, courseId: c.id, courseTitle: c.title, moduleId: null, moduleTitle: null });
      }
      for (const m of c.modules || []) {
        for (const att of m.attachments || []) {
          docs.push({ att, courseId: c.id, courseTitle: c.title, moduleId: m.id, moduleTitle: m.title });
        }
      }
    }
    return docs.sort((a, b) => (b.att.sizeKB || 0) - (a.att.sizeKB || 0));
  }, [courses]);

  const filtered = allDocs.filter(
    (d) => d.att.name.toLowerCase().includes(search.trim().toLowerCase()) || d.courseTitle.toLowerCase().includes(search.trim().toLowerCase())
  );
  const totalKB = allDocs.reduce((s, d) => s + (d.att.sizeKB || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
        {allDocs.length} documento{allDocs.length === 1 ? "" : "s"} en total · {(totalKB / 1024).toFixed(1)} MB
      </div>
      {allDocs.length > 5 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre de archivo o de formación..."
          className="w-full text-sm rounded-md border px-3 py-2"
          style={{ borderColor: "#00000020" }}
        />
      )}
      {allDocs.length === 0 ? (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>No hay ningún documento subido todavía.</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Ningún documento coincide con la búsqueda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          {filtered.map((d) => (
            <div key={d.att.id} style={{ ...DS.card, padding: "var(--sp-3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.att.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {d.courseTitle}{d.moduleTitle ? ` · ${d.moduleTitle}` : ""} · {((d.att.sizeKB || 0) / 1024).toFixed(1)} MB
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <AttachmentViewer att={d.att} />
                <button
                  onClick={() => {
                    if (window.confirm(`¿Eliminar "${d.att.name}"? Se quitará de "${d.courseTitle}${d.moduleTitle ? ` — ${d.moduleTitle}` : ""}".`)) {
                      onDeleteAttachment(d.courseId, d.moduleId, d.att.id);
                    }
                  }}
                  style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--danger)", border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Trash2 size={13} /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// Ficha completa de un empleado — todo lo suyo en un solo sitio (contacto,
// puesto, departamento, situación laboral, notas, y un resumen de su
// cumplimiento) en vez de tener que ir a Empleados, Grupos, Puestos y
// Cumplimiento por separado para juntar la misma información.
function EmployeeProfileOverlay({ employee, groups, puestos, courses, completionsByCourse, onUpdate, onAssignPuesto, onToggleGroup, onClose }) {
  const [name, setName] = useState(employee.name);
  const [email, setEmail] = useState(employee.email || "");
  const [phone, setPhone] = useState(employee.phone || "");
  const [hireDate, setHireDate] = useState(employee.hireDate || "");
  const [status, setStatus] = useState(employee.status || "activo");
  const [statusNote, setStatusNote] = useState(employee.statusNote || "");
  const [notes, setNotes] = useState(employee.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const myGroups = groups.filter((g) => (g.memberNames || []).includes(employee.name));
  const myPuesto = puestos.find((p) => p.id === employee.puestoId);
  const compliance = useMemo(() => computeEmployeeCompliance([employee], courses, groups, completionsByCourse)[0], [employee, courses, groups, completionsByCourse]);

  async function handleSave() {
    setSaving(true);
    setError("");
    const result = await onUpdate(employee.name, { name: name.trim(), email: email.trim(), phone: phone.trim(), hireDate, status, statusNote: statusNote.trim(), notes: notes.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.error || "No se pudo guardar.");
      return;
    }
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 95, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "var(--sp-4)", overflowY: "auto" }}>
      <div style={{ ...DS.card, maxWidth: 640, width: "100%", padding: "var(--sp-5)", margin: "var(--sp-6) 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={employee.name} size={44} />
            <div>
              <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{employee.name}</h3>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Ficha de empleado</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        {/* Resumen rápido de cumplimiento, de solo lectura */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "var(--sp-2)", marginBottom: "var(--sp-5)" }}>
          <div style={{ ...DS.card, padding: "var(--sp-2) var(--sp-3)", textAlign: "center" }}>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: compliance.percent === 100 ? "var(--success)" : "var(--brand)" }}>{compliance.percent}%</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Cumplimiento</div>
          </div>
          <div style={{ ...DS.card, padding: "var(--sp-2) var(--sp-3)", textAlign: "center" }}>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: compliance.overdueCount > 0 ? "var(--danger)" : "var(--text-muted)" }}>{compliance.overdueCount}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Vencidas</div>
          </div>
          {myPuesto && (
            <div style={{ ...DS.card, padding: "var(--sp-2) var(--sp-3)", textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--info)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{myPuesto.name}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Puesto</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: "var(--sp-2)" }}>DATOS DE CONTACTO</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)" }}>
              <TextInput label="Nombre y apellido" value={name} onChange={setName} />
              <TextInput label="Email" value={email} onChange={setEmail} type="email" />
              <TextInput label="Teléfono (opcional)" value={phone} onChange={setPhone} placeholder="600 000 000" />
              <TextInput label="Fecha de incorporación" value={hireDate} onChange={setHireDate} type="date" />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: "var(--sp-2)" }}>PUESTO Y DEPARTAMENTOS</div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Puesto
              <select
                value={employee.puestoId || ""}
                onChange={(e) => onAssignPuesto([employee.name], e.target.value || null)}
                className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900"
                style={{ borderColor: "#00000020" }}
              >
                <option value="">Sin puesto</option>
                {puestos.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", margin: "var(--sp-3) 0 6px" }}>Departamentos / equipos</div>
            {groups.length === 0 ? (
              <div className="text-xs text-gray-400">No hay ningún departamento creado todavía.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {groups.map((g) => {
                  const isMember = myGroups.some((mg) => mg.id === g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => onToggleGroup(employee.name, g.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, fontSize: "var(--text-xs)", fontWeight: 600,
                        padding: "6px 12px", borderRadius: "var(--radius-full)", cursor: "pointer", border: "none",
                        backgroundColor: isMember ? "var(--brand)" : "var(--bg-inset)",
                        color: isMember ? "white" : "var(--text-secondary)",
                      }}
                    >
                      {isMember && <Check size={12} />} {g.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: "var(--sp-2)" }}>SITUACIÓN LABORAL</div>
            <div style={{ display: "flex", gap: 6, marginBottom: status === "baja_temporal" ? "var(--sp-2)" : 0 }}>
              {EMPLOYEE_STATUS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatus(s.id)}
                  style={{
                    fontSize: "var(--text-xs)", fontWeight: 600, padding: "6px 12px", borderRadius: "var(--radius-full)", cursor: "pointer", border: "none",
                    backgroundColor: status === s.id ? s.color : "var(--bg-inset)",
                    color: status === s.id ? "white" : "var(--text-secondary)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {status === "baja_temporal" && (
              <TextInput label="Motivo / hasta cuándo (opcional)" value={statusNote} onChange={setStatusNote} placeholder="Ej. Baja médica, vuelve en marzo" />
            )}
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: "var(--sp-2)" }}>NOTAS INTERNAS (solo las ve el admin)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cualquier cosa que quieras recordar sobre esta persona..."
              rows={3}
              className="w-full text-sm rounded-md border px-3 py-2"
              style={{ borderColor: "#00000020" }}
            />
          </div>

          {error && <div style={{ fontSize: "var(--text-sm)", color: "var(--danger)" }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)", border: "1px solid var(--border)", background: "none", borderRadius: "var(--radius-md)", padding: "8px 16px", cursor: "pointer" }}>
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "white", backgroundColor: "var(--brand)", border: "none", borderRadius: "var(--radius-md)", padding: "8px 16px", cursor: "pointer", opacity: saving || !name.trim() ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />} Guardar ficha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PuestosAdminTab({ puestos, groups, onSavePuesto, onDeletePuesto }) {
  const [editingId, setEditingId] = useState(undefined); // undefined = lista, null = nuevo, id = editando
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("");
  const [items, setItems] = useState([]);
  const [newItemText, setNewItemText] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("conocimiento");
  const [importError, setImportError] = useState("");

  function groupName(id) {
    return groups.find((g) => g.id === id)?.name || null;
  }

  function startNew() {
    setEditingId(null);
    setName("");
    setGroupId("");
    setDeadlineDays("");
    setItems([]);
    setImportError("");
  }
  function startEdit(p) {
    setEditingId(p.id);
    setName(p.name);
    setGroupId(p.groupId || "");
    setDeadlineDays(p.deadlineDays || "");
    setItems([...(p.checklistItems || [])]);
    setImportError("");
  }
  function addItem() {
    if (!newItemText.trim()) return;
    setItems((prev) => [...prev, { id: uid(), text: newItemText.trim(), category: newItemCategory }]);
    setNewItemText("");
  }
  function removeItem(itemId) {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  // Importar el checklist entero desde un Excel: dos columnas, "Categoría" y
  // "Ítem" (los nombres de columna no distinguen mayúsculas ni acentos, para
  // no obligar a nadie a escribirlos exactamente igual). Los ítems que se
  // importan se añaden a los que ya hubiera, no los sustituyen — así no hay
  // riesgo de borrar algo por subir el archivo sin querer dos veces.
  function normalizeHeader(h) {
    return String(h || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function normalizeCategory(raw) {
    const v = normalizeHeader(raw);
    if (v.startsWith("apt")) return "aptitud";
    if (v.startsWith("hab")) return "habilidad";
    return "conocimiento";
  }
  async function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportError("");
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (rows.length === 0) {
        setImportError("El archivo no tiene filas de datos, o está vacío.");
        e.target.value = "";
        return;
      }
      const headerMap = {};
      for (const key of Object.keys(rows[0])) {
        const norm = normalizeHeader(key);
        if (norm.includes("categor")) headerMap.category = key;
        else if (norm.includes("item") || norm.includes("ítem") || norm.includes("texto") || norm.includes("descripcion")) headerMap.text = key;
      }
      if (!headerMap.text) {
        setImportError('No encuentro una columna de texto del ítem. Pon una columna llamada "Ítem" o "Descripción".');
        e.target.value = "";
        return;
      }
      const imported = rows
        .map((row) => ({
          id: uid(),
          text: String(row[headerMap.text] || "").trim(),
          category: headerMap.category ? normalizeCategory(row[headerMap.category]) : "conocimiento",
        }))
        .filter((it) => it.text.length > 0);
      if (imported.length === 0) {
        setImportError("No he encontrado ninguna fila con texto en la columna del ítem.");
        e.target.value = "";
        return;
      }
      setItems((prev) => [...prev, ...imported]);
    } catch (err) {
      setImportError("No he podido leer ese archivo. Comprueba que sea un Excel (.xlsx) o CSV válido.");
    }
    e.target.value = "";
  }

  if (editingId === undefined) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        <button
          onClick={startNew}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 14px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", width: "fit-content" }}
        >
          <Plus size={15} /> Nuevo puesto
        </button>
        {puestos.length === 0 && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>No hay puestos creados todavía. Es opcional — sin puestos, la app sigue funcionando igual.</div>}
        {puestos.map((p) => (
          <div key={p.id} style={{ ...DS.card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--sp-3)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{p.name}</div>
                {groupName(p.groupId) && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: "var(--radius-full)", backgroundColor: "var(--info-soft)", color: "var(--info)" }}>{groupName(p.groupId)}</span>
                )}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                {(p.checklistItems || []).length} ítem{(p.checklistItems || []).length === 1 ? "" : "s"}
                {p.deadlineDays ? ` · ${p.deadlineDays} días de plazo desde la asignación` : ""}
                {!groupName(p.groupId) && " · sin departamento asignado"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <CopyLinkButton url={buildShareLink("puesto", p.id)} compact />
              <button onClick={() => startEdit(p)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--info)", border: "none", background: "none", cursor: "pointer" }}>Editar</button>
              <button onClick={() => onDeletePuesto(p.id)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--danger)", border: "none", background: "none", cursor: "pointer" }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", maxWidth: 640 }}>
      <button onClick={() => setEditingId(undefined)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", color: "var(--text-secondary)", border: "none", background: "none", cursor: "pointer", padding: 0, width: "fit-content" }}>
        <ChevronLeft size={15} /> Puestos
      </button>

      <TextInput label="Nombre del puesto" value={name} onChange={setName} placeholder="Ej. Almacén — Mozo, Administración..." />

      <label className="block text-xs font-semibold text-gray-500 mb-1">
        Departamento
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }}>
          <option value="">Sin departamento asignado</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </label>
      <div className="text-[11px] text-gray-400 -mt-2">
        El checklist de este puesto solo lo verá y podrá evaluar quien sea responsable de este departamento (o el administrador completo) — la propia persona con este puesto nunca lo ve.
      </div>

      <div className="w-52">
        <TextInput label="Plazo para evaluarlo (días, opcional)" type="number" value={deadlineDays} onChange={setDeadlineDays} placeholder="Ej. 30 — vacío = sin plazo" />
      </div>

      <div>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)" }}>
          Checklist de conocimientos, aptitudes y habilidades
        </div>

        <div style={{ ...DS.card, padding: "var(--sp-3)", marginBottom: "var(--sp-3)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--brand)", cursor: "pointer" }}>
            <Upload size={14} />
            Importar desde Excel
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} style={{ display: "none" }} />
          </label>
          <span className="text-[11px] text-gray-400">Dos columnas: "Categoría" (Conocimiento/Aptitud/Habilidad) e "Ítem". Se añade a lo que ya haya.</span>
        </div>
        {importError && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--danger)", marginBottom: "var(--sp-2)" }}>{importError}</div>
        )}

        <div className="flex gap-2 mb-3">
          <input
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Ej. Conoce el protocolo de seguridad del almacén"
            className="flex-1 text-sm rounded-md border px-3 py-2"
            style={{ borderColor: "#00000020", minWidth: 220 }}
          />
          <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} className="text-sm rounded-md border px-2 py-2" style={{ borderColor: "#00000020" }}>
            {CHECKLIST_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button onClick={addItem} disabled={!newItemText.trim()} style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 14px", color: "var(--brand)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer", opacity: !newItemText.trim() ? 0.4 : 1 }}>
            Añadir
          </button>
        </div>

        {items.length === 0 ? (
          <div className="text-xs text-gray-400">Añade al menos un ítem (a mano o importando un Excel) para que el checklist tenga sentido.</div>
        ) : (
          CHECKLIST_CATEGORIES.map((cat) => {
            const catItems = items.filter((i) => i.category === cat.id);
            if (catItems.length === 0) return null;
            return (
              <div key={cat.id} style={{ marginBottom: "var(--sp-3)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: cat.color, marginBottom: 6 }}>{cat.label.toUpperCase()} ({catItems.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {catItems.map((item) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 10px", borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-inset)" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{item.text}</span>
                      <button onClick={() => removeItem(item.id)} className="text-red-500 flex-shrink-0"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        disabled={!name.trim() || items.length === 0}
        onClick={async () => {
          await onSavePuesto({ id: editingId || uid(), name: name.trim(), groupId: groupId || null, deadlineDays: deadlineDays ? Number(deadlineDays) : null, checklistItems: items });
          setEditingId(undefined);
        }}
        style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: (!name.trim() || items.length === 0) ? 0.4 : 1, width: "fit-content" }}
      >
        Guardar puesto
      </button>
    </div>
  );
}

function PathsAdminTab({ paths, courses, groups, employees, onSavePath, onDeletePath, mode = "full" }) {
  const emptyAssignment = { mode: "todos", groupIds: [], employeeNames: [] };
  const [editingId, setEditingId] = useState(undefined); // undefined = lista, null = nueva, id = editando
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseIds, setCourseIds] = useState([]);
  const [assignment, setAssignment] = useState({ ...emptyAssignment });
  const [addCourseId, setAddCourseId] = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [isWelcomePath, setIsWelcomePath] = useState(false);

  function startNew() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setCourseIds([]);
    setAssignment({ ...emptyAssignment });
    setAddCourseId("");
    setIsWelcomePath(false);
  }
  function startEdit(p) {
    setEditingId(p.id);
    setTitle(p.title);
    setDescription(p.description || "");
    setCourseIds([...p.courseIds]);
    setAssignment(p.assignment ? { ...p.assignment } : { ...emptyAssignment });
    setAddCourseId("");
    setIsWelcomePath(!!p.isWelcomePath);
  }
  function moveCourse(i, dir) {
    setCourseIds((prev) => {
      const arr = [...prev];
      const target = i + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[i], arr[target]] = [arr[target], arr[i]];
      return arr;
    });
  }

  if (editingId === undefined) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        <button
          onClick={startNew}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 14px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", width: "fit-content" }}
        >
          <Plus size={15} /> Nueva ruta
        </button>
        {paths.length === 0 && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>No hay rutas de aprendizaje todavía.</div>}
        {paths.map((p) => (
          <div key={p.id} style={{ ...DS.card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--sp-3)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{p.title}</div>
                {p.isWelcomePath && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: "var(--radius-full)", backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}>
                    Ruta de bienvenida
                  </span>
                )}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{p.courseIds.length} {p.courseIds.length === 1 ? "formación" : "formaciones"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <CopyLinkButton url={buildShareLink("path", p.id)} compact />
              <button onClick={() => startEdit(p)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--info)", border: "none", background: "none", cursor: "pointer" }}>Editar</button>
              <button onClick={() => onDeletePath(p.id)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--danger)", border: "none", background: "none", cursor: "pointer" }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const availableCourses = courses.filter((c) => !courseIds.includes(c.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", maxWidth: 640 }}>
      <button onClick={() => setEditingId(undefined)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", color: "var(--text-secondary)", border: "none", background: "none", cursor: "pointer", padding: 0, width: "fit-content" }}>
        <ChevronLeft size={15} /> Rutas
      </button>

      <TextInput label="Título de la ruta" value={title} onChange={setTitle} placeholder="Ej. Ruta de bienvenida" />
      <label className="block text-xs font-semibold text-gray-500 mb-1">
        Descripción
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }} />
      </label>

      <div>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)" }}>
          Formaciones de la ruta, en el orden en que se desbloquean
        </div>
        <div className="flex gap-2 mb-3">
          <select value={addCourseId} onChange={(e) => setAddCourseId(e.target.value)} className="flex-1 text-sm rounded-md border px-3 py-2" style={{ borderColor: "#00000020" }}>
            <option value="">Selecciona una formación para añadir…</option>
            {availableCourses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <button
            disabled={!addCourseId}
            onClick={() => {
              setCourseIds((prev) => [...prev, addCourseId]);
              setAddCourseId("");
            }}
            style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 14px", color: "var(--brand)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer", opacity: !addCourseId ? 0.4 : 1 }}
          >
            Añadir
          </button>
        </div>
        {courseIds.length === 0 ? (
          <div className="text-xs text-gray-400">Añade al menos una formación.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {courseIds.map((cid, i) => {
              const c = courses.find((cc) => cc.id === cid);
              if (!c) return null;
              return (
                <div key={cid} style={{ ...DS.card, display: "flex", alignItems: "center", gap: 8, padding: "var(--sp-2) var(--sp-3)" }}>
                  <span style={{ width: 20, height: 20, borderRadius: "var(--radius-full)", backgroundColor: "var(--brand)", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{c.title}</div>
                  <button disabled={i === 0} onClick={() => moveCourse(i, -1)} className="text-gray-400 disabled:opacity-30"><ChevronUp size={15} /></button>
                  <button disabled={i === courseIds.length - 1} onClick={() => moveCourse(i, 1)} className="text-gray-400 disabled:opacity-30"><ChevronDown size={15} /></button>
                  <button onClick={() => setCourseIds((prev) => prev.filter((id) => id !== cid))} className="text-red-500"><X size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--sp-2)" }}>Asignar ruta a</div>
        <div className="flex gap-2 flex-wrap mb-2">
          {[
            { id: "todos", label: "Todos los empleados" },
            { id: "grupos", label: "Grupos concretos" },
            { id: "individual", label: "Personas concretas" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setAssignment((a) => ({ ...a, mode: m.id }))}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border"
              style={{
                backgroundColor: assignment.mode === m.id ? "var(--brand)" : "white",
                color: assignment.mode === m.id ? "white" : "var(--text-primary)",
                borderColor: assignment.mode === m.id ? "var(--brand)" : "#00000018",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {assignment.mode === "grupos" && (
          <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: "#00000018" }}>
            {groups.length === 0 ? (
              <div className="text-xs text-gray-400">No hay grupos creados todavía.</div>
            ) : (
              groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={(assignment.groupIds || []).includes(g.id)}
                    onChange={() => {
                      const has = (assignment.groupIds || []).includes(g.id);
                      setAssignment((a) => ({ ...a, groupIds: has ? a.groupIds.filter((id) => id !== g.id) : [...(a.groupIds || []), g.id] }));
                    }}
                  />
                  {g.name} <span className="text-[11px] text-gray-400">({(g.memberNames || []).length} personas)</span>
                </label>
              ))
            )}
          </div>
        )}
        {assignment.mode === "individual" && (
          <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: "#00000018" }}>
            {employees.length > 8 && (
              <input value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} placeholder="Buscar por nombre..." className="w-full text-xs rounded-md border px-2 py-1.5 mb-1.5" style={{ borderColor: "#00000020" }} />
            )}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {employees
                .filter((e) => e.name.toLowerCase().includes(assignSearch.trim().toLowerCase()))
                .map((e) => (
                  <label key={e.name} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(assignment.employeeNames || []).includes(e.name)}
                      onChange={() => {
                        const has = (assignment.employeeNames || []).includes(e.name);
                        setAssignment((a) => ({ ...a, employeeNames: has ? a.employeeNames.filter((n) => n !== e.name) : [...(a.employeeNames || []), e.name] }));
                      }}
                    />
                    {e.name}
                  </label>
                ))}
            </div>
          </div>
        )}
      </div>

      {mode !== "team" && (
        <div style={{ ...DS.card, padding: "var(--sp-3)", display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={isWelcomePath} onChange={(e) => setIsWelcomePath(e.target.checked)} id="welcome-path-check" />
          <label htmlFor="welcome-path-check" style={{ fontSize: "var(--text-sm)", cursor: "pointer" }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Ruta de bienvenida</span>
            <span style={{ color: "var(--text-muted)" }}> — se asigna sola a cada persona nueva que se dé de alta, además de a quien ya hayas asignado arriba.</span>
          </label>
        </div>
      )}

      <button
        disabled={!title.trim() || courseIds.length === 0}
        onClick={async () => {
          await onSavePath({ id: editingId || uid(), title: title.trim(), description, courseIds, assignment, isWelcomePath });
          setEditingId(undefined);
        }}
        style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 16px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: (!title.trim() || courseIds.length === 0) ? 0.4 : 1, width: "fit-content" }}
      >
        Guardar ruta
      </button>
    </div>
  );
}

// Vista previa de una formación tal como la vería un empleado — usa el propio
// CourseDetail de siempre (con toda su lógica de módulos/test incluida), pero
// con un estado local aislado: nada de lo que se haga aquí (responder al
// test, valorar, marcar como visto) toca la base de datos real.
function CoursePreviewOverlay({ draft, courses, onClose }) {
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [record, setRecord] = useState({ status: "pendiente", moduleProgress: {} });
  // En la vista previa no hay forma real de "completar" otra formación para
  // probar un requisito — así que, en vez de eso, se puede marcar como
  // "simulada completada" con un clic, solo para probar que el desbloqueo
  // funciona. No toca ningún dato real de nadie.
  const [simulatedCompletedCourseIds, setSimulatedCompletedCourseIds] = useState(() => new Set());
  const PREVIEW_USER = "Vista previa";
  const previewCompletionsByCourse = useMemo(() => {
    const map = {};
    for (const id of simulatedCompletedCourseIds) map[id] = { [PREVIEW_USER]: { status: "completada" } };
    return map;
  }, [simulatedCompletedCourseIds]);

  function resetQuiz() {
    setQuizAnswers({});
    setQuizResult(null);
  }

  function submitQuiz() {
    const quiz = draft.quiz || [];
    let correctCount = 0;
    quiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) correctCount++;
    });
    const score = quiz.length ? Math.round((correctCount / quiz.length) * 100) : 100;
    const passed = score >= (draft.passPct ?? 70);
    setRecord((prev) => {
      const next = { ...prev, status: "en_progreso", score, quizPassed: passed };
      next.awaitingRating = computeAwaitingRating(draft, next);
      return next;
    });
    setQuizResult({ score, passed, correctCount, total: quiz.length });
  }

  // Igual que recomputeModuleState (la versión real), pero todo en memoria —
  // así la vista previa simula de verdad las mismas 4 exigencias de un
  // módulo (test, formación requisito, checklist, caso práctico), no solo el
  // test como antes.
  function recomputeModuleStatePreview(moduleId, progressPatch) {
    const moduleObj = (draft.modules || []).find((m) => m.id === moduleId);
    if (!moduleObj) return null;
    let finalModuleRec = null;
    setRecord((prev) => {
      const prevModuleRec = prev.moduleProgress?.[moduleId] || {};
      const mergedModuleRec = { ...prevModuleRec, ...progressPatch };
      const quizPassed = "quizPassed" in mergedModuleRec ? mergedModuleRec.quizPassed : !!prevModuleRec.quizPassed;
      const passed = isModulePassed(moduleObj, quizPassed, PREVIEW_USER, previewCompletionsByCourse, mergedModuleRec);
      const moduleProgress = { ...(prev.moduleProgress || {}), [moduleId]: { ...mergedModuleRec, quizPassed, passed } };
      const allPassed = (draft.modules || []).every((m) => moduleProgress[m.id]?.passed);
      const next = { ...prev, status: "en_progreso", moduleProgress, quizPassed: allPassed };
      next.awaitingRating = computeAwaitingRating(draft, next);
      finalModuleRec = moduleProgress[moduleId];
      return next;
    });
    return finalModuleRec;
  }

  function submitModuleQuiz(moduleObj) {
    const quiz = moduleObj.quiz || [];
    let correctCount = 0;
    quiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) correctCount++;
    });
    const score = quiz.length ? Math.round((correctCount / quiz.length) * 100) : 100;
    const quizPassed = score >= (moduleObj.passPct ?? 70);
    recomputeModuleStatePreview(moduleObj.id, { quizPassed, score });
    // isModulePassed se evalúa dentro de recomputeModuleStatePreview con el
    // estado más reciente — para el aviso inmediato en pantalla, calculamos
    // aquí una copia igual de fiable con lo que ya tenemos a mano.
    const prevModuleRec = record.moduleProgress?.[moduleObj.id] || {};
    const passed = isModulePassed(moduleObj, quizPassed, PREVIEW_USER, previewCompletionsByCourse, prevModuleRec);
    const result = { score, passed, quizPassed, correctCount, total: quiz.length };
    setQuizResult(result);
    return result;
  }

  function toggleSimulatedRelatedCourse(courseId) {
    setSimulatedCompletedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  function toggleChecklistStepPreview(moduleId, stepId) {
    const prevChecked = record.moduleProgress?.[moduleId]?.checklistChecked || {};
    recomputeModuleStatePreview(moduleId, { checklistChecked: { ...prevChecked, [stepId]: !prevChecked[stepId] } });
  }

  function submitModulePracticalCasePreview(moduleId, text) {
    recomputeModuleStatePreview(moduleId, { practicalCaseAnswer: { text, submittedAt: todayISO() } });
  }

  function selfReport() {
    setRecord((prev) => {
      const next = { ...prev, status: "en_progreso", selfReported: true, quizPassed: true };
      next.awaitingRating = computeAwaitingRating(draft, next);
      return next;
    });
  }

  function submitPracticalCasePreview(text) {
    setRecord((prev) => {
      const next = { ...prev, practicalCaseAnswer: { text, submittedAt: todayISO(), status: "enviado" } };
      next.awaitingRating = computeAwaitingRating(draft, next);
      return next;
    });
  }

  function rate(rating, comment) {
    setRecord((prev) => ({ ...prev, rating, ratingComment: comment, status: "completada", awaitingRating: false, completedAt: todayISO() }));
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, backgroundColor: "var(--bg-page)", overflowY: "auto" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "var(--brand)", color: "white", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <Eye size={16} /> Vista previa — así lo vería un empleado. Nada de lo que hagas aquí se guarda de verdad.
        </span>
        <button
          onClick={onClose}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid white", borderRadius: "var(--radius-md)", color: "white", padding: "5px 12px", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600 }}
        >
          <X size={14} /> Cerrar vista previa
        </button>
      </div>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "var(--sp-6) var(--sp-4)" }}>
        <CourseDetail
          course={draft}
          currentUser={PREVIEW_USER}
          status={record.status}
          record={record}
          quizAnswers={quizAnswers}
          setQuizAnswers={setQuizAnswers}
          quizResult={quizResult}
          onSubmitQuiz={submitQuiz}
          onSubmitModuleQuiz={submitModuleQuiz}
          onResetQuiz={resetQuiz}
          onSelfReport={selfReport}
          onRateCourse={rate}
          onSubmitPracticalCase={submitPracticalCasePreview}
          courses={courses}
          completionsByCourse={previewCompletionsByCourse}
          onOpenRelatedCourse={toggleSimulatedRelatedCourse}
          onToggleModuleChecklistStep={toggleChecklistStepPreview}
          onSubmitModulePracticalCase={submitModulePracticalCasePreview}
          onBack={onClose}
          onRetry={resetQuiz}
        />
        {simulatedCompletedCourseIds.size > 0 && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: "var(--sp-3)", fontStyle: "italic" }}>
            Estás simulando que {simulatedCompletedCourseIds.size} formación{simulatedCompletedCourseIds.size === 1 ? "" : "es"} relacionada{simulatedCompletedCourseIds.size === 1 ? "" : "s"} ya está{simulatedCompletedCourseIds.size === 1 ? "" : "n"} completada{simulatedCompletedCourseIds.size === 1 ? "" : "s"} — solo para probar el desbloqueo aquí, no es un dato real.
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPanel({
  deepLinkPuestoTarget,
  onConsumeDeepLinkPuestoTarget,
  courses,
  news,
  employees,
  groups,
  completionsByCourse,
  loadingTracking,
  lastBackupAt,
  sheetsUrl,
  onSaveSheetsUrl,
  onLoadTracking,
  onSaveCourse,
  onDeleteCourse,
  onSetCourseArchived,
  onDeleteAttachment,
  onUpdateEmployeeProfile,
  onToggleEmployeeGroup,
  onAddNews,
  onUpdateNews,
  onDeleteNews,
  onAddEmployee,
  onRemoveEmployee,
  onResetEmployeePassword,
  onUpdateEmployeeEmail,
  onRenameEmployee,
  onImportEmployeesBulk,
  onAddGroup,
  onDeleteGroup,
  onUpdateGroupMembers,
  onManualSetStatus,
  onMarkFormReviewed,
  onExportBackup,
  onImportBackup,
  onUpdateEmployeeManagedGroups,
  paths,
  onSavePath,
  onDeletePath,
  puestos,
  onSavePuesto,
  onDeletePuesto,
  onAssignPuesto,
  checklistResponses,
  onValidateChecklistItem,
  onCorrectPracticalCase,
  onCorrectModulePracticalCase,
  mode = "full",
  restrictToGroupIds = [],
}) {
  const [tab, setTab] = useState("courses");

  // El seguimiento se actualiza solo al entrar aquí — nadie debería tener que
  // acordarse de pulsar ningún botón para que los datos estén al día, tanto
  // en el panel de administración completo como en "Mi equipo".
  useEffect(() => {
    onLoadTracking();
  }, []);

  // Si se entró aquí por un enlace directo a un Puesto concreto, saltar a
  // esa pestaña directamente — sin esto, tocaría navegar a mano hasta
  // Personas → Puestos cada vez.
  useEffect(() => {
    if (deepLinkPuestoTarget && mode !== "team") {
      setTab("puestos");
      onConsumeDeepLinkPuestoTarget && onConsumeDeepLinkPuestoTarget();
    }
  }, [deepLinkPuestoTarget]);

  const emptyQuestion = { question: "", options: ["", "", "", ""], correct: 0 };
  const emptyAssignment = { mode: "todos", groupIds: [], employeeNames: [] };
  const [draft, setDraft] = useState({
    id: null,
    title: "",
    category: "protocolos",
    departmentGroupId: null,
    description: "",
    videoUrl: "",
    videoFile: null,
    presentationUrl: "",
    deadline: "",
    passPct: 70,
    testMode: "interno",
    googleFormUrl: "",
    quiz: [{ ...emptyQuestion }],
    attachments: [],
    assignment: { ...emptyAssignment },
  });
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);

  // Autoguardado en el propio navegador: si se va la conexión, se cierra la
  // pestaña sin querer, o el navegador se cierra solo, no se pierde el
  // trabajo a medias — solo protege lo que aún no se había guardado de
  // verdad en la base de datos, nunca sustituye al guardado real.
  const AUTOSAVE_KEY = "mb_draft_autosave_v1";
  const [recoveredDraft, setRecoveredDraft] = useState(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id === null && parsed.title && parsed.title.trim()) {
          setRecoveredDraft(parsed);
        }
      }
    } catch (e) {
      // Sin localStorage disponible, o dato corrupto — simplemente no se ofrece recuperar nada.
    }
  }, []);
  useEffect(() => {
    if (tab !== "editor" || !draft.title?.trim()) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
      } catch (e) {
        // Si falla (por ejemplo, almacenamiento lleno), no pasa nada grave —
        // el guardado real en la base de datos sigue funcionando igual.
      }
    }, 800);
    return () => clearTimeout(t);
  }, [draft, tab]);
  function clearAutosave() {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch (e) {}
  }

  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [editingEmailFor, setEditingEmailFor] = useState(null);
  const [editingNameFor, setEditingNameFor] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [renameError, setRenameError] = useState("");
  const [editingEmailValue, setEditingEmailValue] = useState("");
  const [editingManagedGroupsFor, setEditingManagedGroupsFor] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedForBulk, setSelectedForBulk] = useState(() => new Set());
  const [viewingProfileFor, setViewingProfileFor] = useState(null);
  const [bulkPuestoId, setBulkPuestoId] = useState("");
  const [importPreviewRows, setImportPreviewRows] = useState(null);
  const [importFileError, setImportFileError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(null);
  const [groupMemberSearch, setGroupMemberSearch] = useState({});
  const [assignSearch, setAssignSearch] = useState("");
  const [newNewsTitle, setNewNewsTitle] = useState("");
  const [newNewsBody, setNewNewsBody] = useState("");
  const [newNewsLinkType, setNewNewsLinkType] = useState("none");
  const [newNewsLinkId, setNewNewsLinkId] = useState("");
  const [editingNewsId, setEditingNewsId] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importPending, setImportPending] = useState(null);
  const [importError, setImportError] = useState("");
  const [sheetsUrlDraft, setSheetsUrlDraft] = useState(sheetsUrl || "");
  const [syncStatus, setSyncStatus] = useState("");
  const [manualCourseId, setManualCourseId] = useState("");
  const [manualEmployeeName, setManualEmployeeName] = useState("");

  function resetDraft() {
    setDraft({
      id: null,
      title: "",
      category: "protocolos",
      departmentGroupId: null,
      description: "",
      videoUrl: "",
      videoFile: null,
      presentationUrl: "",
      deadline: "",
      passPct: 70,
      testMode: "interno",
      googleFormUrl: "",
      quiz: [{ ...emptyQuestion }],
      attachments: [],
      assignment: { ...emptyAssignment },
      modules: [],
      validityMonths: null,
      practicalCase: null,
    });
    setFileError("");
    setPendingWarnings(null);
  }
  function loadDraft(course) {
    setDraft({
      ...course,
      testMode: course.testMode || "interno",
      googleFormUrl: course.googleFormUrl || "",
      quiz: (course.quiz && course.quiz.length ? course.quiz : [{ ...emptyQuestion }]).map((q) => ({ ...q, options: [...q.options] })),
      attachments: course.attachments ? [...course.attachments] : [],
      assignment: course.assignment ? { ...course.assignment } : { ...emptyAssignment },
      modules: course.modules
        ? course.modules.map((m) => ({
            ...m,
            quiz: (m.quiz || []).map((q) => ({ ...q, options: [...q.options] })),
            attachments: m.attachments ? [...m.attachments] : [],
            relatedCourses: m.relatedCourses ? [...m.relatedCourses] : [],
            externalLinks: m.externalLinks ? [...m.externalLinks] : [],
            practicalCase: m.practicalCase ? { ...m.practicalCase } : null,
            checklistSteps: m.checklistSteps ? [...m.checklistSteps] : [],
          }))
        : [],
    });
    setFileError("");
    setPendingWarnings(null);
    setTab("editor");
  }
  // Duplicar: carga una copia dentro del editor con un id nuevo, sin guardar
  // nada todavía — así el admin puede ajustar el título (u otra cosa) antes
  // de confirmarla como una formación de verdad, en vez de crear un
  // duplicado real de inmediato.
  //
  // Importante: los documentos adjuntos NO se copian. Si se copiaran tal
  // cual, las dos formaciones compartirían el mismo archivo guardado por
  // detrás — y borrar cualquiera de las dos borraría ese archivo para la
  // otra también. Más seguro pedir que se vuelvan a subir en la copia.
  function duplicateCourse(course) {
    loadDraft({
      ...course,
      id: uid(),
      title: `${course.title} (copia)`,
      publishedAt: null,
      attachments: [],
      videoFile: null,
      modules: (course.modules || []).map((m) => ({ ...m, attachments: [], videoFile: null })),
    });
    const attachmentCount = (course.attachments?.length || 0) + (course.modules || []).reduce((s, m) => s + (m.attachments?.length || 0), 0);
    const videoCount = (course.videoFile ? 1 : 0) + (course.modules || []).reduce((s, m) => s + (m.videoFile ? 1 : 0), 0);
    setDuplicateAttachmentsNotice(attachmentCount);
    setDuplicateVideosNotice(videoCount);
  }
  function setAssignmentMode(mode) {
    setDraft((d) => ({ ...d, assignment: { ...d.assignment, mode } }));
  }
  function toggleAssignGroup(groupId) {
    setDraft((d) => {
      const current = d.assignment.groupIds || [];
      const next = current.includes(groupId) ? current.filter((g) => g !== groupId) : [...current, groupId];
      return { ...d, assignment: { ...d.assignment, groupIds: next } };
    });
  }
  function toggleAssignEmployee(name) {
    setDraft((d) => {
      const current = d.assignment.employeeNames || [];
      const next = current.includes(name) ? current.filter((n) => n !== name) : [...current, name];
      return { ...d, assignment: { ...d.assignment, employeeNames: next } };
    });
  }
  function handleFileInput(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setFileError(`"${file.name}" pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El límite para adjuntar aquí dentro es de ~3,5 MB. Para archivos más grandes o vídeo, usa un enlace (SharePoint/YouTube/Vimeo/Drive) en los campos de arriba.`);
      e.target.value = "";
      return;
    }
    setFileError("");
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((d) => ({
        ...d,
        attachments: [...(d.attachments || []), { id: uid(), name: file.name, mimeType: file.type || "application/octet-stream", sizeKB: Math.round(file.size / 1024), data: reader.result }],
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  function removeDraftAttachment(id) {
    const att = (draft.attachments || []).find((a) => a.id === id);
    if (att?.storageKey) deleteKey(att.storageKey);
    setDraft((d) => ({ ...d, attachments: (d.attachments || []).filter((a) => a.id !== id) }));
  }
  function updateQuizQuestion(qi, field, value) {
    setDraft((d) => ({ ...d, quiz: d.quiz.map((q, i) => (i === qi ? { ...q, [field]: value } : q)) }));
  }
  function updateQuizOption(qi, oi, value) {
    setDraft((d) => ({
      ...d,
      quiz: d.quiz.map((q, i) => (i !== qi ? q : { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) })),
    }));
  }
  function addQuestion() {
    setDraft((d) => ({ ...d, quiz: [...d.quiz, { ...emptyQuestion }] }));
  }
  const [quizImportError, setQuizImportError] = useState("");
  async function handleQuizImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const { questions, error } = await parseQuizExcelFile(file);
    if (error) {
      setQuizImportError(error);
    } else {
      setQuizImportError("");
      setDraft((d) => ({ ...d, quiz: [...(d.quiz.length === 1 && !d.quiz[0].question.trim() ? [] : d.quiz), ...questions] }));
    }
    e.target.value = "";
  }
  const [moduleQuizImportError, setModuleQuizImportError] = useState("");
  async function handleModuleQuizImport(mi, e) {
    const file = e.target.files[0];
    if (!file) return;
    const { questions, error } = await parseQuizExcelFile(file);
    if (error) {
      setModuleQuizImportError(error);
    } else {
      setModuleQuizImportError("");
      setDraft((d) => ({
        ...d,
        modules: d.modules.map((m, i) => (i === mi ? { ...m, quiz: [...(m.quiz.length === 1 && !m.quiz[0].question.trim() ? [] : m.quiz), ...questions] } : m)),
      }));
    }
    e.target.value = "";
  }
  function removeQuestion(qi) {
    setDraft((d) => ({ ...d, quiz: d.quiz.filter((_, i) => i !== qi) }));
  }
  // Arrastrar y soltar para reordenar preguntas — antes no había ninguna
  // forma de reordenarlas salvo borrar y volver a crearlas en otro orden.
  const [draggedQuestionIndex, setDraggedQuestionIndex] = useState(null);
  function reorderQuestions(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    setDraft((d) => {
      const quiz = [...d.quiz];
      const [moved] = quiz.splice(fromIndex, 1);
      quiz.splice(toIndex, 0, moved);
      return { ...d, quiz };
    });
  }
  const [draggedModuleQuestionIndex, setDraggedModuleQuestionIndex] = useState(null);
  function reorderModuleQuestions(mi, fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    setDraft((d) => ({
      ...d,
      modules: d.modules.map((m, i) => {
        if (i !== mi) return m;
        const quiz = [...m.quiz];
        const [moved] = quiz.splice(fromIndex, 1);
        quiz.splice(toIndex, 0, moved);
        return { ...m, quiz };
      }),
    }));
  }

  // ---- Gestión de módulos (formaciones secuenciales) ----
  const NEW_MODULE_TEMPLATE = () => ({
    id: uid(), title: "", body: "", videoUrl: "", videoFile: null, passPct: 70, quiz: [{ ...emptyQuestion }], attachments: [],
    relatedCourses: [], externalLinks: [], practicalCase: null, checklistSteps: [],
  });
  // Plantillas de partida: cambian solo la estructura (no rellenan texto de
  // mentira que alguien pudiera olvidarse de borrar). "Protocolo simple"
  // pone caducidad de 12 meses por defecto, algo muy típico en protocolos.
  // "Formación con módulos" activa el modo por módulos con 3 ya creados,
  // ahorrando los clics de activarlo y añadirlos uno a uno.
  function applyTemplate(templateId) {
    if (templateId === "protocolo") {
      setDraft((d) => ({ ...d, category: "protocolos", validityMonths: 12 }));
    } else if (templateId === "modular") {
      setDraft((d) => ({
        ...d,
        modules: [
          { ...NEW_MODULE_TEMPLATE(), title: "Módulo 1" },
          { ...NEW_MODULE_TEMPLATE(), title: "Módulo 2" },
          { ...NEW_MODULE_TEMPLATE(), title: "Módulo 3" },
        ],
      }));
    }
    setShowTemplatePicker(false);
  }
  function toggleModularMode() {
    setDraft((d) => {
      const turningOn = !(d.modules && d.modules.length > 0);
      return { ...d, modules: turningOn ? [{ ...NEW_MODULE_TEMPLATE(), title: "Módulo 1" }] : [] };
    });
  }
  function addModule() {
    setDraft((d) => ({ ...d, modules: [...(d.modules || []), { ...NEW_MODULE_TEMPLATE(), title: `Módulo ${(d.modules || []).length + 1}` }] }));
  }
  function removeModule(mi) {
    setDraft((d) => ({ ...d, modules: d.modules.filter((_, i) => i !== mi) }));
  }
  function moveModule(mi, direction) {
    setDraft((d) => {
      const modules = [...d.modules];
      const target = mi + direction;
      if (target < 0 || target >= modules.length) return d;
      [modules[mi], modules[target]] = [modules[target], modules[mi]];
      return { ...d, modules };
    });
  }
  // Arrastrar y soltar para reordenar módulos — además de las flechas de
  // subir/bajar que ya había, no en su lugar, para que quien prefiera
  // clicar en vez de arrastrar lo siga teniendo igual de fácil.
  const [draggedModuleIndex, setDraggedModuleIndex] = useState(null);
  function reorderModules(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    setDraft((d) => {
      const modules = [...d.modules];
      const [moved] = modules.splice(fromIndex, 1);
      modules.splice(toIndex, 0, moved);
      return { ...d, modules };
    });
  }
  function updateModuleField(mi, field, value) {
    setDraft((d) => ({ ...d, modules: d.modules.map((m, i) => (i === mi ? { ...m, [field]: value } : m)) }));
  }
  // Formaciones relacionadas: se guarda solo el id y si es "requisito" (hace
  // falta completarla para pasar el módulo) o "recomendada" (solo se sugiere).
  function toggleModuleRelatedCourse(mi, courseId) {
    setDraft((d) => ({
      ...d,
      modules: d.modules.map((m, i) => {
        if (i !== mi) return m;
        const existing = (m.relatedCourses || []).find((rc) => rc.courseId === courseId);
        const relatedCourses = existing
          ? m.relatedCourses.filter((rc) => rc.courseId !== courseId)
          : [...(m.relatedCourses || []), { courseId, mode: "recomendada" }];
        return { ...m, relatedCourses };
      }),
    }));
  }
  function setModuleRelatedCourseMode(mi, courseId, mode) {
    setDraft((d) => ({
      ...d,
      modules: d.modules.map((m, i) =>
        i !== mi ? m : { ...m, relatedCourses: m.relatedCourses.map((rc) => (rc.courseId === courseId ? { ...rc, mode } : rc)) }
      ),
    }));
  }
  // Enlaces externos: título + URL, para protocolos o recursos que no tiene
  // sentido subir como documento.
  function addModuleLink(mi) {
    setDraft((d) => ({ ...d, modules: d.modules.map((m, i) => (i === mi ? { ...m, externalLinks: [...(m.externalLinks || []), { id: uid(), label: "", url: "" }] } : m)) }));
  }
  function updateModuleLink(mi, linkId, field, value) {
    setDraft((d) => ({
      ...d,
      modules: d.modules.map((m, i) =>
        i !== mi ? m : { ...m, externalLinks: m.externalLinks.map((l) => (l.id === linkId ? { ...l, [field]: value } : l)) }
      ),
    }));
  }
  function removeModuleLink(mi, linkId) {
    setDraft((d) => ({ ...d, modules: d.modules.map((m, i) => (i === mi ? { ...m, externalLinks: m.externalLinks.filter((l) => l.id !== linkId) } : m)) }));
  }
  // Checklist rápido de pasos: una lista corta a marcar, distinta del
  // checklist de conocimientos por puesto — este es más ligero, sin niveles
  // ni categorías, solo "hecho / no hecho".
  function addModuleChecklistStep(mi, text) {
    if (!text.trim()) return;
    setDraft((d) => ({ ...d, modules: d.modules.map((m, i) => (i === mi ? { ...m, checklistSteps: [...(m.checklistSteps || []), { id: uid(), text: text.trim() }] } : m)) }));
  }
  function removeModuleChecklistStep(mi, stepId) {
    setDraft((d) => ({ ...d, modules: d.modules.map((m, i) => (i === mi ? { ...m, checklistSteps: m.checklistSteps.filter((s) => s.id !== stepId) } : m)) }));
  }
  function handleModuleFileInput(mi, e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setFileError(`"${file.name}" pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El límite para adjuntar aquí dentro es de ~3,5 MB. Para archivos más grandes o vídeo, usa un enlace en el campo de vídeo del módulo.`);
      e.target.value = "";
      return;
    }
    setFileError("");
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((d) => ({
        ...d,
        modules: d.modules.map((m, i) =>
          i === mi
            ? { ...m, attachments: [...(m.attachments || []), { id: uid(), name: file.name, mimeType: file.type || "application/octet-stream", sizeKB: Math.round(file.size / 1024), data: reader.result }] }
            : m
        ),
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  function removeModuleAttachment(mi, attId) {
    setDraft((d) => {
      const mod = d.modules[mi];
      const att = (mod.attachments || []).find((a) => a.id === attId);
      if (att?.storageKey) deleteKey(att.storageKey);
      return { ...d, modules: d.modules.map((m, i) => (i === mi ? { ...m, attachments: (m.attachments || []).filter((a) => a.id !== attId) } : m)) };
    });
  }
  function addModuleQuestion(mi) {
    setDraft((d) => ({ ...d, modules: d.modules.map((m, i) => (i === mi ? { ...m, quiz: [...m.quiz, { ...emptyQuestion }] } : m)) }));
  }
  function removeModuleQuestion(mi, qi) {
    setDraft((d) => ({ ...d, modules: d.modules.map((m, i) => (i === mi ? { ...m, quiz: m.quiz.filter((_, j) => j !== qi) } : m)) }));
  }
  function updateModuleQuestion(mi, qi, field, value) {
    setDraft((d) => ({
      ...d,
      modules: d.modules.map((m, i) => (i !== mi ? m : { ...m, quiz: m.quiz.map((q, j) => (j === qi ? { ...q, [field]: value } : q)) })),
    }));
  }
  function updateModuleOption(mi, qi, oi, value) {
    setDraft((d) => ({
      ...d,
      modules: d.modules.map((m, i) =>
        i !== mi ? m : { ...m, quiz: m.quiz.map((q, j) => (j !== qi ? q : { ...q, options: q.options.map((o, k) => (k === oi ? value : o)) })) }
      ),
    }));
  }
  function canSave() {
    return draft.title.trim().length > 0;
  }
  // Avisa (sin bloquear) de problemas de contenido que antes pasaban
  // desapercibidos hasta que un empleado abría la formación y se encontraba
  // un test roto: preguntas sin texto, sin suficientes opciones, con la
  // respuesta correcta señalando a una opción vacía, o un Google Form sin
  // enlace.
  function getContentWarnings() {
    const warnings = [];
    if (draft.practicalCase && (!draft.practicalCase.title.trim() || !draft.practicalCase.description.trim())) {
      warnings.push("El caso práctico está activado pero le falta el título o la descripción del escenario.");
    }
    function checkQuiz(quiz, context) {
      quiz.forEach((q, qi) => {
        if (!q.question.trim()) warnings.push(`${context}: la pregunta ${qi + 1} no tiene texto.`);
        const filled = q.options.filter((o) => o.trim().length > 0);
        if (filled.length < 2) warnings.push(`${context}: la pregunta ${qi + 1} tiene menos de 2 opciones rellenadas.`);
        else if (!q.options[q.correct] || !q.options[q.correct].trim()) warnings.push(`${context}: la pregunta ${qi + 1} marca como correcta una opción vacía.`);
      });
    }
    const hasModules = draft.modules && draft.modules.length > 0;
    if (!hasModules) {
      if (draft.testMode === "interno") {
        checkQuiz(draft.quiz || [], "Test principal");
      } else if (draft.testMode === "googleform" && !(draft.googleFormUrl || "").trim()) {
        warnings.push("Has elegido \"Google Form\" pero no has puesto ningún enlace de formulario.");
      }
    } else {
      (draft.modules || []).forEach((mod, mi) => {
        const label = `Módulo ${mi + 1}${mod.title ? ` ("${mod.title}")` : ""}`;
        if (!mod.title || !mod.title.trim()) warnings.push(`Módulo ${mi + 1}: no tiene título.`);
        if ((mod.quiz || []).length > 0) checkQuiz(mod.quiz, label);
        if (mod.practicalCase && (!mod.practicalCase.title?.trim() || !mod.practicalCase.description?.trim())) {
          warnings.push(`${label}: el caso práctico está activado pero le falta el título o la descripción.`);
        }
        (mod.externalLinks || []).forEach((link, li) => {
          if (!link.label?.trim() || !link.url?.trim()) warnings.push(`${label}: el enlace ${li + 1} tiene el título o la URL sin rellenar.`);
        });
      });
    }
    return warnings;
  }
  const [pendingWarnings, setPendingWarnings] = useState(null);
  const [duplicateAttachmentsNotice, setDuplicateAttachmentsNotice] = useState(0);
  const [duplicateVideosNotice, setDuplicateVideosNotice] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [courseListSearch, setCourseListSearch] = useState("");
  const [courseListCategoryFilter, setCourseListCategoryFilter] = useState("");
  const [courseListDepartmentFilter, setCourseListDepartmentFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  function handleSaveClick() {
    const warnings = getContentWarnings();
    if (warnings.length > 0) setPendingWarnings(warnings);
    else handleSave();
  }
  async function handleSave() {
    setSaving(true);
    const finalAttachments = [];
    for (const att of draft.attachments || []) {
      if (att.storageKey) {
        finalAttachments.push({ id: att.id, name: att.name, mimeType: att.mimeType, sizeKB: att.sizeKB, storageKey: att.storageKey });
        continue;
      }
      const storageKey = `mb_att_${att.id}`;
      await saveKey(storageKey, { name: att.name, mimeType: att.mimeType, data: att.data });
      finalAttachments.push({ id: att.id, name: att.name, mimeType: att.mimeType, sizeKB: att.sizeKB, storageKey });
    }
    // Los adjuntos de cada módulo se suben igual que los de la formación —
    // cada módulo puede llevar los suyos propios, aparte.
    const finalModules = [];
    for (const mod of draft.modules || []) {
      const modAttachments = [];
      for (const att of mod.attachments || []) {
        if (att.storageKey) {
          modAttachments.push({ id: att.id, name: att.name, mimeType: att.mimeType, sizeKB: att.sizeKB, storageKey: att.storageKey });
          continue;
        }
        const storageKey = `mb_att_${att.id}`;
        await saveKey(storageKey, { name: att.name, mimeType: att.mimeType, data: att.data });
        modAttachments.push({ id: att.id, name: att.name, mimeType: att.mimeType, sizeKB: att.sizeKB, storageKey });
      }
      finalModules.push({ ...mod, attachments: modAttachments });
    }
    await onSaveCourse({ ...draft, id: draft.id || uid(), attachments: finalAttachments, modules: finalModules });
    setSaving(false);
    clearAutosave();
    setRecoveredDraft(null);
    resetDraft();
    setTab("courses");
  }

  const completionRows = useMemo(() => {
    const rows = [];
    for (const c of courses) {
      const data = completionsByCourse[c.id] || {};
      for (const [employee, rec] of Object.entries(data)) {
        rows.push({ employee, courseTitle: c.title, ...rec });
      }
    }
    return rows;
  }, [completionsByCourse, courses]);

  // Valoración media por formación (solo con quien haya puntuado, 1-5 estrellas).
  const avgRatingByCourse = useMemo(() => {
    const result = {};
    for (const c of courses) {
      const data = completionsByCourse[c.id] || {};
      const ratings = Object.values(data).map((r) => r.rating).filter((r) => typeof r === "number" && r > 0);
      if (ratings.length > 0) {
        result[c.id] = { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length };
      }
    }
    return result;
  }, [completionsByCourse, courses]);

  // Cumplimiento por ruta de aprendizaje: de toda la gente a la que le toca una
  // ruta, cuántos la han terminado ENTERA (todas sus formaciones completadas).
  // No usa getStatus (que vive en el componente principal) — comprueba el
  // estado guardado directamente, que es suficiente para este resumen.
  const pathCompletionSummary = useMemo(() => {
    return paths.map((p) => {
      const assignedEmployees = employees.filter((e) => isAssignedToUser(p, e.name, groups));
      let doneCount = 0;
      for (const emp of assignedEmployees) {
        const allDone = p.courseIds.every((cid) => completionsByCourse[cid]?.[emp.name]?.status === "completada");
        if (allDone) doneCount++;
      }
      return { id: p.id, title: p.title, assignedCount: assignedEmployees.length, doneCount };
    });
  }, [paths, employees, groups, completionsByCourse]);

  const pendingReportRows = useMemo(() => {
    const rows = [];
    for (const emp of employees) {
      for (const c of courses) {
        if (!isAssignedToUser(c, emp.name, groups)) continue;
        const rec = (completionsByCourse[c.id] || {})[emp.name];
        const status = rec ? rec.status : "pendiente";
        if (status === "completada") continue;
        const d = c.deadline ? daysUntil(c.deadline) : null;
        rows.push({
          nombre: emp.name,
          email: emp.email || "",
          formacion: c.title,
          categoria: categoryMeta(c.category).label,
          fechaLimite: c.deadline || "",
          diasRestantes: d,
          estado: d !== null && d < 0 ? "Vencida" : "Pendiente",
        });
      }
    }
    return rows;
  }, [employees, courses, groups, completionsByCourse]);

  // Modo "equipo" (responsables): solo la gente de los grupos que gestionan.
  const teamMemberNames = useMemo(() => {
    if (mode !== "team") return null;
    const names = new Set();
    for (const g of groups) {
      if (restrictToGroupIds.includes(g.id)) {
        for (const n of g.memberNames || []) names.add(n);
      }
    }
    return names;
  }, [mode, groups, restrictToGroupIds]);

  const teamEmployees = useMemo(() => {
    if (!teamMemberNames) return [];
    return employees.filter((e) => teamMemberNames.has(e.name));
  }, [employees, teamMemberNames]);

  const teamCompletionRows = useMemo(() => {
    if (!teamMemberNames) return [];
    return completionRows.filter((r) => teamMemberNames.has(r.employee));
  }, [completionRows, teamMemberNames]);

  const [teamNewMemberName, setTeamNewMemberName] = useState("");

  const TAB_GROUPS = [
    { id: "content", label: "Contenido", icon: LayoutGrid, tabs: ["courses", "editor", "paths", "news", "documentos"] },
    { id: "people", label: "Personas", icon: Users, tabs: ["employees", "groups", "puestos"] },
    { id: "tracking", label: "Seguimiento", icon: ClipboardList, tabs: ["seguimiento", "reviews"] },
    { id: "system", label: "Sistema", icon: Settings, tabs: ["notificaciones", "backup"] },
  ];
  const TAB_LABELS = {
    courses: "Formaciones",
    editor: draft.id ? "Editar formación" : "Nueva formación",
    paths: "Rutas",
    news: "Novedades",
    documentos: "Documentos",
    employees: "Empleados",
    groups: "Grupos",
    puestos: "Puestos",
    seguimiento: "Seguimiento",
    reviews: "Reseñas",
    notificaciones: "Notificaciones",
    backup: "Copia de seguridad",
  };
  const activeGroup = TAB_GROUPS.find((g) => g.tabs.includes(tab)) || TAB_GROUPS[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <div>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 var(--sp-4) 0" }}>
          {mode === "team" ? "Mi equipo" : "Administración"}
        </h1>

        {mode === "team" ? (
          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
            {[
              { id: "courses", label: "Formaciones" },
              { id: "editor", label: draft.id ? "Editar formación" : "Nueva formación" },
              { id: "paths", label: "Rutas" },
              { id: "team", label: "Mi equipo" },
            ].map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (t.id === "editor" && !draft.title && tab !== "editor") resetDraft();
                    setTab(t.id);
                  }}
                  style={{
                    fontSize: "var(--text-sm)", fontWeight: active ? 600 : 500,
                    padding: "10px 14px", whiteSpace: "nowrap", flexShrink: 0,
                    color: active ? "var(--brand)" : "var(--text-muted)",
                    background: "none", border: "none", cursor: "pointer",
                    borderBottom: active ? "2px solid var(--brand)" : "2px solid transparent",
                    marginBottom: -1, transition: "color var(--dur-fast) var(--ease-out)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            {/* Nivel 1: categorías — nunca crece, aunque añadamos más pestañas dentro de cada una */}
            <div style={{ display: "flex", gap: 4, marginBottom: "var(--sp-2)", flexWrap: "wrap" }}>
              {TAB_GROUPS.map((g) => {
                const isActiveGroup = g.id === activeGroup.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      if (!g.tabs.includes(tab)) setTab(g.tabs[0]);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      fontSize: "var(--text-sm)", fontWeight: isActiveGroup ? 600 : 500,
                      padding: "7px 12px", borderRadius: "var(--radius-md)",
                      color: isActiveGroup ? "var(--brand)" : "var(--text-secondary)",
                      backgroundColor: isActiveGroup ? "var(--brand-soft)" : "transparent",
                      border: "none", cursor: "pointer",
                    }}
                  >
                    <g.icon size={14} /> {g.label}
                  </button>
                );
              })}
            </div>
            {/* Nivel 2: pestañas concretas dentro de la categoría elegida */}
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
              {activeGroup.tabs.map((tabId) => {
                const active = tab === tabId;
                return (
                  <button
                    key={tabId}
                    onClick={() => {
                      if (tabId === "editor" && !draft.title && tab !== "editor") resetDraft();
                      setTab(tabId);
                    }}
                    style={{
                      fontSize: "var(--text-sm)", fontWeight: active ? 600 : 500,
                      padding: "10px 14px", whiteSpace: "nowrap", flexShrink: 0,
                      color: active ? "var(--brand)" : "var(--text-muted)",
                      background: "none", border: "none", cursor: "pointer",
                      borderBottom: active ? "2px solid var(--brand)" : "2px solid transparent",
                      marginBottom: -1, transition: "color var(--dur-fast) var(--ease-out)",
                    }}
                  >
                    {TAB_LABELS[tabId]}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {tab === "courses" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          {recoveredDraft && (
            <div style={{ ...DS.card, padding: "var(--sp-3)", backgroundColor: "var(--info-soft)", border: "none", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Save size={15} style={{ color: "var(--info)", flexShrink: 0 }} />
              <div style={{ fontSize: "var(--text-xs)", color: "var(--info)", flex: 1, minWidth: 200 }}>
                Tienes un borrador sin guardar: <strong>"{recoveredDraft.title}"</strong>. ¿Lo recuperas o lo descartas?
              </div>
              <button
                onClick={() => {
                  loadDraft(recoveredDraft);
                  setRecoveredDraft(null);
                }}
                style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: "var(--radius-md)", color: "white", backgroundColor: "var(--info)", border: "none", cursor: "pointer" }}
              >
                Recuperar
              </button>
              <button
                onClick={() => {
                  clearAutosave();
                  setRecoveredDraft(null);
                }}
                style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", border: "none", background: "none", cursor: "pointer" }}
              >
                Descartar
              </button>
            </div>
          )}
          <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "center", marginBottom: "var(--sp-2)" }}>
            <button
              onClick={() => {
                resetDraft();
                setTab("editor");
                setShowTemplatePicker(true);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 14px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer" }}
            >
              <Plus size={15} /> Nueva formación
            </button>
          </div>
          {courses.length > 4 && (
            <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", marginBottom: "var(--sp-2)" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  value={courseListSearch}
                  onChange={(e) => setCourseListSearch(e.target.value)}
                  placeholder="Buscar por título..."
                  style={{ width: "100%", padding: "7px 10px 7px 32px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "var(--text-sm)" }}
                />
              </div>
              <select
                value={courseListCategoryFilter}
                onChange={(e) => setCourseListCategoryFilter(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}
              >
                <option value="">Todos los campos</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
              {groups.length > 0 && (
                <select
                  value={courseListDepartmentFilter}
                  onChange={(e) => setCourseListDepartmentFilter(e.target.value)}
                  style={{ padding: "7px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}
                >
                  <option value="">Todos los departamentos</option>
                  <option value="__general__">General / Interdepartamental</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          {courses.length === 0 && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>No hay formaciones todavía.</div>}
          {(() => {
            const archivedCount = courses.filter((c) => c.archived).length;
            const filtered = courses.filter(
              (c) =>
                !!c.archived === showArchived &&
                (!courseListCategoryFilter || c.category === courseListCategoryFilter) &&
                (!courseListDepartmentFilter || (courseListDepartmentFilter === "__general__" ? !c.departmentGroupId : c.departmentGroupId === courseListDepartmentFilter)) &&
                (!courseListSearch.trim() || c.title.toLowerCase().includes(courseListSearch.trim().toLowerCase()))
            );
            return (
              <>
                {archivedCount > 0 && (
                  <button
                    onClick={() => setShowArchived((v) => !v)}
                    style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, width: "fit-content", marginBottom: "var(--sp-2)" }}
                  >
                    {showArchived ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {showArchived ? "Ocultar archivadas" : `Ver archivadas (${archivedCount})`}
                  </button>
                )}
                {filtered.length === 0 ? (
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                    {showArchived ? "No hay formaciones archivadas." : "Ninguna formación coincide con la búsqueda."}
                  </div>
                ) : (
                  filtered.map((c) => (
                    <div key={c.id} style={{ ...DS.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "var(--sp-3)", flexWrap: "wrap", opacity: c.archived ? 0.6 : 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                        <CategoryTag id={c.category} small />
                        <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                        {avgRatingByCourse[c.id] && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "var(--warning)", flexShrink: 0 }} title={`${avgRatingByCourse[c.id].count} valoración${avgRatingByCourse[c.id].count === 1 ? "" : "es"}`}>
                            <Star size={11} fill="var(--warning)" /> {avgRatingByCourse[c.id].avg.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        {confirmDeleteId === c.id ? (
                          <>
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--danger)", fontWeight: 600, marginRight: 2 }}>¿Eliminar del todo?</span>
                            <button
                              onClick={() => {
                                onDeleteCourse(c.id);
                                setConfirmDeleteId(null);
                              }}
                              style={{ fontSize: "var(--text-xs)", fontWeight: 700, padding: "6px 10px", borderRadius: "var(--radius-md)", color: "white", backgroundColor: "var(--danger)", border: "none", cursor: "pointer" }}
                            >
                              Sí, eliminar
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              style={{ fontSize: "var(--text-xs)", fontWeight: 600, padding: "6px 10px", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", background: "none", border: "1px solid var(--border)", cursor: "pointer" }}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <div style={{ marginRight: 8 }}>
                              <CopyLinkButton url={buildShareLink("course", c.id)} compact />
                            </div>
                            <button onClick={() => loadDraft(c)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, padding: "6px 10px", borderRadius: "var(--radius-md)", color: "var(--info)", background: "none", border: "none", cursor: "pointer" }}>
                              Editar
                            </button>
                            <button onClick={() => duplicateCourse(c)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, padding: "6px 10px", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                              <Copy size={13} /> Duplicar
                            </button>
                            <button
                              onClick={() => onSetCourseArchived(c.id, !c.archived)}
                              style={{ fontSize: "var(--text-xs)", fontWeight: 600, padding: "6px 10px", borderRadius: "var(--radius-md)", color: "var(--warning)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <Archive size={13} /> {c.archived ? "Desarchivar" : "Archivar"}
                            </button>
                            {mode !== "team" && (
                              <button onClick={() => setConfirmDeleteId(c.id)} style={{ fontSize: "var(--text-xs)", fontWeight: 600, padding: "6px 10px", borderRadius: "var(--radius-md)", color: "var(--danger)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                                <Trash2 size={13} /> Eliminar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            );
          })()}
        </div>
      )}

      {showTemplatePicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 95, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--sp-4)" }}>
          <div style={{ ...DS.card, maxWidth: 480, width: "100%", padding: "var(--sp-5)" }}>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 var(--sp-1)" }}>¿Cómo quieres empezar?</h3>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: "0 0 var(--sp-4)" }}>Puedes cambiarlo todo después — esto solo decide el punto de partida.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              <button
                onClick={() => setShowTemplatePicker(false)}
                style={{ ...DS.card, textAlign: "left", padding: "var(--sp-3)", cursor: "pointer", border: "1px solid var(--border)" }}
              >
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>En blanco</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Sin nada predefinido, tú decides cada campo.</div>
              </button>
              <button
                onClick={() => applyTemplate("protocolo")}
                style={{ ...DS.card, textAlign: "left", padding: "var(--sp-3)", cursor: "pointer", border: "1px solid var(--border)" }}
              >
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Protocolo simple</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Categoría "Protocolos" y caducidad a 12 meses ya puestas — lo típico en un protocolo.</div>
              </button>
              <button
                onClick={() => applyTemplate("modular")}
                style={{ ...DS.card, textAlign: "left", padding: "var(--sp-3)", cursor: "pointer", border: "1px solid var(--border)" }}
              >
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Formación con módulos</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Ya con 3 módulos creados y listos para rellenar, sin ir añadiéndolos uno a uno.</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "editor" && (
        <div className="rounded-xl border bg-white p-4 space-y-4 shadow-sm" style={{ borderColor: "#00000012" }}>
          {(duplicateAttachmentsNotice > 0 || duplicateVideosNotice > 0) && (
            <div style={{ ...DS.card, padding: "var(--sp-3)", backgroundColor: "var(--warning-soft)", border: "none", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={15} style={{ color: "var(--warning)", flexShrink: 0 }} />
              <div style={{ fontSize: "var(--text-xs)", color: "var(--warning-text)" }}>
                Esta es una copia — {[
                  duplicateAttachmentsNotice > 0 ? `${duplicateAttachmentsNotice} documento${duplicateAttachmentsNotice === 1 ? "" : "s"} adjunto${duplicateAttachmentsNotice === 1 ? "" : "s"}` : null,
                  duplicateVideosNotice > 0 ? `${duplicateVideosNotice} vídeo${duplicateVideosNotice === 1 ? "" : "s"} propio${duplicateVideosNotice === 1 ? "" : "s"}` : null,
                ].filter(Boolean).join(" y ")} del original no se ha{(duplicateAttachmentsNotice + duplicateVideosNotice) === 1 ? "" : "n"} copiado (para no compartir el mismo archivo entre las dos). Vuelve a subirlo{(duplicateAttachmentsNotice + duplicateVideosNotice) === 1 ? "" : "s"} aquí si hace falta.
              </div>
              <button
                onClick={() => {
                  setDuplicateAttachmentsNotice(0);
                  setDuplicateVideosNotice(0);
                }}
                style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", color: "var(--warning-text)", flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Qué falta por rellenar, siempre visible mientras editas */}
          {(() => {
            const hasContent = !!(draft.videoUrl?.trim() || (draft.attachments || []).length > 0 || (draft.modules || []).length > 0);
            const hasTest =
              draft.testMode === "ninguno" ||
              (draft.testMode === "googleform" && !!draft.googleFormUrl?.trim()) ||
              (draft.testMode === "interno" && (draft.quiz || []).some((q) => q.question.trim())) ||
              ((draft.modules || []).length > 0 && (draft.modules || []).every((m) => m.quiz.length === 0 || m.quiz.some((q) => q.question.trim())));
            const hasAssignment =
              draft.assignment.mode === "todos" ||
              (draft.assignment.mode === "grupos" && (draft.assignment.groupIds || []).length > 0) ||
              (draft.assignment.mode === "individual" && (draft.assignment.employeeNames || []).length > 0);
            const checklist = [
              { label: "Título", ok: !!draft.title.trim() },
              { label: "Descripción", ok: !!draft.description.trim() },
              { label: "Contenido", ok: hasContent },
              { label: "Test", ok: hasTest },
              { label: "Asignación", ok: hasAssignment },
            ];
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "var(--sp-2) 0" }}>
                {checklist.map((item) => (
                  <span
                    key={item.label}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                      padding: "3px 9px", borderRadius: "var(--radius-full)",
                      backgroundColor: item.ok ? "var(--success-soft)" : "var(--bg-inset)",
                      color: item.ok ? "var(--success-text)" : "var(--text-muted)",
                    }}
                  >
                    {item.ok ? <Check size={11} /> : <X size={11} />} {item.label}
                  </span>
                ))}
              </div>
            );
          })()}

          <TextInput label="Título de la formación" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder="Ej. Protocolo de picking pasillo 4" />

          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Categoría
            <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Departamento (opcional)
            <select
              value={draft.departmentGroupId || ""}
              onChange={(e) => setDraft((d) => ({ ...d, departmentGroupId: e.target.value || null }))}
              className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900"
              style={{ borderColor: "#00000020" }}
            >
              <option value="">General / Interdepartamental (aparece en todos los filtros)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          <div className="text-[11px] text-gray-400 -mt-2">
            Poner un departamento no cambia quién la ve — eso lo sigue decidiendo la asignación de más abajo. Solo permite filtrar por departamento dentro del Catálogo, algo útil sobre todo en Protocolos.
          </div>

          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Descripción
            <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={2} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }} />
          </label>

          <div className="rounded-lg p-3 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--bg-inset)" }}>
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Formación por módulos secuenciales
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Varias partes que hay que ir aprobando una a una para desbloquear la siguiente, con su propio progreso dentro de la formación. Si lo desactivas, vuelve a ser una formación normal (un único vídeo/test).
              </div>
            </div>
            <button
              onClick={toggleModularMode}
              style={{
                width: 44, height: 24, borderRadius: 999, flexShrink: 0, position: "relative", border: "none", cursor: "pointer",
                backgroundColor: draft.modules && draft.modules.length > 0 ? "var(--brand)" : "#00000025",
                transition: "background-color 0.2s",
              }}
            >
              <span style={{ position: "absolute", top: 2, left: draft.modules && draft.modules.length > 0 ? 22 : 2, width: 20, height: 20, borderRadius: "50%", backgroundColor: "white", transition: "left 0.2s" }} />
            </button>
          </div>

          <div className="flex gap-4 flex-wrap">
            <div className="w-40">
              <TextInput label="Fecha límite" type="date" value={draft.deadline} onChange={(v) => setDraft((d) => ({ ...d, deadline: v }))} />
            </div>
            {(!draft.modules || draft.modules.length === 0) && draft.testMode !== "googleform" && (
              <div className="w-40">
                <TextInput label="% para aprobar el test" type="number" value={draft.passPct} onChange={(v) => setDraft((d) => ({ ...d, passPct: Number(v) }))} />
              </div>
            )}
            <div className="w-48">
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Caduca cada (meses, opcional)
                <input
                  type="number"
                  min="0"
                  value={draft.validityMonths || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, validityMonths: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="Ej. 12 — vacío = no caduca"
                  className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900"
                  style={{ borderColor: "#00000020" }}
                />
              </label>
            </div>
          </div>
          {draft.validityMonths > 0 && (
            <div className="text-[11px] text-gray-400 -mt-2">
              Pasados {draft.validityMonths} mes{draft.validityMonths === 1 ? "" : "es"} desde que alguien la complete, le volverá a aparecer como pendiente automáticamente (recertificación).
            </div>
          )}

          <div style={{ ...DS.card, padding: "var(--sp-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: draft.practicalCase ? "var(--sp-3)" : 0 }}>
              <input
                type="checkbox"
                id="practical-case-check"
                checked={!!draft.practicalCase}
                onChange={(e) => setDraft((d) => ({ ...d, practicalCase: e.target.checked ? { title: "", description: "" } : null }))}
              />
              <label htmlFor="practical-case-check" style={{ fontSize: "var(--text-sm)", cursor: "pointer" }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Caso práctico</span>
                <span style={{ color: "var(--text-muted)" }}> — un ejercicio de respuesta libre, que corrige a mano un admin o el responsable del equipo. Se suma al test, no lo sustituye.</span>
              </label>
            </div>
            {draft.practicalCase && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                <input
                  value={draft.practicalCase.title}
                  onChange={(e) => setDraft((d) => ({ ...d, practicalCase: { ...d.practicalCase, title: e.target.value } }))}
                  placeholder="Título del caso (ej. «Gestión de una muestra contaminada»)"
                  className="w-full text-sm rounded-md border px-3 py-2"
                  style={{ borderColor: "#00000020" }}
                />
                <textarea
                  value={draft.practicalCase.description}
                  onChange={(e) => setDraft((d) => ({ ...d, practicalCase: { ...d.practicalCase, description: e.target.value } }))}
                  placeholder="Describe el escenario y qué se espera que responda la persona..."
                  rows={5}
                  className="w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900"
                  style={{ borderColor: "#00000020" }}
                />
              </div>
            )}
          </div>

          {draft.modules && draft.modules.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-gray-500 -mb-1">Módulos, en el orden en que se desbloquean</div>
              {draft.modules.map((mod, mi) => (
                <div
                  key={mod.id}
                  draggable
                  onDragStart={() => setDraggedModuleIndex(mi)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedModuleIndex !== null) reorderModules(draggedModuleIndex, mi);
                    setDraggedModuleIndex(null);
                  }}
                  onDragEnd={() => setDraggedModuleIndex(null)}
                  className="rounded-lg border p-3 space-y-2.5"
                  style={{ borderColor: "#00000018", backgroundColor: "white", opacity: draggedModuleIndex === mi ? 0.4 : 1 }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ cursor: "grab", color: "var(--text-muted)", flexShrink: 0, display: "flex" }} title="Arrastra para reordenar">
                      <GripVertical size={15} />
                    </span>
                    <span className="flex-shrink-0 flex items-center justify-center rounded-full font-bold text-white text-xs" style={{ backgroundColor: "var(--brand)", width: 22, height: 22 }}>
                      {mi + 1}
                    </span>
                    <input
                      value={mod.title}
                      onChange={(e) => updateModuleField(mi, "title", e.target.value)}
                      placeholder={`Título del módulo ${mi + 1}`}
                      className="flex-1 text-sm font-semibold rounded-md border px-2 py-1.5"
                      style={{ borderColor: "#00000020" }}
                    />
                    <button disabled={mi === 0} onClick={() => moveModule(mi, -1)} className="text-gray-400 disabled:opacity-30" title="Subir">
                      <ChevronUp size={16} />
                    </button>
                    <button disabled={mi === draft.modules.length - 1} onClick={() => moveModule(mi, 1)} className="text-gray-400 disabled:opacity-30" title="Bajar">
                      <ChevronDown size={16} />
                    </button>
                    {draft.modules.length > 1 && (
                      <button onClick={() => removeModule(mi)} className="text-red-500" title="Eliminar módulo">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <textarea
                    value={mod.body}
                    onChange={(e) => updateModuleField(mi, "body", e.target.value)}
                    placeholder="Contenido / explicación de este módulo (texto)"
                    rows={3}
                    className="w-full text-xs rounded-md border px-2 py-1.5"
                    style={{ borderColor: "#00000018" }}
                  />
                  <VideoFieldEditor
                    label="Vídeo del módulo (opcional)"
                    videoUrl={mod.videoUrl}
                    videoFile={mod.videoFile}
                    onSetVideoUrl={(v) => updateModuleField(mi, "videoUrl", v)}
                  />

                  <div>
                    <div className="text-[11px] font-semibold text-gray-500 mb-1">Documentos de este módulo (PDF, Word...)</div>
                    {(mod.attachments || []).map((att) => (
                      <div key={att.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 mb-1" style={{ backgroundColor: "var(--bg-inset)" }}>
                        <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>{att.name} <span className="text-[10px] text-gray-400">({att.sizeKB} KB)</span></span>
                        <button onClick={() => removeModuleAttachment(mi, att.id)} className="text-red-500 flex-shrink-0"><X size={13} /></button>
                      </div>
                    ))}
                    <input type="file" onChange={(e) => handleModuleFileInput(mi, e)} className="text-xs" accept=".pdf,.doc,.docx" />
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-gray-500 mb-1">Formación relacionada</div>
                    <div className="rounded-md border p-2 space-y-1" style={{ borderColor: "#00000018", maxHeight: 160, overflowY: "auto" }}>
                      {courses.filter((c) => c.id !== draft.id).length === 0 && (
                        <div className="text-[11px] text-gray-400">No hay otras formaciones creadas todavía.</div>
                      )}
                      {courses.filter((c) => c.id !== draft.id).map((c) => {
                        const rel = (mod.relatedCourses || []).find((rc) => rc.courseId === c.id);
                        return (
                          <div key={c.id} className="flex items-center gap-2">
                            <input type="checkbox" checked={!!rel} onChange={() => toggleModuleRelatedCourse(mi, c.id)} />
                            <span className="text-xs flex-1 truncate" style={{ color: "var(--text-primary)" }}>{c.title}</span>
                            {rel && (
                              <select
                                value={rel.mode}
                                onChange={(e) => setModuleRelatedCourseMode(mi, c.id, e.target.value)}
                                className="text-[11px] rounded border px-1 py-0.5"
                                style={{ borderColor: "#00000018" }}
                              >
                                <option value="recomendada">Recomendada</option>
                                <option value="requisito">Requisito (hay que completarla)</option>
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-gray-500 mb-1">Enlaces externos (protocolos, intranet...)</div>
                    {(mod.externalLinks || []).map((link) => (
                      <div key={link.id} className="flex items-center gap-2 mb-1">
                        <input
                          value={link.label}
                          onChange={(e) => updateModuleLink(mi, link.id, "label", e.target.value)}
                          placeholder="Título (ej. Protocolo de manipulación)"
                          className="flex-1 text-xs rounded-md border px-2 py-1"
                          style={{ borderColor: "#00000018" }}
                        />
                        <input
                          value={link.url}
                          onChange={(e) => updateModuleLink(mi, link.id, "url", e.target.value)}
                          placeholder="https://..."
                          className="flex-1 text-xs rounded-md border px-2 py-1"
                          style={{ borderColor: "#00000018" }}
                        />
                        <button onClick={() => removeModuleLink(mi, link.id)} className="text-red-500 flex-shrink-0"><X size={13} /></button>
                      </div>
                    ))}
                    <button onClick={() => addModuleLink(mi)} className="text-xs font-semibold flex items-center gap-1" style={{ color: BRAND.blue }}>
                      <Plus size={12} /> Añadir enlace
                    </button>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-gray-500 mb-1">Checklist rápido de pasos (opcional)</div>
                    {(mod.checklistSteps || []).map((step) => (
                      <div key={step.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 mb-1" style={{ backgroundColor: "var(--bg-inset)" }}>
                        <span className="text-xs" style={{ color: "var(--text-primary)" }}>{step.text}</span>
                        <button onClick={() => removeModuleChecklistStep(mi, step.id)} className="text-red-500 flex-shrink-0"><X size={13} /></button>
                      </div>
                    ))}
                    <ModuleChecklistStepInput onAdd={(text) => addModuleChecklistStep(mi, text)} />
                  </div>

                  <div style={{ ...DS.card, padding: "var(--sp-3)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: mod.practicalCase ? "var(--sp-2)" : 0 }}>
                      <input
                        type="checkbox"
                        id={`mod-case-${mod.id}`}
                        checked={!!mod.practicalCase}
                        onChange={(e) => updateModuleField(mi, "practicalCase", e.target.checked ? { title: "", description: "" } : null)}
                      />
                      <label htmlFor={`mod-case-${mod.id}`} className="text-xs" style={{ cursor: "pointer" }}>
                        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Caso práctico de este módulo</span>
                      </label>
                    </div>
                    {mod.practicalCase && (
                      <div className="space-y-1.5">
                        <input
                          value={mod.practicalCase.title}
                          onChange={(e) => updateModuleField(mi, "practicalCase", { ...mod.practicalCase, title: e.target.value })}
                          placeholder="Título del caso"
                          className="w-full text-xs rounded-md border px-2 py-1.5"
                          style={{ borderColor: "#00000018" }}
                        />
                        <textarea
                          value={mod.practicalCase.description}
                          onChange={(e) => updateModuleField(mi, "practicalCase", { ...mod.practicalCase, description: e.target.value })}
                          placeholder="Describe el escenario..."
                          rows={3}
                          className="w-full text-xs rounded-md border px-2 py-1.5"
                          style={{ borderColor: "#00000018" }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-xs font-semibold text-gray-500">Test de este módulo</div>
                    <button
                      onClick={() => updateModuleField(mi, "quiz", mod.quiz.length > 0 ? [] : [{ ...emptyQuestion }])}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                      style={{
                        backgroundColor: mod.quiz.length === 0 ? BRAND.red : "white",
                        color: mod.quiz.length === 0 ? "white" : BRAND.ink,
                        borderColor: mod.quiz.length === 0 ? BRAND.red : "#00000018",
                      }}
                    >
                      {mod.quiz.length === 0 ? "Sin test ✓" : "Sin test"}
                    </button>
                  </div>

                  {mod.quiz.length === 0 ? (
                    <div className="text-[11px] text-gray-400 rounded-md p-2" style={{ backgroundColor: "var(--bg-inset)" }}>
                      Este módulo no tiene test — la persona verá el contenido y pulsará "Continuar" para pasar al siguiente módulo, sin preguntas de por medio.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <label className="text-[11px] text-gray-400 flex items-center gap-1">
                          % para aprobar
                          <input
                            type="number"
                            value={mod.passPct}
                            onChange={(e) => updateModuleField(mi, "passPct", Number(e.target.value))}
                            className="w-14 text-xs rounded-md border px-1.5 py-1"
                            style={{ borderColor: "#00000018" }}
                          />
                        </label>
                        <label className="text-[11px] font-semibold flex items-center gap-1" style={{ color: BRAND.blue, cursor: "pointer" }}>
                          <Upload size={11} /> Importar Excel
                          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleModuleQuizImport(mi, e)} style={{ display: "none" }} />
                        </label>
                        <button onClick={() => addModuleQuestion(mi)} className="text-xs font-semibold flex items-center gap-1" style={{ color: BRAND.blue }}>
                          <Plus size={12} /> Pregunta
                        </button>
                      </div>
                      {moduleQuizImportError && <div className="text-[11px] mb-1" style={{ color: "var(--danger)" }}>{moduleQuizImportError}</div>}

                      {mod.quiz.map((q, qi) => (
                        <div
                          key={qi}
                          draggable
                          onDragStart={() => setDraggedModuleQuestionIndex(`${mi}-${qi}`)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedModuleQuestionIndex !== null) {
                              const [dmi, dqi] = draggedModuleQuestionIndex.split("-").map(Number);
                              if (dmi === mi) reorderModuleQuestions(mi, dqi, qi);
                            }
                            setDraggedModuleQuestionIndex(null);
                          }}
                          onDragEnd={() => setDraggedModuleQuestionIndex(null)}
                          className="rounded-md p-2 space-y-1.5"
                          style={{ backgroundColor: "var(--bg-inset)", opacity: draggedModuleQuestionIndex === `${mi}-${qi}` ? 0.4 : 1 }}
                        >
                          <div className="flex items-center gap-2">
                            <span style={{ cursor: "grab", color: "var(--text-muted)", flexShrink: 0, display: "flex" }} title="Arrastra para reordenar">
                              <GripVertical size={13} />
                            </span>
                            <input
                              value={q.question}
                              onChange={(e) => updateModuleQuestion(mi, qi, "question", e.target.value)}
                              placeholder={`Pregunta ${qi + 1}`}
                              className="flex-1 text-xs rounded-md border px-2 py-1"
                              style={{ borderColor: "#00000018" }}
                            />
                            {mod.quiz.length > 1 && (
                              <button onClick={() => removeModuleQuestion(mi, qi)} className="text-red-500">
                                <X size={14} />
                              </button>
                            )}
                          </div>
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input type="radio" checked={q.correct === oi} onChange={() => updateModuleQuestion(mi, qi, "correct", oi)} className="flex-shrink-0" />
                              <input
                                value={opt}
                                onChange={(e) => updateModuleOption(mi, qi, oi, e.target.value)}
                                placeholder={`Opción ${oi + 1}`}
                                className="flex-1 text-xs rounded-md border px-2 py-1"
                                style={{ borderColor: "#00000015" }}
                              />
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
              <button onClick={addModule} className="text-sm font-semibold flex items-center gap-1.5" style={{ color: BRAND.red }}>
                <Plus size={15} /> Añadir otro módulo
              </button>
            </div>
          ) : (
            <>
              <VideoFieldEditor
                videoUrl={draft.videoUrl}
                videoFile={draft.videoFile}
                onSetVideoUrl={(v) => setDraft((d) => ({ ...d, videoUrl: v }))}
              />
              <TextInput label="URL de la presentación (link embebible)" value={draft.presentationUrl} onChange={(v) => setDraft((d) => ({ ...d, presentationUrl: v }))} placeholder="https://..." />

          <div>

            <div className="text-xs font-semibold text-gray-500 mb-2">Cómo se hace el test</div>
            <div className="flex gap-2 flex-wrap mb-2">
              {[
                { id: "interno", label: "Preguntas dentro de la app" },
                { id: "googleform", label: "Google Form (externo)" },
                { id: "ninguno", label: "Sin test" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setDraft((d) => ({ ...d, testMode: m.id }))}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: draft.testMode === m.id ? BRAND.red : "white",
                    color: draft.testMode === m.id ? "white" : BRAND.ink,
                    borderColor: draft.testMode === m.id ? BRAND.red : "#00000018",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {draft.testMode === "ninguno" && (
              <div className="text-[11px] text-gray-400 rounded-lg border p-3" style={{ borderColor: "#00000018" }}>
                Sin test: la persona verá el vídeo y/o los documentos, y marcará "Ya la he visto" ella misma para darla por completada — igual que con un Google Form, pero sin ningún formulario externo de por medio.
              </div>
            )}

            {draft.testMode === "googleform" ? (
              <div className="rounded-lg border p-3" style={{ borderColor: "#00000018" }}>
                <TextInput
                  label="Enlace del Google Form"
                  value={draft.googleFormUrl}
                  onChange={(v) => setDraft((d) => ({ ...d, googleFormUrl: v }))}
                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                />
                <div className="text-[11px] text-gray-400 mt-1.5">
                  El formulario es totalmente tuyo — créalo, edítalo y cámbialo cuando quieras directamente en Google Forms, sin tocar esta app. La app solo lo muestra embebido y deja que la persona marque "completado" al terminar; no puede leer las respuestas ni corregirlo automáticamente. Si necesitas saber quién acertó qué, revisa las respuestas del propio Form (o su Hoja de cálculo vinculada), y usa "Marcar manualmente" en Seguimiento si quieres reflejarlo en la app.
                </div>
              </div>
            ) : draft.testMode === "interno" ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-gray-500">Preguntas del test</div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold flex items-center gap-1" style={{ color: BRAND.blue, cursor: "pointer" }}>
                      <Upload size={13} /> Importar desde Excel
                      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleQuizImport} style={{ display: "none" }} />
                    </label>
                    <button onClick={addQuestion} className="text-xs font-semibold flex items-center gap-1" style={{ color: BRAND.blue }}>
                      <Plus size={13} /> Añadir pregunta
                    </button>
                  </div>
                </div>
                {quizImportError && <div className="text-xs mb-2" style={{ color: "var(--danger)" }}>{quizImportError}</div>}
                <div className="text-[11px] text-gray-400 mb-2">Columnas: Pregunta, Opción 1-4, y Correcta (número 1-4, letra a-d, o el texto exacto de la opción).</div>
                <div className="space-y-3">
                  {draft.quiz.map((q, qi) => (
                    <div
                      key={qi}
                      draggable
                      onDragStart={() => setDraggedQuestionIndex(qi)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedQuestionIndex !== null) reorderQuestions(draggedQuestionIndex, qi);
                        setDraggedQuestionIndex(null);
                      }}
                      onDragEnd={() => setDraggedQuestionIndex(null)}
                      className="rounded-lg border p-3"
                      style={{ borderColor: "#00000018", opacity: draggedQuestionIndex === qi ? 0.4 : 1 }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span style={{ cursor: "grab", color: "var(--text-muted)", flexShrink: 0, display: "flex" }} title="Arrastra para reordenar">
                          <GripVertical size={14} />
                        </span>
                        <input value={q.question} onChange={(e) => updateQuizQuestion(qi, "question", e.target.value)} placeholder={`Pregunta ${qi + 1}`} className="flex-1 text-sm rounded-md border px-2 py-1.5" style={{ borderColor: "#00000020" }} />
                        {draft.quiz.length > 1 && (
                          <button onClick={() => removeQuestion(qi)} className="text-red-500">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input type="radio" checked={q.correct === oi} onChange={() => updateQuizQuestion(qi, "correct", oi)} className="flex-shrink-0" />
                            <input value={opt} onChange={(e) => updateQuizOption(qi, oi, e.target.value)} placeholder={`Opción ${oi + 1}`} className="flex-1 text-sm rounded-md border px-2 py-1" style={{ borderColor: "#00000018" }} />
                          </div>
                        ))}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1">Marca con el círculo cuál es la respuesta correcta.</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
            </>
          )}

          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">Asignar formación a</div>
            <div className="flex gap-2 flex-wrap mb-2">
              {[
                { id: "todos", label: "Todos los empleados" },
                { id: "grupos", label: "Grupos concretos" },
                { id: "individual", label: "Personas concretas" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setAssignmentMode(m.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: draft.assignment.mode === m.id ? BRAND.red : "white",
                    color: draft.assignment.mode === m.id ? "white" : BRAND.ink,
                    borderColor: draft.assignment.mode === m.id ? BRAND.red : "#00000018",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {draft.assignment.mode === "grupos" && (
              <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: "#00000018" }}>
                {groups.length === 0 ? (
                  <div className="text-xs text-gray-400">No hay grupos creados todavía. Créalos en la pestaña "Grupos".</div>
                ) : (
                  groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={(draft.assignment.groupIds || []).includes(g.id)} onChange={() => toggleAssignGroup(g.id)} />
                      {g.name} <span className="text-[11px] text-gray-400">({(g.memberNames || []).length} personas)</span>
                    </label>
                  ))
                )}
              </div>
            )}

            {draft.assignment.mode === "individual" && (
              <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: "#00000018" }}>
                {employees.length === 0 ? (
                  <div className="text-xs text-gray-400">No hay empleados registrados todavía.</div>
                ) : (
                  <>
                    {employees.length > 8 && (
                      <input
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        placeholder="Buscar por nombre..."
                        className="w-full text-xs rounded-md border px-2 py-1.5 mb-1.5"
                        style={{ borderColor: "#00000020" }}
                      />
                    )}
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {employees
                        .filter((e) => e.name.toLowerCase().includes(assignSearch.trim().toLowerCase()))
                        .map((e) => (
                          <label key={e.name} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={(draft.assignment.employeeNames || []).includes(e.name)} onChange={() => toggleAssignEmployee(e.name)} />
                            {e.name}
                          </label>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1.5">Adjuntar documento (PDF, Word, imagen... máx. ~3,5 MB)</div>
            <input type="file" onChange={handleFileInput} accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*" className="text-sm" />
            {fileError && <div className="text-xs text-red-600 mt-1.5">{fileError}</div>}
            <div className="text-[11px] text-gray-400 mt-1">
              Para vídeo o archivos más grandes: pégalo como enlace arriba (YouTube, Vimeo, SharePoint, Drive).
            </div>
            {(draft.attachments || []).length > 0 && (
              <div className="space-y-1.5 mt-2">
                {draft.attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm rounded-md border px-2 py-1.5" style={{ borderColor: "#00000018" }}>
                    <span className="truncate flex items-center gap-1.5">
                      <FileText size={13} style={{ color: BRAND.blue }} /> {a.name} <span className="text-[11px] text-gray-400">({a.sizeKB} KB)</span>
                    </span>
                    <button onClick={() => removeDraftAttachment(a.id)} className="text-red-500 flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {pendingWarnings && (
            <div style={{ ...DS.card, padding: "var(--sp-4)", borderLeft: "4px solid var(--warning)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--sp-2)" }}>
                <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                  Antes de guardar, revisa esto
                </div>
              </div>
              <ul style={{ margin: "0 0 var(--sp-3) 0", paddingLeft: 20, fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {pendingWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={() => setPendingWarnings(null)}
                  className="text-xs font-semibold rounded-md px-3 py-1.5 border"
                  style={{ borderColor: "#00000018", color: BRAND.ink }}
                >
                  Volver a revisarlo
                </button>
                <button
                  onClick={() => {
                    setPendingWarnings(null);
                    handleSave();
                  }}
                  className="text-xs font-semibold rounded-md px-3 py-1.5 text-white"
                  style={{ backgroundColor: "var(--warning)" }}
                >
                  Guardar de todas formas
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              disabled={!canSave()}
              onClick={() => setShowPreview(true)}
              className="text-sm font-semibold rounded-md px-4 py-2 border disabled:opacity-40 flex items-center gap-2"
              style={{ borderColor: "#00000020", color: BRAND.ink }}
            >
              <Eye size={15} /> Vista previa
            </button>
            <button disabled={!canSave() || saving} onClick={handleSaveClick} className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 transition-all duration-150 active:scale-[0.98]" style={{ backgroundColor: BRAND.red }}>
              {saving ? "Guardando..." : "Guardar formación"}
            </button>
            <button
              onClick={() => {
                resetDraft();
                setTab("courses");
              }}
              className="text-sm font-semibold rounded-md px-4 py-2"
              style={{ color: BRAND.ink }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showPreview && <CoursePreviewOverlay draft={draft} courses={courses} onClose={() => setShowPreview(false)} />}

      {tab === "paths" && (
        <PathsAdminTab paths={paths} courses={courses} groups={groups} employees={employees} onSavePath={onSavePath} onDeletePath={onDeletePath} mode={mode} />
      )}

      {tab === "documentos" && mode !== "team" && (
        <DocumentosAdminTab courses={courses} onDeleteAttachment={onDeleteAttachment} />
      )}

      {tab === "puestos" && mode !== "team" && (
        <PuestosAdminTab puestos={puestos} groups={groups} onSavePuesto={onSavePuesto} onDeletePuesto={onDeletePuesto} />
      )}

      {tab === "news" && mode !== "team" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 space-y-3 shadow-sm" style={{ borderColor: "#00000012" }}>
            {editingNewsId && (
              <div className="text-xs font-semibold rounded-md px-3 py-2" style={{ backgroundColor: "var(--info-soft)", color: "var(--info-text)" }}>
                Editando novedad existente
              </div>
            )}
            <TextInput label="Título de la novedad" value={newNewsTitle} onChange={setNewNewsTitle} placeholder="Ej. Nueva formación disponible" />
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Contenido
              <textarea value={newNewsBody} onChange={(e) => setNewNewsBody(e.target.value)} rows={2} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }} />
            </label>

            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1.5">Vincular a (opcional — para que se pueda pinchar y llevar directo)</div>
              <div className="flex gap-2 flex-wrap mb-2">
                {[
                  { id: "none", label: "Nada" },
                  { id: "course", label: "Una formación" },
                  { id: "category", label: "Un campo" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setNewNewsLinkType(opt.id);
                      setNewNewsLinkId("");
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                    style={{
                      backgroundColor: newNewsLinkType === opt.id ? BRAND.red : "white",
                      color: newNewsLinkType === opt.id ? "white" : BRAND.ink,
                      borderColor: newNewsLinkType === opt.id ? BRAND.red : "#00000018",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {newNewsLinkType === "course" && (
                <select value={newNewsLinkId} onChange={(e) => setNewNewsLinkId(e.target.value)} className="w-full text-sm rounded-md border px-3 py-2 text-gray-900" style={{ borderColor: "#00000020" }}>
                  <option value="">Selecciona una formación...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}
              {newNewsLinkType === "category" && (
                <select value={newNewsLinkId} onChange={(e) => setNewNewsLinkId(e.target.value)} className="w-full text-sm rounded-md border px-3 py-2 text-gray-900" style={{ borderColor: "#00000020" }}>
                  <option value="">Selecciona un campo...</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={!newNewsTitle.trim() || (newNewsLinkType !== "none" && !newNewsLinkId)}
                onClick={() => {
                  const fields = {
                    title: newNewsTitle,
                    body: newNewsBody,
                    linkType: newNewsLinkType === "none" ? null : newNewsLinkType,
                    linkId: newNewsLinkType === "none" ? null : newNewsLinkId,
                  };
                  if (editingNewsId) {
                    onUpdateNews(editingNewsId, fields);
                    setEditingNewsId(null);
                  } else {
                    onAddNews({ id: uid(), date: todayISO(), ...fields });
                  }
                  setNewNewsTitle("");
                  setNewNewsBody("");
                  setNewNewsLinkType("none");
                  setNewNewsLinkId("");
                }}
                className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40"
                style={{ backgroundColor: BRAND.red }}
              >
                {editingNewsId ? "Guardar cambios" : "Publicar novedad"}
              </button>
              {editingNewsId && (
                <button
                  onClick={() => {
                    setEditingNewsId(null);
                    setNewNewsTitle("");
                    setNewNewsBody("");
                    setNewNewsLinkType("none");
                    setNewNewsLinkId("");
                  }}
                  className="text-sm font-semibold px-3 py-2"
                  style={{ color: BRAND.ink }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {news.map((n) => {
              const linkedCourse = n.linkType === "course" ? courses.find((c) => c.id === n.linkId) : null;
              const linkedCategory = n.linkType === "category" ? categoryMeta(n.linkId) : null;
              return (
                <div key={n.id} className="flex items-start justify-between gap-2 rounded-lg border bg-white p-3 shadow-sm" style={{ borderColor: "#00000012" }}>
                  <div>
                    <div className="font-semibold text-sm">{n.title}</div>
                    <div className="text-xs text-gray-500">{n.body}</div>
                    <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2">
                      {n.date}
                      {linkedCourse && <span className="text-blue-600 font-semibold">→ {linkedCourse.title}</span>}
                      {linkedCategory && <span className="text-blue-600 font-semibold">→ {linkedCategory.label}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingNewsId(n.id);
                        setNewNewsTitle(n.title);
                        setNewNewsBody(n.body || "");
                        setNewNewsLinkType(n.linkType || "none");
                        setNewNewsLinkId(n.linkId || "");
                      }}
                      className="text-xs font-semibold"
                      style={{ color: BRAND.blue }}
                    >
                      Editar
                    </button>
                    <button onClick={() => onDeleteNews(n.id)} className="text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "employees" && mode !== "team" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 flex items-end gap-2 flex-wrap shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="flex-1 min-w-[160px]">
              <TextInput label="Nombre del empleado" value={newEmployeeName} onChange={setNewEmployeeName} placeholder="Nombre y apellido" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <TextInput label="Email" value={newEmployeeEmail} onChange={setNewEmployeeEmail} placeholder="nombre@munozbosch.com" type="email" />
            </div>
            <button
              disabled={!newEmployeeName.trim() || !newEmployeeEmail.trim()}
              onClick={() => {
                onAddEmployee(newEmployeeName, newEmployeeEmail);
                setNewEmployeeName("");
                setNewEmployeeEmail("");
              }}
              className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 mb-1"
              style={{ backgroundColor: BRAND.red }}
            >
              Añadir
            </button>
          </div>
          <div className="text-[11px] text-gray-400 -mt-2">
            No hace falta poner contraseña aquí — cada persona crea la suya en su primer acceso, verificando este email.
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="font-bold text-sm mb-1 flex items-center gap-2">
              <FileSpreadsheet size={16} style={{ color: BRAND.blue }} />
              Importar varios de golpe desde Excel
            </div>
            <div className="text-xs text-gray-500 mb-3">
              Sube un archivo .xlsx o .csv con columnas <strong>Nombre</strong> (obligatoria), y opcionalmente{" "}
              <strong>Email</strong>, <strong>Equipo</strong> y <strong>Puesto</strong>. No hace falta contraseña — cada
              persona crea la suya en su primer acceso, verificando el email que pongas aquí. Si la columna Equipo
              nombra un grupo que no existe todavía, se crea solo. La columna Puesto, en cambio, solo empareja con un
              puesto que ya exista en Admin → Puestos (por su nombre exacto) — si no coincide con ninguno, se ignora
              sin dar error.
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                setImportFileError("");
                setImportDone(null);
                const { rows, error } = await parseEmployeeExcelFile(file);
                if (error) {
                  setImportFileError(error);
                  setImportPreviewRows(null);
                } else if (rows.length === 0) {
                  setImportFileError("No se encontró ninguna fila con nombre.");
                  setImportPreviewRows(null);
                } else {
                  setImportPreviewRows(rows);
                }
                e.target.value = "";
              }}
              className="text-sm"
            />
            {importFileError && <div className="text-xs text-red-600 mt-2">{importFileError}</div>}

            {importPreviewRows && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-gray-500 mb-2">
                  Previsualización — {importPreviewRows.length} persona{importPreviewRows.length === 1 ? "" : "s"}. Revisa
                  antes de confirmar.
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border" style={{ borderColor: "#00000018" }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b sticky top-0 bg-white" style={{ borderColor: "#00000012" }}>
                        <th className="px-2 py-1.5">Nombre</th>
                        <th className="px-2 py-1.5">Email</th>
                        <th className="px-2 py-1.5">Equipo</th>
                        <th className="px-2 py-1.5">Puesto</th>
                        <th className="px-2 py-1.5">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreviewRows.map((r, i) => {
                        const exists = employees.some((e) => e.name.trim().toLowerCase() === r.name.trim().toLowerCase());
                        const matchedPuesto = r.puesto ? puestos.find((p) => p.name.trim().toLowerCase() === r.puesto.trim().toLowerCase()) : null;
                        return (
                          <tr key={i} className="border-b last:border-0" style={{ borderColor: "#00000008" }}>
                            <td className="px-2 py-1.5 font-medium">{r.name}</td>
                            <td className="px-2 py-1.5 text-gray-500">{r.email || "—"}</td>
                            <td className="px-2 py-1.5 text-gray-500">{r.equipo || "—"}</td>
                            <td className="px-2 py-1.5 text-gray-500">
                              {!r.puesto ? "—" : matchedPuesto ? matchedPuesto.name : <span className="text-amber-700">"{r.puesto}" no coincide con ninguno</span>}
                            </td>
                            <td className="px-2 py-1.5">
                              {exists ? (
                                <span className="text-amber-700 font-semibold">Ya existe — se actualiza</span>
                              ) : (
                                <span className="text-green-700 font-semibold">Nuevo</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    disabled={importing}
                    onClick={async () => {
                      setImporting(true);
                      await onImportEmployeesBulk(importPreviewRows);
                      setImportDone(importPreviewRows);
                      setImportPreviewRows(null);
                      setImporting(false);
                    }}
                    className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 flex items-center gap-1.5"
                    style={{ backgroundColor: BRAND.red }}
                  >
                    {importing && <Loader2 size={14} className="animate-spin" />}
                    <Upload size={14} />
                    Confirmar importación
                  </button>
                  <button
                    onClick={() => setImportPreviewRows(null)}
                    className="text-sm font-semibold rounded-md px-4 py-2 border"
                    style={{ borderColor: "#00000020", color: BRAND.ink }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {importDone && (
              <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: "#DCFCE7" }}>
                <div className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Importación completada — {importDone.length} persona{importDone.length === 1 ? "" : "s"}
                </div>
                <div className="text-xs text-green-800 mt-1">
                  Ya pueden entrar con su nombre y crear su contraseña verificando el email que has importado.
                </div>
              </div>
            )}
          </div>

          {mode !== "team" && puestos.length > 0 && (
            <div style={{ ...DS.card, padding: "var(--sp-3)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                {selectedForBulk.size > 0 ? `${selectedForBulk.size} seleccionado${selectedForBulk.size === 1 ? "" : "s"}` : "Asignar puesto en masa:"}
              </span>
              <select value={bulkPuestoId} onChange={(e) => setBulkPuestoId(e.target.value)} style={{ fontSize: "var(--text-sm)", padding: "6px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                <option value="">Selecciona un puesto...</option>
                {puestos.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="__none__">— Quitar puesto —</option>
              </select>
              <button
                disabled={selectedForBulk.size === 0 || !bulkPuestoId}
                onClick={async () => {
                  await onAssignPuesto(Array.from(selectedForBulk), bulkPuestoId === "__none__" ? null : bulkPuestoId);
                  setSelectedForBulk(new Set());
                  setBulkPuestoId("");
                }}
                style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "6px 14px", color: "white", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: (selectedForBulk.size === 0 || !bulkPuestoId) ? 0.4 : 1 }}
              >
                Asignar a los seleccionados
              </button>
              {selectedForBulk.size > 0 && (
                <button onClick={() => setSelectedForBulk(new Set())} style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", border: "none", background: "none", cursor: "pointer" }}>
                  Deseleccionar todos
                </button>
              )}
            </div>
          )}

          {employees.length > 8 && (
            <input
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder={`Buscar entre ${employees.length} empleados...`}
              className="w-full text-sm rounded-md border px-3 py-2"
              style={{ borderColor: "#00000020" }}
            />
          )}

          <div className="space-y-1.5">
            {employees.length === 0 && <div className="text-sm text-gray-400">Sin empleados añadidos.</div>}
            {employees
              .filter((e) => e.name.toLowerCase().includes(employeeSearch.trim().toLowerCase()))
              .map((e) => (
                <div key={e.name} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 flex-wrap" style={{ borderColor: "#00000012" }}>
                  <div className="flex items-center gap-2 min-w-0">
                    {mode !== "team" && puestos.length > 0 && (
                      <input
                        type="checkbox"
                        checked={selectedForBulk.has(e.name)}
                        onChange={() => {
                          setSelectedForBulk((prev) => {
                            const next = new Set(prev);
                            if (next.has(e.name)) next.delete(e.name);
                            else next.add(e.name);
                            return next;
                          });
                        }}
                        style={{ flexShrink: 0 }}
                      />
                    )}
                    <Avatar name={e.name} size={30} />
                    <div className="min-w-0">
                      {mode !== "team" && (
                        <button
                          onClick={() => setViewingProfileFor(e.name)}
                          title="Ver ficha completa"
                          className="text-[10px] font-semibold flex items-center gap-0.5 mb-0.5"
                          style={{ color: "var(--info)" }}
                        >
                          <FileText size={10} /> Ver ficha
                        </button>
                      )}
                      {editingNameFor === e.name ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            value={editingNameValue}
                            onChange={(ev) => {
                              setEditingNameValue(ev.target.value);
                              setRenameError("");
                            }}
                            onKeyDown={async (ev) => {
                              if (ev.key === "Enter") {
                                const res = await onRenameEmployee(e.name, editingNameValue);
                                if (res.ok) setEditingNameFor(null);
                                else setRenameError(res.error);
                              }
                            }}
                            className="text-sm rounded-md border px-2 py-1 w-40"
                            style={{ borderColor: "#00000020" }}
                            autoFocus
                          />
                          <button
                            onClick={async () => {
                              const res = await onRenameEmployee(e.name, editingNameValue);
                              if (res.ok) setEditingNameFor(null);
                              else setRenameError(res.error);
                            }}
                            className="text-[11px] font-semibold"
                            style={{ color: BRAND.blue }}
                          >
                            Guardar
                          </button>
                          <button onClick={() => { setEditingNameFor(null); setRenameError(""); }} className="text-[11px] text-gray-400">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="text-sm font-medium truncate">{e.name}</div>
                          <button
                            onClick={() => {
                              setEditingNameFor(e.name);
                              setEditingNameValue(e.name);
                              setRenameError("");
                            }}
                            title="Cambiar nombre"
                            className="text-gray-300 hover:text-gray-500 flex-shrink-0"
                          >
                            <Settings size={11} />
                          </button>
                        </div>
                      )}
                      {renameError && editingNameFor === e.name && <div className="text-[10px] text-red-600 mt-0.5">{renameError}</div>}
                      {editingEmailFor === e.name ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <input
                            value={editingEmailValue}
                            onChange={(ev) => setEditingEmailValue(ev.target.value)}
                            placeholder="nombre@munozbosch.com"
                            className="text-xs rounded-md border px-2 py-1 w-40"
                            style={{ borderColor: "#00000020" }}
                          />
                          <button
                            onClick={() => {
                              onUpdateEmployeeEmail(e.name, editingEmailValue);
                              setEditingEmailFor(null);
                            }}
                            className="text-[11px] font-semibold"
                            style={{ color: BRAND.blue }}
                          >
                            Guardar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingEmailFor(e.name);
                            setEditingEmailValue(e.email || "");
                          }}
                          className="text-[11px] text-gray-400 hover:underline truncate block"
                        >
                          {e.email || "Sin email — añadir"} <span style={{ opacity: 0.6 }}>(editar)</span>
                        </button>
                      )}
                    </div>
                    {!e.passwordHash && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 flex-shrink-0">Sin contraseña todavía</span>}
                    {mode !== "team" && puestos.length > 0 && (
                      <select
                        value={e.puestoId || ""}
                        onChange={(ev) => onAssignPuesto([e.name], ev.target.value || null)}
                        title="Puesto asignado"
                        style={{ fontSize: 10, fontWeight: 600, borderRadius: "var(--radius-full)", padding: "2px 6px", backgroundColor: e.puestoId ? "var(--info-soft)" : "var(--bg-inset)", color: e.puestoId ? "var(--info)" : "var(--text-muted)", border: "none", flexShrink: 0 }}
                      >
                        <option value="">Sin puesto</option>
                        {puestos.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}
                    {mode !== "team" && (e.managedGroupIds || []).length > 0 && (
                      <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0" style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}>
                        Responsable de {e.managedGroupIds.length} equipo{e.managedGroupIds.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {mode !== "team" && (
                      <button
                        onClick={() => setEditingManagedGroupsFor(editingManagedGroupsFor === e.name ? null : e.name)}
                        className="text-xs font-semibold"
                        style={{ color: BRAND.blue }}
                      >
                        Responsable de…
                      </button>
                    )}
                    {e.passwordHash && (
                      <button
                        onClick={() => onResetEmployeePassword(e.name)}
                        className="text-xs font-semibold"
                        style={{ color: BRAND.blue }}
                        title="Borra su contraseña actual; en su próximo acceso deberá crear una nueva verificando su email"
                      >
                        Restablecer contraseña
                      </button>
                    )}
                    <button onClick={() => onRemoveEmployee(e.name)} className="text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {editingManagedGroupsFor === e.name && (
                    <div style={{ ...DS.card, padding: "var(--sp-3)", width: "100%", marginTop: "var(--sp-2)" }}>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--sp-2)" }}>
                        Hacer a {e.name} responsable de estos equipos (verá "Mi equipo" al entrar, y podrá subir formaciones para cualquier equipo):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {groups.length === 0 && <div className="text-xs text-gray-400">Crea grupos primero, en la pestaña Grupos.</div>}
                        {groups.map((g) => {
                          const checked = (e.managedGroupIds || []).includes(g.id);
                          return (
                            <label key={g.id} className="flex items-center gap-1.5 text-xs" style={{ cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const current = e.managedGroupIds || [];
                                  const next = checked ? current.filter((id) => id !== g.id) : [...current, g.id];
                                  onUpdateEmployeeManagedGroups(e.name, next);
                                }}
                              />
                              {g.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {viewingProfileFor && employees.find((e) => e.name === viewingProfileFor) && (
        <EmployeeProfileOverlay
          employee={employees.find((e) => e.name === viewingProfileFor)}
          groups={groups}
          puestos={puestos}
          courses={courses}
          completionsByCourse={completionsByCourse}
          onUpdate={async (name, fields) => {
            const result = await onUpdateEmployeeProfile(name, fields);
            if (result.ok && fields.name) setViewingProfileFor(fields.name.trim());
            return result;
          }}
          onAssignPuesto={onAssignPuesto}
          onToggleGroup={onToggleEmployeeGroup}
          onClose={() => setViewingProfileFor(null)}
        />
      )}

      {tab === "groups" && mode !== "team" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 flex items-end gap-2 flex-wrap shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="flex-1 min-w-[200px]">
              <TextInput label="Nombre del grupo" value={newGroupName} onChange={setNewGroupName} placeholder="Ej. Administración, Aprovisionamiento..." />
            </div>
            <button
              disabled={!newGroupName.trim()}
              onClick={() => {
                onAddGroup(newGroupName);
                setNewGroupName("");
              }}
              className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 mb-1"
              style={{ backgroundColor: BRAND.red }}
            >
              Crear grupo
            </button>
          </div>

          {groups.length === 0 && <div className="text-sm text-gray-400">No hay grupos creados todavía.</div>}

          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.id} className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-sm flex items-center gap-2">
                    <Users size={15} style={{ color: BRAND.blue }} />
                    {g.name}
                    <span className="text-[11px] font-normal text-gray-400">({(g.memberNames || []).length} personas)</span>
                  </div>
                  <button onClick={() => onDeleteGroup(g.id)} className="text-red-500 flex items-center gap-1 text-xs font-semibold">
                    <Trash2 size={13} /> Eliminar grupo
                  </button>
                </div>
                {employees.length === 0 ? (
                  <div className="text-xs text-gray-400">Añade empleados primero desde la pestaña Empleados.</div>
                ) : (
                  <>
                    {employees.length > 8 && (
                      <input
                        value={groupMemberSearch[g.id] || ""}
                        onChange={(e) => setGroupMemberSearch((prev) => ({ ...prev, [g.id]: e.target.value }))}
                        placeholder="Buscar por nombre..."
                        className="w-full text-xs rounded-md border px-2 py-1.5 mb-2"
                        style={{ borderColor: "#00000020" }}
                      />
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1">
                      {employees
                        .filter((e) => e.name.toLowerCase().includes((groupMemberSearch[g.id] || "").trim().toLowerCase()))
                        .map((e) => {
                          const isMember = (g.memberNames || []).includes(e.name);
                          return (
                            <label key={e.name} className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={isMember}
                                onChange={() => {
                                  const next = isMember ? g.memberNames.filter((n) => n !== e.name) : [...(g.memberNames || []), e.name];
                                  onUpdateGroupMembers(g.id, next);
                                }}
                              />
                              {e.name}
                            </label>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "seguimiento" && mode !== "team" && (
        <div className="space-y-3">
          {loadingTracking && (
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <Loader2 size={13} className="animate-spin" /> Actualizando datos de seguimiento...
            </div>
          )}

          <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="font-bold text-sm mb-1">Marcar manualmente</div>
            <div className="text-xs text-gray-500 mb-3">
              Útil para formaciones con Google Form externo (revisas sus respuestas tú y confirmas aquí) o para corregir cualquier registro a mano.
            </div>
            <div className="flex gap-2 flex-wrap items-end">
              <label className="block text-xs font-semibold text-gray-500 flex-1 min-w-[160px]">
                Formación
                <select value={manualCourseId} onChange={(e) => setManualCourseId(e.target.value)} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }}>
                  <option value="">Selecciona...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-500 flex-1 min-w-[160px]">
                Empleado
                <select value={manualEmployeeName} onChange={(e) => setManualEmployeeName(e.target.value)} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }}>
                  <option value="">Selecciona...</option>
                  {employees.map((e) => (
                    <option key={e.name} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={!manualCourseId || !manualEmployeeName}
                onClick={() => onManualSetStatus(manualCourseId, manualEmployeeName, "completada")}
                className="text-sm font-bold rounded-md px-3 py-2 text-white disabled:opacity-40"
                style={{ backgroundColor: BRAND.red }}
              >
                Marcar completada
              </button>
              <button
                disabled={!manualCourseId || !manualEmployeeName}
                onClick={() => onManualSetStatus(manualCourseId, manualEmployeeName, "pendiente")}
                className="text-sm font-semibold rounded-md px-3 py-2 border disabled:opacity-40"
                style={{ borderColor: "#00000020", color: BRAND.ink }}
              >
                Marcar pendiente
              </button>
            </div>
          </div>

          {paths.length > 0 && (
            <div>
              <div className="font-bold text-sm mb-2" style={{ color: "var(--text-primary)" }}>Cumplimiento por ruta de aprendizaje</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
                {pathCompletionSummary.map((p) => {
                  const percent = p.assignedCount > 0 ? Math.round((p.doneCount / p.assignedCount) * 100) : 0;
                  return (
                    <div key={p.id} style={{ ...DS.card, padding: "var(--sp-3)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <Map size={13} style={{ color: "var(--info)" }} />
                        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{p.title}</div>
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 6 }}>
                        {p.doneCount}/{p.assignedCount} personas completada la ruta entera
                      </div>
                      <div style={{ height: 6, borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-inset)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${percent}%`, backgroundColor: percent === 100 ? "var(--success)" : "var(--brand)", borderRadius: "var(--radius-full)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
            <ComplianceView employees={employees} courses={courses} groups={groups} completionsByCourse={completionsByCourse} onMarkFormReviewed={onMarkFormReviewed} puestos={puestos} checklistResponses={checklistResponses} onValidateChecklistItem={onValidateChecklistItem} myManagedGroupIds={null} onCorrectPracticalCase={onCorrectPracticalCase} onCorrectModulePracticalCase={onCorrectModulePracticalCase} />
          </div>
        </div>
      )}

      {tab === "team" && mode === "team" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--sp-2)" }}>
              Miembros de tu equipo ({teamEmployees.length})
            </div>
            <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-3)", flexWrap: "wrap" }}>
              <input
                value={teamNewMemberName}
                onChange={(e) => setTeamNewMemberName(e.target.value)}
                placeholder="Nombre de la persona a añadir a tu equipo"
                className="text-sm rounded-md border px-3 py-2"
                style={{ borderColor: "#00000020", minWidth: 260 }}
              />
              <button
                disabled={!teamNewMemberName.trim()}
                onClick={() => {
                  const name = teamNewMemberName.trim();
                  const exists = employees.some((e) => e.name.trim().toLowerCase() === name.toLowerCase());
                  if (!exists) {
                    onAddEmployee(name, "");
                  }
                  for (const gid of restrictToGroupIds) {
                    const g = groups.find((gr) => gr.id === gid);
                    if (g && !g.memberNames.includes(name)) {
                      onUpdateGroupMembers(gid, [...g.memberNames, name]);
                    }
                  }
                  setTeamNewMemberName("");
                }}
                style={{ fontSize: "var(--text-sm)", fontWeight: 600, borderRadius: "var(--radius-md)", padding: "8px 14px", color: "var(--text-inverse)", backgroundColor: "var(--brand)", border: "none", cursor: "pointer", opacity: !teamNewMemberName.trim() ? 0.4 : 1 }}
              >
                Añadir a mi equipo
              </button>
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
              Si la persona ya existe en la aplicación, se añade a tu equipo. Si es nueva, se crea sin contraseña — la creará ella misma en su primer acceso.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              {teamEmployees.length === 0 && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Todavía no tienes a nadie en tu equipo.</div>}
              {teamEmployees.map((e) => (
                <div key={e.name} style={{ ...DS.card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--sp-2) var(--sp-3)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={e.name} size={26} />
                    <div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{e.name}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{e.email || "Sin email"}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      for (const gid of restrictToGroupIds) {
                        const g = groups.find((gr) => gr.id === gid);
                        if (g) onUpdateGroupMembers(gid, g.memberNames.filter((n) => n !== e.name));
                      }
                    }}
                    style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--danger)", border: "none", background: "none", cursor: "pointer" }}
                  >
                    Quitar de mi equipo
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--sp-3)" }}>
              Cumplimiento de tu equipo
            </div>
            <ComplianceView employees={teamEmployees} courses={courses} groups={groups} completionsByCourse={completionsByCourse} onMarkFormReviewed={onMarkFormReviewed} puestos={puestos} checklistResponses={checklistResponses} onValidateChecklistItem={onValidateChecklistItem} myManagedGroupIds={restrictToGroupIds} onCorrectPracticalCase={onCorrectPracticalCase} onCorrectModulePracticalCase={onCorrectModulePracticalCase} />
          </div>
        </div>
      )}

      {tab === "reviews" && mode !== "team" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            Valoraciones y comentarios que ha dejado cada persona al completar una formación.
          </div>
          {courses.filter((c) => avgRatingByCourse[c.id]).length === 0 ? (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Todavía no hay ninguna valoración registrada.</div>
          ) : (
            courses
              .filter((c) => avgRatingByCourse[c.id])
              .map((c) => {
                const entries = Object.entries(completionsByCourse[c.id] || {}).filter(([, r]) => typeof r.rating === "number" && r.rating > 0);
                return (
                  <div key={c.id} style={{ ...DS.card, padding: "var(--sp-4)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: "var(--sp-3)", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{c.title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--warning)" }}>
                        <Star size={14} fill="var(--warning)" /> {avgRatingByCourse[c.id].avg.toFixed(1)}
                        <span style={{ fontSize: "var(--text-xs)", fontWeight: 400, color: "var(--text-muted)" }}>
                          ({avgRatingByCourse[c.id].count} valoración{avgRatingByCourse[c.id].count === 1 ? "" : "es"})
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                      {entries.map(([name, r]) => (
                        <div key={name} style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--sp-2)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Avatar name={name} size={22} />
                              <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{name}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ display: "flex", gap: 1 }}>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Star key={n} size={12} fill={r.rating >= n ? "var(--warning)" : "none"} color={r.rating >= n ? "var(--warning)" : "var(--border-strong)"} />
                                ))}
                              </div>
                              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{r.ratedAt || ""}</span>
                            </div>
                          </div>
                          {r.ratingComment && (
                            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 4, marginLeft: 30, fontStyle: "italic" }}>
                              "{r.ratingComment}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}

      {tab === "notificaciones" && mode !== "team" && (
        <div className="space-y-4">
          {loadingTracking && (
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <Loader2 size={13} className="animate-spin" /> Actualizando lista de pendientes...
            </div>
          )}

          <div className="rounded-xl border bg-white overflow-hidden shadow-sm" style={{ borderColor: "#00000012" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b" style={{ borderColor: "#00000012" }}>
                  <th className="px-3 py-2">Empleado</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Formación</th>
                  <th className="px-3 py-2">Fecha límite</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pendingReportRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                      Nadie tiene formaciones pendientes ahora mismo.
                    </td>
                  </tr>
                )}
                {pendingReportRows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: "#00000008" }}>
                    <td className="px-3 py-2 font-medium">{r.nombre}</td>
                    <td className="px-3 py-2 text-gray-500">{r.email || <span className="text-amber-600">sin email</span>}</td>
                    <td className="px-3 py-2">{r.formacion}</td>
                    <td className="px-3 py-2">{r.fechaLimite || "—"}</td>
                    <td className="px-3 py-2">
                      {r.estado === "Vencida" ? (
                        <span className="text-red-700 font-semibold">Vencida ({Math.abs(r.diasRestantes)}d)</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-3 shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="font-bold text-sm">Enviar avisos por correo (Outlook)</div>
            <div className="text-xs text-gray-500">
              Esta app no puede enviar correos por sí sola. Para avisos automáticos de verdad, la vía recomendada es un Google Apps Script con un disparador programado que lea una Hoja de cálculo y envíe los correos — pídeme el script y las instrucciones de despliegue. Mientras tanto, puedes:
            </div>
            <button
              onClick={() => downloadCsv(pendingReportRows)}
              disabled={pendingReportRows.length === 0}
              className="text-sm font-semibold rounded-md px-4 py-2 border disabled:opacity-40"
              style={{ borderColor: BRAND.red, color: BRAND.red }}
            >
              Descargar CSV para Google Sheets
            </button>

            <div className="border-t pt-3" style={{ borderColor: "#00000012" }}>
              <div className="text-xs font-semibold text-gray-500 mb-1">
                Sincronización automática (experimental)
              </div>
              <div className="text-[11px] text-gray-400 mb-2">
                Pega aquí la URL de un Google Apps Script publicado como "Aplicación web". Al pulsar "Sincronizar" el navegador intentará enviarle la lista directamente. Puede fallar por CORS (Apps Script debe devolver las cabeceras adecuadas) — si falla, usa el CSV de arriba, que siempre funciona.
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <input
                  value={sheetsUrlDraft}
                  onChange={(e) => setSheetsUrlDraft(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="flex-1 min-w-[220px] text-sm rounded-md border px-3 py-2"
                  style={{ borderColor: "#00000020" }}
                />
                <button onClick={() => onSaveSheetsUrl(sheetsUrlDraft)} className="text-xs font-semibold px-3 py-2 rounded-md border" style={{ borderColor: "#00000020", color: BRAND.ink }}>
                  Guardar URL
                </button>
                <button
                  disabled={!sheetsUrl || syncStatus === "loading"}
                  onClick={async () => {
                    setSyncStatus("loading");
                    try {
                      const res = await fetch(sheetsUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rows: pendingReportRows }),
                      });
                      setSyncStatus(res.ok ? "ok" : "error");
                    } catch {
                      setSyncStatus("error");
                    }
                  }}
                  className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40"
                  style={{ backgroundColor: BRAND.red }}
                >
                  {syncStatus === "loading" ? "Enviando..." : "Sincronizar ahora"}
                </button>
              </div>
              {syncStatus === "ok" && <div className="text-xs text-green-700 font-semibold mt-2">Enviado correctamente.</div>}
              {syncStatus === "error" && (
                <div className="text-xs text-red-600 font-semibold mt-2">
                  No se pudo enviar (puede ser un bloqueo de CORS del script de Google, o la URL/despliegue no es correcto). Usa el CSV como alternativa segura.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "backup" && mode !== "team" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="font-bold text-sm mb-1">Estado de la copia de seguridad</div>
            <div className="text-xs text-gray-500 mb-3">
              {lastBackupAt
                ? `Última copia exportada: ${new Date(lastBackupAt).toLocaleString("es-ES")}`
                : "Todavía no has exportado ninguna copia de seguridad."}
            </div>
            <div className="text-[11px] text-gray-400 rounded-md p-2.5 mb-3" style={{ backgroundColor: "#00000008" }}>
              Esto descarga un archivo a tu ordenador con todo lo que hay guardado ahora mismo. Guárdalo en SharePoint, Drive o donde tengáis vuestras copias — cuanto más lejos de este mismo sistema, mejor protegido está. El archivo incluye las contraseñas cifradas (hash) de acceso: no son legibles directamente, pero trátalo igualmente como información sensible.
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  await onExportBackup(false);
                  setExporting(false);
                }}
                className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40"
                style={{ backgroundColor: BRAND.red }}
              >
                {exporting ? "Exportando..." : "Exportar copia (rápida)"}
              </button>
              <button
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  await onExportBackup(true);
                  setExporting(false);
                }}
                className="text-sm font-semibold rounded-md px-4 py-2 border disabled:opacity-40"
                style={{ borderColor: BRAND.red, color: BRAND.red }}
              >
                {exporting ? "Exportando..." : "Exportar copia completa (con documentos adjuntos)"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="font-bold text-sm mb-1">Restaurar desde una copia</div>
            <div className="text-xs text-gray-500 mb-3">
              Sube un archivo exportado desde aquí. Esto reemplaza todos los datos actuales — formaciones, empleados, grupos, novedades y progreso — por los del archivo.
            </div>
            <input
              type="file"
              accept="application/json"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                setImportError("");
                try {
                  const text = await file.text();
                  const parsed = JSON.parse(text);
                  setImportPending(parsed);
                } catch {
                  setImportError("No se pudo leer el archivo. Comprueba que sea una copia de seguridad exportada desde aquí.");
                }
                e.target.value = "";
              }}
              className="text-sm"
            />
            {importError && <div className="text-xs text-red-600 mt-2">{importError}</div>}
            {importPending && (
              <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: "#FEE2E2" }}>
                <div className="text-sm font-semibold text-red-800 mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> ¿Restaurar esta copia?
                </div>
                <div className="text-xs text-red-700 mb-2">
                  Copia del {payloadDate(importPending)}. Esto sobrescribirá todos los datos actuales. Esta acción no se puede deshacer.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await onImportBackup(importPending);
                      setImportPending(null);
                    }}
                    className="text-xs font-bold rounded-md px-3 py-1.5 text-white"
                    style={{ backgroundColor: BRAND.red }}
                  >
                    Confirmar restauración
                  </button>
                  <button onClick={() => setImportPending(null)} className="text-xs font-semibold rounded-md px-3 py-1.5" style={{ color: BRAND.ink }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

