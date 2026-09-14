import { createClient } from "@supabase/supabase-js";

// Credenciales de Supabase: se leen de variables de entorno (ver .env.example).
// Nunca pongas aquí la "service_role key" — solo la "anon public key",
// que está pensada para vivir en el navegador.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
