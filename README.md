# Mini CRM Logistic

CRM multi-tenant orientado a equipos comerciales del sector logística. El proyecto está construido con `Next.js 16`, `React 19`, `Prisma`, `NextAuth` y `shadcn/ui`, con foco en gestión de leads, control de acceso por rol y monetización por planes/features.

## Estado actual

### Ya implementado

- Autenticación por credenciales y acceso `SuperAdmin`.
- Multi-tenancy por `tenantSlug`.
- RBAC por tenant (`ADMIN`, `SUPERVISOR`, `VENDEDOR`, `FREELANCE`, `PASANTE`).
- CRUD de leads con filtros, asignación y reasignación.
- Importación MVP de leads por CSV pegado en texto.
- Detección y fusión MVP de duplicados por RUC, email, teléfono y nombre normalizado.
- Dashboard tenant operativo con pipeline por estado y actividad reciente.
- Dashboard tenant con señales operativas de importación y duplicados.
- Lead detail page con vista comercial, contacto e historial de reasignaciones.
- Panel `SuperAdmin` para tenants, planes y features.
- Gestión de equipo con alta, activación/desactivación y remoción segura.
- Invitaciones de equipo con onboarding por enlace seguro y aceptación para usuarios nuevos o existentes.
- Configuración de Prisma migrada a `prisma.config.ts` y runtime conectado con `@prisma/adapter-pg`.
- Suite inicial de pruebas unitarias con `Vitest`.

### En progreso

- Preparación de Sprint 6: hardening para producción.

### Pendiente

- Documents MVP.
- Tasks, interactions, notifications y client portal.
- Hardening productivo: auditoría, observabilidad y más tests.

## Roadmap resumido

| Sprint | Objetivo                                         | Estado        |
| ------ | ------------------------------------------------ | ------------- |
| 2.1    | Estabilización de `team`                         | ✅ Completado |
| 2.2    | Reasignaciones + validaciones del core comercial | ✅ Completado |
| 2.3    | Configuración Prisma + pruebas base              | ✅ Completado |
| 3      | Lead detail + dashboard útil para operación      | ✅ Completado |
| 4      | Documents MVP o Import/Dedupe MVP                | ✅ Completado |
| 5      | Invitaciones / onboarding de usuarios            | ✅ Completado |
| 6      | Hardening para producción                        | ⏳ Pendiente  |

## Stack

- `Next.js 16.1.4`
- `React 19.2`
- `NextAuth 5 beta`
- `Prisma 7.6`
- `@prisma/adapter-pg`
- `PostgreSQL`
- `Tailwind CSS 4`
- `shadcn/ui`
- `Zod`
- `Vitest`

## Requisitos

- `Node.js 20+`
- `pnpm`
- Base de datos PostgreSQL accesible desde `DATABASE_URL`

## Variables de entorno

El proyecto usa `.env` y trae una plantilla en `.env.example`.

Variables mínimas:

- `DATABASE_URL`

## Puesta en marcha

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Configurar entorno

```bash
copy .env.example .env
```

Completa `DATABASE_URL` con tu conexión local o remota.

### 3. Generar cliente Prisma y aplicar migraciones

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

### 4. Cargar datos semilla

```bash
pnpm prisma:seed
```

Usuarios de prueba creados por el seed:

- `superadmin@example.com / changeme`
- `admin@acme.com / admin123`
- `vendedor@acme.com / vendedor123`

### 5. Levantar la app

```bash
pnpm dev
```

## Scripts principales

| Script                 | Descripción                        |
| ---------------------- | ---------------------------------- |
| `pnpm dev`             | Levanta el entorno de desarrollo   |
| `pnpm build`           | Compila la aplicación              |
| `pnpm lint`            | Ejecuta ESLint                     |
| `pnpm test`            | Corre pruebas unitarias con Vitest |
| `pnpm test:watch`      | Modo watch de Vitest               |
| `pnpm prisma:generate` | Genera Prisma Client               |
| `pnpm prisma:migrate`  | Ejecuta migraciones de desarrollo  |
| `pnpm prisma:validate` | Valida schema/config de Prisma     |
| `pnpm prisma:seed`     | Carga datos semilla                |
| `pnpm prisma:studio`   | Abre Prisma Studio                 |

## Estructura funcional actual

### Tenant app

- `app/[tenantSlug]/dashboard`
- `app/[tenantSlug]/leads`
- `app/[tenantSlug]/leads/[id]`
- `app/[tenantSlug]/leads/import`
- `app/[tenantSlug]/leads/dedupe`
- `app/[tenantSlug]/team`
- `app/[tenantSlug]/profile`
- `app/[tenantSlug]/documents` _(placeholder)_

### Auth / onboarding

- `app/(auth)/login`
- `app/(auth)/invite/[token]`

### SuperAdmin

- `app/(superadmin)/superadmin`
- `app/(superadmin)/superadmin/plans`
- `app/(superadmin)/superadmin/tenants`

## Últimos avances documentados

### Sprint 2.1

- Permisos coherentes en módulo `team`.
- Protección de ruta `team/new`.
- Remoción real de miembros.
- Salvaguardas para no autoeliminar admins ni dejar tenants sin administradores.

### Sprint 2.2

- Reglas de owners elegibles para leads (`VENDEDOR+`).
- Prevención de solicitudes pendientes duplicadas.
- Validación de owner sugerido en reasignaciones.
- Resolución de reasignaciones con owner final y nota opcional.

### Sprint 2.3

- Migración completa a `prisma.config.ts`.
- Upgrade a Prisma `7.6.0`.
- Integración de `@prisma/adapter-pg` para runtime y seed.
- Eliminación de configuración Prisma deprecada en `package.json`.
- Arranque de suite de pruebas unitarias con `Vitest`.

### Sprint 3

- Nueva ruta `lead detail` con resumen comercial, datos de contacto y historial de reasignaciones.
- Dashboard enriquecido con métricas accionables, pipeline por estado y actividad reciente.
- Navegación directa desde listado/dashboards hacia el detalle de cada lead.
- Helper compartido de estados para reutilizar etiquetas y variantes entre vistas.

### Sprint 4 (cierre)

- Nueva ruta `leads/import` para importación MVP vía CSV pegado en texto.
- Nueva ruta `leads/dedupe` para revisar grupos duplicados y fusionarlos.
- Server actions para importar leads y fusionar duplicados con revalidación de vistas.
- Utilidades puras para parsing CSV, normalización y agrupación determinística de duplicados.
- Cobertura de pruebas para import utils, dedupe utils, validadores y permisos extendidos.
- Navegación lateral para `Importación` y `Duplicados` cuando las features están habilitadas.
- Dashboard con accesos rápidos y métricas de grupos duplicados detectados.
- Preflight de importación con análisis previo antes de confirmar altas masivas.
- Diálogo de dedupe con preview del resultado estimado de la fusión.
- Tenant demo del seed alineado al plan `Growth` para exponer `IMPORT` y `DEDUPE` en entornos de prueba.

### Sprint 5 (cierre)

- Nuevo flujo de invitaciones de equipo desde `team/new`, sin contraseñas administradas por terceros.
- Tabla operativa de invitaciones abiertas con estados, cancelación y regeneración de enlace.
- Onboarding público en `invite/[token]` para aceptar la invitación y entrar automáticamente al tenant.
- Compatibilidad con usuarios nuevos y con usuarios ya existentes en la plataforma.
- Reserva de cupos del plan mientras existan invitaciones activas para evitar sobreasignación.
- Nueva cobertura de pruebas para validadores y utilidades del flujo de invitaciones.

## Calidad y validación

Antes de cerrar un hito o sprint:

1. Ejecutar `pnpm lint`
2. Ejecutar `pnpm test`
3. Ejecutar `pnpm build`
4. Actualizar `README.md`
5. Actualizar `CHANGELOG.md`

## Documentación viva

Este repositorio sigue una regla simple:

- cada hito cerrado actualiza `README.md`
- cada avance funcional se registra en `CHANGELOG.md`

Sí, la idea es que la documentación deje de ir un sprint por detrás del código. Milagros modernos.
