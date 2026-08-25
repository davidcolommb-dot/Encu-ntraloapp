import { useState, useEffect, useMemo } from "react";
import {
  ClipboardList, Users, Package, Cpu, CheckCircle2, Clock, AlertTriangle,
  Plus, Trash2, X, PlayCircle, FileText, Newspaper, ChevronLeft, ChevronDown, ChevronUp,
  ShieldCheck, LayoutGrid, Home, Settings, Loader2, LogOut, Lock, KeyRound,
  Trophy, Award, Star, PartyPopper
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Credenciales de Supabase: se leen de variables de entorno (ver .env.example).
// Nunca pongas aquí la "service_role key" — solo la "anon public key",
// que está pensada para vivir en el navegador.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BRAND = {
  red: "#8B1E1E",
  redDark: "#6E1717",
  gold: "#C9A227",
  blue: "#3E7C96",
  teal: "#2E5F5A",
  cream: "#FAF7F2",
  ink: "#2B2420",
};

const AVATAR_PALETTE = [BRAND.red, BRAND.blue, BRAND.gold, BRAND.teal, "#7A5C3E", "#5B6B79"];

// Límite de archivo adjunto: ~3.5MB en crudo para que, tras la codificación base64
// (+33% de tamaño), el elemento guardado no supere el límite de 5MB por clave.
const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024;

const CATEGORIES = [
  { id: "protocolos", label: "Protocolos", code: "P1", color: BRAND.blue, icon: ClipboardList },
  { id: "generica", label: "Formación genérica", code: "P2", color: BRAND.gold, icon: Users },
  { id: "especifica", label: "Formación específica por equipo", code: "P3", color: BRAND.red, icon: Package },
  { id: "ia", label: "IA y nuevas tecnologías", code: "P4", color: BRAND.teal, icon: Cpu },
];

function categoryMeta(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T23:59:59");
  const now = new Date();
  return Math.ceil((target - now) / 86400000);
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

function avatarColor(name) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

function getVideoEmbedUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return `https://player.vimeo.com/video/${id}`;
    }
    if (u.hostname.includes("drive.google.com")) {
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
      const id = u.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
    return url;
  } catch {
    return url;
  }
}

function isAssignedToUser(course, userName, groups) {
  const a = course.assignment;
  if (!a || a.mode === "todos") return true;
  if (a.mode === "individual") return (a.employeeNames || []).includes(userName);
  if (a.mode === "grupos") {
    const userGroupIds = groups.filter((g) => (g.memberNames || []).includes(userName)).map((g) => g.id);
    return (a.groupIds || []).some((gid) => userGroupIds.includes(gid));
  }
  return true;
}

const LEVELS = [
  { min: 0, name: "Iniciando", color: "#6B655D" },
  { min: 200, name: "En marcha", color: "#3E7C96" },
  { min: 500, name: "Consolidado", color: "#C9A227" },
  { min: 1000, name: "Experto", color: "#8B1E1E" },
];

function levelForPoints(points) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (points >= lvl.min) current = lvl;
  }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  return { ...current, tier: idx + 1, totalTiers: LEVELS.length, nextMin: next ? next.min : null };
}

function getFormEmbedUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("docs.google.com") && u.pathname.includes("/forms/")) {
      if (!u.searchParams.has("embedded")) u.searchParams.set("embedded", "true");
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

const SEED_COURSES = [
  {
    id: uid(),
    title: "[Ejemplo] Seguridad básica en el almacén",
    category: "protocolos",
    description:
      "Formación de ejemplo sobre hábitos básicos de seguridad en el almacén: manipulación de cargas, orden y limpieza, EPIs y qué hacer ante un incidente. Sustituye el vídeo por el vuestro real cuando queráis, o dejad este como referencia de formato.",
    videoUrl: "https://www.youtube.com/watch?v=ySXc8tbw8VA",
    presentationUrl: "",
    deadline: daysFromNow(3),
    testMode: "interno",
    passPct: 70,
    attachments: [{ name: "Seguridad básica en el almacén.pdf", mimeType: "application/pdf", sizeKB: 5.4, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgMTAgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRXh0R1N0YXRlIDw8Ci9nUkxzMCA8PAovY2EgLjEyCj4+IC9nUkxzMSA8PAovY2EgMQo+Pgo+PiAvRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNiAwIG9iago8PAovQ29udGVudHMgMTEgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRXh0R1N0YXRlIDw8Ci9nUkxzMCA8PAovY2EgLjEyCj4+IC9nUkxzMSA8PAovY2EgMQo+Pgo+PiAvRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNyAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDkgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9BdXRob3IgKFwoYW5vbnltb3VzXCkpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAoXCh1bnNwZWNpZmllZFwpKSAvVGl0bGUgKFNlZ3VyaWRhZCBiXDM0MXNpY2EgZW4gZWwgYWxtYWNcMzUxbikgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago5IDAgb2JqCjw8Ci9Db3VudCAyIC9LaWRzIFsgNSAwIFIgNiAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjEwIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDI1NzEKPj4Kc3RyZWFtCkdiISNdOWxvJ3QoPlxqaEAmXDVeUUpcRkJDSyV1Q2heIVZmaW4nR1MmLiRKS09HIVtzQz8vYVpFcmYxNSt1czNRL05mVW0oNVwqMUs2LEAlSjBQaWgtWl02RlJeJksnZm9RL2k9OzgqckhQV0dEYiY2K0FsZUFJOT0kYC1haU5jaVcnSjhsdFoyWlpIV3M1LFEsUl1KMm4kP1JAYC8/MFozQVppU3MpOF5LZDR1NlswdTpuXjUxKHQrV0ZKMEksMDRIL0FOcSEmN1hcQkEqb3RMaCk2cFtXT3Usc1VHJEQ8K3FzSClZLFE1UTBlbEZvO10vWDAlVD1Ub2Q1RiNxRT9HMGdXTzZsUnEwPzRFWD9zLzBRblE3X284SyteMl9jXGhdcCcyP3FvWlE4WUw7Yj5IWjZXJ0QnXUJZJThYJzQxWylmTFkoMV1pRy1lWCM/PDNTPWlaNyUxSHApNzojKC1pWCJfb2NJaTMxL2FUS2VKJCU6UjQ3W2lNLkB0cFFfLyVANkw6SCMjOm1WVzE7U2djcGtLSmtYc1VXJ1ZCb2srNCRVQSsmRnJTKz1ZO2E3NipkQ1x0aF8ySSldPSNsc2wlS2xxOGNDJDlca0pvJTxKTXAvLnRTVUluanUnbEIuN0podSg2PVlYNzU+aGdXLmUvW2wwcTEuSUQqNy5kT0dfZGQ8cHBiLEdIVFpeVW1zLUZDaVk8c2lpdT5cXD9tJktQOylrbDBOJlJsR29eW1BAQmRkLzREcVI5RTxYJkxDRFNBND9wXEQwWCVYLm4sOG1KPSokaFp0LnA4T2gmUiZXKyFbIV1hZ2FuIjNcMCxdPyZrME1pXG1sN0JEOiljVF9FSW48TUBwQjo+OGQ+dGVaWU4lImFWckYya2AhPWNLTStUTVxRLSgsMnUxIUFnYTBcKjFUU2xjPiEqP048aVM9MEdJRVgrM3BAU21uV0klM20rXEhTQGdaTmQkbEAvLWJmb1VtWD07L0g8SD0iV190dUhKWyxHJWNmTHFvREtSLjM2UlJoT2NUIkMiJVVGYE5cNU8yVVxMb1hTLFMzOlEnIipTTmNjSVNPbjNUZkw8TldCQS9DRFdHJUFMQWEjYCRmP08pQHEnTS1QVTZTOSRuSkBYak8kLiEiTWpDL208LmpjbVcuKk4oMzhdVUdgWmNUYEFsViEzYDlrci0ucWhJdVlqWyxpOz9IZFhxKGRQJzRhRFAhMGFvSiY9dTImUF41NC1kQlh1PjxBTEdtSHUuMklOLio0VVVkZ01CL2h0aFxtWk9sRmhmXE85MDxtdFBcLlw6NkEoPWFTUyMzIyZnXzhDPjFvQFpSQlo9Ij5XLlRYa2BXcmhiJGpePXEoK0xBKEFXQUMrPlJGa1xccDMoUmAmQjhDPnAnR1cpYVlPTThKbG5oZVVaRWllZ09pOm1Sb0QkOV5RXnI+My9JLXEpNzsvczEjKzNwJ00hbUllJzVmZmNlOmFmVTpDWztnVVE4dCc/aS09ZnUmV0R0NEFYJENSMD9GcltYSGJTaFZwaSM1XlVrXUhwU0lmdFUvMXFaXEg1Y01NPGZvUXBfZ1I0b1xxKTNZJEcoJihER0xyQ0w9TWpNSEpKZWJRPycrcjJKITFgR2M8ISJWYj9mYC4hIUk4VldrUmxZLj5QPFlYaXM1PVwsVSU8JTllYGxMXzRdci9hcFcwXz8+IjY5dXU2LjdiYSdQJTJOaWQjWVxrXi9KJyY/TCIxdCRoKHJhNE5aU29NVi4xMlJDc11vKzVZXDRYZlpaITBWMyFtb09kb0EzazQ3dE5CVDFaVzpBZmJfXXBnWSNRdWY8MVdYbW1yISRoYW8/ST1DRUpqO1RXYGJPKTY4PjhMNWRZJGw9XT4tTlduLGw7aWojaGxccWFyOz9hdFgiWTd1TiRjXFsyLmFBU0ZULVE5W2I9IU9dZUQ0Z3AjQltyRjhoVj4oa04yXidHTVVncEhNKDhMSDJLL1NRSXVocThzNUAlbGIxTCYncEBTSDdJJmttaXBFQ1NBJiElY2VMTl1GLlZvKFhfUishYiM9PSpzPUpURSNESk1VM3BCbkRtS1pMRD1IbWYsZGA5aUVTXyxtUlFUQWlNbSZANUllX1FlKEQxJFdhblgkRk5hPTFrJWVia0E5TUNuM0lTJ1xeNDBUXmtxbGtbK0FedC0jbTY2IVdIUTdcaThPJzRQR2c8Lm5oVzZQOSQ1YzU2Z1ZuVmAuXmdyNWFcWjwrPUZpSm5DWmk5PTo6MzljQVw7P1dOXjRdWVQyRVs8PG0rI1UrOmdRWj1DIS1WS1tdWE9Lczk8RURrblYrSCgoQHNxdFAiUlJCTTE0KEssUUA8YjhVXS5UM1Q9YS4oVm9SSVpJTzpgMGAmUSkkP2ZXSSstIj5Mb0NdcHJHWUtoMltDY1c3dC4pLEZPLHVhbzlKR0t1RFU/STpzKElhW0JtWGwybCwsXlAwRkNZRGM6UiI+XTZBPDs4Wic8OHQ9cyFTXD1eMDVkMDYnUElWIjVMSiJePSdiKmxsSWJBSD1lJGtkcmpiN0klZGo0PzFGJ2FEZy50ODIqJGZLaVA3TCUqLCdzZTJXVTEmZ2ddOlY/Ii1JPzVTM2ZKQSlbXmZWdSE6RUZQLl40Nk5WWVU9USldWkorVUNvIzU+MCo2aCU0MVcvSiZVTUdbUiVJazlTRy5UMTUyYnBdOyd1ayVQa1pqISlpdWopPlRVTSQ7ImVBYGBCJUp1Vmg3XTZnPVNPUEZuWDdra0ZpMGUtJVAkbFQuWzFPP0Ywbi5zIiVSUzMhVCpKYyNBbDtKRytwQWs9Kk5lW15AU00haTBtRU89azUicllRcW0/ajMsYzpDLi1WPmpGZTFdPCJxIURlYDIxb29BJmkkPSY3bVNgYTddRGpqTV5yM182PXEzUEYkKENtSiNcK0JqRk8lKE85cSVVPG9vVFVFWHRhIiYjIVhnMl08V2pES0JKYEM5ck4mc3AnQW1PO3JIbSI8cGBTJEpSKyxxbUc/M1stal09biRKRiZpLEA0XkxfcEhucUBCP10xUlc/WUk3cS8yY1dUOCleSVY9WlA7SGg3XTgvbDAmb0dBUktocENTZExGWGxpdUhsRnVAZS0pZyc5cCokNVAkZEBlcFtASD9mNnJVWklWTGpBJjI/aF9lXWliNVpIWCVHWTxfWVIwQV9vV3QoVi1VUCIsNFIyTTJrVWc5S0g5ZipHVzNdMTFmOVFXWko+NzhOOy5XRl1cUD85bTQ8OU9NdS82a2ZTIVNSUlVWLTw5XF41K185aFRgLFYqaTRzT2cmT3BAbl5nZz5QR11pQkxSZ0cucnFZbHNlck5yQzBacE5ea3E1X1pJQEZMMGxePz5VcytGW01TSF0sIU1vOlZwQkduV2xFKWlVMydHbV9tL01YMW5cLjc6S1J+PmVuZHN0cmVhbQplbmRvYmoKMTEgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggOTUyCj4+CnN0cmVhbQpHYiEjWT51MDMvJ1JmR1JcRGpKVD8mNF1zOGJOPyU5TUEsMD8rNmBHUispaEZgIiR0LTJMYlYtbz9qRjNbUmUnKFdqUVU9cUhUWTZtUFAiZTVHXCwiJEBvSC9TNlFVSiFBJi8/NnNeIz4ubF5tMipbVnFmVzFQRXAmSkREdWhNdTIoOyZHZ1ZlNFVFWlZeXzpqUW5pJlciUGIlb11TTkItYTFyN0FmU3BhMTFEZV07YD8nL0BCbnFES1VlP1YkTy81LTcrQHMuIUBNKzYoIVJrdVsuVihxM18zcWFiKk5UO1hfZUdaX3BhSnA7b0RBXEFtcFVNPnIlKCkmZF9sW2ljXk0mU0xocm1IJi5IRlluXFRcbyRiQD47MzpeYFIsOilSM0hqaThnI1RfLjI3MCJUTDMrX05EZG8wNlFXImhqZ2FnSm9LSGYwXDxfZGokSz1NYitFKWBfOkchdWUhaGNpXyU6N25OWGBTaTYpMU9lbWg6JDNORVYmc3R0YSVIUU1HXmRCXUhqQDI3Q0hqNEErLDlZSChYXm9HMid1Nk5DOy1JMT1BYmYlUTVVWzEoJ1k7KGlaai9mMENpaiEkRGAiajdtb2VUNSghIydMXEM1ciNYTW5AbmA8PCFKZVlfOG02cXAjUD1qQSouRjpSOy08bm9bI1tSbiU5V00vN3EhKmpPNHMwTnFEaiZBK24vP1omYilyKC0qbTFIVjFbSWhNPHBUaVxIaEpYYFlGJ2dYUl10cS1gcUYjOUdCc0EwU2UmcChKVVBYSiM8TEAqOSRzJys5b0Y+c00kZGwmRDRcKChPKz1uTWdlLyFhalhOakhkUVRiMytWUWo8KkAycTcoVGIuOVk3W101Silla2g2N0xIY1Q+N2htW0ZhS1c9RWkyYEQiXlJmdVYoYnBsKD82b29tcEJYU25SXl8hJ1JvXzYoSF1xND9Pa3RfImIvTiNtbk5ca0k9aU9uTzFCX2kqSFwpPTdiJSZzZkdcTipOLCdsPT5qRSFhYDMuZTJHPUgnMGA3WEM4MWNEMjs5ZSJrVVQ7byJuTD03ZiY+ZypbJzFxTGZVSzA8aCxtNnUkTGVoWnE2RjpeQztlcy5RLWY7IjRpYDomWVc1c2ZNT0xLZzIwZyhmbClgQkBSRDNzLiElOyZWMEApT2RQbE1qZSdARGt1TkNJZCgvRT5BOytgNHRqWiw7LmBdVkBFMSdjT0VcXmcrSkNfTFpbOTMrSUdYREtrRGgxZVBNdFhhPEE9NFZbZG1eUH4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTIKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMTIgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzMxIDAwMDAwIG4gCjAwMDAwMDA0MTQgMDAwMDAgbiAKMDAwMDAwMDY3NSAwMDAwMCBuIAowMDAwMDAwOTM2IDAwMDAwIG4gCjAwMDAwMDEwMDQgMDAwMDAgbiAKMDAwMDAwMTMwNyAwMDAwMCBuIAowMDAwMDAxMzcyIDAwMDAwIG4gCjAwMDAwMDQwMzUgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8OTYwNmFhMDc2ZmY2OGZjMDcxOGRiYWQzYzBiNTgyYTE+PDk2MDZhYTA3NmZmNjhmYzA3MThkYmFkM2MwYjU4MmExPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA4IDAgUgovUm9vdCA3IDAgUgovU2l6ZSAxMgo+PgpzdGFydHhyZWYKNTA3OAolJUVPRgo=" }],
    quiz: [
      {
        question: "¿Cuál es la forma correcta de levantar una caja pesada del suelo?",
        options: ["Doblando solo la espalda", "Doblando las rodillas y manteniendo la espalda recta", "Girando el tronco mientras la levantas", "De un tirón rápido, cuanto antes mejor"],
        correct: 1,
      },
      {
        question: "Si detectas un derrame o un obstáculo en un pasillo, ¿qué debes hacer primero?",
        options: ["Pasar con cuidado y seguir tu tarea", "Esperar a que otra persona lo vea", "Señalizarlo y avisar para que se retire antes de que alguien tropiece", "Ignorarlo si no es tu zona"],
        correct: 2,
      },
      {
        question: "¿Por qué es importante mantener el orden y la limpieza en el almacén?",
        options: ["Solo por estética", "Porque reduce accidentes y mejora la eficiencia del trabajo", "No tiene relación con la seguridad", "Solo importa el día de una auditoría"],
        correct: 1,
      },
      {
        question: "¿Qué debes hacer si sufres o presencias un accidente laboral, por pequeño que sea?",
        options: ["Solo avisar si hay sangre visible", "Esperar a ver si empeora antes de avisar", "No decir nada si no duele mucho", "Comunicarlo siempre a tu responsable, aunque parezca leve"],
        correct: 3,
      },
      {
        question: "¿Qué equipo de protección individual (EPI) es habitual en zonas con circulación de carretillas?",
        options: ["Calzado de seguridad y chaleco de alta visibilidad", "Ninguno si conoces bien el almacén", "Solo guantes, el resto es opcional", "Gafas de sol"],
        correct: 0,
      },
      {
        question: "Antes de mover una carga pesada, ¿qué deberías evaluar?",
        options: ["Nada, cuanto antes se mueva mejor", "El peso y si necesitas ayuda o un equipo mecánico", "Solo el color de la etiqueta", "Si hay alguien mirando"],
        correct: 1,
      },
    ],
  },
  {
    id: uid(),
    title: "[Ejemplo] Bienvenida y funcionamiento del Aula Virtual",
    category: "generica",
    description:
      "Formación de ejemplo pensada para la incorporación de cualquier persona nueva al equipo: qué es el Aula Virtual, cómo se usa, y qué se espera de cada formación. Plantilla lista para adaptar con vuestro contenido real de bienvenida.",
    videoUrl: "",
    presentationUrl: "",
    deadline: "",
    testMode: "interno",
    passPct: 70,
    attachments: [{ name: "Bienvenida al Aula Virtual.pdf", mimeType: "application/pdf", sizeKB: 3.6, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgOSAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCA4IDAgUiAvUmVzb3VyY2VzIDw8Ci9FeHRHU3RhdGUgPDwKL2dSTHMwIDw8Ci9jYSAuMTIKPj4gL2dSTHMxIDw8Ci9jYSAxCj4+Cj4+IC9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgOCAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0F1dGhvciAoXChhbm9ueW1vdXNcKSkgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MDgyNDEyMTgzMiswMCcwMCcpIC9DcmVhdG9yIChcKHVuc3BlY2lmaWVkXCkpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MDgyNDEyMTgzMiswMCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0IChcKHVuc3BlY2lmaWVkXCkpIC9UaXRsZSAoQmllbnZlbmlkYSBhbCBBdWxhIFZpcnR1YWwpIC9UcmFwcGVkIC9GYWxzZQo+PgplbmRvYmoKOCAwIG9iago8PAovQ291bnQgMSAvS2lkcyBbIDUgMCBSIF0gL1R5cGUgL1BhZ2VzCj4+CmVuZG9iago5IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDIwODYKPj4Kc3RyZWFtCkdiISNcPyQiSVMnUmZHUlw7dT1tYHEkVGEhdTtfc2ZVMmRdVCg4VTpDOSE6R1xbKCVebyc/JFQzRCNEXVRrO0Q2TEN1UFI1KiFvTzNxbDZ1Nk1xTXJaWUc8UT8tcW51SmpgIUM9IVdxT1RvMVNyaVNycWwsWTQrVS8uMmY8YUttLiE1TWI+O1RROl5DNXVIUWc+LEZUTVZccygsJ09BQzcjbmcqSStaZFZmalNWRVQwXVMyOmclJDlJbCxyKm1wb0BONjkhXVdqVUphb2YiRUJTTiktbyhAcVRnalIxTFlkXTQ1M2NlMWxKWjBoQD9yaCs1NkM/WEMnPm4lOi1WbzRCPlBlQUolRGRBIkNzKjZuR14tLFc8NV5gSV8xaVo9byg8Y19EVkJkZmAmbisqZ15PRUNyTTRWYnJrNCV0OTxMKy81RFYlOG4+VjYqS2NoajkhUGc9S2FpXV9VQkxsL2onWiUvMiJiOjUsKnVvXyM3YSllWl45bHFaYCkiJmxja2YwX0BtJClIZ2MuKUIyai4xUSwyakY8cmptXUVLQmElcmRbcEUzZDVFPlxvUU1aNkczLzQ6MDE5Y1I7TjEtJCQ5QUBgJDMyK102PkhMcUYnamhlP1ppUGdPUERaOUF1bDZUQ2lbJz8yW09xMSdcMjNWIzZVPl1NbDdxI2gjJFc/Zk9UQmM1Pyg7OGplPVFFQ0VqQmFbTTNZI2tDM182O3IpPHVZQkw6UDZzOC9eVDgzaSY5ZDZHcDtzNDFDczcyIXU6bVNUXjc/Qmo3O3MpKDJxUl1rPikhMisxQHF1XWVHQjlhRkcwckstQzdgPS1ibydLO1tGSGUybEA9YjJWIy82SD8scylIQDlCZ2YldS9XUzlfSnAnZmhuZm9gT2BDK2VcTD46bz1ZWENEN1xacWJhIVRKKUsjPl1GO1E7aSI9V2I7WE4pK0VkYT5UcDQ8J04qZEgmLjZuaU9vLjUoPSVuTyJjMmpecDVVV09NP0xAcW90LzxAPUNZXHArJ3A8JShbKTlddWFyQV5XMjx1US9VMCokOVciWHFoTTFZNlwwNzM1bF8xak9KYmduOjxhUTdBUDU9UWZBNTRjTFg7Kl1FZkFjU0hWJSVwJipTJ2ozT0BNbXJQVClAdGZzWWUpZmFCNnNYN0RVNzgmM0p1NkBpJ2hyZ2dUWHM8LUM9PjMqN25UPF44SDQ6WSltRnFrLjYrMG9oWzp1Zi9uNyxEbGFLOltDbDdbOitaXDtXLnRwZEQ1M080QEYyYGhTNDpnMjV1NytBUkYuUlw4IyYtYWwyRzZkZyolUW1XOTo2aVdLZzRWRHQwPHNmPmFLLj5kXzVCR1xdMjchUFc+YSNQUHRfS1chM1IsPFVzRzdYMlMkRTkmTkxuYT0tbmpWbzk8LGw+bHFBIiI/PWRLaTtxUjtZYUFOJlY8LiVbQnUrUzNoWG80Plo3XSE8IkE+YVtsQm5cJlxuZzpqNFZPPzwlMVZaZTJNPSpQU19CRjQpITozbyMnPzxRaDhXQSlPVWMvOWJkZEl0OT5iLjkpKUVkO21BK2EoPFYqW1N1dE1FMDtELyg9PT5ZK25DODo0YGRkXldAZFEmTm1pQU1YOEddZFlKJEYsO24vQFQlJzheSGwxblsuY1xUYU9ObEEjcyRcSSZpJCQ3T3RIRT9kLl1CYWYuODpxP1hWc0JYOCFER0RsM1cvQU08b1hnQCpISGp0OkhcbCNPcmsnTl1GNE1IN1tfYVUlTE9DaENiTWRIISNYUDVoI1wtIzglbV9MPSVQTSkkYFcqW1heTl5OLkNQQy1qZyFDImxzNU9TTi1WdC4xSlRnS24+TFk7ZUtiKnRXOyMkYTl0PEFPSnMqUEBcUiRKbFkjQ2RrWz9uJWZQLEk9MUdoKF90L1VwczQoTztvPzQudXE9b0RgZ1FnT0U9TT47K25OaCglTDpKQF8/LmJgImBbV2JZMGBYLnFzVCptYkdaY1g3YysqPXBib2AqZkAjYGdtSG5ZWU5SQGMlTGVIcT1AMz1SdDFLN1hJbCJIT0FuN01hYDVQQCo/OE1BbktabU0rWy1GOmloUG8sPVdFPV07UylnS0dtISYjPiZnZjNCJ1plSlg/Mmw1SyplMiExNl1sKTMialByYm1jcGZhUT5GLkYuZGo/NkpVbnBTcl5XN2kmYHFqSGRWT2U+YTMvTmBtYjs+ODFAKk0kU2pGLUhMXkFxKFhmJkxRWj5aUFQ1cVRCSSRMY2MtcHA1cVdqMUwlWCkkKCRsUGYtayNbUzNsTHVJWyJoZFlfaCIva1Q2SSIia1ZkVyZESzNcWVwxMWBSVzhTZXNYUkVkRig9VycqLGZhTDVBJVBJYWQmM1ReayY4NnFHPEZPWSovaldASzBWZk0hPF9xcyksalZjMSNRK1VCZi5eIyMrXllHY3AhYERrJyhpJj0tPmdFKV9sIzZMNzM+ZGlyVDIjSDhySEIhOGpya2A+PG11OW0sMkUqQ1xGbyVTVSJyMXJoLWdmTT0lNWMnWm4uJi1taDY/c0AkamEjLk04TDpnNz9yRUNWJDMvNVpXKSsqMkBzSkkoQylzakNPPGxZJy1pOWs6XzsrRFBVT1giWmFsSGcqXTxpJzBpclktPFlXW0NXaitoUUZAVWgrXjxmNWA9QiNHWTl0PkpsMzxFaHI2KCJaMURaYShsSjMjWFRvKXUhKWo5bTJFZUNXW1guVWheITA+ayM0IXBLZyJecW9ucXNqU1hkWypoc1pmYmdFZGBJIS5lMF46fj5lbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCAxMAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjE5IDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMDQxNCAwMDAwMCBuIAowMDAwMDAwNjc0IDAwMDAwIG4gCjAwMDAwMDA3NDIgMDAwMDAgbiAKMDAwMDAwMTAzNSAwMDAwMCBuIAowMDAwMDAxMDk0IDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPGU4N2NkMjI1Y2ZmYjcwNzBjYmU3NmZkMjg4NDgzYTMyPjxlODdjZDIyNWNmZmI3MDcwY2JlNzZmZDI4ODQ4M2EzMj5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gNyAwIFIKL1Jvb3QgNiAwIFIKL1NpemUgMTAKPj4Kc3RhcnR4cmVmCjMyNzEKJSVFT0YK" }],
    quiz: [
      {
        question: "¿Para qué sirve principalmente el Aula Virtual?",
        options: ["Solo para ver vídeos de ocio", "Centralizar protocolos, formación y novedades del equipo", "Únicamente para el departamento comercial", "No tiene ningún uso práctico"],
        correct: 1,
      },
      {
        question: "Si tienes dudas sobre una formación, ¿qué deberías hacer?",
        options: ["No preguntar nunca", "Adivinar la respuesta", "Consultarlo con tu responsable o la persona indicada", "Esperar a que se te olvide"],
        correct: 2,
      },
      {
        question: "¿Con qué frecuencia conviene revisar la sección de Novedades?",
        options: ["Una vez al año", "Nunca", "Solo el primer día de trabajo", "De forma periódica, para estar al día de cambios y avisos"],
        correct: 3,
      },
      {
        question: "¿Qué se espera de ti al completar una formación con test?",
        options: ["Que respondas lo más rápido posible sin ver el contenido", "Que la veas con atención y respondas con honestidad", "Que la ignores si no te interesa", "Nada en particular"],
        correct: 1,
      },
      {
        question: "Si un plazo de formación está a punto de vencer, ¿qué deberías hacer?",
        options: ["Ignorarlo, no pasa nada", "Eliminar la formación", "Completarla cuanto antes o avisar si necesitas más tiempo", "Esperar a que alguien te lo recuerde en persona"],
        correct: 2,
      },
    ],
  },
  {
    id: uid(),
    title: "[Ejemplo] Sistema ABC de ubicaciones: fundamentos",
    category: "especifica",
    description:
      "Formación de ejemplo para equipos de almacén sobre qué es una clasificación ABC de ubicaciones y por qué importa respetarla. Contenido genérico de referencia — sustitúyelo por vuestro protocolo real cuando esté validado.",
    videoUrl: "",
    presentationUrl: "",
    deadline: daysFromNow(14),
    testMode: "interno",
    passPct: 70,
    attachments: [{ name: "Sistema ABC de ubicaciones.pdf", mimeType: "application/pdf", sizeKB: 3.9, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgOSAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCA4IDAgUiAvUmVzb3VyY2VzIDw8Ci9FeHRHU3RhdGUgPDwKL2dSTHMwIDw8Ci9jYSAuMTIKPj4gL2dSTHMxIDw8Ci9jYSAxCj4+Cj4+IC9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgOCAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0F1dGhvciAoXChhbm9ueW1vdXNcKSkgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MDgyNDEyMTgzMiswMCcwMCcpIC9DcmVhdG9yIChcKHVuc3BlY2lmaWVkXCkpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MDgyNDEyMTgzMiswMCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0IChcKHVuc3BlY2lmaWVkXCkpIC9UaXRsZSAoU2lzdGVtYSBBQkMgZGUgdWJpY2FjaW9uZXM6IGZ1bmRhbWVudG9zKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjggMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyA1IDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKOSAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAyMzg5Cj4+CnN0cmVhbQpHYiEjXDlsbyZJJkFAc0JtJWxMVWEnbmQ8MHQwLDo0Nys6THEvQ11PIlg1Ki0vZF1sSVdFL2lmSTEmcHNqaUZpbXB1KFxwWjpLP29oWDgrK01oJDNRIlJeMionNCJxbGNiQll1S1FPVnIrU0s5VUg6cjFaY0wvdWosWW44YjYhYis1QnE0UVRtSjlMZG5mZ109YDwsTGw0UnA5PjhMWXI5QyVdckMoQyw2TkBxKCtQTidCJkE6TzFzMD5OUjZFPnNAXDFWbm0lSVAnVWdgam9ML0QwOGU0PFY1cCcxaHQ+U3UpT1NpbUMiaFIkWS88KWs9KylDWTA0aGIlPCdTZ10vUkE8c0lrPzAvalU0Ojg+ak0/MidGL0VNIlUyNUgrKXAvb11KTFVGYUtqL2NVKktxPk81Z2cnLXFxOSEjU21IU15tPicwK0gpbEphWzk1a1IpOlFmU3A/NU5iKDNHSz07ZkFCcWsnRidiNzklRD47dXNaVUpgLmNWMTFBMig1MmdhT1hBYT5aRkdwWEE+S1chTk5qYnRISVxEOW1XU1pvX1pLbjgnMHNTQzcjTydXNitUVFNbUWltZmklbidkSG9zbSYmJ1VFY2pBVWFyKyJEQFVIMl5DQ1NaRSIuXHBSNUtVamBXJiRZP1xdP2RidCtWNVU2WTlSR15IaiMyVmpnbnQpXGYjYWsoNWdTUEw1R0M6WHAuZl9YLlQqSE5VK29sKXByIjxgVUM1YmosJElWa1hmLGNXNi8jL2lcIjJnXC9JIzsrPU9XXFQ8Ly1YVy5YOFgoKHVAalFuVDFNOklwLXE4U21yIkMmQGpUbW1MNCI7V0RYJ2VfVE0palM/Uj5XSiVdSi5KJjlTIlQiKlY2QklaRU5XJ0RnV3FQNDlPI1o2N2RUSio2NlduJ2NdYkAwWzBYQC8hPT4iTDVlVSUjZ0w+J0YkKiVGbm9MKnQlcF1aVmUsTmRHYEtCST4iLV5fQWQ0RDBibTtgbk9mWlRWMUUramVvJGAyN0dcRCY0N2EqQVtIOmdyTV1wWF9LLFBwMF9fSSg8P0sxNS1HV1haQSg7JyleTUdBImYuOCdUclc4X2BsZixqbWlXTFg0KFopKiw9WVxaWFo+Lk1BLVpCMThPP3JwNHEuTWo/ZjxXLSonWExJKCFRdW1UJFIxX3U7QDNpLWFYYiQ5U18zWDBQUDZLXXJUJE10L1ktaTtXO1pLW3AsYEZuJk89XSopMTAwVSdmP1YjTHBSUSYoNHI+KFZiV2pfKUtfcnJBPVg6PEZMZD83Wl9PWWxmQGJjT21AZkYyQ1UlO0BfXW5gPEUiLVw2W3AzXEhsOjNjRGg+WTkwKHFqLSVKQj9wOjZDK2FLWCwtNm0uPXV0WS8/a1wsLSprL0YvZWZyKzBuVHA/XDFVKEtySTQqWzZPK1VgXTs/Py9MQkAmXS5HMF4zU1o9YmhAWXEhL2dURjBnKDNQXU5HYkkqVjVTVXRwSTRZclVAIyg3bEVZOTFmMS47ZjFYSGZlIyE1OkFTSThlMTQ2N1ovXmMuc1dZNGEnLD09IUEuQDsxWkJLVUMpWUdNZkcnOkoiQTgyNU0jNWtobl8mOCJlX1MjVDI5PDFFb1pkWGJmOE51Q2MjdTlnO0BNc2llSjByNk5gRlJGNSMxI2AuQUdjQ0dfIyVkIy8ocUJsKUwkT04kRUtnIjNEaiY3KEVuNzdPdVQ3NyhDcjRQbWdWNVdyJmVwOXNtb1hOay0xajZnNUJEU15NXiQhc1w2aUxYSV1uL0ApV145TlpvbmotQ1lsWEdpNkk0ZFksJkAva2VbPzRJTT88UEstMmQpQWlQTEojPDdGZklwPkZlIitpMCFULUhRcyIuOjVZNztyQzwrYTNnWHVXSmFOQCEyNio3cWQ0RlJBO1tPNEk+bGxRUy1LY2ZEImpDQD9NakApWS1hJWxJMV1gLl03b2tFNm4yP0ApU1NFPDMlb0hOLyI5WU9fWjJgVGEzXT5pJlomR0Q7MkdkMDVrU3RaMUxxPiEqa1pDVFdgYz9aOjlQXCIyTWJBTSUwRjQsMj47WyRVMm1tUkteNENITmJsVWhxaTZgXF5iRUZWSkFuLDo3RDBNTWUrYG4+YFgzSVdEOlEuZERUalE8QnJyV0JwRSYsUDVFRGVFQ0JjcCdWaWxjQjgoPG1gO2hfT2onZSVqKFZzXENsWmtRWyxmMk1SJy1ZOlRvLD0pPlwpJCdYdTpGM3V1RCE8Iz9DUytPZUIrMyF1RlkrcnRjPVNAbC9raTJxUURgKGxVLGRCSShfaEQwNXROLSkkXSZxXE9YXlJgWzQzaTdjPixOKkgwYy5falMnVGc6XFs8VHQzVGdYJS1dR09UW2EzST8nQ3UsdUVOPjgqRWQ5MkZMOWwxXSlyaDhAcGc6SXBoJyIiU3RhT2AsXiQ7QHJhZ1FAdSRbNTVnamFHJUVxYTwzbClMPV8lKzZ0ZEcrYU9HMD0hbEFlT2JoT1hVaihgNyhPP2BZTmsiRDYlUG4zTDVFOTdIYCdeIWYsTCI5aSgxOUlnT1RrSTVoQlNWSWs2PGJKVS9rX2RpTCdcQi9EYmZYcU8lL2g1XipXbD1bOVFfNUYzbTNcJGdxUyYjcW5qQVJRXDZFSjhXa2RgOVBeayk4ZGE7cVc5JXQja09XKlQjbkhgciF0TyROQDtmcERXTiUtSTprKkQnJSIjQGwlMVtQNidcSyY4aXVGclNITj5iNHUzMjZEXC4wNiFJVmopQiJCVERxYmtXamA+anVCa0EsRHNeMEtIYVtdJ15cYEVlV3Q+Q1wiPyRfNz9xcyY7XjooZEFVdXJccj8vbkcpXCpDSyd1XSQhTWxfalkia25QJT8wMiMlK09aTywvcjxPOSpeP1xwJ21HbUg7KERAXm8iQyJePXNncUZCMC1tKW9TYCtmLzkzPj9KLkEjUC1bYzRKaCMyPVtkaz5tOVFjNjtUQmhoOktKJUFIQDo0IUxeNEwlYFVAbGZdYUhPRy9lInM8Zk1lLEVNVl9ZNmRScj5hWXRcVVJUaDQ8PGU7X3JWImlGUTZdbGpPXV1ANDgqLjlZYDJsVnNiOTIzMHJvWyIyXUVIU2Quc2RQWFBdbyF1aTFQZyZqKkhFUyg1YFpTJl4wPiJEKFs7JUdTInA8LF82Wm5DOkxiLCtxI0tUJyU8V34+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTAKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMTIgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzMxIDAwMDAwIG4gCjAwMDAwMDA0MTQgMDAwMDAgbiAKMDAwMDAwMDY3NCAwMDAwMCBuIAowMDAwMDAwNzQyIDAwMDAwIG4gCjAwMDAwMDEwNDggMDAwMDAgbiAKMDAwMDAwMTEwNyAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzxhYmY5NTVhNDgxM2MyZDFlNjhjMzhmNjA4MTlmYjNmOD48YWJmOTU1YTQ4MTNjMmQxZTY4YzM4ZjYwODE5ZmIzZjg+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDcgMCBSCi9Sb290IDYgMCBSCi9TaXplIDEwCj4+CnN0YXJ0eHJlZgozNTg3CiUlRU9GCg==" }],
    quiz: [
      {
        question: "En una clasificación ABC de ubicaciones, ¿qué suelen representar los artículos tipo A?",
        options: ["Los que nunca se mueven", "Los que tienen mayor rotación o importancia y deben estar más accesibles", "Los que ocupan más espacio físico", "Los que llegan más tarde al almacén"],
        correct: 1,
      },
      {
        question: "¿Cuál es uno de los objetivos principales de reorganizar ubicaciones según su rotación?",
        options: ["Aumentar la distancia que recorren los operarios", "Complicar la localización de productos", "Reducir los tiempos de picking y desplazamiento", "Ninguno, es solo un cambio estético"],
        correct: 2,
      },
      {
        question: "Si detectas una ubicación física que no coincide con lo que indica el sistema, ¿qué deberías hacer?",
        options: ["Cambiar el producto de sitio sin avisar a nadie", "Ignorarla", "Esperar a la próxima auditoría anual", "Reportar la discrepancia siguiendo el protocolo del equipo"],
        correct: 3,
      },
      {
        question: "¿Por qué es importante respetar la ubicación asignada a cada referencia?",
        options: ["No es importante", "Porque garantiza que el sistema y la realidad física coincidan, evitando errores", "Solo importa para el departamento de compras", "Porque así el almacén se ve más ordenado, sin más motivo"],
        correct: 1,
      },
      {
        question: "¿Qué papel tiene el picking en la productividad del almacén?",
        options: ["No influye en la productividad", "Solo importa en campañas puntuales", "Es una tarea secundaria sin relevancia", "Es una de las tareas que más tiempo consume, por lo que optimizarla tiene alto impacto"],
        correct: 3,
      },
      {
        question: "¿Quién debería poder modificar físicamente una ubicación sin pasar por el proceso establecido?",
        options: ["Cualquiera, en cualquier momento", "Nadie — los cambios deben seguir el protocolo y quedar registrados", "Solo los nuevos empleados", "Solo los clientes"],
        correct: 1,
      },
    ],
  },
  {
    id: uid(),
    title: "Inteligencia Artificial en el trabajo: guía general",
    category: "ia",
    description:
      "Formación completa e introductoria sobre qué es la Inteligencia Artificial, cómo se usa ya en el día a día laboral, qué asistentes existen (ChatGPT, Claude, Copilot...) y qué buenas prácticas de seguridad y sentido crítico hay que aplicar al usarla en el trabajo. Pensada para cualquier persona del equipo, sin conocimientos técnicos previos.",
    videoUrl: "https://www.youtube.com/watch?v=-Nfcj0F7b-Q",
    presentationUrl: "",
    deadline: daysFromNow(21),
    testMode: "interno",
    passPct: 75,
    attachments: [{ name: "Inteligencia Artificial en el trabajo - guía general.pdf", mimeType: "application/pdf", sizeKB: 6.1, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgMTAgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRXh0R1N0YXRlIDw8Ci9nUkxzMCA8PAovY2EgLjEyCj4+IC9nUkxzMSA8PAovY2EgMQo+Pgo+PiAvRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNiAwIG9iago8PAovQ29udGVudHMgMTEgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNyAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDkgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9BdXRob3IgKFwoYW5vbnltb3VzXCkpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAoXCh1bnNwZWNpZmllZFwpKSAvVGl0bGUgKEludGVsaWdlbmNpYSBBcnRpZmljaWFsIGVuIGVsIHRyYWJham8pIC9UcmFwcGVkIC9GYWxzZQo+PgplbmRvYmoKOSAwIG9iago8PAovQ291bnQgMiAvS2lkcyBbIDUgMCBSIDYgMCBSIF0gL1R5cGUgL1BhZ2VzCj4+CmVuZG9iagoxMCAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAyNjY1Cj4+CnN0cmVhbQpHYiEjXWJCRFcwJyZEayhxS1BIbGE9bk5OR1pNc0hkNCElbCs0NFc8OWFiZCJYVD9kRiIvJTVxclM2WkI1Wi9kUC5hYyxSWjpMV3FbcitAP1dsMTxkSikoI1UuYFFxT0E4Y3RaTiFKXz9SZG5JV2ZdPEEzYk42azVNJi9bZVQ0Y0MuNEFEUGxxRD9CWilOMXBVcDlHK2VFPzlIbSlDSShFN15EP1A6OnVER00zIT82NSNWNnExLV9JZF9lSChkZHJHMiYoPmVUXzxoK0QrKm9yZ3BSMjg9YVBkJj5nYyRvLUVARF9cXXA5U1hwJ3E1RyJiMEtpXVllUUZlSDtWQ2dRVCs6JVZ1KGk6Uj9xUThZZS9NYkdvNihKV1doRWViPEE7T0VFczFjKHQoODFpXDZCWCdfMCFxNUtqNGNQNlEja2oiaDI5TGxaclFOITZJJkYuUkNGInFRXyUwWyc1OkgsKTEuRjc8I3FlQj0iLyM+OyRgKS9YcU9qUSg7YjgqSVtINlUkI21CRl9KYjMrSTA2bWNAV1pYSFEpVDk+LWpORUBmaEcsQihFPms2JWUyKWNsWi4jZFlRKk90NnBcSG0xPGdIcy5DLUchOSY9NytiJXBeYURcVENQVDZTXHMmc29iLjpFJFNYRTVZLnNyazhYSTFWQkI+ZyhGZDV1KnVPIXNNLCZOc20kKWI/WUliZHJRbyZGPGVxcFFkSztAKyMmIzRGaHIuaEppanMvOUssRDstJjhUXmkublhUWlhdKUFbUSwjOzg9a1JmYTAiPzI6PG0jPj1YVTA9cXVXSDddciRHU3NDa0pHR0k6ZFkuSVNrNy5cYnRQWldjK1A9MXFfcDY8KHBCTT43O2g2Tj1IUURKSlshIzRTQT0rJU1IWjM6cUg1VF4ralYjMzVIR2xBVWA9Xk1pcTJnc0xyWWZwOyRHLVpeJlg4NiJoTUInPC4iXzxeO0I0TlMwcHQ+dXVpMSRIP2hoPkwwXnQ0bi5wMlpDODxiIUc/TEYhVCkwT2gsZENNKE0vPyZLJHNfZUgwYyciKjBZNDNNcG5aJzUrOmwtbUhtJHMnZjImIk8oPkMqWigwIWc9UE0pLW1APkFAIilFbj1oUyNAOztKbVlePl5JYm8uU01PcypnRDE7WTw0QmxXaHFJREtTTStgKFlxPkRUJiNRa0tjMlsqVFU+LSZGJllCWDZvXVBzMzNScjs9Tk1sK0xVOGA5UnVJWVZkXGdqSnJWVSZYMGs9VTo7I0clcSg5aW5HMjJccWc2VFBJO2QxRVJCUkshYk1dN1JLQGYlPnB0WjcvbkQuK0dtb20tYVdnJ0NzcUBbTlVqO0teIihsWnVSSSJHWXNEI3JvMmtuS1VeOiw0JmpfaF0pJjpmY1c3IVxZSDo0U0QnRjdCUGRMbDpQSkZEK3FSZCZgQ2ktPFZTVFZgRFdvZk1GK2JVRUo4NmtSLChCbFlsWjMtcC5DZTxiZVpzVyIqaydOPk46XHNZQT9hXVpPI2s/X3VuIiZeUnUuTEckOCQuLl9hJVVrKTwlbGJwY28/XHNQKzcxXTM1XztvSSxPJmJadDJuQVhiW0NtOlk3YDM+aWlLJFojOlE2aFJ0PEZNST9MVzxgZzBWdWtiNGU7a2ZnT25HYGgvOl04Q3U1ckw1Tz9YYyYmdCkvMz4uS2A5cC5XTEQlby1fPj4wQltnRUMuTCVqX1ZqYj9fIjsrKS1bbEdASCZSYEJ1JTIjK05NXjpEQCNPaCtgSlRlMEJYKzNqSjNzQ0RZbEdaLG03bjYnTCRQQC5zJlNrZnVDdSw1UWUqQTo4VlVKLEtNS0BHUEhHRCJJdSc4NmRDV2pvJycqaC5lKj1adTN0cCFFZWIscCghclpFMHM4Rl9aXS8vWmFzP1loNUs9KTw1WmtWOm44ZVMrS0krLEtXTFJwRk89MUAhdGYuaDtCTm1vcUA0SiZQZSR0LGhjNCosWDA5LF9fJHMkakw0RXBzZGA2LS5dQ1BAMF4rNlZqKylqKzZOYyYnK1dWNGMqJ0ciN2E7YFA3O1peW1JbajpyJCtjRiR1RW5qdU8uVU82cFFaUT44cmA4KVJJK0VbI19EXlZtUWxvNGpXWXI0U3MsJSZWLSI1KTVJZ1QtOz1kOjo7dFpwUW5XXTxEMThNLUVtZ0NrUUssMjFoYEchJFBjZCEpTVZUIWw8RmZUI0xkanBzb0c6Z10ual9gdWVgVypfJFBDUFBbJSwrJkQ9QnByTDZyOUhcN0csZVYidWZiaCRoIVhZPzBUOj1fbkA1PEJQIV9QZkJVdHVxY05Xa2s1VF0rMm09YCM+O2h0Q0w/UW1SLlsqTTlxMGMhN3QqXXJSN1dEJDluSy1TUyJiVG4pP0ExYVRfLUReUTZxPU5fcSxqY0YrPihpVD1qUGBDTkQ2Z2ZbK1QoOEptVyFfZWAnai41QWMvZ3RwK1tYaV42SCtOWld0ZjQlMmIrSkNxYGJwO15BaCpMSTVGU29nWmxsOkx1OEdaTjlRSjMpb25oOFheYygnKyhVYS5RUz9ETFFxQVVFSmZmb15EKlwsX10kJUBHZGdZPik2ZTRiOSUvS0wmRV0ySC1MODYqa18rPDhdb1ptVkNVTVw4Z2tTTEosK2xmZ0JQbCwtcyI+YSROS2t0Iio6RUQiKjxsP2ArT1ddVGhtJGRkV0RmJ1BDWHFdUiVDXEVdRWduIkUxOC1UYyQmZXVJUWstRFtlbWlJIyRaZ0cmMzpMRTFCbitmNmBxUztdRitPSyxTS0g9KHBZMT01Lz06XVZWMmVoJEtTJER1V1g5RG5XMzssIjE6cklaYWFMZkdZMDVLPXQ9dDsiVSg+YztINzVvP24odEIpT00sQGxXITcsPSEtdTJpNVBnXTUoWWFAJHJLUCdFZTxBcnJ0JFhxZDJqajUmcTc4NUpsZCpcdVxvVyoyPWYtPUNTLl5ZWzFEPXUsT1x1KGhFVlFrMHRmLz8mQ0h1cGA6SDZMSixDL2w9T0xRaUcoIlNpcF1HYFYnJWdEcFF1IjdDcnVwbmNjRlojLkQqXy5CMilUOS9Fa1o8MCtRW0haYmUjKD4kak5RbjsqUHRhQT9yPmckUlBVNCdaal1aVDFNLF8vYm9dMkg1X1IyMkQ7JypfO0lrZDc8W0pgb1A+QVphJ21FZSFBbEFuZUdbXGkxKldfRXFsJzppOzdmM2VZVV0tN1J1O1hjWSpEVUFpZGZYMiw3UCw8Om5IX0h1Uyd0P1EkY3E5ZGxkUGIja24hSV5CbF9UOyZuNEJyO0oyX2gzRDsuR0dXSStZZ3E7ayEwWlhySCNxdWY2cHFrTTwnQmApWWc8JTZTRFMwajtIWmdpNnNqcF9rMUExc1hCTWxNPzFkN3NYOydqcCM3WD5uN0xcJyQ3ImRsSzAyTHFOcyNZaGIwXyRlXEEyRkpwO01SSTk9WkcyN1UqayleW1huPXE8YT1tLjE1WjJTPi5XUHQtSkxcUmQ5MC0sdGJhT1hXQXFiYVknbnI8LCxRW0k4cFhWaFlZRVEmXFRxKjJlSyZFV34+ZW5kc3RyZWFtCmVuZG9iagoxMSAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxNjAwCj4+CnN0cmVhbQpHYiEjWzlvbiRlJkFAUDkpISdgXFkra0JHaEBkMV0kVCg8K1wzOVhTOT0xI244UTg2I1MpJUgvMmpFW11uWVU6PCsrYVlzTz1aOEZEci8tUE4kdVZPalQhZ1BkSF9PXEhrVD9rZHFWTlEpUGpiOk5JRzNpSSgwS2cxXmdASUpnYCw+Wm9EPThtXFwlYTE8Ry1SYDokaW8iYF1bZFBgcTY6STtvcHI7M2NvPVIsQ20zKCFGSWEoWEJXLTYscVlabzNRWVtjIWIxL09CNkU6Oy1YO3NSXHIwSjNhMDE9bFFoUGAsSkRbOl44NXRCKFxHa1hLKVNlX0ZKPTFZWCNqTHVxIyI/KSksdC9hVDc2K14zXz8qO2wzNS1zYlBqY0RxZlIwSGEmIUlhTzxuJDpUYCxta1VKNCpKR2FrJTxAWXRlWkMhS2o2aFRNSEdXWSNcJzpwJ1ZzQzFMWyVkSU8mcjMxYy1VOjYkUVVuaFE3ZEpzOWNcMjlzWTg0SE9COiJQIXMwLGFqX1NHPjQoUDgvZ1BhKGI4Mk4+QVpEdS5xIm4+LWMrYjEhbTdlZk4zbSc5W3JuYF41PiJUJmhzIyJpPlQ3Q2EtLyRiTDFlKVRiTVFsdWIoM29CJD0jQCJCLDJUXSwoKUBiUk4jOCwmPj4pOHJeIjtubSpVY0chVkhgUjU4QFZNOW9kQ19RbyZKKiJQOldjPlhRKEVfPGNZLyJkQjg3IWBGLz0tMWE4VS1uQWAuaCxcXyVoN1NWbS5eVHRla1VkajhDIWcmcXNdcCFVclJRbF4nKWdvPU9IJ01XbytnN0knIVI1Iz5UXzdNZzY0Jy5zTD5gNkVaREdzKU5PW0ZSNnJxNXJPZSQ9V0JlYmFkI048ZXA3OEQ1U1JYazAkVV1wXUI0QG8jZmQmVUFab1QpczVkR3FDaWtXb0E2YUk2UG9XWXRrMVkmYnVaWyxEcHVeXVFxVS9qVkhpWUVfVipUI1tKbz9AY29uSC5rIWdMczw9UGRuUChVSywuXkM8XEttLSlTYmtOX2w5PW5ULjddMk1LXC9KNkwoKkVUcjNMYSVvKlQxUCFrTjM+KT1UaE0+alpVPzhecSs6TzdCOWtqa2cjV1JtYmc6WTg7UUxyc0taT0lkaWgoP0dQW09VJTBLPTtoQCJFMVEyVWU7XlBwPE90W0lXWiplY29dOTt0ZkUlNCgiLFQ8LjVmPComRmBwYFpIXVdTMGxKQERYbmxnRTRVMSY7SzcnbEpRaF5kaCQjNzNEYEI4dTgyPFFtdFYnMT4maDpAZEsjQ19WdCZUOyNsVD9qUUpLTGkuJUFQMjJuKTpjSHVrN10sPVwrTjpEZllHUSsoY2lWWUFEcV9UO11xWzNBMCokKSI/b0FIU0okVEY/ZmVjcVA8JkZpRVM/LSlpI01iQF5UNmwsNUlqMVAoLzM6O042VlQ2N2VcKnJDcy42SlglcjNEJlUkV1NwM1UrXDRpSDk+TlNwTXU/OkkvNiRUJixJXGwxSyoxYC9VcFkoR0NrQG9iX0pJU2dYRl5qY0FzX1RjXjE2Smo5KyszbF4uWWA7Y3JXQUVzRTJRMlQhYjQ4RXQxKz5kLVAmSWYicyklRzs+bDZ1P1lJPW1RXFRlV1ZkZSFRTiIrZFdYVlVacTozQDRxMmdQakM/QVRFXSsxSVU9KzcqNy1XZl5jUjBPMWsoU2BWZ08zSUtYQytkVlVBdWZqbEdKXGRlYjlKQ1AzSjYiT2YuKGM3Z2lSMkcuO2BZL1tHUSM0NixAa0dcR2pHPmYjR29fZVVtWVNGOzVccT9DV1xiNmZUXTciQl9xMDdhMyIsUFF1KnMqJGBnaXBpYkkhdD1WV2lnSkRxQjY5YTE1UixeczdnKlFYZipPdSIhVW9fXVgvMHM9TnRwQFMhMUY9Q09hQGguamovZkA2O1AqZjpKQTFKOjlNKyRLaU1FSmJMLiwiJjY4KypSLyJYTDQ4SUJnSisxREAnZE5hJ207QC1DaF4rZXA4IShKaVdkNjhWZkItMlFkREByRmZzaGloVy4xUEJzL1hHXXBMRCM8LHU7KG5jOTFNJVZpdDZuIiI/ay1JN11IQnJhSzdpc0BKJS9FZFpGa0c0Yz9JZllCUTVdbX4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTIKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMTIgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzMxIDAwMDAwIG4gCjAwMDAwMDA0MTQgMDAwMDAgbiAKMDAwMDAwMDY3NSAwMDAwMCBuIAowMDAwMDAwODc5IDAwMDAwIG4gCjAwMDAwMDA5NDcgMDAwMDAgbiAKMDAwMDAwMTI1MSAwMDAwMCBuIAowMDAwMDAxMzE2IDAwMDAwIG4gCjAwMDAwMDQwNzMgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8MmNlMzgwZTVjMTAzNjM0MWUwNmRiODUzNTZiNTRhZjY+PDJjZTM4MGU1YzEwMzYzNDFlMDZkYjg1MzU2YjU0YWY2Pl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA4IDAgUgovUm9vdCA3IDAgUgovU2l6ZSAxMgo+PgpzdGFydHhyZWYKNTc2NQolJUVPRgo=" }],
    quiz: [
      {
        question: "De forma sencilla, ¿qué es la Inteligencia Artificial (IA)?",
        options: [
          "Un robot físico que sustituye a las personas",
          "Sistemas informáticos capaces de realizar tareas que normalmente requieren razonamiento humano, como entender texto o reconocer patrones",
          "Un programa que solo sirve para generar imágenes",
          "Un tipo de virus informático",
        ],
        correct: 1,
      },
      {
        question: "¿Cuál de estas es un asistente de IA conversacional (tipo 'chat')?",
        options: ["Excel", "Windows Explorer", "ChatGPT o Claude", "Adobe Acrobat Reader"],
        correct: 2,
      },
      {
        question: "La IA generativa a veces inventa información que suena convincente pero es falsa. ¿Cómo se llama este fenómeno?",
        options: ["Spam", "Alucinación", "Phishing", "Un bug de red"],
        correct: 1,
      },
      {
        question: "Por eso, ¿qué deberías hacer siempre con información importante que te da un asistente de IA?",
        options: ["Darla por cierta sin comprobar nada", "Ignorarla siempre", "Verificarla antes de usarla para algo importante, sobre todo datos y cifras", "Compartirla inmediatamente sin revisar"],
        correct: 2,
      },
      {
        question: "¿Es buena idea pegar datos confidenciales de la empresa o de clientes en una herramienta de IA pública y gratuita?",
        options: ["Sí, siempre, no hay ningún riesgo", "Solo los fines de semana", "No, salvo que la empresa lo autorice explícitamente con una herramienta aprobada", "Solo si el archivo es pequeño"],
        correct: 2,
      },
      {
        question: "¿Para qué tipo de tareas suele ser especialmente útil un asistente de IA en el trabajo?",
        options: [
          "Tomar decisiones legales vinculantes sin supervisión",
          "Sustituir por completo el criterio profesional en decisiones críticas",
          "Resumir textos largos, redactar borradores o ayudar a organizar ideas",
          "Ninguna, no tiene aplicaciones prácticas",
        ],
        correct: 2,
      },
      {
        question: "¿Qué significa que la IA sea una herramienta de 'aumento' y no de sustitución total?",
        options: [
          "Que aumenta el precio de las herramientas de oficina",
          "Que reemplaza completamente a la persona en su puesto",
          "Que solo funciona los días laborables",
          "Que ayuda y potencia el trabajo de las personas, sin eliminar la necesidad de su criterio y supervisión",
        ],
        correct: 3,
      },
      {
        question: "¿Qué es un 'prompt' cuando trabajas con un asistente de IA?",
        options: ["Un tipo de virus", "La instrucción o pregunta que le escribes para pedirle algo", "El nombre técnico del ordenador", "Un archivo adjunto obligatorio"],
        correct: 1,
      },
      {
        question: "Si dos personas usan el mismo asistente con el mismo prompt, ¿por qué pueden obtener respuestas algo distintas?",
        options: [
          "Porque depende del color de la pantalla",
          "Porque hay una única respuesta correcta programada de antemano",
          "Porque es imposible, siempre da la respuesta exacta",
          "Porque estos modelos no siempre generan una respuesta idéntica cada vez, aunque la pregunta sea la misma",
        ],
        correct: 3,
      },
      {
        question: "¿Cuál de estas es una buena práctica al usar IA en el trabajo?",
        options: [
          "Publicar cualquier respuesta de la IA sin revisarla",
          "Revisar críticamente el resultado antes de usarlo, igual que revisarías el trabajo de un compañero nuevo",
          "Usarla para decisiones sobre personas sin ninguna supervisión humana",
          "Compartir contraseñas de la empresa con el asistente para que 'te conozca mejor'",
        ],
        correct: 1,
      },
    ],
  },
  {
    id: uid(),
    title: "Buenas prácticas para trabajar con asistentes de IA",
    category: "ia",
    description:
      "Segunda formación de ejemplo sobre IA, más práctica: cómo escribir mejores instrucciones (prompts), cuándo conviene revisar o pedir ajustes, y qué tareas nunca conviene delegar sin supervisión. Complementa a la guía general.",
    videoUrl: "",
    presentationUrl: "",
    deadline: "",
    testMode: "interno",
    passPct: 70,
    attachments: [{ name: "Buenas prácticas con asistentes de IA.pdf", mimeType: "application/pdf", sizeKB: 4.9, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgMTAgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRXh0R1N0YXRlIDw8Ci9nUkxzMCA8PAovY2EgLjEyCj4+IC9nUkxzMSA8PAovY2EgMQo+Pgo+PiAvRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNiAwIG9iago8PAovQ29udGVudHMgMTEgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNyAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDkgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9BdXRob3IgKFwoYW5vbnltb3VzXCkpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAoXCh1bnNwZWNpZmllZFwpKSAvVGl0bGUgKEJ1ZW5hcyBwclwzNDFjdGljYXMgcGFyYSB0cmFiYWphciBjb24gYXNpc3RlbnRlcyBkZSBJQSkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago5IDAgb2JqCjw8Ci9Db3VudCAyIC9LaWRzIFsgNSAwIFIgNiAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjEwIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDI1NTEKPj4Kc3RyZWFtCkdiISNdYkF1QFcnJkRrKF0hQmFZZDBTVGlsc2M8RjhrT0JOXHAoIXEmL1w5PiFcaSs0XnRBWV9IWzVbUlRNL08yYC5jQCI4NzVhZUIyM1pDKlgxV2I/ZjZDIiVGTm9McVZnVWZKcmptPC4jPlIoRFFgNCVjLEpec1FjK19malEkSjFRSCVWT2UjWTAqJSprV2RiQigkPDdIMCMoUCM9bkFkYlhYNj81c1pZTytAbSwxQiwzRzVOUklWQzcxRlhFbEdPKGg/S2BYOGE8LUA9OUs/Iz81MDtXOGlJMmJybmNPJUJxUl0+PkFfUTFcZGQsSUlkMV03cyY1Zlw3SyI9PkgoXllxVD9jUV0/QlAtRHJganMvN1dHWTFYZTkmW2x1LV1iKU9IMlIlOVhIbThYLi1uTVhec201OlQhOS1PWi1KXmg0OHFFQTY+YGo6aXFJJmQzSkZEdCNHZyFHIVkzbVFAPCNfJlJwN25dXTIqVnVUSEM/dERHVm1PS2VgZGdnbUxSUShYRFVKZ040V0lPbCc1I0woWE5OZ3BTWklRP2hoKnNzW2x0amQ2K1MsNz08NzJkOkxIQyNVRjRlbyclQEtDNycqdDRKJXRqOGNRQW89dWBwbUElVD01Rm8sJHIiTkFJQ1RPTC80cjw8NjVaZiNqUkBOTT9kUmdlMUQhLUNhW3Q0PixwWWokWidxUkouTEEmKD9zVypZOzE8N0NjIkVBKjYwLnArNy9yL1JtclZMRkgsImJlX2h1NC4hO2whQUhQUi8jbSxUWF1nSkFsWkJbby9ZYiNlclo2YFk3NDROKm5SbjM5M0VTUEwsMl9iPVM2dUUrK2dWQTtDPW9yY3QlVTIkS0xnIV1vZ1RePiZqL10yckN0MTtwZzdEXFVqU29UP3BjRVNnQm8rWTU4bDJBUFVsZk1uIkAyODFAUWpZQThBIjtkImZAOVxQVjJNJmUoPmRYIyRdTS00SyFocltbNVZXcEdJbk1hbGgvZVpMQ2o2KihRNXNEIyhDcUVuMDNLKD1bKmVOUmlHak4rYG5JVExcSSQmNXMxaUJiMWU+bmoyOGNbSmZXQEAkOVJpQFM3SjdRNlMvPjsrUFdgKSxGXUxHRFlvWT5yX2hvSCZFOjArdGFFPGEiY2ZPWzshXDY7QjFURy40JksuKVMhKig5LVh0JmltOjItJCdYbCNMZGpSQTFFNTtibV5rVU9RKSxdcWhva0tGZ1g8OzovYEJfaUZIVlZbb2xuX2EwZCFLX101YEs1Q21bQV4yTy9rWSQ+dEdHQ28iLz4pJ1tCRixXIV5gNm1aV2JvTz4qZDUtPiUjME40WWA2TCcwYGEqIUBBY3JTa1s2JjhdUy02PyJrbjpxWXJqb2oibGEsXGZDMShcOWpbQnRBQnBvQyVBaVlOaWxYS2xKX0UrRGAhUlA7K01gQztKYVg0QFgxa2REbyk8PWI2U0s+SUxpZGxmZlxuczY7aFEncDo+aVRKI3RoPDwvOV5FPGEuNTgvKy0qUWRlTWRnK0xfY2VuVkhZUGhiQT1jXkpMSkctO1I0QT85WG87aHNnNlVPXTIiJFNqK3AwaktcQlphIS1CMlclS0tQLTRZPSNebWphY15DPyMkZFlnKUgxVmtSXCgqRkU9bSNIKUJDPGhGWVtuK1cpRi1XIyIsMCFuWCRANmlUW15WbERaPHRAKm1zNSQ4LnFcRVNeYFVpcjc+STYncSRzOyMvYy5YVTJuJGI5PjFtJmpMRFMlNydqcV4rMC09MTZYWExvaCZwNmo7QDtHPVUiTz1lK08oUzJwUy4hTEAhLVcoRiZiPm5qLkc2RXMxLy5ZPyRyJVFwSFpzSVRgSTw2cSRpSlBhdWRocChSZHJqSFciajFbJ04oM1k/VXFScFtnN202SiZfRmg2KjJkI1RWKmckKExPZTUzSkoqTHFGWEdzUUsrbCVOcDtgM0wvTUc3KSZtRWpnZEdqKWYpYmkmc29ASDpWQVJoKzIkJ1ZmPFZoZ1c0RTlBXnJrNlc5PFEtWkA+Xy43Ki5gZ3BkKS9jPjh1Klg8NnNWS2I7X1RILkU7UDlFUWQ0KSZEUGUnaWEua3I2KSlAIVcmYVlrO0EkYVNQWGJcL1MxLHQmRzcnSi8hIUZVb0pKQT8hNlJOXTwmXW9JI1VzbmwlTSJyJW1wS2NaVyRNLE03bkY6TitWU05KKEBjWjgtJC08UWlrXlRMJmBWLVlsaGhkNFovaSopJVd0LzJbaDZLWG0sKGJkb1VFVURyVFFIYT9AXWRoUmg9ZksiRlw0cTNgVVZYJm88KWBzWWwnJ1w7QVI5MmpUUCNeWT47QUxONHRpJExSSVtmYGM0cmA+O1s1MyFYNDEwPWJIMVJVOHEtLCosYTpyXG1pbU80Smk7NXFuLmNiIV1gUi03dDE2RUsmIy5TKEMlRzkqQWUlKC5zVGUsR1pXTXE3UUZWUS5gajskcGElTExpWW1faS9nXyU+TGlIVisqTzltLTI+YlIjU1xpdTRPJ2BeS0YrX2JvRjRtVCRSK1ddXFFSRiFzUVlENlcqKit1VycrNWozQzg+TkVjQlBgI1BSJ0AmSzhkZ3QhOl8zVlNjajRXL202Oz80RC1yQTNOPVRiWCtZREFxYTgsYUFyJC8waFp0SmFdYGM8OmRaJDloSTNoT0ZkQi5NSkxfTT5OJmdwTU4sLTJxRW5da0R0VzA1JV1JIj0vPWlQU24vaUk7ZytgTFNQJyY7XVhHQHMnayhYTzlYcVhdI19NNUh0ZHFAPEkhMEk5UDx0TihXV1QpIilKJmA3JTBDW04nTF4iN0E5VyhdL1FFcTlCTy5qUUFMVz9RMnRkU18uXSEzVCp0ajA/SUhLN2BuL2cpYC05NV51Qj8oOkIiKGdAXT0qM1MqZ3Q8OVpvQDA7dEBEZk5BbiJGaGsjRiIucktwNStFLTU2SldTaSNIWldoPVhnXU1iKlFfK2grMmFcTmoocDMrIUhrXzkqYClBZ0dsLkpTSCtgTidsZ2EnbjgjdDtjNCgjOGhJXz4xcGlHTFtOayhCaWxMS2RKLUlYLk5uXzpgOz9SMCVXOyhLK1M4M05jcjRLJSU3K0k3ZWZcPj4yVk0jZzZuRVhQRSlJWHE3J0VIRzY0dFAuUlFuKy1SazU3TmwnL1BTSmk3UHVYZilLM2VpSz9nXE86WVlDaiNcMCdDMEVSaG9bTVMkSjZOV2ppWEVldGtAWUgwcFkpdFpKZHJcUS5RV21BUUtXX0xLSGVBSVFXUzlqW0EtclJGTzM5RHI3LyoqbElZVV9KQUMlUS9FUmlDdWRsdShhckkwbz8vbEMiKj8iV3NCOWxuX0lYPkdiKy83Kjg/bWQmNmUtQkFfUF43SGlcN1w6KFkyPzJQZTA8LC5Cfj5lbmRzdHJlYW0KZW5kb2JqCjExIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDQ2MQo+PgpzdHJlYW0KR2FyJyQ7K290KCdTWUhBLydkMCdQImpATUQ6cDslPyEncCIuL1BoU0dBPi4+Y28uPyRfWVdUMyk9IkZ1VGEsbWltXmAnak9TbCcrXSxROWkoLWQ2dS4jaUJcQVY8P3JMTDRvZz1wU29GQ2hhNlAuVkdjZlZXVkZMRSpaWEVmQmg4MyQ9LWQ+TFpHX1QvOy1sW1A4bCxWV2lSMigvZEwiOjklW0QjWEJrYShYX1YmZT5iYDVBPyZSLGpqM1M6Z2diN0YxV1ZETEMzLT5JQltCIjhbb1JzdCZibVgxXEJUSGdbXlgmKE5CUE9OXWM/ZS0vN1FsTmhUYDlwNW8iZ3FZVnEycT0tXFguU0A4TkFJRWphQWFLPzVCQFs1SDNUUHJgRioxPXIlYGFxSV5DWU1AbmMxc1FcI0RQLDtLUFRoR00nPCZzMElnWUVJczM+TjlRSWE/VE1xTGkoL1BPK15pL11VJHAzN2VucDwyKkIzKVcpYCJDQEdRJzUuYSVscHEnOmFsQ15UcGNOTTo3bF46LkJGKnI7M1o8MG0tJyVJWGsyOyNdcF8vLEkzOTFObEpOKVpzRi5zWnFpdF1RXl45RG83OmpgN2FOMFdRfj5lbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCAxMgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjE5IDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMDQxNCAwMDAwMCBuIAowMDAwMDAwNjc1IDAwMDAwIG4gCjAwMDAwMDA4NzkgMDAwMDAgbiAKMDAwMDAwMDk0NyAwMDAwMCBuIAowMDAwMDAxMjY4IDAwMDAwIG4gCjAwMDAwMDEzMzMgMDAwMDAgbiAKMDAwMDAwMzk3NiAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzwyNWMzMjhjODYzYmVhMGQxNmMxYTcyODk5ZWRiMThkYj48MjVjMzI4Yzg2M2JlYTBkMTZjMWE3Mjg5OWVkYjE4ZGI+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDggMCBSCi9Sb290IDcgMCBSCi9TaXplIDEyCj4+CnN0YXJ0eHJlZgo0NTI4CiUlRU9GCg==" }],
    quiz: [
      {
        question: "¿Qué suele mejorar la calidad de la respuesta de un asistente de IA?",
        options: ["Escribir la pregunta lo más corta y ambigua posible", "Dar contexto claro y detalle específico sobre lo que necesitas", "Nunca dar ejemplos", "Escribir todo el mensaje en mayúsculas"],
        correct: 1,
      },
      {
        question: "Si la primera respuesta no es exactamente lo que buscabas, ¿qué puedes hacer?",
        options: ["Darte por vencido inmediatamente", "Cerrar la sesión sin decir nada", "Pedirle que la ajuste o aclare, como en una conversación", "Culpar a la herramienta y no volver a usarla"],
        correct: 2,
      },
      {
        question: "¿Es recomendable revisar y editar un texto generado por IA antes de enviarlo a un cliente?",
        options: ["No, se puede enviar tal cual siempre", "Sí, siempre conviene revisarlo y adaptarlo con tu propio criterio", "Solo si es muy largo", "Solo si lo pide el cliente"],
        correct: 1,
      },
      {
        question: "¿Qué tipo de tareas NO deberías delegar por completo en un asistente de IA sin supervisión?",
        options: ["Traducir un párrafo sencillo", "Generar ideas para una lluvia de ideas", "Resumir un correo largo", "Decisiones con impacto legal, de seguridad o económico importante"],
        correct: 3,
      },
      {
        question: "¿Qué ventaja tiene mantener una conversación de varios mensajes con un asistente, en vez de un único mensaje suelto?",
        options: ["No tiene ninguna ventaja", "Permite ir refinando la respuesta con más contexto en cada paso", "Hace que la IA se equivoque más", "Solo sirve para hacer la conversación más larga"],
        correct: 1,
      },
    ],
  },
];

const SEED_NEWS = [
  {
    id: uid(),
    date: todayISO(),
    title: "Bienvenida al Aula Virtual",
    body: "Este es el espacio de formación de Muñoz Bosch: protocolos, formación general y por equipo, e IA y nuevas tecnologías. Cada formación incluye vídeo, material y un test final.",
  },
  {
    id: uid(),
    date: todayISO(),
    title: "Nueva formación disponible: IA en el trabajo",
    body: "Ya está disponible la guía general de Inteligencia Artificial en el trabajo, en la categoría IA y nuevas tecnologías. Recomendada para todo el equipo.",
  },
];

async function loadKey(key, fallback) {
  try {
    const { data, error } = await supabase.from("app_storage").select("value").eq("key", key).maybeSingle();
    if (error || !data) return fallback;
    return data.value;
  } catch {
    return fallback;
  }
}

async function saveKey(key, value) {
  try {
    await supabase.from("app_storage").upsert({ key, value, updated_at: new Date().toISOString() });
  } catch {
    // se ignora en silencio; el estado local sigue reflejando la sesión actual
  }
}

async function deleteKey(key) {
  try {
    await supabase.from("app_storage").delete().eq("key", key);
  } catch {
    // clave ya inexistente o error de red; no bloquea la operación en curso
  }
}

// Convierte formaciones semilla (con adjuntos en base64 "en crudo") en formaciones
// listas para usar: sube cada adjunto a su propia clave de almacenamiento y deja
// en el curso solo la referencia ligera {id, name, mimeType, sizeKB, storageKey}.
async function materializeSeedCourses(seedList) {
  const result = [];
  for (const c of seedList) {
    const finalAttachments = [];
    for (const att of c.attachments || []) {
      const attId = uid();
      const storageKey = `mb_att_${attId}`;
      await saveKey(storageKey, { name: att.name, mimeType: att.mimeType, data: att.data });
      finalAttachments.push({ id: attId, name: att.name, mimeType: att.mimeType, sizeKB: att.sizeKB, storageKey });
    }
    result.push({
      ...c,
      id: uid(),
      quiz: (c.quiz || []).map((q) => ({ ...q, options: [...q.options] })),
      attachments: finalAttachments,
    });
  }
  return result;
}

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

function PinDots({ length, filled }) {
  return (
    <div className="flex gap-3 justify-center my-3">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className="w-3.5 h-3.5 rounded-full transition"
          style={{ backgroundColor: i < filled ? BRAND.red : "#00000020" }}
        />
      ))}
    </div>
  );
}

function PinPad({ onComplete }) {
  const [pin, setPin] = useState("");
  useEffect(() => {
    if (pin.length === 4) {
      const p = pin;
      const t = setTimeout(() => onComplete(p), 120);
      return () => clearTimeout(t);
    }
  }, [pin]);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];
  return (
    <div>
      <PinDots length={4} filled={pin.length} />
      <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto">
        {keys.map((k, i) =>
          k === "" ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => (k === "back" ? setPin((p) => p.slice(0, -1)) : pin.length < 4 && setPin((p) => p + k))}
              className="h-12 rounded-lg font-bold text-lg flex items-center justify-center transition-all duration-150 active:scale-90 shadow-sm hover:shadow-md hover:-translate-y-0.5"
              style={{ backgroundColor: "white", border: "1px solid #00000018", color: BRAND.ink }}
            >
              {k === "back" ? "⌫" : k}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function DeadlineChip({ deadline, completed }) {
  if (completed) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">
        <CheckCircle2 size={13} /> Completada
      </span>
    );
  }
  if (!deadline) {
    return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500">Sin plazo</span>;
  }
  const d = daysUntil(deadline);
  if (d < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
        <AlertTriangle size={13} /> Vencida hace {Math.abs(d)} día{Math.abs(d) === 1 ? "" : "s"}
      </span>
    );
  }
  if (d <= 3) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
        <Clock size={13} /> Quedan {d} día{d === 1 ? "" : "s"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
      <Clock size={13} /> {d} días restantes
    </span>
  );
}

function CategoryTag({ id, small }) {
  const meta = categoryMeta(id);
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-md ${small ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2 py-1"}`}
      style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
    >
      <span
        className="inline-flex items-center justify-center rounded-sm font-bold"
        style={{ backgroundColor: meta.color, color: "white", width: 18, height: 18, fontSize: 9 }}
      >
        {meta.code}
      </span>
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

function dataUriToBlobUrl(dataUri, mimeType) {
  const commaIdx = dataUri.indexOf(",");
  const base64 = dataUri.slice(commaIdx + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });
  return URL.createObjectURL(blob);
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

function LoginGate({ employees, adminPin, onEmployeeLogin, onAdminLogin, onAdminSetup }) {
  const [mode, setMode] = useState("menu"); // menu | employee-pin | admin-pin | admin-setup
  const [typedName, setTypedName] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [setupPin, setSetupPin] = useState("");
  const [setupStep, setSetupStep] = useState(1);

  function normalize(s) {
    return s.trim().replace(/\s+/g, " ").toLowerCase();
  }

  function goToPin() {
    if (!typedName.trim()) return;
    setError("");
    setMode("employee-pin");
  }

  function tryEmployeePin(pin) {
    const target = normalize(typedName);
    const match = employees.find((e) => normalize(e.name) === target);
    // Mensaje siempre igual, exista o no exista ese nombre — así la pantalla de
    // acceso no confirma ni descarta quién está registrado en la app.
    if (match && match.pin && pin === match.pin) {
      onEmployeeLogin(match.name);
    } else {
      setError("Nombre o PIN incorrecto.");
      setAttempt((a) => a + 1);
    }
  }

  function tryAdminPin(pin) {
    if (pin === adminPin) {
      onAdminLogin();
    } else {
      setError("PIN de administrador incorrecto.");
      setAttempt((a) => a + 1);
    }
  }

  function handleSetupDigits(pin) {
    if (setupStep === 1) {
      setSetupPin(pin);
      setSetupStep(2);
      setAttempt((a) => a + 1);
    } else {
      if (pin === setupPin) {
        onAdminSetup(pin);
      } else {
        setError("Los PIN no coinciden. Empieza de nuevo.");
        setSetupStep(1);
        setSetupPin("");
        setAttempt((a) => a + 1);
      }
    }
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4"
      style={{ background: `linear-gradient(160deg, ${BRAND.red} 0%, ${BRAND.redDark} 60%)`, fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg mb-2 shadow-md" style={{ backgroundColor: BRAND.red, color: "white" }}>
            MB
          </div>
          <div className="font-bold text-lg" style={{ color: BRAND.ink }}>
            Aula Virtual · Muñoz Bosch
          </div>
          <div className="text-xs text-gray-400">Acceso con nombre y PIN personal</div>
        </div>

        {mode === "menu" && (
          <div>
            {employees.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4 px-2">
                Todavía no hay empleados registrados. Entra como administrador para añadir el primero.
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Nombre y apellido
                  <input
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && goToPin()}
                    placeholder="Como está registrado en el equipo"
                    className="mt-1 w-full text-sm rounded-lg border px-3 py-2.5 font-normal text-gray-900"
                    style={{ borderColor: "#00000020" }}
                    autoFocus
                  />
                </label>
                <button
                  disabled={!typedName.trim()}
                  onClick={goToPin}
                  className="w-full mt-3 text-sm font-bold rounded-lg py-2.5 text-white disabled:opacity-40 transition-all duration-150 active:scale-[0.98]"
                  style={{ backgroundColor: BRAND.red }}
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
                setSetupStep(1);
                setSetupPin("");
                setMode(adminPin ? "admin-pin" : "admin-setup");
              }}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-lg py-2.5 border transition hover:bg-gray-50"
              style={{ borderColor: "#00000018", color: BRAND.red }}
            >
              <ShieldCheck size={15} /> Acceder como administrador
            </button>
          </div>
        )}

        {mode === "employee-pin" && (
          <div>
            <button
              onClick={() => {
                setMode("menu");
                setError("");
              }}
              className="flex items-center gap-1 text-xs font-semibold text-gray-400 mb-3"
            >
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="flex flex-col items-center mb-2">
              <Avatar name={typedName} size={52} />
              <div className="font-semibold text-sm mt-2">{typedName}</div>
              <div className="text-[11px] text-gray-400">Introduce tu PIN de 4 dígitos</div>
            </div>
            <PinPad key={attempt} onComplete={tryEmployeePin} />
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}

        {mode === "admin-pin" && (
          <div>
            <button onClick={() => setMode("menu")} className="flex items-center gap-1 text-xs font-semibold text-gray-400 mb-3">
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="flex flex-col items-center mb-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.red}15` }}>
                <Lock size={20} style={{ color: BRAND.red }} />
              </div>
              <div className="font-semibold text-sm mt-2">Acceso administrador</div>
              <div className="text-[11px] text-gray-400">Introduce el PIN de administración</div>
            </div>
            <PinPad key={attempt} onComplete={tryAdminPin} />
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}

        {mode === "admin-setup" && (
          <div>
            <button onClick={() => setMode("menu")} className="flex items-center gap-1 text-xs font-semibold text-gray-400 mb-3">
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="flex flex-col items-center mb-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.gold}20` }}>
                <KeyRound size={20} style={{ color: BRAND.gold }} />
              </div>
              <div className="font-semibold text-sm mt-2">{setupStep === 1 ? "Crea el PIN de administrador" : "Repite el PIN para confirmar"}</div>
              <div className="text-[11px] text-gray-400">Primer acceso — este PIN protegerá el panel de administración</div>
            </div>
            <PinPad key={attempt} onComplete={handleSetupDigits} />
            {error && <div className="text-xs text-red-600 text-center mt-2 font-medium">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- App principal ---------- */

export default function AulaVirtualMB() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [news, setNews] = useState([]);
  const [completionsByCourse, setCompletionsByCourse] = useState({});
  const [employees, setEmployees] = useState([]);
  const [groups, setGroups] = useState([]);
  const [adminPin, setAdminPin] = useState("");
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [loadingTracking, setLoadingTracking] = useState(false);

  const [currentUser, setCurrentUser] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState("dashboard");
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);

  useEffect(() => {
    (async () => {
      const [c, n, emp, grp, pin, lastBk, sUrl] = await Promise.all([
        loadKey("mb_courses", null),
        loadKey("mb_news", null),
        loadKey("mb_employees", []),
        loadKey("mb_groups", []),
        loadKey("mb_admin_pin", ""),
        loadKey("mb_last_backup_at", null),
        loadKey("mb_sheets_webapp_url", ""),
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
      // migración: empleados antiguos guardados como strings, o sin email -> objetos {name, pin, email}
      const normalizedEmployees = (emp || []).map((e) => (typeof e === "string" ? { name: e, pin: "", email: "" } : { email: "", ...e }));
      setCourses(finalCourses);
      setNews(finalNews);
      setEmployees(normalizedEmployees);
      setGroups(grp || []);
      setAdminPin(pin);
      setLastBackupAt(lastBk);
      setSheetsUrl(sUrl || "");
      setLoading(false);
    })();
  }, []);

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
    return rec ? rec.status : "pendiente";
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

  async function openCourse(courseId) {
    setActiveCourseId(courseId);
    setQuizAnswers({});
    setQuizResult(null);
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
    const updated = {
      ...current,
      [currentUser]: {
        status: passed ? "completada" : "en_progreso",
        startedAt: prev.startedAt || todayISO(),
        completedAt: passed ? todayISO() : null,
        score,
        attempts: (prev.attempts || 0) + 1,
      },
    };
    setCompletionsByCourse((prevState) => ({ ...prevState, [activeCourse.id]: updated }));
    await saveKey(`mb_completions_course_${activeCourse.id}`, updated);
    setQuizResult({ score, passed, correctCount, total: quiz.length });
  }

  async function selfReportComplete(courseId) {
    if (!currentUser) return;
    const current = await loadKey(`mb_completions_course_${courseId}`, {});
    const prev = current[currentUser] || { attempts: 0 };
    const updated = {
      ...current,
      [currentUser]: {
        status: "completada",
        startedAt: prev.startedAt || todayISO(),
        completedAt: todayISO(),
        score: null,
        selfReported: true,
        attempts: (prev.attempts || 0) + 1,
      },
    };
    setCompletionsByCourse((prevState) => ({ ...prevState, [courseId]: updated }));
    await saveKey(`mb_completions_course_${courseId}`, updated);
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

  const assignedCountForUser = useMemo(() => {
    if (!currentUser) return 0;
    return courses.filter((c) => isAssignedToUser(c, currentUser, groups)).length;
  }, [courses, currentUser, groups]);

  const progressPercent = useMemo(() => {
    if (!currentUser || assignedCountForUser === 0) return 0;
    return Math.round((completedForUser.length / assignedCountForUser) * 100);
  }, [completedForUser, assignedCountForUser, currentUser]);

  const POINTS_PER_COURSE = 100;
  const pointsForUser = useMemo(() => completedForUser.length * POINTS_PER_COURSE, [completedForUser]);
  const levelForUser = useMemo(() => levelForPoints(pointsForUser), [pointsForUser]);

  const badgesForUser = useMemo(() => {
    if (!currentUser) return [];
    const badges = [];
    const n = completedForUser.length;
    if (n >= 1) badges.push({ id: "first", label: "Primera formación completada", icon: Star });
    if (n >= 5) badges.push({ id: "five", label: "5 formaciones completadas", icon: Award });
    if (n >= 10) badges.push({ id: "ten", label: "10 formaciones completadas", icon: Trophy });
    for (const cat of CATEGORIES) {
      const assignedInCat = courses.filter((c) => c.category === cat.id && isAssignedToUser(c, currentUser, groups));
      if (assignedInCat.length > 0 && assignedInCat.every((c) => getStatus(currentUser, c.id) === "completada")) {
        badges.push({ id: `cat-${cat.id}`, label: `Experto en ${cat.label}`, icon: cat.icon });
      }
    }
    if (assignedCountForUser > 0 && pendingForUser.length === 0) {
      badges.push({ id: "uptodate", label: "Al día con todo", icon: PartyPopper });
    }
    return badges;
  }, [completedForUser, courses, currentUser, groups, pendingForUser, assignedCountForUser]);

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
  }
  async function updateGroupMembers(id, memberNames) {
    const updated = groups.map((g) => (g.id === id ? { ...g, memberNames } : g));
    setGroups(updated);
    saveKey("mb_groups", updated);
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
    const payload = { exportedAt: new Date().toISOString(), courses, news, employees, groups, completionsByCourse: allCompletions, adminPin };
    if (includeAttachments) {
      const attachmentsData = {};
      for (const c of courses) {
        for (const att of c.attachments || []) {
          const data = await loadKey(att.storageKey, null);
          if (data) attachmentsData[att.storageKey] = data;
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
    if (payload.adminPin) {
      setAdminPin(payload.adminPin);
      await saveKey("mb_admin_pin", payload.adminPin);
    }
    if (payload.attachmentsData) {
      for (const [key, val] of Object.entries(payload.attachmentsData)) {
        await saveKey(key, val);
      }
    }
  }

  async function addEmployee(name, pin, email) {
    if (!name.trim() || employees.some((e) => e.name === name.trim())) return;
    const updated = [...employees, { name: name.trim(), pin, email: email.trim() }];
    setEmployees(updated);
    saveKey("mb_employees", updated);
  }
  async function removeEmployee(name) {
    const updated = employees.filter((e) => e.name !== name);
    setEmployees(updated);
    saveKey("mb_employees", updated);
    if (currentUser === name) setCurrentUser("");
  }
  async function updateEmployeePin(name, pin) {
    const updated = employees.map((e) => (e.name === name ? { ...e, pin } : e));
    setEmployees(updated);
    saveKey("mb_employees", updated);
  }
  async function updateEmployeeEmail(name, email) {
    const updated = employees.map((e) => (e.name === name ? { ...e, email } : e));
    setEmployees(updated);
    saveKey("mb_employees", updated);
  }

  async function saveCourse(course) {
    let updated;
    if (courses.find((c) => c.id === course.id)) updated = courses.map((c) => (c.id === course.id ? course : c));
    else updated = [...courses, course];
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
    await deleteKey(`mb_completions_course_${id}`);
    const updated = courses.filter((c) => c.id !== id);
    setCourses(updated);
    await saveKey("mb_courses", updated);
  }
  async function addNews(item) {
    const updated = [item, ...news];
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

  async function handleAdminSetup(pin) {
    setAdminPin(pin);
    await saveKey("mb_admin_pin", pin);
    setIsAdmin(true);
    setView("admin");
  }

  function logout() {
    setCurrentUser("");
    setView("dashboard");
  }
  function logoutAdmin() {
    setIsAdmin(false);
    if (view === "admin") setView("dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center" style={{ backgroundColor: BRAND.cream }}>
        <Loader2 className="animate-spin" size={28} style={{ color: BRAND.red }} />
      </div>
    );
  }

  if (!currentUser && !isAdmin) {
    return (
      <LoginGate
        employees={employees}
        adminPin={adminPin}
        onEmployeeLogin={(name) => {
          setCurrentUser(name);
          setView("dashboard");
          const assignedIds = courses.filter((c) => isAssignedToUser(c, name, groups)).map((c) => c.id);
          ensureCompletionsForCourses(assignedIds);
        }}
        onAdminLogin={() => {
          setIsAdmin(true);
          setView("admin");
        }}
        onAdminSetup={handleAdminSetup}
      />
    );
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: BRAND.cream, fontFamily: "Arial, Helvetica, sans-serif", color: BRAND.ink }}>
      <div className="sticky top-0 z-20 shadow-lg" style={{ backgroundColor: BRAND.red }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md flex items-center justify-center font-bold text-sm shadow-sm" style={{ backgroundColor: "white", color: BRAND.red }}>
              MB
            </div>
            <div className="text-white leading-tight">
              <div className="font-bold text-base tracking-tight">Aula Virtual</div>
              <div className="text-[11px] opacity-80 -mt-0.5">Muñoz Bosch</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {currentUser && (
              <div className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                <Avatar name={currentUser} size={26} />
                <span className="text-xs font-semibold text-white">{currentUser}</span>
                <button onClick={logout} title="Cerrar sesión" className="text-white opacity-80 hover:opacity-100">
                  <LogOut size={13} />
                </button>
              </div>
            )}
            {isAdmin && (
              <div className="flex items-center gap-1.5 rounded-full pl-2.5 pr-2.5 py-1" style={{ backgroundColor: "white" }}>
                <ShieldCheck size={13} style={{ color: BRAND.red }} />
                <span className="text-xs font-bold" style={{ color: BRAND.red }}>
                  Administrador
                </span>
                <button onClick={logoutAdmin} title="Salir del modo administrador" style={{ color: BRAND.red }} className="opacity-70 hover:opacity-100">
                  <LogOut size={12} />
                </button>
              </div>
            )}
            {isAdmin && !currentUser && (
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  setCurrentUser(e.target.value);
                  const assignedIds = courses.filter((c) => isAssignedToUser(c, e.target.value, groups)).map((c) => c.id);
                  ensureCompletionsForCourses(assignedIds);
                }}
                className="text-xs rounded-full px-2.5 py-1.5 border-0 font-medium"
                style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "white" }}
              >
                <option value="" style={{ color: BRAND.ink }}>
                  Ver como empleado...
                </option>
                {employees.map((e) => (
                  <option key={e.name} value={e.name} style={{ color: BRAND.ink }}>
                    {e.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {[
            { id: "dashboard", label: "Inicio", icon: Home },
            { id: "catalog", label: "Catálogo", icon: LayoutGrid },
            ...(isAdmin ? [{ id: "admin", label: "Administración", icon: Settings }] : []),
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-t-md transition-all duration-200"
              style={{
                backgroundColor: view === t.id || (view === "course" && t.id === "catalog") ? BRAND.cream : "transparent",
                color: view === t.id || (view === "course" && t.id === "catalog") ? BRAND.red : "rgba(255,255,255,0.85)",
              }}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
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
            onOpenCourse={openCourse}
          />
        )}
        {view === "catalog" && <Catalog courses={courses} currentUser={currentUser} groups={groups} getStatus={getStatus} onOpenCourse={openCourse} />}
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
            onSelfReport={() => selfReportComplete(activeCourse.id)}
            onBack={() => setView("catalog")}
            onRetry={() => {
              setQuizAnswers({});
              setQuizResult(null);
            }}
          />
        )}
        {view === "admin" && isAdmin && (
          <AdminPanel
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
            onAddNews={addNews}
            onDeleteNews={deleteNews}
            onAddEmployee={addEmployee}
            onRemoveEmployee={removeEmployee}
            onUpdateEmployeePin={updateEmployeePin}
            onUpdateEmployeeEmail={updateEmployeeEmail}
            onAddGroup={addGroup}
            onDeleteGroup={deleteGroup}
            onUpdateGroupMembers={updateGroupMembers}
            onManualSetStatus={manualSetStatus}
            onLoadSeedExamples={loadSeedExamples}
            onExportBackup={exportBackup}
            onImportBackup={importBackup}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Vistas ---------- */

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={17} style={{ color: BRAND.red }} />
      <h2 className="font-bold text-base" style={{ color: BRAND.ink }}>
        {children}
      </h2>
    </div>
  );
}

function CourseCard({ course, status, onOpen }) {
  const meta = categoryMeta(course.category);
  return (
    <button
      onClick={onOpen}
      className="text-left w-full rounded-xl border bg-white p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-2"
      style={{ borderColor: "#00000012", borderLeftWidth: 3, borderLeftColor: status === "completada" ? "#22C55E" : meta.color }}
    >
      <div className="flex items-start justify-between gap-2">
        <CategoryTag id={course.category} small />
        <DeadlineChip deadline={course.deadline} completed={status === "completada"} />
      </div>
      <div className="font-bold text-sm leading-snug mt-1" style={{ color: BRAND.ink }}>
        {course.title}
      </div>
      <div className="text-xs text-gray-500 line-clamp-2">{course.description}</div>
      <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
        {course.videoUrl && (
          <span className="flex items-center gap-1">
            <PlayCircle size={12} /> Vídeo
          </span>
        )}
        {course.presentationUrl && (
          <span className="flex items-center gap-1">
            <FileText size={12} /> Presentación
          </span>
        )}
        <span>
          {course.testMode === "googleform" ? "Test en Google Form" : `${(course.quiz || []).length} pregunta${(course.quiz || []).length === 1 ? "" : "s"} de test`}
        </span>
      </div>
    </button>
  );
}

function StatusHero({ currentUser, pendingForUser, assignedCountForUser, points, level }) {
  if (!currentUser) return null;

  const overdueCount = pendingForUser.filter((c) => c.deadline && daysUntil(c.deadline) < 0).length;
  const allDone = assignedCountForUser > 0 && pendingForUser.length === 0;
  const noneAssigned = assignedCountForUser === 0;

  let icon = Clock, big = "Tienes formaciones pendientes", small = `${pendingForUser.length} por completar.`, bg = "#FEF3C7", fg = "#92400E", ring = "#F59E0B";
  if (noneAssigned) {
    icon = Home; big = "Todavía no tienes formaciones asignadas"; small = "Cuando te asignen alguna, aparecerá aquí."; bg = "#F3F4F6"; fg = "#4B5563"; ring = "#9CA3AF";
  } else if (allDone) {
    icon = CheckCircle2; big = "Estás al día"; small = "Has completado todas tus formaciones asignadas."; bg = "#DCFCE7"; fg = "#166534"; ring = "#22C55E";
  } else if (overdueCount > 0) {
    icon = AlertTriangle; big = "Tienes formaciones vencidas"; small = `${overdueCount} vencida${overdueCount === 1 ? "" : "s"} de ${pendingForUser.length} pendiente${pendingForUser.length === 1 ? "" : "s"} en total.`; bg = "#FEE2E2"; fg = "#B91C1C"; ring = "#EF4444";
  }
  const Icon = icon;

  return (
    <div className="rounded-2xl p-5 flex items-center gap-4 flex-wrap shadow-sm" style={{ backgroundColor: bg }}>
      <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 shadow-md" style={{ backgroundColor: "white" }}>
        <Icon size={28} style={{ color: ring }} />
      </div>
      <div className="flex-1 min-w-[200px]">
        <div className="font-extrabold text-2xl leading-tight" style={{ color: fg }}>
          {big}
        </div>
        <div className="text-sm mt-0.5" style={{ color: fg, opacity: 0.85 }}>
          {small}
        </div>
      </div>
      {!noneAssigned && (
        <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 shadow-sm">
          <Trophy size={20} style={{ color: level.color }} />
          <div>
            <div className="text-sm font-bold" style={{ color: BRAND.ink }}>
              {points} pts · Nivel {level.tier} · {level.name}
            </div>
            <div className="text-[11px] text-gray-400">
              {level.nextMin != null ? `${level.nextMin - points} pts para el siguiente nivel` : "Nivel máximo alcanzado"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BadgesRow({ badges }) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => {
        const Icon = b.icon || Award;
        return (
          <div key={b.id} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm" style={{ backgroundColor: `${BRAND.gold}18`, color: "#8A6D1A", border: `1px solid ${BRAND.gold}30` }}>
            <Icon size={13} />
            {b.label}
          </div>
        );
      })}
    </div>
  );
}

function Dashboard({ currentUser, news, pendingForUser, completedForUser, assignedCountForUser, progressPercent, points, level, badges, onOpenCourse }) {
  return (
    <div className="space-y-8">
      {currentUser && (
        <StatusHero currentUser={currentUser} pendingForUser={pendingForUser} assignedCountForUser={assignedCountForUser} points={points} level={level} />
      )}

      {currentUser && (
        <div className="rounded-xl bg-white border p-4 flex items-center gap-4 flex-wrap" style={{ borderColor: "#00000012" }}>
          <Avatar name={currentUser} size={48} />
          <div className="flex-1 min-w-[160px]">
            <div className="font-bold text-base">Hola, {currentUser.split(" ")[0]}</div>
            <div className="text-xs text-gray-500">
              {completedForUser.length} completada{completedForUser.length === 1 ? "" : "s"} · {pendingForUser.length} pendiente{pendingForUser.length === 1 ? "" : "s"}
            </div>
            {badges.length > 0 && (
              <div className="mt-2">
                <BadgesRow badges={badges} />
              </div>
            )}
          </div>
          <ProgressRing percent={progressPercent} color={BRAND.red} label="Progreso total" />
        </div>
      )}

      <div>
        <SectionTitle icon={Newspaper}>Novedades</SectionTitle>
        <div className="space-y-2">
          {news.length === 0 && <div className="text-sm text-gray-400">Sin novedades por ahora.</div>}
          {news.map((n) => (
            <div key={n.id} className="rounded-lg bg-white border p-3" style={{ borderColor: "#00000012" }}>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">{n.title}</div>
                <div className="text-[11px] text-gray-400">{n.date}</div>
              </div>
              <div className="text-xs text-gray-600 mt-1">{n.body}</div>
            </div>
          ))}
        </div>
      </div>

      {currentUser && (
        <div>
          <SectionTitle icon={Clock}>Tus formaciones pendientes</SectionTitle>
          {pendingForUser.length === 0 ? (
            <div className="text-sm text-gray-400">No tienes formaciones pendientes. Al día.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pendingForUser.map((c) => (
                <CourseCard key={c.id} course={c} status="pendiente" onOpen={() => onOpenCourse(c.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {currentUser && completedForUser.length > 0 && (
        <div>
          <SectionTitle icon={CheckCircle2}>Completadas</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {completedForUser.map((c) => (
              <CourseCard key={c.id} course={c} status="completada" onOpen={() => onOpenCourse(c.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function sortByUrgency(list) {
  return [...list].sort((a, b) => {
    const da = a.deadline ? daysUntil(a.deadline) : 9999;
    const db = b.deadline ? daysUntil(b.deadline) : 9999;
    return da - db;
  });
}

function Catalog({ courses, currentUser, groups, getStatus, onOpenCourse }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const visibleCourses = currentUser ? courses.filter((c) => isAssignedToUser(c, currentUser, groups)) : courses;

  if (visibleCourses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#00000008" }}>
          <LayoutGrid size={22} className="text-gray-300" />
        </div>
        <div className="text-sm text-gray-400 max-w-xs">
          {courses.length === 0 ? "Aún no hay formaciones. Añade la primera desde Administración." : "No tienes formaciones asignadas todavía."}
        </div>
      </div>
    );
  }

  const pendingCourses = visibleCourses.filter((c) => !currentUser || getStatus(currentUser, c.id) !== "completada");
  const completedCourses = currentUser ? visibleCourses.filter((c) => getStatus(currentUser, c.id) === "completada") : [];

  return (
    <div className="space-y-8">
      {CATEGORIES.map((cat) => {
        const items = sortByUrgency(pendingCourses.filter((c) => c.category === cat.id));
        if (items.length === 0) return null;
        return (
          <div key={cat.id}>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center rounded-md font-bold text-white text-xs" style={{ backgroundColor: cat.color, width: 24, height: 24 }}>
                {cat.code}
              </span>
              <h2 className="font-bold text-base">{cat.label}</h2>
              <span className="text-[11px] text-gray-400 font-normal">— por plazo más urgente primero</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((c) => (
                <CourseCard key={c.id} course={c} status={currentUser ? getStatus(currentUser, c.id) : "pendiente"} onOpen={() => onOpenCourse(c.id)} />
              ))}
            </div>
          </div>
        );
      })}

      {pendingCourses.length === 0 && completedCourses.length > 0 && (
        <div className="text-sm text-gray-400 text-center py-2">No tienes formaciones pendientes en el catálogo. Al día.</div>
      )}

      {currentUser && completedCourses.length > 0 && (
        <div>
          <button onClick={() => setShowCompleted((v) => !v)} className="flex items-center gap-2 mb-3 w-full text-left">
            <span className="inline-flex items-center justify-center rounded-md font-bold text-white" style={{ backgroundColor: "#22C55E", width: 24, height: 24 }}>
              <CheckCircle2 size={14} />
            </span>
            <h2 className="font-bold text-base text-gray-500">Completadas ({completedCourses.length})</h2>
            {showCompleted ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>
          {showCompleted && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-70">
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

function CourseDetail({ course, currentUser, status, record, quizAnswers, setQuizAnswers, quizResult, onSubmitQuiz, onSelfReport, onBack, onRetry }) {
  const embed = getVideoEmbedUrl(course.videoUrl);
  const quiz = course.quiz || [];
  const allAnswered = quiz.every((_, i) => quizAnswers[i] !== undefined);
  const isGoogleForm = course.testMode === "googleform" && course.googleFormUrl;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold" style={{ color: BRAND.red }}>
        <ChevronLeft size={16} /> Volver al catálogo
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <CategoryTag id={course.category} />
          <h1 className="font-bold text-xl mt-2" style={{ color: BRAND.ink }}>
            {course.title}
          </h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">{course.description}</p>
        </div>
        <DeadlineChip deadline={course.deadline} completed={status === "completada"} />
      </div>

      {course.videoUrl && (
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
            <PlayCircle size={14} /> Vídeo de la formación
          </div>
          <div className="rounded-lg overflow-hidden bg-black aspect-video">
            <iframe src={embed} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={course.title} />
          </div>
          <a
            href={course.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold mt-2"
            style={{ color: BRAND.blue }}
          >
            <PlayCircle size={14} /> Ver el vídeo directamente en su web de origen ↗
          </a>
          <div className="text-[11px] text-gray-400 mt-1">
            Si el reproductor de arriba no carga o aparece bloqueado, usa este enlace — se abre en una pestaña aparte, fuera del Aula Virtual.
          </div>
        </div>
      )}

      {course.presentationUrl && (
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
            <FileText size={14} /> Presentación / material
          </div>
          <div className="rounded-lg overflow-hidden border bg-white" style={{ borderColor: "#00000012" }}>
            <iframe src={course.presentationUrl} className="w-full" style={{ height: 420 }} title={`${course.title}-material`} />
          </div>
          <a href={course.presentationUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold mt-1.5 inline-block" style={{ color: BRAND.blue }}>
            Abrir en una pestaña nueva ↗
          </a>
        </div>
      )}

      {course.attachments && course.attachments.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
            <FileText size={14} /> Documentos adjuntos
          </div>
          <div className="space-y-2">
            {course.attachments.map((att) => (
              <AttachmentViewer key={att.id} att={att} />
            ))}
          </div>
        </div>
      )}

      {isGoogleForm && (
        <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
          <div className="font-bold text-sm mb-1 flex items-center gap-2" style={{ color: BRAND.ink }}>
            <ClipboardList size={16} style={{ color: BRAND.red }} />
            Test final (Google Form)
          </div>
          <div className="text-xs text-gray-500 mb-3">
            Este test se completa en el formulario de abajo. La app no puede comprobar tu respuesta automáticamente — cuando termines, indícalo con el botón.
          </div>
          <div className="rounded-lg overflow-hidden border mb-2" style={{ borderColor: "#00000012" }}>
            <iframe src={getFormEmbedUrl(course.googleFormUrl)} className="w-full" style={{ height: 480 }} title={`${course.title}-form`}>
              Cargando…
            </iframe>
          </div>
          <a href={course.googleFormUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold inline-block mb-3" style={{ color: BRAND.blue }}>
            Abrir el formulario en una pestaña nueva ↗
          </a>
          <div>
            {status === "completada" ? (
              <div className="text-sm text-green-700 font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Marcado como completado {record?.completedAt ? `el ${record.completedAt}` : ""}
              </div>
            ) : (
              <button
                disabled={!currentUser}
                onClick={onSelfReport}
                className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 transition-all duration-150 active:scale-[0.98]"
                style={{ backgroundColor: BRAND.red }}
              >
                Ya he completado el formulario
              </button>
            )}
          </div>
        </div>
      )}

      {!isGoogleForm && quiz.length > 0 && (
        <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
          <div className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: BRAND.ink }}>
            <ClipboardList size={16} style={{ color: BRAND.red }} />
            Test final {record?.attempts ? `· intento ${record.attempts + (quizResult ? 0 : 1)}` : ""}
          </div>

          {status === "completada" && !quizResult ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-green-700 font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Superado {record?.score != null ? `(${record.score}%)` : ""}
              </div>
              <button onClick={onRetry} className="text-xs font-semibold underline text-gray-500">
                Repetir de todas formas
              </button>
            </div>
          ) : quizResult ? (
            <div className="space-y-3">
              <div
                className="rounded-lg p-3 text-sm font-semibold flex items-center gap-2"
                style={{ backgroundColor: quizResult.passed ? "#DCFCE7" : "#FEE2E2", color: quizResult.passed ? "#166534" : "#B91C1C" }}
              >
                {quizResult.passed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {quizResult.passed
                  ? `Superado — ${quizResult.correctCount}/${quizResult.total} correctas (${quizResult.score}%)`
                  : `No alcanzado — ${quizResult.correctCount}/${quizResult.total} correctas (${quizResult.score}%). Necesitas ${course.passPct ?? 70}%.`}
              </div>
              {!quizResult.passed && (
                <button onClick={onRetry} className="text-sm font-semibold rounded-md px-3 py-1.5 text-white transition-all duration-150 active:scale-[0.98]" style={{ backgroundColor: BRAND.red }}>
                  Reintentar test
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {quiz.map((q, qi) => (
                <div key={qi}>
                  <div className="text-sm font-semibold mb-2">
                    {qi + 1}. {q.question}
                  </div>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => (
                      <div
                        key={oi}
                        onClick={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}
                        className="flex items-center gap-2 text-sm rounded-md border px-3 py-2 cursor-pointer transition"
                        style={{ borderColor: quizAnswers[qi] === oi ? BRAND.red : "#00000018", backgroundColor: quizAnswers[qi] === oi ? `${BRAND.red}10` : "white" }}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border flex-shrink-0"
                          style={{ borderColor: quizAnswers[qi] === oi ? BRAND.red : "#00000030", backgroundColor: quizAnswers[qi] === oi ? BRAND.red : "transparent" }}
                        />
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button disabled={!allAnswered || !currentUser} onClick={onSubmitQuiz} className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 transition-all duration-150 active:scale-[0.98]" style={{ backgroundColor: BRAND.red }}>
                Enviar test
              </button>
            </div>
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

function AdminPanel({
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
  onAddNews,
  onDeleteNews,
  onAddEmployee,
  onRemoveEmployee,
  onUpdateEmployeePin,
  onUpdateEmployeeEmail,
  onAddGroup,
  onDeleteGroup,
  onUpdateGroupMembers,
  onManualSetStatus,
  onLoadSeedExamples,
  onExportBackup,
  onImportBackup,
}) {
  const [tab, setTab] = useState("courses");
  const emptyQuestion = { question: "", options: ["", "", "", ""], correct: 0 };
  const emptyAssignment = { mode: "todos", groupIds: [], employeeNames: [] };
  const [draft, setDraft] = useState({
    id: null,
    title: "",
    category: "protocolos",
    description: "",
    videoUrl: "",
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
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeePin, setNewEmployeePin] = useState("");
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [editingPinFor, setEditingPinFor] = useState(null);
  const [editingPinValue, setEditingPinValue] = useState("");
  const [editingEmailFor, setEditingEmailFor] = useState(null);
  const [editingEmailValue, setEditingEmailValue] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [groupMemberSearch, setGroupMemberSearch] = useState({});
  const [assignSearch, setAssignSearch] = useState("");
  const [newNewsTitle, setNewNewsTitle] = useState("");
  const [newNewsBody, setNewNewsBody] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importPending, setImportPending] = useState(null);
  const [importError, setImportError] = useState("");
  const [sheetsUrlDraft, setSheetsUrlDraft] = useState(sheetsUrl || "");
  const [syncStatus, setSyncStatus] = useState("");
  const [manualCourseId, setManualCourseId] = useState("");
  const [manualEmployeeName, setManualEmployeeName] = useState("");
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [examplesMsg, setExamplesMsg] = useState("");

  function resetDraft() {
    setDraft({
      id: null,
      title: "",
      category: "protocolos",
      description: "",
      videoUrl: "",
      presentationUrl: "",
      deadline: "",
      passPct: 70,
      testMode: "interno",
      googleFormUrl: "",
      quiz: [{ ...emptyQuestion }],
      attachments: [],
      assignment: { ...emptyAssignment },
    });
    setFileError("");
  }
  function loadDraft(course) {
    setDraft({
      ...course,
      testMode: course.testMode || "interno",
      googleFormUrl: course.googleFormUrl || "",
      quiz: (course.quiz && course.quiz.length ? course.quiz : [{ ...emptyQuestion }]).map((q) => ({ ...q, options: [...q.options] })),
      attachments: course.attachments ? [...course.attachments] : [],
      assignment: course.assignment ? { ...course.assignment } : { ...emptyAssignment },
    });
    setFileError("");
    setTab("editor");
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
  function removeQuestion(qi) {
    setDraft((d) => ({ ...d, quiz: d.quiz.filter((_, i) => i !== qi) }));
  }
  function canSave() {
    return draft.title.trim().length > 0;
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
    await onSaveCourse({ ...draft, id: draft.id || uid(), attachments: finalAttachments });
    setSaving(false);
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

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "courses", label: "Formaciones" },
          { id: "editor", label: draft.id ? "Editar formación" : "Nueva formación" },
          { id: "news", label: "Novedades" },
          { id: "employees", label: "Empleados" },
          { id: "groups", label: "Grupos" },
          { id: "seguimiento", label: "Seguimiento" },
          { id: "notificaciones", label: "Notificaciones" },
          { id: "backup", label: "Copia de seguridad" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              if (t.id === "editor" && !draft.title && tab !== "editor") resetDraft();
              setTab(t.id);
            }}
            className="text-sm font-semibold px-3 py-1.5 rounded-md"
            style={{ backgroundColor: tab === t.id ? BRAND.red : "white", color: tab === t.id ? "white" : BRAND.ink, border: `1px solid ${tab === t.id ? BRAND.red : "#00000018"}` }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "courses" && (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap items-center mb-2">
            <button
              onClick={() => {
                resetDraft();
                setTab("editor");
              }}
              className="flex items-center gap-1.5 text-sm font-bold rounded-md px-3 py-2 text-white"
              style={{ backgroundColor: BRAND.red }}
            >
              <Plus size={15} /> Nueva formación
            </button>
            <button
              disabled={loadingExamples}
              onClick={async () => {
                setLoadingExamples(true);
                const added = await onLoadSeedExamples();
                setLoadingExamples(false);
                setExamplesMsg(`Ejemplos actualizados (${added} formaciones/novedades). Si tenías progreso guardado en las versiones antiguas, se ha reiniciado.`);
                setTimeout(() => setExamplesMsg(""), 6000);
              }}
              className="flex items-center gap-1.5 text-sm font-semibold rounded-md px-3 py-2 border disabled:opacity-40"
              style={{ borderColor: BRAND.red, color: BRAND.red }}
            >
              {loadingExamples && <Loader2 size={14} className="animate-spin" />}
              Cargar / actualizar formaciones de ejemplo
            </button>
            {examplesMsg && <span className="text-xs text-gray-500">{examplesMsg}</span>}
          </div>
          {courses.length === 0 && <div className="text-sm text-gray-400">No hay formaciones todavía.</div>}
          {courses.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border bg-white p-3" style={{ borderColor: "#00000012" }}>
              <div className="flex items-center gap-2 min-w-0">
                <CategoryTag id={c.category} small />
                <div className="font-semibold text-sm truncate">{c.title}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => loadDraft(c)} className="text-xs font-semibold px-2 py-1 rounded" style={{ color: BRAND.blue }}>
                  Editar
                </button>
                <button onClick={() => onDeleteCourse(c.id)} className="text-xs font-semibold px-2 py-1 rounded text-red-600 flex items-center gap-1">
                  <Trash2 size={13} /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "editor" && (
        <div className="rounded-xl border bg-white p-4 space-y-4 shadow-sm" style={{ borderColor: "#00000012" }}>
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
            Descripción
            <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={2} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }} />
          </label>

          <TextInput label="URL del vídeo (YouTube o Vimeo)" value={draft.videoUrl} onChange={(v) => setDraft((d) => ({ ...d, videoUrl: v }))} placeholder="https://www.youtube.com/watch?v=..." />
          <TextInput label="URL de la presentación (link embebible)" value={draft.presentationUrl} onChange={(v) => setDraft((d) => ({ ...d, presentationUrl: v }))} placeholder="https://..." />

          <div className="flex gap-4 flex-wrap">
            <div className="w-40">
              <TextInput label="Fecha límite" type="date" value={draft.deadline} onChange={(v) => setDraft((d) => ({ ...d, deadline: v }))} />
            </div>
            {draft.testMode !== "googleform" && (
              <div className="w-40">
                <TextInput label="% para aprobar el test" type="number" value={draft.passPct} onChange={(v) => setDraft((d) => ({ ...d, passPct: Number(v) }))} />
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">Cómo se hace el test</div>
            <div className="flex gap-2 flex-wrap mb-2">
              {[
                { id: "interno", label: "Preguntas dentro de la app" },
                { id: "googleform", label: "Google Form (externo)" },
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
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-gray-500">Preguntas del test</div>
                  <button onClick={addQuestion} className="text-xs font-semibold flex items-center gap-1" style={{ color: BRAND.blue }}>
                    <Plus size={13} /> Añadir pregunta
                  </button>
                </div>
                <div className="space-y-3">
                  {draft.quiz.map((q, qi) => (
                    <div key={qi} className="rounded-lg border p-3" style={{ borderColor: "#00000018" }}>
                      <div className="flex items-center justify-between gap-2 mb-2">
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
            )}
          </div>

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

          <div className="flex gap-2">
            <button disabled={!canSave() || saving} onClick={handleSave} className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 transition-all duration-150 active:scale-[0.98]" style={{ backgroundColor: BRAND.red }}>
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

      {tab === "news" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 space-y-3 shadow-sm" style={{ borderColor: "#00000012" }}>
            <TextInput label="Título de la novedad" value={newNewsTitle} onChange={setNewNewsTitle} placeholder="Ej. Nueva formación disponible" />
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Contenido
              <textarea value={newNewsBody} onChange={(e) => setNewNewsBody(e.target.value)} rows={2} className="mt-1 w-full text-sm rounded-md border px-3 py-2 font-normal text-gray-900" style={{ borderColor: "#00000020" }} />
            </label>
            <button
              disabled={!newNewsTitle.trim()}
              onClick={() => {
                onAddNews({ id: uid(), date: todayISO(), title: newNewsTitle, body: newNewsBody });
                setNewNewsTitle("");
                setNewNewsBody("");
              }}
              className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40"
              style={{ backgroundColor: BRAND.red }}
            >
              Publicar novedad
            </button>
          </div>
          <div className="space-y-2">
            {news.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-2 rounded-lg border bg-white p-3" style={{ borderColor: "#00000012" }}>
                <div>
                  <div className="font-semibold text-sm">{n.title}</div>
                  <div className="text-xs text-gray-500">{n.body}</div>
                  <div className="text-[11px] text-gray-400 mt-1">{n.date}</div>
                </div>
                <button onClick={() => onDeleteNews(n.id)} className="text-red-500 flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "employees" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 flex items-end gap-2 flex-wrap shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="flex-1 min-w-[160px]">
              <TextInput label="Nombre del empleado" value={newEmployeeName} onChange={setNewEmployeeName} placeholder="Nombre y apellido" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <TextInput label="Email" value={newEmployeeEmail} onChange={setNewEmployeeEmail} placeholder="nombre@munozbosch.com" type="email" />
            </div>
            <div className="w-28">
              <TextInput label="PIN (4 dígitos)" value={newEmployeePin} onChange={(v) => setNewEmployeePin(v.replace(/\D/g, "").slice(0, 4))} placeholder="0000" />
            </div>
            <button
              disabled={!newEmployeeName.trim() || newEmployeePin.length !== 4}
              onClick={() => {
                onAddEmployee(newEmployeeName, newEmployeePin, newEmployeeEmail);
                setNewEmployeeName("");
                setNewEmployeePin("");
                setNewEmployeeEmail("");
              }}
              className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 mb-1"
              style={{ backgroundColor: BRAND.red }}
            >
              Añadir
            </button>
          </div>

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
                    <Avatar name={e.name} size={30} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{e.name}</div>
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
                          {e.email || "Sin email — añadir"}
                        </button>
                      )}
                    </div>
                    {!e.pin && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 flex-shrink-0">Sin PIN</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editingPinFor === e.name ? (
                      <>
                        <input
                          value={editingPinValue}
                          onChange={(ev) => setEditingPinValue(ev.target.value.replace(/\D/g, "").slice(0, 4))}
                          placeholder="0000"
                          className="w-16 text-sm rounded-md border px-2 py-1"
                          style={{ borderColor: "#00000020" }}
                        />
                        <button
                          disabled={editingPinValue.length !== 4}
                          onClick={() => {
                            onUpdateEmployeePin(e.name, editingPinValue);
                            setEditingPinFor(null);
                            setEditingPinValue("");
                          }}
                          className="text-xs font-semibold disabled:opacity-40"
                          style={{ color: BRAND.blue }}
                        >
                          Guardar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPinFor(e.name);
                          setEditingPinValue("");
                        }}
                        className="text-xs font-semibold"
                        style={{ color: BRAND.blue }}
                      >
                        {e.pin ? "Cambiar PIN" : "Asignar PIN"}
                      </button>
                    )}
                    <button onClick={() => onRemoveEmployee(e.name)} className="text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {tab === "groups" && (
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

      {tab === "seguimiento" && (
        <div className="space-y-3">
          <button
            onClick={onLoadTracking}
            disabled={loadingTracking}
            className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 flex items-center gap-2 transition-all duration-150 active:scale-[0.98]"
            style={{ backgroundColor: BRAND.red }}
          >
            {loadingTracking && <Loader2 size={14} className="animate-spin" />}
            {loadingTracking ? "Cargando..." : "Cargar / actualizar seguimiento"}
          </button>
          <div className="text-[11px] text-gray-400">
            Con muchos empleados y formaciones esto puede tardar unos segundos — cada formación guarda su progreso por separado, precisamente para que nadie pierda datos si varias personas terminan un test a la vez.
          </div>

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

          <div className="rounded-xl border bg-white overflow-hidden shadow-sm" style={{ borderColor: "#00000012" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b" style={{ borderColor: "#00000012" }}>
                  <th className="px-3 py-2">Empleado</th>
                  <th className="px-3 py-2">Formación</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Nota</th>
                  <th className="px-3 py-2">Intentos</th>
                </tr>
              </thead>
              <tbody>
                {completionRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                      Todavía no hay actividad cargada. Pulsa "Cargar / actualizar seguimiento".
                    </td>
                  </tr>
                )}
                {completionRows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: "#00000008" }}>
                    <td className="px-3 py-2 font-medium">{r.employee}</td>
                    <td className="px-3 py-2">{r.courseTitle}</td>
                    <td className="px-3 py-2">
                      {r.status === "completada" ? (
                        <span className="text-green-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={13} /> Completada
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold">En progreso</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{r.score != null ? `${r.score}%` : "—"}</td>
                    <td className="px-3 py-2">{r.attempts || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "notificaciones" && (
        <div className="space-y-4">
          <button
            onClick={onLoadTracking}
            disabled={loadingTracking}
            className="text-sm font-bold rounded-md px-4 py-2 text-white disabled:opacity-40 flex items-center gap-2 transition-all duration-150 active:scale-[0.98]"
            style={{ backgroundColor: BRAND.red }}
          >
            {loadingTracking && <Loader2 size={14} className="animate-spin" />}
            {loadingTracking ? "Cargando..." : "Actualizar lista de pendientes"}
          </button>

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
                      Nadie tiene formaciones pendientes ahora mismo (o falta pulsar "Actualizar lista de pendientes").
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

      {tab === "backup" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "#00000012" }}>
            <div className="font-bold text-sm mb-1">Estado de la copia de seguridad</div>
            <div className="text-xs text-gray-500 mb-3">
              {lastBackupAt
                ? `Última copia exportada: ${new Date(lastBackupAt).toLocaleString("es-ES")}`
                : "Todavía no has exportado ninguna copia de seguridad."}
            </div>
            <div className="text-[11px] text-gray-400 rounded-md p-2.5 mb-3" style={{ backgroundColor: "#00000008" }}>
              Esto descarga un archivo a tu ordenador con todo lo que hay guardado ahora mismo. Guárdalo en SharePoint, Drive o donde tengáis vuestras copias — cuanto más lejos de este mismo sistema, mejor protegido está. El archivo incluye los PIN de acceso: trátalo como información sensible.
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

function payloadDate(payload) {
  try {
    return new Date(payload.exportedAt).toLocaleString("es-ES");
  } catch {
    return "fecha desconocida";
  }
}

function toCsv(rows) {
  const headers = ["Nombre", "Email", "Formacion", "Categoria", "FechaLimite", "DiasRestantes", "Estado"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const vals = [r.nombre, r.email, r.formacion, r.categoria, r.fechaLimite, r.diasRestantes ?? "", r.estado];
    lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(rows) {
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
