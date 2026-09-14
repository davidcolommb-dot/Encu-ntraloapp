// ============================================================================
// Servidor de la Aula Virtual — reemplaza a Supabase + Cloudflare.
// ============================================================================
// Qué hace, en tres partes:
//   1. Sirve la propia aplicación (los archivos ya compilados en dist/).
//   2. Da acceso a SQL Server a través de unas pocas rutas HTTP sencillas
//      (/api/storage/...) — el navegador nunca habla con SQL Server
//      directamente, solo con este servidor, que es quien sabe la contraseña.
//   3. Sirve los vídeos que pida la aplicación, leyéndolos del servidor de
//      vídeos (una carpeta de red montada en este mismo servidor).
// ============================================================================

import express from "express";
import path from "path";
import fs from "fs";
import sql from "mssql";
import { fileURLToPath } from "url";
import { APP_SERVER, SQL_SERVER, VIDEO_SERVER } from "../config/server.config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: "15mb" })); // formaciones con documentos adjuntos pueden pesar varios MB

// ----------------------------------------------------------------------------
// Conexión a SQL Server — un único "pool" de conexiones reutilizado en toda
// la vida del servidor, en vez de abrir una conexión nueva en cada petición
// (eso sería mucho más lento y acabaría agotando conexiones).
// ----------------------------------------------------------------------------
let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect({
      server: SQL_SERVER.host,
      port: SQL_SERVER.port,
      database: SQL_SERVER.databaseName,
      user: SQL_SERVER.user,
      password: SQL_SERVER.password,
      options: {
        trustServerCertificate: true, // habitual en redes internas sin certificado público
        encrypt: false,
      },
    });
  }
  return poolPromise;
}

// ----------------------------------------------------------------------------
// API de almacenamiento — sustituye exactamente a loadKey/saveKey/deleteKey
// que antes hablaban con Supabase.
// ----------------------------------------------------------------------------

app.get("/api/storage/:key", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("key", sql.NVarChar, req.params.key)
      .query("SELECT [value] FROM app_storage WHERE [key] = @key");
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "no encontrado" });
    }
    res.json({ value: JSON.parse(result.recordset[0].value) });
  } catch (err) {
    console.error("[SQL] Error al leer " + req.params.key + ":", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/storage/:key", async (req, res) => {
  try {
    const pool = await getPool();
    const valueJson = JSON.stringify(req.body.value);
    await pool
      .request()
      .input("key", sql.NVarChar, req.params.key)
      .input("value", sql.NVarChar(sql.MAX), valueJson)
      .query(`
        MERGE app_storage AS target
        USING (SELECT @key AS [key]) AS source
        ON target.[key] = source.[key]
        WHEN MATCHED THEN
          UPDATE SET [value] = @value, updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT ([key], [value], updated_at) VALUES (@key, @value, SYSUTCDATETIME());
      `);
    res.json({ ok: true });
  } catch (err) {
    console.error("[SQL] Error al guardar " + req.params.key + ":", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/storage/:key", async (req, res) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("key", sql.NVarChar, req.params.key)
      .query("DELETE FROM app_storage WHERE [key] = @key");
    res.json({ ok: true });
  } catch (err) {
    console.error("[SQL] Error al borrar " + req.params.key + ":", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// Vídeos, segmentados por carpeta — lee del servidor físico de vídeos.
// VIDEO_SERVER.address debe ser la ruta LOCAL, en este mismo servidor, donde
// Lisbet monte la carpeta compartida de red.
// ----------------------------------------------------------------------------
app.get("/api/videos/:folder/:filename", (req, res) => {
  const { folder, filename } = req.params;

  if (folder.includes("..") || filename.includes("..") || folder.includes("/") || filename.includes("/")) {
    return res.status(400).json({ error: "ruta no válida" });
  }

  const videoPath = path.join(VIDEO_SERVER.address, folder, filename);

  fs.stat(videoPath, (err, stats) => {
    if (err) return res.status(404).json({ error: "vídeo no encontrado" });

    const range = req.headers.range;
    if (!range) {
      res.writeHead(200, { "Content-Length": stats.size, "Content-Type": "video/mp4" });
      return fs.createReadStream(videoPath).pipe(res);
    }
    const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : stats.size - 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": "video/mp4",
    });
    fs.createReadStream(videoPath, { start, end }).pipe(res);
  });
});

app.get("/api/videos/:folder", (req, res) => {
  const { folder } = req.params;
  if (folder.includes("..") || folder.includes("/")) {
    return res.status(400).json({ error: "ruta no válida" });
  }
  const folderPath = path.join(VIDEO_SERVER.address, folder);
  fs.readdir(folderPath, (err, files) => {
    if (err) return res.status(404).json({ error: "carpeta no encontrada" });
    res.json({ files: files.filter((f) => /\.(mp4|webm|mov)$/i.test(f)) });
  });
});

// ----------------------------------------------------------------------------
// Sirve la propia aplicación (el resultado de "npm run build", en dist/)
// ----------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, "..", "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

// ----------------------------------------------------------------------------
app.listen(APP_SERVER.port || 3000, () => {
  console.log(`Aula Virtual escuchando en el puerto ${APP_SERVER.port || 3000}`);
});
