# Mini CRM Logistic

CRM multi-tenant orientado a equipos comerciales del sector logística. El proyecto está construido con `Next.js 16`, `React 19`, `Prisma`, `NextAuth` y `shadcn/ui`, con foco en gestión de leads, control de acceso por rol y monetización por planes/features.

## Estado actual

### Ya implementado

- Autenticación por credenciales y acceso `SuperAdmin`.
- Multi-tenancy por `tenantSlug`.
- RBAC por tenant (`ADMIN`, `SUPERVISOR`, `VENDEDOR`, `FREELANCE`, `PASANTE`).
- CRUD de leads con filtros, asignación y reasignación.
- Importación masiva de leads por archivo Excel (`.xlsx/.xls`) o CSV, con análisis previo y confirmación en 2 pasos.
- Detección y fusión MVP de duplicados por RUC, email, teléfono y nombre normalizado.
- Módulo de documentos operativo: carga, listado y eliminación con almacenamiento en Vercel Blob.
- Módulo de cotizaciones operativo: CRUD de cotizaciones con ítems, cálculo de subtotal/impuesto/total, estados (`BORRADOR`, `ENVIADA`, `ACEPTADA`, `RECHAZADA`) y soporte de moneda (`PEN`/`USD`).
- Campanita de notificaciones en el dashboard de tenant: leads sin asignar, leads nuevos, leads ganados, cotizaciones generadas, aceptadas y rechazadas de los últimos 7 días.
- Generación de PDF por cotización: `components/quotes/quote-pdf-button.tsx` con `jsPDF` + `jspdf-autotable`; descarga directa desde el listado y desde el detalle.
- Dashboard tenant operativo con pipeline por estado y actividad reciente.
- Dashboard tenant con señales operativas de importación y duplicados.
- Lead detail page con vista comercial, contacto e historial de reasignaciones.
- Panel `SuperAdmin` para tenants, planes y features.
- UX del `SuperAdmin` refinada: tabla de planes con dialogs de alta, detalle, edición y activación/desactivación.
- Gestión de equipo con alta, activación/desactivación y remoción segura.
- Invitaciones de equipo con onboarding por enlace seguro y aceptación para usuarios nuevos o existentes.
- Hardening MVP para producción: validación central de entorno, `proxy.ts` con headers de seguridad, rate limiting inicial en login y fallbacks globales de error.
- Catálogo comercial saneado: SuperAdmin solo puede activar y vender features ya soportadas por el producto.
- Configuración de Prisma migrada a `prisma.config.ts` y runtime conectado con `@prisma/adapter-pg`.
- Menú de cuenta en avatar para tenant y `SuperAdmin`, con acceso directo a perfil y cierre de sesión.
- Suite inicial de pruebas unitarias con `Vitest`.

### En progreso

- Envío de cotización por email al cliente.

### Pendiente

- Tasks, interactions, notifications y client portal.
- Hardening productivo adicional: auditoría avanzada, observabilidad profunda y más tests end-to-end.

## Roadmap resumido

| Sprint | Objetivo                                         | Estado        |
| ------ | ------------------------------------------------ | ------------- |
| 2.1    | Estabilización de `team`                         | ✅ Completado |
| 2.2    | Reasignaciones + validaciones del core comercial | ✅ Completado |
| 2.3    | Configuración Prisma + pruebas base              | ✅ Completado |
| 3      | Lead detail + dashboard útil para operación      | ✅ Completado |
| 4      | Import/Dedupe + Documents MVP                    | ✅ Completado |
| 5      | Invitaciones / onboarding de usuarios            | ✅ Completado |
| 6      | Hardening para producción                        | ✅ Completado |
| 7      | Cotizaciones MVP + Documentos completos          | ✅ Completado |
| 7.1    | Notificaciones en tiempo real                    | ✅ Completado |
| 7.2    | PDF de cotizaciones descargable                  | ✅ Completado |

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
- `AUTH_SECRET`

Variables recomendadas:

- `AUTH_TRUST_HOST` (si despliegas detrás de reverse proxy fuera de Vercel o quieres dejarlo explícito en producción)
- `BLOB_READ_WRITE_TOKEN` (requerido para el módulo `DOCUMENTS` en producción)
- `QUOTING_BASIC` habilitado en plan `SCALE` (activar desde panel SuperAdmin para exponer cotizaciones en el tenant)
- `LOG_LEVEL`
- `NODE_ENV`
- `AUTH_RATE_LIMIT_WINDOW_MS`
- `AUTH_RATE_LIMIT_MAX_ATTEMPTS`
- `AUTH_RATE_LIMIT_BLOCK_MS`

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

Volver a ejecutar el seed también repara las credenciales demo y las memberships base de `acme-logistics`, útil cuando el entorno local quedó desalineado tras cambios previos o pruebas manuales.

Usuarios de prueba creados por el seed:

- `superadmin@example.com / changeme`
- `admin@acme.com / admin123`
- `vendedor@acme.com / vendedor123`

Para ingresar como `SuperAdmin`, el login ya no requiere `slug`; basta con el email y la contrasena. Para cuentas tenant, el `slug` del tenant sigue siendo obligatorio.

En despliegues productivos detrás de proxy/reverse proxy, asegúrate de que `AUTH_SECRET` esté configurado correctamente y considera fijar `AUTH_TRUST_HOST=true` en el entorno si tu plataforma no lo infiere automáticamente.

La protección de rutas en `proxy.ts` usa el wrapper `auth(...)` de Auth.js para leer la misma sesión que exponen `/api/auth/session` y los server components; esto evita discrepancias de lectura del token entre el borde y el runtime principal.

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
- `app/[tenantSlug]/documents`
- `app/[tenantSlug]/quotes`
- `app/[tenantSlug]/quotes/[id]`

### Auth / onboarding

- `app/(auth)/login`
- `app/(auth)/invite/[token]`

### SuperAdmin

- `app/(superadmin)/superadmin`
- `app/(superadmin)/superadmin/plans`
- `app/(superadmin)/superadmin/profile`
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

### Sprint 6 (cierre)

- Validación central de entorno reutilizable para app, Prisma config y seed.
- Migración de `middleware.ts` a `proxy.ts` para alinearse con Next.js 16 y eliminar la deprecación.
- Headers de seguridad base y `x-request-id` en el borde para endurecer respuestas HTTP.
- Logger estructurado con niveles y salida JSON en producción.
- Fallbacks globales de error (`app/error.tsx` y `app/global-error.tsx`) para degradación segura.
- Nueva cobertura unitaria para validación de entorno, logger y headers de seguridad.

### Post Sprint 6 (hardening incremental)

- Mensajes de login neutralizados para evitar enumeración de tenants, usuarios y accesos.
- Rate limiting inicial para intentos de autenticación, aplicado tanto en la acción de login como en el proveedor de credenciales.
- Features futuras (`INTERACTIONS`, `TASKS`, `NOTIFICATIONS`, `CLIENT_PORTAL`) retiradas del catálogo comercial activo hasta contar con implementación real.
- `QUOTING_BASIC` pasó de futura a soportada en Sprint 7 (habilitada en plan `SCALE`).

### UX/UI SuperAdmin

- `superadmin/plans` ahora presenta un catálogo tabular con acciones por fila para ver detalle, editar y activar/desactivar sin salir de la pantalla.
- La creación de planes se trasladó a un diálogo contextual para mantener el flujo administrativo compacto.
- El avatar del sidebar ahora abre un menú de cuenta con acceso a perfil y cierre de sesión, tanto en tenant como en `SuperAdmin`.
- Nuevo módulo `superadmin/profile` para consultar la identidad del administrador y sus memberships vinculadas.

### Importación Excel + Módulo Documentos (mar-2026)

- `leads/import` migró de pegado manual a carga de archivo (`.xlsx/.xls/.csv`) con UX drag-and-drop.
- Se añadió descarga de plantilla Excel con cabeceras oficiales y filas de ejemplo para carga masiva.
- La importación ahora exige `ruc` como campo obligatorio y lo usa como clave principal de deduplicación.
- `businessName` pasa a opcional durante importación (si falta, se usa el valor de `ruc` como fallback).
- Nuevo módulo `documents` completo: subida (máx. 5 MB), listado, descarga y eliminación con control de permisos.
- Se habilitó pestaña `Documentos` en el detalle de lead y repositorio general en `/{tenantSlug}/documents`.

### Sprint 7 (cierre)

- Módulo de cotizaciones implementado end-to-end: CRUD de cotizaciones con ítems, sub-total, impuesto y total calculados en servidor.
- Soporte de moneda `PEN`/`USD` por cotización.
- Estados de cotización con transiciones validadas: `BORRADOR` → `ENVIADA` → `ACEPTADA` / `RECHAZADA`.
- Reglas de edición por estado (solo `BORRADOR` es editable) y override por `SUPERVISOR+`.
- Nueva pestaña `Cotizaciones` en el detalle de lead para creación y consulta en contexto.
- Nueva ruta general `/{tenantSlug}/quotes` con listado paginado y filtros por estado/lead.
- Feature flag `QUOTING_BASIC` habilitada en plan `SCALE` y expuesta en catálogo de features.
- Navegación lateral del tenant con acceso directo a `Cotizaciones` cuando la feature está activa.
- Cobertura de pruebas en `tests/quote-actions.test.ts`.

### Sprint 7 UX/UI — Mejora de interfaz de Cotizaciones

- Formulario de alta de cotización movido a un `Dialog` contextual — botón "Nueva cotización" siempre visible en el encabezado de la página.
- `QuoteCreateForm` mejorado: `<Label>` en todos los campos, `<Select>` para impuesto (0 %, 10 %, 18 % IGV), preview de subtotal/impuesto/total en tiempo real.
- `QuoteList` con `DropdownMenu` de acciones por fila (`MoreHorizontal`): ver detalle, cambiar estado y eliminar con `AlertDialog` de confirmación.
- Cuatro tarjetas de resumen estadístico (Borrador/Enviada/Aceptada/Rechazada) con borde de color semántico en la página principal de cotizaciones.
- Trazabilidad automática: al crear una cotización se registra una interacción tipo `NOTE` en el historial del lead con el número y total de la cotización.
- Empty state estilizado con borde discontinuo cuando no hay cotizaciones.

### Sprint 7.2 — PDF de cotizaciones

- `components/quotes/quote-pdf-button.tsx`: jsPDF cargado con dynamic import. PDF con encabezado azul, datos del cliente, tabla de ítems, totales y footer con fecha de generación.
- Botón **Descargar PDF** en la página de detalle de cotización.
- Opción **Descargar PDF** en el dropdown de acciones de la lista de cotizaciones.

### Sprint 7 UX/UI — Notificaciones (campanita)

- `lib/notifications-actions.ts` con 6 tipos de notificación contextual por tenant.
- `components/notifications-bell.tsx`: Popover con ScrollArea, badge semántico (rojo = crítico, primario = informativo), recarga al abrir.
- Inyectado en header de `app/[tenantSlug]/layout.tsx`.

### Sprint 7 UX/UI — Buscadores en Cotizaciones y Filtros de Leads

- Nuevo componente `SearchableSelect` (`components/ui/searchable-select.tsx`): combobox accesible con `Popover` + `Command` de `cmdk`, búsqueda en tiempo real, hint secundario por opción y check de selección activa.
- Selector de lead en el formulario de cotización reemplazado por `SearchableSelect` — permite buscar por nombre de empresa o RUC directamente desde el Dialog.
- Filtro **Ciudad** en lista de leads migrado a `SearchableSelect` con búsqueda incremental.
- Filtro **Vendedor** (antes "Owner", ahora traducido) migrado a `SearchableSelect` con hint de email y nueva opción **"Sin vendedor asignado"** para localizar leads huérfanos.
- `leads/page.tsx` soporta el valor especial `__UNASSIGNED__` en el query de Prisma para los leads sin owner.

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
