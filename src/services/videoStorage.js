import { supabase } from "../lib/supabaseClient";
import { uid } from "../utils/ids";

// NOTA: sin usar desde que se quitó la subida de vídeo propio del editor.
// Candidato a eliminar en la Fase 11 (optimización) si se confirma que no hace falta.
// Vídeo propio: a diferencia de los documentos (que se guardan como texto en
// la tabla normal, bien para archivos pequeños), un vídeo necesita el
// almacenamiento de archivos de Supabase — un cubo ("bucket") aparte,
// pensado para esto. VIDEO_MAX_SIZE_MB coincide con el máximo del plan
// gratuito de Supabase (50 MB por archivo); si en algún momento se pasa al
// plan de pago, este número es lo único que habría que subir.
export const VIDEO_BUCKET = "videos";
export const VIDEO_MAX_SIZE_MB = 50;
export async function uploadVideoFile(file) {
  if (file.size > VIDEO_MAX_SIZE_MB * 1024 * 1024) {
    return { error: `El vídeo pesa demasiado (máximo ${VIDEO_MAX_SIZE_MB} MB en el plan actual). Compruébalo comprimiéndolo o recortándolo.` };
  }
  const path = `${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, { contentType: file.type });
  if (error) {
    return { error: `No se pudo subir el vídeo: ${error.message}` };
  }
  const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl, sizeKB: Math.round(file.size / 1024), mimeType: file.type };
}
export async function deleteVideoFile(path) {
  if (!path) return;
  try {
    await supabase.storage.from(VIDEO_BUCKET).remove([path]);
  } catch (err) {
    // Si falla el borrado del archivo en Storage, no bloqueamos el resto de
    // la operación — como mucho queda un archivo huérfano ocupando espacio,
    // que se puede limpiar luego a mano desde el panel de Supabase.
  }
}
