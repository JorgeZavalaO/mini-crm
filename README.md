# Mini CRM Logistic

CRM multi-tenant orientado a equipos comerciales del sector logística. El proyecto está construido con `Next.js 16`, `React 19`, `Prisma`, `NextAuth` y `shadcn/ui`, con foco en gestión de leads, control de acceso por rol y monetización por planes/features.

## Estado actual

### Ya implementado

- **Módulo de Reportes** (`/{tenantSlug}/reports` y `/superadmin/reports`): indicadores operativos, comerciales y ejecutivos con filtros avanzados. KPI cards de leads/interacciones/tareas/cotizaciones, gráficos de tendencia de captación y distribución del pipeline, top ciudades/fuentes/industrias con barras de progreso proporcionales, estado de tareas con puntos de color, cotizaciones con monto `S/` y total pipeline, tabla de desempeño del equipo. Exportación en CSV. Vista SuperAdmin con métricas globales (distribución de planes, adopción de features, ciclo de vida de tenants, top tenants). Feature controlada por flag `REPORTS`, habilitada en planes Growth y Scale.
- Autenticación por credenciales y acceso `SuperAdmin`.
- Multi-tenancy por `tenantSlug`.
- RBAC por tenant (`ADMIN`, `SUPERVISOR`, `VENDEDOR`, `FREELANCE`, `PASANTE`).
- CRUD de leads con filtros rediseñados, asignación y reasignación.
- Importación masiva de leads por archivo Excel (`.xlsx/.xls`) o CSV, con análisis previo y confirmación en 2 pasos.
- Importación masiva de interacciones por archivo Excel (`.xlsx/.xls`) o CSV, con plantilla descargable, análisis previo, confirmación en 2 pasos y resultado por fila.
  - **Formato simple (original)**: una interacción por línea con columnas `ruc`, `authorEmail`, `type`, `occurredAt`, `subject` (opcional) y `notes`.
  - **Formato múltiple (nuevo)**: múltiples interacciones por línea con columnas `ruc`, `authorEmail`, `types`, `occurredAt`, `subjects` y `notes`, valores separados por `;`. Máximo 10 interacciones por línea, todas comparten la misma fecha, asuntos opcionales, retrocompatibilidad total.
  - Plantilla Excel con dos hojas de ejemplo para ambos formatos.
- Interacciones históricas para leads (`CALL`, `EMAIL`, `NOTE`, `VISIT`, `WHATSAPP`) con `occurredAt`, asociación por RUC, autor por `authorEmail` y soporte para fechas anteriores sin modificar estado ni responsable del lead.
- Detección y fusión MVP de duplicados por RUC, email, teléfono y nombre normalizado.
- Módulo de documentos operativo: carga, listado y eliminación con almacenamiento privado en Vercel Blob y descarga autenticada vía `GET /api/documents/[id]`.
- Módulo de cotizaciones operativo: CRUD de cotizaciones con ítems, cálculo de subtotal/impuesto/total, estados (`BORRADOR`, `ENVIADA`, `ACEPTADA`, `RECHAZADA`) y soporte de moneda (`PEN`/`USD`).
- **KPI cards de cotizaciones rediseñadas**: tarjetas por estado con icono sobre fondo de color, monto total agregado por estado, métricas derivadas "Pipeline Activo" y "Tasa de cierre".
- **Combobox de catálogo por ítem en cotizaciones**: selector Popover+Command per-fila en crear/editar cotización; al seleccionar un producto auto-rellena precio unitario.
- Campanita de notificaciones en el dashboard de tenant: leads sin asignar, leads nuevos, leads ganados, cotizaciones generadas, aceptadas y rechazadas de los últimos 7 días.
- **Notificaciones persistentes**: modelo `Notification` en DB con tipos (`UNASSIGNED_LEAD`, `LEAD_NEW`, `LEAD_WON`, `QUOTE_CREATED`, `QUOTE_ACCEPTED`, `QUOTE_REJECTED`, `PENDING_REASSIGNMENT`, `TASK_ASSIGNED`, `TASK_COMPLETED`). Badge de no leídas, marcar leída individual/masiva, eliminación, página completa con tabs (Todas/No leídas/Leídas). Hooks automáticos al crear leads, asignar/completar tareas y cambiar estado de cotizaciones.
- Generación de PDF por cotización: `components/quotes/quote-pdf-button.tsx` con `jsPDF` + `jspdf-autotable`; descarga directa desde el listado y desde el detalle. Logo y razón social del tenant integrados dinámicamente.
- **Módulo de Tareas** operativo: CRUD de tareas con prioridades (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), estados (`PENDING`, `IN_PROGRESS`, `DONE`, `CANCELLED`), asignación validada contra memberships activas, restricción de asignación a terceros para `SUPERVISOR+`, fecha límite con indicador de vencimiento y soft-delete.
- **Catálogo de productos** operativo: CRUD de productos con nombre, descripción, precio unitario (`Decimal 12,4`), moneda (`PEN`/`USD`) y estado activo/inactivo. Solo `ADMIN`/`SUPERVISOR` pueden gestionar el catálogo.
- **Edición de cotizaciones**: formulario de edición completo con selector de productos del catálogo, prelleno de datos y actualización en servidor.
- **Envío de cotización por email**: integración con **Resend** para enviar cotizaciones al cliente vía email transaccional con tabla HTML responsiva; transición automática de `BORRADOR` a `ENVIADA` (envío temporalmente oculto en UI, opción de "Marcar como enviada" disponible en listado).
- **Política de permisos por creador en cotizaciones**: el creador de una cotización puede aceptarla/rechazarla independientemente de su rol (`VENDEDOR`, `FREELANCE`, `PASANTE`); `SUPERVISOR`/`ADMIN` puede cambiar estado de cualquier cotización; `SuperAdmin` mantiene acceso global. Transiciones de estado validadas con rechazo de cambios inválidos desde borrador.
- **Client Portal MVP**: portal público para que clientes consulten sus cotizaciones sin autenticación. Los tokens se almacenan hasheados, el valor bruto solo se muestra una vez al crearlo, la pestaña Portal solo está disponible para `SUPERVISOR+` y el layout sigue ofreciendo listado/detalle de cotizaciones visibles (solo ENVIADA/ACEPTADA/RECHAZADA).
- **Paginación transversal con `shadcn/ui`**: listados principales del tenant, secciones embebidas del detalle de lead, portal público y vistas `SuperAdmin` usan paginación server-side orientada por URL, con métricas globales desacopladas del slice visible.
- **Fronteras Server/Client endurecidas**: la navegación paginada y tabs interactivas (`notifications`, `tasks`, detalle de lead y memberships en `SuperAdmin`) usan props serializables entre Server Components y Client Components para evitar errores de runtime de Next.js.
- **Acceso a deduplicación restringido por rol**: `Duplicados` solo es visible para `SUPERVISOR`/`ADMIN` del tenant o `SuperAdmin`; perfiles operativos sin privilegios ya no lo ven en el sidebar ni pueden abrir `/{tenantSlug}/leads/dedupe` por URL directa.
- **Modelo Lead enriquecido**: nuevos campos `gerente` (sponsor comercial), `contactName` y `contactPhone` para registrar el árbol de contactos del lead desde el formulario de alta y edición.
- **Historial de propietarios del lead**: modelo `LeadOwnerHistory` en DB que registra cada cambio de asignación (quién reasignó, desde quién y hacia quién). Visualización en `components/leads/owner-history-timeline.tsx` integrada en el detalle del lead.
- **Visualizaciones del dashboard**: gráfico de tendencia mensual de leads (`LeadsTrendChart`) y gráfico de barras del pipeline por estado (`PipelineBarChart`), construidos con `recharts` y el wrapper `ChartContainer` de `shadcn/ui`.
  - **Gráfico de tendencias mejorado**: rango dinámico que incluye los últimos 6 meses + mes actual (se recalcula automáticamente cada carga sin cambios de código), etiquetas del eje X legibles ("Octubre 2025" vs "oct 25"), botón de refresco con indicador de carga y timestamp de última actualización ("Datos a: viernes 10 abr 2026 · 14:32").
- **Exportación de leads en CSV y Excel**: botón dropdown "Exportar leads" en `/{tenantSlug}/leads` con dos opciones de descarga:
  - **CSV (.csv)**: con BOM UTF-8 para compatibilidad con Excel en Windows/español.
  - **Excel (.xlsx)**: construido dinámicamente con librería `xlsx`, 16 campos en español (Empresa, RUC, Estado, País, Ciudad, Industria, Fuente, Gerente, Nombre Contacto, Teléfono Contacto, Teléfonos, Emails, Notas, Responsable, Email Responsable, Fecha Creación).
  - Visibilidad endurecida: managers (`SUPERVISOR+`, `SuperAdmin`) exportan todos los leads; resto exporta solo los suyos (mismo control que la lista).
- **UX de filtros de leads mejorada**: panel compacto con búsqueda principal, contador y chips de filtros activos, filtros avanzados colapsables y acciones optimizadas para mobile.
- **UX de importación de interacciones**: flujo visual por pasos (subir, analizar, confirmar y listo), área de carga más clara, mensajes contextuales y tabla de resultados estable para auditoría de filas.
- **Hardening de seguridad transversal (Sprint 12)**:
  - Aislamiento de tenant endurecido en acciones de leads y cotizaciones: `tenantId` validado en todas las mutaciones.
  - Hashing de contraseñas con validación de longitud y comparaciones timing-safe (`lib/password.ts`).
  - Escape de HTML y sanitización del asunto en emails transaccionales (`lib/email.ts`).
  - Headers de seguridad adicionales en descarga de documentos y respuestas HTTP.
  - FKs de `User` cambiadas a `onDelete: SetNull` en modelos relacionados para preservar integridad ante borrado.
  - Tokens del portal almacenados siempre como hash; el valor bruto solo se expone una vez.
- **Internacionalización de la UI**: etiquetas de roles, estados y textos de interfaz homogeneizados al español en todo el cliente.
- **Módulo de configuración de empresa** (`/{tenantSlug}/company`): identidad corporativa del tenant — razón social, RUC/NIF/RFC, teléfono, email corporativo, sitio web, dirección y logo. Solo editable por `ADMIN+`. Logo almacenado públicamente en Vercel Blob y embebido en PDFs de cotizaciones. Acceso controlado mediante prop `showCompanySettings` en el sidebar.
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
- Suite de pruebas con `Vitest` y validación E2E inicial con `Playwright` para el módulo de notificaciones.

### Pendiente

- Hardening productivo adicional: auditoría avanzada, observabilidad profunda y ampliación de cobertura end-to-end más allá del módulo de notificaciones.

## Roadmap resumido

| Sprint | Objetivo                                                          | Estado        |
| ------ | ----------------------------------------------------------------- | ------------- |
| 2.1    | Estabilización de `team`                                          | ✅ Completado |
| 2.2    | Reasignaciones + validaciones del core comercial                  | ✅ Completado |
| 2.3    | Configuración Prisma + pruebas base                               | ✅ Completado |
| 3      | Lead detail + dashboard útil para operación                       | ✅ Completado |
| 4      | Import/Dedupe + Documents MVP                                     | ✅ Completado |
| 5      | Invitaciones / onboarding de usuarios                             | ✅ Completado |
| 6      | Hardening para producción                                         | ✅ Completado |
| 7      | Cotizaciones MVP + Documentos completos                           | ✅ Completado |
| 7.1    | Notificaciones en tiempo real                                     | ✅ Completado |
| 7.2    | PDF de cotizaciones descargable                                   | ✅ Completado |
| 8      | Módulo de Tareas (Tasks)                                          | ✅ Completado |
| 9      | Catálogo de productos, edición de cotizaciones y envío por email  | ✅ Completado |
| 10     | Notificaciones persistentes                                       | ✅ Completado |
| 11     | Client Portal MVP                                                 | ✅ Completado |
| 11.1   | Paginación transversal y estandarización UX                       | ✅ Completado |
| 11.2   | Hardening de navegación y límites Server/Client                   | ✅ Completado |
| 12     | Hardening de seguridad, modelo Lead enriquecido y visualizaciones | ✅ Completado |
| 13     | Módulo de empresa, KPI cotizaciones y combobox de catálogo        | ✅ Completado |
| 13.3   | Importación masiva de interacciones y mejoras UX de leads         | ✅ Completado |
| 14     | Módulo de Reportes (tenant + SuperAdmin) y mejoras UX             | ✅ Completado |
| 14.1   | Importación dinámica de múltiples interacciones por línea         | ✅ Completado |

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

- `AUTH_TRUST_HOST` (en `development/test` cae en `true`; en `production` cae en `false` salvo override explícito)
- `BLOB_READ_WRITE_TOKEN` (requerido para el módulo `DOCUMENTS`; los blobs ahora se suben como privados y se sirven por route autenticada)
- `QUOTING_BASIC` habilitado en plan `SCALE` (activar desde panel SuperAdmin para exponer cotizaciones en el tenant)
- `RESEND_API_KEY` (requerido para envío de cotizaciones por email)
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

En despliegues productivos detrás de proxy/reverse proxy, asegúrate de que `AUTH_SECRET` esté configurado correctamente. `AUTH_TRUST_HOST` ahora cae en `false` en producción salvo override explícito, así que debes activarlo solo si tu plataforma realmente entrega un host confiable.

Si aplicas la migración de hardening del portal, los enlaces de cliente emitidos antes de ese cambio quedan invalidados y deben regenerarse. Si ya tenías documentos públicos en Blob, ejecuta `pnpm documents:migrate-private-blob` una vez para re-subirlos al store privado manteniendo el `blobPathname`.

La protección de rutas en `proxy.ts` usa el wrapper `auth(...)` de Auth.js para leer la misma sesión que exponen `/api/auth/session` y los server components; esto evita discrepancias de lectura del token entre el borde y el runtime principal.

### 5. Levantar la app

```bash
pnpm dev
```

## Scripts principales

| Script                                | Descripción                                 |
| ------------------------------------- | ------------------------------------------- |
| `pnpm dev`                            | Levanta el entorno de desarrollo            |
| `pnpm build`                          | Compila la aplicación                       |
| `pnpm lint`                           | Ejecuta ESLint                              |
| `pnpm test`                           | Corre pruebas unitarias con Vitest          |
| `pnpm test:e2e`                       | Corre la suite E2E con Playwright           |
| `pnpm test:e2e:ui`                    | Abre la UI interactiva de Playwright        |
| `pnpm test:e2e:headed`                | Corre Playwright en modo headed             |
| `pnpm test:watch`                     | Modo watch de Vitest                        |
| `pnpm prisma:generate`                | Genera Prisma Client                        |
| `pnpm prisma:migrate`                 | Ejecuta migraciones de desarrollo           |
| `pnpm prisma:validate`                | Valida schema/config de Prisma              |
| `pnpm prisma:seed`                    | Carga datos semilla                         |
| `pnpm documents:migrate-private-blob` | Migra documentos existentes al Blob privado |
| `pnpm prisma:studio`                  | Abre Prisma Studio                          |

## Estructura funcional actual

### Tenant app

- `app/[tenantSlug]/dashboard`
- `app/[tenantSlug]/leads`
- `app/[tenantSlug]/leads/[id]`
- `app/[tenantSlug]/leads/import`
- `app/[tenantSlug]/leads/interactions/import`
- `app/[tenantSlug]/leads/dedupe`
- `app/[tenantSlug]/notifications`
- `app/[tenantSlug]/team`
- `app/[tenantSlug]/profile`
- `app/[tenantSlug]/documents`
- `app/[tenantSlug]/quotes`
- `app/[tenantSlug]/quotes/[id]`
- `app/[tenantSlug]/tasks`
- `app/[tenantSlug]/products`

### Auth / onboarding

- `app/(auth)/login`
- `app/(auth)/invite/[token]`

### Portal público

- `app/portal/[token]`
- `app/portal/[token]/quotes/[id]`

### SuperAdmin

- `app/(superadmin)/superadmin`
- `app/(superadmin)/superadmin/plans`
- `app/(superadmin)/superadmin/profile`
- `app/(superadmin)/superadmin/tenants`

## Últimos avances documentados

### Post Sprint 13.3

- Nueva ruta `leads/interactions/import` para cargar interacciones masivas desde Excel o CSV.
- Plantilla descargable y preflight con análisis previo antes de confirmar la creación.
- Asociación por RUC normalizado dentro del tenant y autor obligatorio por `authorEmail` con membresía activa.
- Tipos soportados: llamadas, correos, notas, visitas y WhatsApp, con aliases en español.
- `occurredAt` acepta fechas históricas; una fecha sin hora se guarda a las 00:00 en la zona horaria del tenant.
- La importación crea interacciones sin actualizar estado, responsable ni historial de propietarios del lead.
- Índice Prisma `Interaction(tenantId, leadId, occurredAt)` para acelerar consultas por lead y fecha.
- Filtros de leads rediseñados con buscador principal, filtros avanzados colapsables, chips de criterios activos y mejor comportamiento mobile.
- Pantalla de importación de interacciones rediseñada con stepper, estados más claros y tabla de resultados por fila.

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
- Nuevo módulo `documents` completo: subida (máx. 5 MB), listado, descarga autenticada vía route interna y eliminación con control de permisos.
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

### Sprint 8 (cierre)

- Módulo de tareas completo: CRUD con prioridades (`LOW`/`MEDIUM`/`HIGH`/`URGENT`), estados (`PENDING`/`IN_PROGRESS`/`DONE`/`CANCELLED`), asignación a miembros y soft-delete.
- La asignación o reasignación de tareas a terceros quedó endurecida en servidor: solo `SUPERVISOR+` puede mover ownership entre miembros y toda asignación valida membership activa dentro del tenant.
- `changeTaskStatusAction` asigna `completedAt` automáticamente al marcar como `DONE` y lo limpia en otros estados.
- La finalización de tareas ahora genera `TASK_COMPLETED` para perfiles `ADMIN` y `SUPERVISOR` del tenant, excluyendo al actor que marcó la tarea como realizada y evitando duplicados si ya estaba completada.
- Pestaña **Tareas** en detalle de lead con badge de tareas activas y creación en contexto.
- Página `/{tenantSlug}/tasks` con 4 tarjetas de estadísticas y listado completo del tenant.
- Feature `TASKS` movida de `COMING_SOON` a `SUPPORTED_FEATURE_KEYS`, habilitada en bundles `GROWTH` y `SCALE`.
- 31 tests cubriendo flujos de creación, edición, cambio de estado, eliminación y listado.

### Post Sprint 13 — Notificaciones de tareas completadas + Playwright

- Nuevo tipo persistente `TASK_COMPLETED` en `NotificationType`, con migración Prisma aplicada y UI actualizada en campana + historial completo.
- `changeTaskStatusAction` ahora dispara notificación cuando una tarea pasa a `DONE` por primera vez, dirigida a `ADMIN`/`SUPERVISOR` del tenant.
- Se añadió `playwright.config.ts` y una spec E2E serial (`tests/e2e/notifications.spec.ts`) que valida los 6 triggers activos reales del módulo (`LEAD_NEW`, `QUOTE_CREATED`, `QUOTE_ACCEPTED`, `QUOTE_REJECTED`, `TASK_ASSIGNED`, `TASK_COMPLETED`), además de acciones visibles de UX (`mark read`, `mark all read`, filtros y delete) sobre `/{tenantSlug}/notifications`.
- Validación ejecutada: `pnpm test` ✅ (**408 / 408**), `pnpm exec playwright test tests/e2e/notifications.spec.ts` ✅ (**1 / 1**), `pnpm run build` ✅.

### Sprint 9 (cierre)

- Catálogo de productos: CRUD completo con nombre, descripción, precio (`Decimal 12,4`), moneda y estado activo/inactivo. Ruta `/{tenantSlug}/products` protegida por feature `QUOTING_BASIC`.
- Edición de cotizaciones: `QuoteEditDialog` con formulario prelleno, selector de productos del catálogo (`ProductSelector`) y actualización en servidor.
- Envío de cotización por email: integración con **Resend** (`lib/email.ts`), botón `QuoteSendEmailButton` en detalle de cotización, transición automática de `BORRADOR` a `ENVIADA`.
- Entrada **Catálogo** con ícono `Package` en sidebar del tenant cuando `QUOTING_BASIC` está activa.
- 13 tests de product-actions cubriendo creación, edición, eliminación y listado.
- `package.json` bumpeado a `v1.0.0`.

### Post Sprint 11 — Paginación transversal

- Todas las vistas con volumen operativo ahora usan paginación consistente basada en `shadcn/ui` y query params.
- El patrón es server-side y URL-driven tanto en tenant app como en `SuperAdmin` y portal público.
- El detalle de lead soporta paginación independiente por pestaña (`Interacciones`, `Reasignaciones`, `Documentos`, `Cotizaciones`, `Tareas`, `Portal`) sin perder contexto de navegación.
- Los KPIs, badges y contadores se calculan sobre el dataset completo filtrado, no sobre la página visible, para evitar métricas engañosas.
- La validación del hito quedó cerrada con `pnpm test`, `pnpm lint` y `pnpm build` en verde.

### Post Sprint 11.1 — Hardening de navegación

- Se corrigió la frontera entre Server Components y Client Components en pantallas paginadas para evitar el error `Functions cannot be passed directly to Client Components` de Next.js.
- `Notifications`, `Tasks`, tabs del detalle de lead y paginación de memberships en `SuperAdmin` ahora reconstruyen navegación a partir de estado serializable, manteniendo SSR + interactividad sin callbacks cruzando el boundary.
- El módulo `Duplicados` quedó endurecido por rol: solo managers/admins del tenant o `SuperAdmin` pueden verlo en sidebar y acceder por URL.
- La pantalla `/{tenantSlug}/leads/dedupe` usa un bloqueo seguro para perfiles sin permiso sin depender de `forbidden()` experimental.

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
