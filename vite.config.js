import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // En local (npm run dev), Vite sirve la aplicación en su propio puerto
    // (normalmente 5173) mientras el servidor (npm run server) corre aparte
    // en el puerto 3000. Esto reenvía cualquier llamada a /api/... hacia ese
    // servidor, para que el navegador no note la diferencia.
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
