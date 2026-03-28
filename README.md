# Mini CRM Logistic

CRM multi-tenant orientado a equipos comerciales del sector logística. El proyecto está construido con `Next.js 16`, `React 19`, `Prisma`, `NextAuth` y `shadcn/ui`, con foco en gestión de leads, control de acceso por rol y monetización por planes/features.

## Estado actual

### Ya implementado

- Autenticación por credenciales y acceso `SuperAdmin`.
- Multi-tenancy por `tenantSlug`.
- RBAC por tenant (`ADMIN`, `SUPERVISOR`, `VENDEDOR`, `FREELANCE`, `PASANTE`).
- CRUD de leads con filtros, asignación y reasignación.
- Dashboard tenant básico.
- Panel `SuperAdmin` para tenants, planes y features.
- Gestión de equipo con alta, activación/desactivación y remoción segura.
- Configuración de Prisma migrada a `prisma.config.ts` y runtime conectado con `@prisma/adapter-pg`.
- Suite inicial de pruebas unitarias con `Vitest`.

### En progreso

- Sprint 2.2: robustecimiento del flujo de reasignaciones y validación de owners elegibles.
- Sprint 2.3: estabilización de tooling Prisma 7 y cobertura de pruebas del core.

### Pendiente

- Lead detail page.
- Documents MVP.
- Import + deduplicación.
- Tasks, interactions, notifications y client portal.
- Hardening productivo: auditoría, observabilidad y más tests.

## Roadmap resumido

| Sprint | Objetivo                                         | Estado         |
| ------ | ------------------------------------------------ | -------------- |
| 2.1    | Estabilización de `team`                         | ✅ Completado  |
| 2.2    | Reasignaciones + validaciones del core comercial | 🟡 En progreso |
| 2.3    | Configuración Prisma + pruebas base              | 🟡 En progreso |
| 3      | Lead detail + dashboard útil para operación      | ⏳ Pendiente   |
| 4      | Documents MVP o Import/Dedupe MVP                | ⏳ Pendiente   |
| 5      | Invitaciones / onboarding de usuarios            | ⏳ Pendiente   |
| 6      | Hardening para producción                        | ⏳ Pendiente   |

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
- `app/[tenantSlug]/team`
- `app/[tenantSlug]/profile`
- `app/[tenantSlug]/documents` _(placeholder)_

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
