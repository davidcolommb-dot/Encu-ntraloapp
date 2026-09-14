import { uid } from "../utils/ids";
import { saveKey } from "./storage";

// Convierte formaciones semilla (con adjuntos en base64 "en crudo") en formaciones
// listas para usar: sube cada adjunto a su propia clave de almacenamiento y deja
// en el curso solo la referencia ligera {id, name, mimeType, sizeKB, storageKey}.
export async function materializeSeedCourses(seedList) {
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
      createdAt: c.createdAt || new Date().toISOString(),
    });
  }
  return result;
}
