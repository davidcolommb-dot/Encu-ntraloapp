import { daysUntil } from "./dates";

export function isCourseExpired(course, record) {
  if (!course?.validityMonths || !record?.completedAt) return false;
  const completedDate = new Date(record.completedAt);
  if (isNaN(completedDate.getTime())) return false;
  const expiryDate = new Date(completedDate);
  expiryDate.setMonth(expiryDate.getMonth() + course.validityMonths);
  return new Date() > expiryDate;
}

// Una formación queda "a la espera de valoración" (el paso final antes de
// "completada") solo cuando se cumplen TODAS sus condiciones: el test/form
// correspondiente, Y el caso práctico si la formación tiene uno configurado.
// Corregir el caso práctico es aparte — no hace falta esperar a que un
// admin lo corrija para que la persona termine su formación.
export function computeAwaitingRating(course, rec) {
  const quizOk = !!rec?.quizPassed;
  const caseOk = !course?.practicalCase || !!rec?.practicalCaseAnswer;
  return quizOk && caseOk;
}

// Un módulo se da por aprobado solo cuando se cumple TODO lo que tenga
// configurado: su propio test, las formaciones marcadas como "requisito"
// (completadas de verdad, no solo empezadas), su caso práctico si tiene uno,
// y su checklist rápido de pasos si lo tiene.
export function isModulePassed(moduleObj, quizPassed, employeeName, completionsByCourse, moduleProgressEntry) {
  if (!quizPassed) return false;
  const requiredCourses = (moduleObj.relatedCourses || []).filter((rc) => rc.mode === "requisito");
  const requiredCoursesOk = requiredCourses.every((rc) => completionsByCourse[rc.courseId]?.[employeeName]?.status === "completada");
  const caseOk = !moduleObj.practicalCase || !!moduleProgressEntry?.practicalCaseAnswer;
  const steps = moduleObj.checklistSteps || [];
  const checklistOk = steps.length === 0 || steps.every((s) => !!moduleProgressEntry?.checklistChecked?.[s.id]);
  return requiredCoursesOk && caseOk && checklistOk;
}

// Un checklist de puesto está "completo" cuando la persona ha puesto algún
// nivel a CADA ítem — no hace falta que todo sea "lo domino", solo que se
// haya autoevaluado en todos, sin dejarse ninguno sin mirar.
export function isChecklistComplete(puesto, responseEntry) {
  if (!puesto || !puesto.checklistItems || puesto.checklistItems.length === 0) return true;
  const responses = responseEntry?.responses || {};
  return puesto.checklistItems.every((item) => !!responses[item.id]?.level);
}

// Una ruta cuenta como "completada del todo" cuando cada formación que la
// forma está, ella misma, en estado "completada" para esa persona — usa
// getStatus, así que la caducidad/recertificación ya queda contemplada sin
// tener que repetir esa lógica aquí.
export function isPathFullyCompleted(path, courses, userName, getStatus) {
  const pathCourses = path.courseIds.map((id) => courses.find((c) => c.id === id)).filter(Boolean);
  if (pathCourses.length === 0) return false;
  return pathCourses.every((c) => getStatus(userName, c.id) === "completada");
}

// El plazo de un checklist es relativo a cuándo se le asignó el puesto a esa
// persona en concreto (no una fecha fija para todos, porque cada quien puede
// empezar en un momento distinto) — solo aplica si el puesto tiene definidos
// días de plazo.
export function getChecklistDeadlineInfo(employee, puesto, responseEntry) {
  if (!puesto || !puesto.deadlineDays || !employee.puestoAssignedAt) return { hasDeadline: false, daysLeft: null, overdue: false };
  const complete = isChecklistComplete(puesto, responseEntry);
  const assigned = new Date(employee.puestoAssignedAt + "T00:00:00Z");
  const deadlineDate = new Date(assigned);
  deadlineDate.setDate(deadlineDate.getDate() + puesto.deadlineDays);
  const daysLeft = Math.ceil((deadlineDate - new Date()) / 86400000);
  return { hasDeadline: true, daysLeft, overdue: !complete && daysLeft < 0, complete };
}

export function isAssignedToUser(course, userName, groups) {
  // Una formación archivada no le llega a nadie, aunque en teoría le tocara
  // por su asignación — archivar la quita de en medio sin borrar nada.
  if (course.archived) return false;
  return isAssignedIgnoringArchived(course, userName, groups);
}

// Igual que isAssignedToUser, pero sin el filtro de archivado — pensada
// exclusivamente para calcular lo que alguien YA ganó (puntos, insignias).
// Archivar una formación es para despejar el catálogo, nunca para quitarle a
// nadie algo que ya se había ganado por completarla.
export function isAssignedIgnoringArchived(course, userName, groups) {
  const a = course.assignment;
  if (!a) return true;
  // Nombres añadidos automáticamente (p. ej. por la ruta de bienvenida al dar de
  // alta a alguien nuevo) cuentan siempre, sin importar el modo de asignación —
  // así no hace falta tocar "todos/grupos/personas" para que esto funcione.
  if ((a.extraNames || []).includes(userName)) return true;
  if (a.mode === "todos") return true;
  if (a.mode === "individual") return (a.employeeNames || []).includes(userName);
  if (a.mode === "grupos") {
    const userGroupIds = groups.filter((g) => (g.memberNames || []).includes(userName)).map((g) => g.id);
    return (a.groupIds || []).some((gid) => userGroupIds.includes(gid));
  }
  return true;
}

// Cumplimiento de cada persona: cuántas formaciones tiene asignadas, cuántas
// completó de verdad (teniendo en cuenta la caducidad — si una formación
// caducó, deja de contar como completada), y cuántas tiene vencidas ahora
// mismo. Es la base tanto del panel de Admin como del de "Mi equipo".
export function computeEmployeeCompliance(employees, courses, groups, completionsByCourse) {
  return employees.map((emp) => {
    let totalAssigned = 0, completed = 0, overdueCount = 0, needsFormReview = 0, needsCaseReview = 0;
    const courseDetails = [];
    for (const c of courses) {
      if (!isAssignedToUser(c, emp.name, groups)) continue;
      totalAssigned++;
      const rec = completionsByCourse[c.id]?.[emp.name];
      const rawDone = rec?.status === "completada";
      const expired = rawDone && isCourseExpired(c, rec);
      const done = rawDone && !expired;
      const overdue = !done && c.deadline && daysUntil(c.deadline) < 0;
      // Un Google Form completado es siempre "autodeclarado" — la app nunca ve
      // las respuestas, así que se marca para revisión manual hasta que
      // alguien con permiso lo compruebe por fuera y lo confirme aquí.
      const pendingFormReview = done && c.testMode === "googleform" && !rec?.formReviewed;
      // El caso práctico puede estar "enviado" incluso antes de que la
      // formación entera cuente como completada (o justo al mismo tiempo) —
      // se marca para corregir en cuanto llega, sin esperar a nada más.
      const courseCaseReview = !!c.practicalCase && rec?.practicalCaseAnswer?.status === "enviado";
      // Lo mismo, pero con los casos prácticos que puede tener cada módulo
      // por separado — antes no se contaban en absoluto.
      const modulePendingCases = (c.modules || [])
        .filter((m) => m.practicalCase && rec?.moduleProgress?.[m.id]?.practicalCaseAnswer?.status === "enviado")
        .map((m) => ({ moduleId: m.id, moduleTitle: m.title }));
      const pendingCaseReview = courseCaseReview || modulePendingCases.length > 0;
      if (done) completed++;
      if (overdue) overdueCount++;
      if (pendingFormReview) needsFormReview++;
      if (pendingCaseReview) needsCaseReview += (courseCaseReview ? 1 : 0) + modulePendingCases.length;
      courseDetails.push({ course: c, record: rec, done, overdue, expired, pendingFormReview, pendingCaseReview, courseCaseReview, modulePendingCases });
    }
    const percent = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 100;
    return { employee: emp, totalAssigned, completed, overdueCount, needsFormReview, needsCaseReview, percent, courseDetails };
  });
}

export function sortByUrgency(list) {
  return [...list].sort((a, b) => {
    const da = a.deadline ? daysUntil(a.deadline) : 9999;
    const db = b.deadline ? daysUntil(b.deadline) : 9999;
    return da - db;
  });
}
