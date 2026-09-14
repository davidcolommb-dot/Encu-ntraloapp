import {
  ClipboardList, Users, Package, Cpu, X, Clock, CheckCircle2, BookOpen, Sparkles, Wrench,
} from "lucide-react";
import { BRAND } from "../theme/tokens";

export const CATEGORIES = [
  { id: "protocolos", label: "Protocolos", code: "P1", color: BRAND.blue, icon: ClipboardList },
  { id: "generica", label: "Formación genérica", code: "P2", color: BRAND.gold, icon: Users },
  { id: "especifica", label: "Formación específica por equipo", code: "P3", color: BRAND.red, icon: Package },
  { id: "ia", label: "IA y nuevas tecnologías", code: "P4", color: BRAND.teal, icon: Cpu },
];

export function categoryMeta(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
}

export const CHECKLIST_LEVELS = [
  { id: "no_se", label: "No lo sé", icon: X, variant: "danger" },
  { id: "en_proceso", label: "En proceso", icon: Clock, variant: "warning" },
  { id: "domina", label: "Lo domino", icon: CheckCircle2, variant: "success" },
];

export const CHECKLIST_CATEGORIES = [
  { id: "conocimiento", label: "Conocimiento", color: "var(--info)", soft: "var(--info-soft)", icon: BookOpen },
  { id: "aptitud", label: "Aptitud", color: "var(--warning)", soft: "var(--warning-soft)", icon: Sparkles },
  { id: "habilidad", label: "Habilidad", color: "var(--success)", soft: "var(--success-soft)", icon: Wrench },
];
export function checklistCategoryMeta(id) {
  return CHECKLIST_CATEGORIES.find((c) => c.id === id) || CHECKLIST_CATEGORIES[0];
}

export const EMPLOYEE_STATUS = [
  { id: "activo", label: "Activo", color: "var(--success)" },
  { id: "baja_temporal", label: "De baja temporal", color: "var(--warning)" },
];
