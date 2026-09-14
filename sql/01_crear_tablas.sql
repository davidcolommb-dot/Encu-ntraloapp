-- ============================================================================
-- Aula Virtual Muñoz Bosch — Creación de tablas en SQL Server
-- ============================================================================
-- Enfoque: UNA tabla, tipo "clave-valor", igual que se usaba en Supabase
-- (tabla app_storage). Es deliberado, no un descuido: rediseñar todo a un
-- modelo relacional "de libro" (una tabla por cada cosa: formaciones,
-- empleados, grupos...) sería mucho más trabajo y mucho más riesgo de romper
-- algo, para un beneficio que hoy no hace falta. Con esto, migrar es cambiar
-- SOLO cómo se guarda y se lee — el resto de la aplicación no se entera.
--
-- Ejecutar este script una sola vez, conectado a la base de datos ya creada
-- (la que Lisbet indique en SQL_SERVER.databaseName de la configuración).
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'app_storage')
BEGIN
    CREATE TABLE app_storage (
        [key]        NVARCHAR(200)   NOT NULL PRIMARY KEY,
        [value]      NVARCHAR(MAX)   NOT NULL,  -- JSON, igual que en Supabase
        updated_at   DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME()
    );

    PRINT 'Tabla app_storage creada correctamente.';
END
ELSE
BEGIN
    PRINT 'La tabla app_storage ya existía — no se ha tocado nada.';
END
GO

-- Índice para que buscar por fecha de actualización (ej. "¿qué cambió
-- recientemente?") sea rápido, aunque hoy no se use activamente.
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_app_storage_updated_at')
BEGIN
    CREATE INDEX IX_app_storage_updated_at ON app_storage(updated_at);
END
GO
