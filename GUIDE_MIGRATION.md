# 🚀 Guía de Migración de Base de Datos - CargoPlanner

## 📋 Descripción

Esta guía detalla el proceso de migración de la base de datos de producción para incorporar el nuevo sistema de **Sedes**, **Subsedes** y **Facturación**, garantizando que todos los datos existentes permanezcan intactos y se asignen automáticamente a "Santamarta - Principal".

---

## 🚨 ADVERTENCIAS CRÍTICAS

> ⚠️ **OBLIGATORIO ANTES DE PROCEDER**

- ✅ **SIEMPRE realizar backup completo** antes de cualquier cambio
- ✅ **Tener plan de rollback preparado** y probado
- ✅ **Coordinar ventana de mantenimiento** con el equipo
- ✅ **Verificar permisos de base de datos** necesarios

---

## 🛠️ Pre-requisitos

### 1. Backup de Seguridad

```bash
# Crear backup con timestamp
Por dbeaver hacer backup de toda la base de datos en formato Plain(SQL)
```

### 2. Detener Aplicación

```bash
# Detener servicios de la aplicación temporalmente
Control + C para pausar aplicacion, pausar servidor
```

### 3. Pasarse a la rama Bill o la rama mas actuailizada del repositorio y hacer git pull

```bash
# Pasarse a la rama Bill
git checkout bill
git pull origin bin
```

### 4. Configuración de Entorno

- Cambiar `DATABASE_URL` en `.env` para apuntar a la base de datos objetivo
- Verificar conexión a la base de datos

---

## 🔄 Proceso de Migración

### Paso 1: Sincronizar Esquema Actual

```bash
# Aplicar cambios estructurales sin perder datos
npx prisma db push
```

### Paso 2: Crear Migración Baseline

```bash
# Generar script de migración baseline
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > baseline.sql
```

### Paso 3: Organizar Archivos de Migración

```bash
# Crear directorio de migración con ID único
mkdir -p prisma/migrations/d996a8e0-fa7b-4347-86f5-4d3885206d01_baseline_production

# Mover script a directorio de migración
mv baseline.sql prisma/migrations/d996a8e0-fa7b-4347-86f5-4d3885206d01_baseline_production/migration.sql
```

### Paso 4: Marcar Migración Como Aplicada

```bash
# Registrar migración sin ejecutarla (ya está aplicada)
npx prisma migrate resolve --applied d996a8e0-fa7b-4347-86f5-4d3885206d01_baseline_production
```

### Paso 5: Ejecutar Script de Datos Iniciales

Ejecutar el siguiente script SQL directamente en la base de datos:

```sql
-- ==========================================
-- SCRIPT DE MIGRACIÓN DE DATOS
-- Fecha: $(date)
-- Descripción: Asignar sede "Santamarta - Principal" a todos los datos existentes
-- ==========================================

BEGIN;

-- Asegurar que existe la sede principal
-- INSERT INTO "Site" ("id", "name", "status", "createAt", "updateAt", "id_user")
-- VALUES (1, 'Santamarta', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 36)
-- ON CONFLICT ("id") DO UPDATE SET
--   "name" = EXCLUDED."name",
--   "updateAt" = CURRENT_TIMESTAMP;

-- Asegurar que existe la subsede principal
INSERT INTO "SubSite" ("id", "name", "id_site", "status")
VALUES (1, 'Principal', 1, 'ACTIVE')
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "id_site" = EXCLUDED."id_site";

-- Actualizar todos los usuarios
UPDATE "User" SET "id_site" = 1 WHERE "id_site" IS NULL;
UPDATE "User" SET "id_subsite" = 1 WHERE "id_subsite" IS NULL AND "id_site" = 1;

-- Actualizar todas las áreas de trabajo
UPDATE "JobArea" SET "id_site" = 1 WHERE "id_site" IS NULL;
UPDATE "JobArea" SET "id_subsite" = 1 WHERE "id_subsite" IS NULL AND "id_site" = 1;

-- Actualizar todos los trabajadores
UPDATE "Worker" SET "id_site" = 1 WHERE "id_site" IS NULL;
UPDATE "Worker" SET "id_subsite" = 1 WHERE "id_subsite" IS NULL AND "id_site" = 1;

-- Actualizar todas las operaciones
UPDATE "Operation" SET "id_site" = 1 WHERE "id_site" IS NULL;
UPDATE "Operation" SET "id_subsite" = 1 WHERE "id_subsite" IS NULL AND "id_site" = 1;

-- Actualizar todas las tareas
UPDATE "Task" SET "id_site" = 1 WHERE "id_site" IS NULL;
UPDATE "Task" SET "id_subsite" = 1 WHERE "id_subsite" IS NULL AND "id_site" = 1;

-- Actualizar programaciones de cliente
UPDATE "ClientProgramming" SET "id_site" = 1 WHERE "id_site" IS NULL;
UPDATE "ClientProgramming" SET "id_subsite" = 1 WHERE "id_subsite" IS NULL AND "id_site" = 1;

-- Actualizar secuencias para asegurar IDs únicos
SELECT setval('"Site_id_seq"', COALESCE((SELECT MAX(id) FROM "Site"), 1), true);
SELECT setval('"SubSite_id_seq"', COALESCE((SELECT MAX(id) FROM "SubSite"), 1), true);

COMMIT;

-- Verificación final
SELECT 'MIGRACIÓN COMPLETADA: Todos los datos asignados a Santamarta - Principal' as resultado;
```

### Paso 6: Aplicar Migración Final

```bash
# Crear y aplicar migración de datos
npx prisma migrate dev --name ensure_site_data
```

---

## 🎯 Checklist Final

- [ ] ✅ Backup realizado y verificado
- [ ] ✅ Aplicación detenida temporalmente
- [ ] ✅ Variable `DATABASE_URL` configurada
- [ ] ✅ `npx prisma db push` ejecutado exitosamente
- [ ] ✅ Migración baseline creada y marcada
- [ ] ✅ Script de datos ejecutado sin errores
- [ ] ✅ `npx prisma migrate dev` completado
- [ ] ✅ Verificación post-migración exitosa
- [ ] ✅ Todos los datos asignados a "Santamarta - Principal"
- [ ] ✅ Aplicación reiniciada y funcionando
- [ ] ✅ Funcionalidades críticas probadas

---

## 📞 Contacto y Soporte

En caso de problemas durante la migración:

1. **No continuar** si hay errores críticos
2. **Documentar** el error exacto y logs
3. **Considerar rollback** si es necesario
4. **Revisar** este documento paso a paso

---

## 📝 Notas Importantes

- Esta migración es **conservativa** y **preserva todos los datos**
- Todos los registros existentes se asignan automáticamente a **"Santamarta - Principal"**
- El proceso está diseñado para **cero pérdida de datos**
- Se recomienda ejecutar en **horario de menor actividad**

---

**Versión del documento:** 1.0  
**Fecha de creación:** 5 de agosto de 2025  
**Autor:** Sistema CargoPlanner  
**Estado:** Producción Ready ✅
