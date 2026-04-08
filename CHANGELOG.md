# Changelog

Todos los cambios relevantes del proyecto se documentan aquí por hito/sprint.

## [v1.3.0 · 2026-04-07] Sprint 12 — Hardening de seguridad, modelo Lead enriquecido y visualizaciones

### Added

- **`components/leads/owner-history-timeline.tsx`**: nuevo componente que muestra el historial completo de cambios de propietario de un lead (quién lo reasignó, cuándo y a quién).
- **`model LeadOwnerHistory`** en `prisma/schema.prisma`: registra `previousOwnerId`, `newOwnerId`, `changedById` y `reassignmentRequestId`; relaciones FK con `SET NULL` en borrado de usuario. Migración aplicada.
- **Campos adicionales en el modelo `Lead`**: `gerente` (nombre del gerente/sponsor comercial), `contactName` (persona de contacto clave) y `contactPhone` (teléfono de contacto). Actualizados en `lead-form-dialog.tsx`, `lead-table.tsx` y el servidor. Migración aplicada.
- **`components/dashboard/leads-trend-chart.tsx`**: gráfico de líneas con la tendencia mensual de leads captados, basado en `recharts`.
- **`components/dashboard/pipeline-bar-chart.tsx`**: gráfico de barras con el conteo de leads por estado del pipeline, basado en `recharts`.
- **`components/ui/chart.tsx`**: envoltorio reutilizable `ChartContainer`, `ChartTooltip` y `ChartLegend` de `shadcn/ui` para integración con `recharts`.
- **`recharts`** añadido como dependencia de producción.
- **`tests/quote-actions.test.ts`**: nueva suite de 20+ tests que cubre creación, edición, cambios de estado y eliminación de cotizaciones con aislamiento de tenant.
- **`scripts/migrate-documents-to-private-blob.ts`**: script de migración one-off para mover documentos existentes a almacenamiento privado en Vercel Blob.
- Nuevos tests en `tests/portal-actions.test.ts` (cobertura ampliada) y `tests/task-actions.test.ts` (validación de asignación a usuarios fuera del tenant).

### Changed

- **`app/[tenantSlug]/dashboard/page.tsx`**: dashboard rediseñado con gráficos de tendencia y pipeline integrados usando los nuevos componentes `recharts`.
- **Aislamiento de tenant endurecido** en `lib/lead-actions.ts` y `lib/quote-actions.ts`: `tenantId` se incluye explícitamente en todas las operaciones de actualización, archivo y cambio de estado para evitar mutaciones cross-tenant.
- **`lib/password.ts`**: hashing reforzado con validación de longitud mínima y comparaciones timing-safe para mitigar timing attacks.
- **`lib/auth-rate-limit.ts`**: mejoras en la gestión de intentos fallidos y reset de contadores.
- **`lib/http-security.ts`**: headers de seguridad adicionales en respuestas HTTP.
- **`lib/email.ts`**: escape de HTML en cuerpo y sanitización del asunto del email para prevenir XSS en emails transaccionales.
- **`app/api/documents/[id]/route.ts`**: headers de seguridad (`Content-Disposition`, `X-Content-Type-Options`) añadidos a la descarga de documentos.
- **`lib/lead-permissions.ts`**: ajustes para permitir `createdById` nulo en modelos relacionados; nueva función de control de acceso para historial de propietarios.
- **`prisma/schema.prisma`**: FK de `User` en múltiples modelos cambiadas a `onDelete: SetNull` para proteger integridad ante borrado de usuarios; nuevos índices de rendimiento.
- **Importación de leads**: plantilla Excel, mapeo CSV, validación y persistencia alineadas para soportar `gerente`, `contactName` y `contactPhone` en cargas masivas.
- **Internacionalización de la UI**: etiquetas de roles, estados y textos de interfaz traducidos/homogeneizados al español en 23+ archivos del lado cliente y servidor.
- `app/[tenantSlug]/leads/[id]/page.tsx`: pestaña de historial de propietarios integrada con `OwnerHistoryTimeline`.
- `lib/interaction-actions.ts`: schema de interacción actualizado (`tenantSlug`, `type`, `subject`, `notes`, `occurredAt`).
- `lib/portal-tokens.ts`: gestión de tokens reforzada; valor bruto nunca persiste, solo el hash.

### Fixed

- Operaciones de edición y archivo de leads y cotizaciones ya no son ejecutables desde un tenant que no sea el propietario del recurso.
- Corrección de comparaciones de contraseña inseguras por comparación de longitud y timing-safe en `password.ts`.
- Email de cotización ya no es vulnerable a inyección de etiquetas HTML en el nombre del cliente.

### Tests

- Validación completa tras Sprint 12:
  - `pnpm test` ✅ (**392 / 392** tests pasando, 36 suites)
  - `pnpm lint` — pendiente de verificación post-merge
  - `pnpm build` — pendiente de verificación post-merge

## [v1.2.2 · 2026-04-01] Post Sprint 11.1 — Hardening de navegación y límites Server/Client

### Changed

- `app/[tenantSlug]/notifications/page.tsx` y `components/notifications/notifications-full-list.tsx`: la paginación/filtros ya no pasan callbacks desde Server Components hacia Client Components; ahora solo viajan props serializables y las URLs se reconstruyen en cliente.
- `app/[tenantSlug]/tasks/page.tsx` y `components/tasks/task-tabs.tsx`: mismo ajuste de frontera Server/Client para tabs y paginación del módulo de tareas, eliminando errores de serialización en runtime.
- `components/leads/lead-detail-tabs.tsx` y `app/[tenantSlug]/leads/[id]/page.tsx`: las pestañas del detalle de lead ahora reciben `href` serializados por item en vez de funciones, manteniendo la navegación por URL sin violar el boundary de Next.js.
- `components/superadmin/tenant-settings-tabs.tsx` y `app/(superadmin)/superadmin/tenants/[id]/page.tsx`: la paginación de membresías del tenant en `SuperAdmin` fue alineada al mismo patrón serializable.
- `app/[tenantSlug]/layout.tsx` y `components/tenant-sidebar.tsx`: el módulo `Duplicados` ahora solo aparece en la navegación lateral para perfiles `SUPERVISOR`/`ADMIN` del tenant o `SuperAdmin` del sistema.
- `app/[tenantSlug]/leads/dedupe/page.tsx`: el acceso directo por URL se mantiene bloqueado para perfiles sin permiso y el fallback cambió de `forbidden()` (experimental en esta configuración) a `notFound()` para evitar errores de runtime.

### Fixed

- Se corrige el error de Next.js `Functions cannot be passed directly to Client Components...` que afectaba rutas como `/{tenantSlug}/notifications` y `/{tenantSlug}/tasks` tras la estandarización de paginación.
- Se evita que perfiles comerciales sin privilegios de manager/admin vean o intenten acceder al módulo de deduplicación desde el sidebar.
- Se elimina el runtime error asociado a `forbidden()` en la pantalla de deduplicación cuando `experimental.authInterrupts` no está habilitado.

### Tests

- Verificación posterior al hotfix:
  - `pnpm test` ✅ (**360 / 360** tests pasando)
  - `pnpm lint` ✅
  - `pnpm build` ✅

## [v1.2.1 · 2026-04-01] Post Sprint 11 — Paginación transversal con shadcn

### Added

- `lib/pagination.ts`: utilidades compartidas para paginación URL-driven (`firstSearchParam`, `buildSearchHref`, `getPaginationState`) con clamping consistente de página/tamaño.
- `components/ui/list-pagination.tsx`: wrapper reutilizable sobre `shadcn/ui` para renderizar paginación homogénea con resumen de rango, numeración y elipsis.
- `components/leads/lead-detail-tabs.tsx`: wrapper client para sincronizar pestañas del detalle de lead con la URL y soportar paginación independiente por sección embebida.
- Nuevas variantes paginadas de server actions para colecciones embebidas y públicas:
  - `listLeadInteractionsAction`
  - `listLeadDocumentsPageAction`
  - `listLeadQuotesPageAction`
  - `listLeadTasksPageAction`
  - `listLeadPortalTokensPageAction`
  - `getPortalQuotesPageByToken`
  - `listTenantNotificationsPageAction`

### Changed

- `components/ui/pagination.tsx`: labels adaptados al UX del producto en español (`Anterior`, `Siguiente`, `Más páginas`).
- Paginación estandarizada con `shadcn/ui`, query params y render server-side en vistas principales del tenant:
  - `app/[tenantSlug]/products/page.tsx`
  - `app/[tenantSlug]/quotes/page.tsx`
  - `app/[tenantSlug]/documents/page.tsx`
  - `app/[tenantSlug]/tasks/page.tsx`
  - `app/[tenantSlug]/notifications/page.tsx`
  - `app/[tenantSlug]/team/page.tsx`
- `app/[tenantSlug]/leads/[id]/page.tsx`: las secciones `Interacciones`, `Reasignaciones`, `Documentos`, `Cotizaciones`, `Tareas` y `Portal` ahora paginan con parámetros independientes por pestaña (`interactionsPage`, `reassignmentsPage`, `documentsPage`, `quotesPage`, `tasksPage`, `portalPage`).
- `app/portal/[token]/page.tsx`: el listado público de cotizaciones del cliente ahora pagina por URL y mantiene navegación coherente al volver al detalle.
- `app/(superadmin)/superadmin/page.tsx`, `app/(superadmin)/superadmin/plans/page.tsx` y `app/(superadmin)/superadmin/tenants/[id]/page.tsx`: listados administrativos paginados sin romper KPIs/global counters.
- `components/tasks/task-tabs.tsx`, `components/notifications/notifications-full-list.tsx`, `components/leads/interaction-timeline.tsx`, `components/leads/portal-tokens-card.tsx` y `components/superadmin/tenant-settings-tabs.tsx` ahora aceptan metadata externa de paginación/contadores para desacoplar métricas globales de la página actual.
- `lib/product-actions.ts`, `lib/quote-actions.ts`, `lib/task-actions.ts`, `lib/document-actions.ts`, `lib/portal-actions.ts` y `lib/notifications-actions.ts` ahora usan estado de paginación centralizado y corrigen conteos/estadísticas para que no dependan del slice visible.
- `lib/validators.ts`: nuevos filtros para interacciones, documentos y tokens de portal; `taskFiltersSchema` amplía soporte para `scope: 'mine' | 'all'`.

### Tests

- Validación completa tras la estandarización de paginación:
  - `pnpm test` ✅ (**360 / 360** tests pasando)
  - `pnpm lint` ✅
  - `pnpm build` ✅

## [v1.2.0 · 2026-03-31] Sprint 11 — Client Portal MVP

### Added

- `lib/portal-actions.ts`: server actions completas para el portal de clientes:
  - `createPortalTokenAction`: genera un token criptográfico de 32 bytes con expiración a 30 días. Solo SUPERVISOR+.
  - `revokePortalTokenAction`: desactiva un token activo.
  - `listLeadPortalTokensAction`: lista tokens asociados a un lead.
  - `getPortalDataByToken`: función pública (sin auth) que valida token activo/no expirado/lead no eliminado, actualiza `lastAccessedAt` y retorna datos del tenant, lead y cotizaciones con estado ENVIADA/ACEPTADA/RECHAZADA.
- `app/portal/[token]/layout.tsx`: layout público minimalista con header del portal.
- `app/portal/[token]/page.tsx`: listado de cotizaciones del lead con badges de estado semánticos y formateo de moneda.
- `app/portal/[token]/quotes/[id]/page.tsx`: detalle de cotización con tabla de ítems, totales y fechas.
- `components/leads/portal-tokens-card.tsx`: card client para crear/revocar tokens y copiar URLs del portal desde el detalle de lead.
- Pestaña "Portal" con ícono Globe en `app/[tenantSlug]/leads/[id]/page.tsx`, gated por feature `CLIENT_PORTAL`.
- `lib/lead-permissions.ts`: funciones `canCreatePortalToken` y `canRevokePortalToken` (requieren SUPERVISOR+).
- `lib/validators.ts`: schemas `createPortalTokenSchema` y `revokePortalTokenSchema`.
- `prisma/schema.prisma`: modelo `PortalToken` con campos `token (unique)`, `isActive`, `expiresAt`, `lastAccessedAt`, `createdById`. Índice compuesto `[tenantId, leadId]`.
- `proxy.ts`: ruta `/portal` añadida como ruta pública.
- `tests/portal-actions.test.ts`: 13 tests cubriendo creación, revocación, listado y acceso público por token.

### Changed

- `lib/feature-catalog.ts`: `CLIENT_PORTAL` movida de `COMING_SOON_FEATURE_KEYS` a `SUPPORTED_FEATURE_KEYS`; habilitada en bundle `SCALE`.
- `COMING_SOON_FEATURE_KEYS` ahora es `[]` (vacío — todas las features tienen implementación real).
- `tests/feature-catalog.test.ts`: assertions actualizadas para `CLIENT_PORTAL` soportada y `COMING_SOON` vacío.
- `tests/superadmin-actions.test.ts`: test de feature no soportada migrado a `'UNKNOWN_FEATURE' as never`.

## [v1.1.0 · 2026-03-31] Sprint 10 — Notificaciones persistentes

### Added

- `lib/notifications-actions.ts`: reescritura completa — notificaciones ahora son entidades persistentes en DB:
  - `getTenantNotificationsAction`: lista con filtros (isRead, limit, offset).
  - `getUnreadCountAction`: contador de no leídas para badge.
  - `markNotificationReadAction`: marca individual como leída.
  - `markAllNotificationsReadAction`: marca todas como leídas.
  - `deleteNotificationAction`: soft delete.
  - `createNotificationsForEvent`: helper interno que genera notificaciones para miembros del tenant.
  - `getTenantMemberIds`: helper para obtener destinatarios filtrados por rol mínimo.
- `prisma/schema.prisma`: enum `NotificationType` (UNASSIGNED_LEAD, LEAD_NEW, LEAD_WON, QUOTE_CREATED, QUOTE_ACCEPTED, QUOTE_REJECTED, PENDING_REASSIGNMENT); modelo `Notification` con campos `type`, `title`, `description`, `href`, `isRead`, `readAt`, `deletedAt`. Índices compuestos para consultas eficientes.
- Migración `20260331234518_add_notifications_and_portal` aplicada.
- `app/[tenantSlug]/notifications/page.tsx`: página completa de notificaciones protegida por feature `NOTIFICATIONS`.
- `components/notifications/notifications-full-list.tsx`: componente client con tabs (Todas/No leídas/Leídas), acciones mark-read y delete por fila, mark all read.
- `lib/lead-permissions.ts`: función `canDeleteNotification`.
- `lib/validators.ts`: schemas `markNotificationReadSchema`, `deleteNotificationSchema`, `notificationFiltersSchema`.
- `tests/notifications-actions.test.ts`: 13 tests cubriendo lectura, conteo, marcado, eliminación y creación de eventos.

### Changed

- `components/notifications-bell.tsx`: refactorizado para usar DB persistente — badge con `getUnreadCountAction`, carga de items al abrir popover, indicador de no leída (punto azul + texto bold), botón "Marcar todas leídas" (CheckCheck), enlace "Ver todas las notificaciones →".
- `components/tenant-sidebar.tsx`: entrada "Notificaciones" con ícono Bell, gated por `enabledFeatures.NOTIFICATIONS`.
- `lib/feature-catalog.ts`: `NOTIFICATIONS` movida de `COMING_SOON_FEATURE_KEYS` a `SUPPORTED_FEATURE_KEYS`; habilitada en bundles `GROWTH` y `SCALE`.
- `lib/lead-actions.ts`: hook de notificación `LEAD_NEW` al crear un lead.
- `lib/quote-actions.ts`: hooks de notificación `QUOTE_CREATED`, `QUOTE_ACCEPTED` y `QUOTE_REJECTED` en acciones de creación y cambio de estado.
- `tests/lead-actions.test.ts`: mock de `db.membership.findMany` para el hook de notificaciones.
- `tests/quote-actions.test.ts`: mocks de `membership` y `notification` para hooks de notificaciones.

### Tests

- **348 / 348** tests pasando (28 nuevos tests: 13 notifications + 13 portal + 2 feature-catalog).

## [v1.0.0 · 2026-03-31] Sprint 9 — Edición de cotizaciones, Catálogo de productos y Envío por email

### Added

- `lib/email.ts`: módulo de envío de emails transaccionales con **Resend**. Genera HTML responsivo con la tabla de ítems, totales y notas. Singleton `getResend()` con validación de `RESEND_API_KEY`.
- `lib/product-actions.ts`: CRUD completo para el catálogo de productos — `createProductAction`, `updateProductAction`, `deleteProductAction`, `listProductsAction`. Solo ADMIN/SUPERVISOR pueden gestionar el catálogo.
- `lib/quote-actions.ts` → `sendQuoteEmailAction`: envía la cotización al destinatario vía Resend y transiciona automáticamente de BORRADOR a ENVIADA.
- `lib/validators.ts`: schemas Zod para `createProductSchema`, `updateProductSchema` (actualización parcial), `deleteProductSchema`, `productFiltersSchema`, `sendQuoteEmailSchema`.
- `prisma/schema.prisma`: modelo `Product` con campos `name`, `description`, `unitPrice (Decimal 12,4)`, `currency`, `isActive`, `createdById`, `createdAt`, `updatedAt`, `deletedAt`. Relaciones con `Tenant` y `User`.
- Migración `20260331221058_add_product_catalog` aplicada en base de datos.
- `components/products/product-form-dialog.tsx`: Dialog reutilizable para crear y editar productos (nombre, descripción, precio, moneda).
- `components/products/product-list.tsx`: tabla de productos con badge de estado activo/inactivo, dropdown de acciones (editar, activar/desactivar, eliminar con AlertDialog).
- `app/[tenantSlug]/products/page.tsx`: página del catálogo protegida por feature `QUOTING_BASIC`, con encabezado, botón “Nuevo producto” y listado completo.
- `components/quotes/product-selector.tsx`: selector de producto del catálogo mediante `SearchableSelect`; al elegir uno autocompletó descripción y precio en la línea de cotización.
- `components/quotes/quote-edit-form.tsx`: formulario completo de edición de cotización con valores prellenos, selector de lead, moneda, impuesto, ítems, validez y notas.
- `components/quotes/quote-edit-dialog.tsx`: Dialog envolvente para `QuoteEditForm`.
- `components/quotes/quote-send-email-button.tsx`: Dialog con campo de email que llama a `sendQuoteEmailAction`; transiciona la cotización a ENVIADA si está en BORRADOR.
- `tests/product-actions.test.ts`: 13 tests cubriendo creación, edición, eliminación y listado de productos.

### Changed

- `components/quotes/quote-create-form.tsx` y `quote-edit-form.tsx`: nuevo prop opcional `products?: ProductOption[]`; cuando hay productos en el catálogo se muestra el `ProductSelector` junto al botón “Agregar ítem”.
- `components/quotes/quote-list.tsx`: botón **Editar** (icono `Pencil`) en el DropdownMenu con enlace a la página de detalle.
- `app/[tenantSlug]/quotes/[id]/page.tsx`: `QuoteEditDialog` en el encabezado cuando la cotización es editable; `QuoteSendEmailButton` junto al PDF.
- `components/tenant-sidebar.tsx`: entrada **Catálogo** con ícono `Package` visible cuando `QUOTING_BASIC` está activa.
- `lib/env.ts`: campo `RESEND_API_KEY: string | undefined` en `AppEnv`.
- `package.json`: versión bumpeada a **1.0.0**.

### Tests

- **320 / 320** tests pasando (13 nuevos tests de product-actions).

### Added

- `prisma/schema.prisma`: enums `TaskStatus` (PENDING, IN_PROGRESS, DONE, CANCELLED) y `TaskPriority` (LOW, MEDIUM, HIGH, URGENT); modelo `Task` con relaciones a `Tenant`, `Lead` (opcional), `User` (creador + asignado).
- Migración `20260331214059_add_tasks_module` aplicada en base de datos.
- `lib/task-actions.ts`: server actions completas — `createTaskAction`, `updateTaskAction`, `changeTaskStatusAction`, `deleteTaskAction`, `listLeadTasksAction`, `listTenantTasksAction`. La acción `changeTaskStatusAction` asigna `completedAt` automáticamente al marcar como `DONE` y lo limpia en otros estados.
- `lib/validators.ts`: schemas Zod para `createTaskSchema`, `updateTaskSchema`, `changeTaskStatusSchema`, `deleteTaskSchema`, `taskFiltersSchema`.
- `lib/lead-permissions.ts`: funciones `canCreateTask`, `canEditTask`, `canDeleteTask`, `canCompleteTask`.
- `components/tasks/task-form-dialog.tsx`: Dialog reutilizable para crear y editar tareas con selección de prioridad, asignado, fecha límite y descripción opcional.
- `components/tasks/task-list.tsx`: lista de tareas con secciones activa/completada colapsable, cambio de estado rápido, indicador de vencimiento, dropdown de acciones con AlertDialog de confirmación.
- `app/[tenantSlug]/tasks/page.tsx`: página principal del módulo con 4 tarjetas de estadísticas (Pendientes/En progreso/Completadas/Canceladas) y lista completa del tenant.
- Pestaña **Tareas** en `app/[tenantSlug]/leads/[id]/page.tsx`: badge con tareas activas, `TaskFormDialog` para crear en contexto, `TaskList` filtrada por lead.
- `tests/task-actions.test.ts`: 26 tests que cubren flujos de creación, edición, cambio de estado, eliminación y listado con mocks de Prisma.

### Changed

- `lib/feature-catalog.ts`: `TASKS` movida de `COMING_SOON_FEATURE_KEYS` a `SUPPORTED_FEATURE_KEYS`; habilitada en bundles `GROWTH` y `SCALE`.
- `components/tenant-sidebar.tsx`: entrada **Tareas** con ícono `ClipboardList` añadida al sidebar cuando `TASKS` está activa.
- `tests/feature-catalog.test.ts`: tests actualizados para reflejar que `TASKS` es ahora una feature soportada.
- `tests/superadmin-actions.test.ts`: test de feature no soportada migrado a `CLIENT_PORTAL`.

## [v0.8.0 · 2026-03-31] Sprint 7.2 — PDF de cotizaciones

### Added

- `jspdf` + `jspdf-autotable` como dependencias de producción para generación de PDF en el cliente sin servidor extra.
- `components/quotes/quote-pdf-button.tsx`: componente client reutilizable que genera el PDF con lazy import (`import('jspdf')`) para no impactar el bundle inicial. Diseño del PDF: encabezado azul con número y estado, sección de cliente y metadatos en dos columnas, tabla de ítems con cabecera azul y filas alternadas, bloque de totales alineado a la derecha, sesión de notas y footer con página y fecha de generación.

### Changed

- `app/[tenantSlug]/quotes/[id]/page.tsx`: botón **Descargar PDF** en el encabezado, junto al botón Volver.
- `components/quotes/quote-list.tsx`: opción **Descargar PDF** en el `DropdownMenu` de acciones de cada fila, separada visualmente de las acciones de estado.

## [v0.7.0 · 2026-03-31] Sprint 7.1 — Campanita de notificaciones

### Added

- `lib/notifications-actions.ts`: server action `getTenantNotificationsAction` que agrega 6 tipos de notificaciones contextuales por tenant: leads sin asignar (ámbar), leads nuevos (azul), leads ganados (verde), cotizaciones generadas (violeta), cotizaciones aceptadas (verde) y cotizaciones rechazadas (rojo). Solo SUPERVISOR+ ve las reasignaciones pendientes.
- `components/notifications-bell.tsx`: componente client con botón campanita y Popover; badge rojo si hay items críticos (sin asignar / reasignación pendiente), badge primario para el resto; `ScrollArea` para listas largas; recarga automática al abrir y botón de actualización manual.

### Changed

- `app/[tenantSlug]/layout.tsx`: `NotificationsBell` inyectada en el header a la derecha, visible para todos los miembros del tenant.

## [2026-03-31] Sprint 7 UX/UI — Buscadores en Cotizaciones y Filtros de Leads

### Added

- `components/ui/command.tsx`: nuevo componente `Command` / `CommandInput` / `CommandList` / `CommandItem` basado en `cmdk` para búsqueda en tiempo real dentro de popovers.
- `components/ui/searchable-select.tsx`: combobox reutilizable (botón trigger + `Popover` + `Command`) con input de búsqueda, hint secundario por opción y check de selección activa. Accesible con `role="combobox"` y `aria-expanded`.
- Opción **"Sin vendedor asignado"** (`__UNASSIGNED__`) en el filtro de Vendedor de la lista de leads — permite filtrar leads sin owner.

### Changed

- `components/quotes/quote-create-form.tsx`: selector de lead reemplazado por `SearchableSelect`; búsqueda en tiempo real por nombre de empresa o RUC; valor hint muestra el RUC junto a cada opción.
- `app/[tenantSlug]/leads/components/lead-filters.tsx`:
  - Filtro **Ciudad** migrado a `SearchableSelect` con búsqueda en tiempo real.
  - Filtro **Owner** migrado a `SearchableSelect`, label traducido a "Vendedor", hint muestra email del miembro, incluye opción "Sin vendedor asignado".
- `app/[tenantSlug]/leads/page.tsx`: soporte del valor especial `__UNASSIGNED__` en la query de Prisma (traduce a `{ ownerId: null }`).

## [2026-03-31] Sprint 7 UX/UI — Mejora de interfaz de Cotizaciones

### Added

- `components/quotes/quote-dialog-trigger.tsx`: componente client con `Dialog` + `DialogTrigger` que abre el formulario de alta sin salir de la pantalla; se cierra automáticamente al crear una cotización.
- Cuatro tarjetas de resumen estadístico en `app/[tenantSlug]/quotes/page.tsx` (Borrador, Enviada, Aceptada, Rechazada) con borde de color semántico.
- Empty state estilizado en `QuoteList` con borde discontinuo cuando no hay cotizaciones.

### Changed

- `components/quotes/quote-create-form.tsx` reescrito con `<Label>` en todos los campos, `<Select>` para impuesto (0 %, 10 %, 18 %), preview de subtotal/impuesto/total en tiempo real (calculado en cliente), prop `onSuccess` para cerrar el Dialog al crear, y botón Limpiar.
- `components/quotes/quote-list.tsx` reescrito: botones de acción migrados a `DropdownMenu` con ícono `MoreHorizontal`; eliminación protegida por `AlertDialog` de confirmación; spinner por fila durante operaciones; badges de estado con color semántico consistente.
- `app/[tenantSlug]/quotes/page.tsx` reescrito como Server Component puro: formulario movido al Dialog, tabla envuelta en `Card`, encabezado con ícono, contador de cotizaciones registradas.
- `createQuoteAction` en `lib/quote-actions.ts` ahora registra automáticamente una interacción tipo `NOTE` en el historial del lead al crear una cotización (trazabilidad end-to-end).

### Fixed

- `tests/quote-actions.test.ts` actualizado para incluir el mock de `db.interaction.create` requerido por la nueva trazabilidad.

## [2026-03-31] Sprint 7 - Módulo de Cotizaciones completo

### Added

- Nuevo módulo de cotizaciones implementado end-to-end:
  - `lib/quote-actions.ts` con acciones `createQuoteAction`, `updateQuoteAction`, `changeQuoteStatusAction`, `deleteQuoteAction` (soft delete), `listLeadQuotesAction`, `listTenantQuotesAction` y `getQuoteDetailAction`.
  - `components/quotes/quote-create-form.tsx` con formulario de alta de cotización e ítems dinámicos.
  - `components/quotes/quote-list.tsx` con tabla de cotizaciones, badges de estado y acciones por fila.
  - `app/[tenantSlug]/quotes/page.tsx` con listado general y creación rápida de cotizaciones del tenant.
  - `app/[tenantSlug]/quotes/[id]/page.tsx` con detalle y transición de estado.
- Nueva pestaña `Cotizaciones` en `app/[tenantSlug]/leads/[id]/page.tsx` para alta y consulta contextual por lead.
- Feature flag `QUOTING_BASIC` marcada como soportada en `lib/feature-catalog.ts` y habilitada en el bundle `SCALE`.
- Reglas de permisos `canCreateQuote`, `canEditQuote`, `canDeleteQuote` y `canChangeQuoteStatus` en `lib/lead-permissions.ts`.
- Cobertura de pruebas en `tests/quote-actions.test.ts` (permisos, transiciones de estado, aislamiento multi-tenant).
- Enums `QuoteStatus` (`BORRADOR`, `ENVIADA`, `ACEPTADA`, `RECHAZADA`) y `CurrencyCode` (`PEN`, `USD`) en el schema de Prisma.
- Migración `20260331163105_add_quotes_module` aplicada.

### Changed

- `prisma/schema.prisma` incorpora los modelos `Quote` y `QuoteItem` con relaciones a `Tenant`, `Lead` y `User`.
- `lib/validators.ts` añade `createQuoteSchema`, `updateQuoteSchema`, `changeQuoteStatusSchema`, `deleteQuoteSchema` y `quoteFiltersSchema`.
- `components/tenant-sidebar.tsx` expone la entrada `Cotizaciones` en la navegación lateral cuando `QUOTING_BASIC` está activa.
- `tests/feature-catalog.test.ts` actualizado para reflejar `QUOTING_BASIC` como feature soportada.
- El cálculo de `subtotal`, `tax` y `total` ocurre íntegramente en el servidor (`quote-actions.ts`) para garantizar consistencia.

### Fixed

- Transiciones de estado validadas en servidor para evitar saltos inválidos (p. ej. `ACEPTADA` → `BORRADOR`).
- Solo cotizaciones en estado `BORRADOR` son editables; `SUPERVISOR+` puede forzar cambios sobre cualquier estado.

## [2026-03-31] Importación por Excel + Documentos completos

### Added

- Nuevo módulo de documentos implementado end-to-end:
  - `lib/document-actions.ts` con acciones de subir, eliminar y listar documentos.
  - `components/documents/document-upload-zone.tsx` con carga drag-and-drop.
  - `components/documents/document-list.tsx` con tabla, descarga y acciones por archivo.
  - `app/[tenantSlug]/documents/page.tsx` como repositorio general de documentos del tenant.
- Nueva pestaña `Documentos` en `app/[tenantSlug]/leads/[id]/page.tsx` para gestionar archivos por lead.
- Soporte de almacenamiento en `@vercel/blob` para archivos del módulo `DOCUMENTS`.
- Cobertura de pruebas para documentos en `tests/document-actions.test.ts`.

### Changed

- `next.config.ts` ahora declara `serverActions.bodySizeLimit = '5mb'` para cargas de documentos.
- `prisma/schema.prisma` incorpora el modelo `Document` y sus relaciones (`Tenant`, `Lead`, `User`).
- La importación de leads migró de pegado manual a carga de archivo (`.xlsx/.xls/.csv`) con UX mejorada.
- Se añadió descarga de plantilla Excel con filas de ejemplo para carga masiva.
- La importación ahora requiere `ruc` como columna obligatoria y clave principal para deduplicación.
- `businessName` pasa a opcional en importación; si no viene informado, se usa `ruc` como fallback.

### Fixed

- Se corrigen inconsistencias de props en vistas de documentos (`docs`/`documents` y props no soportadas).
- Se garantiza compatibilidad de build y tipado tras la integración del módulo de documentos.

## [2026-03-29] UX/UI SuperAdmin - planes tabulares y perfil desde avatar

### Added

- Nuevo componente reutilizable `components/sidebar-user-menu.tsx` para centralizar el menú de cuenta en sidebars.
- Nueva ruta `app/(superadmin)/superadmin/profile` para visualizar identidad, accesos rápidos y memberships del `SuperAdmin`.
- Nuevos dialogs de planes para alta, detalle, edición y activación/desactivación desde la tabla administrativa.

### Changed

- `app/(superadmin)/superadmin/plans` ahora usa una tabla operativa con acciones por fila en lugar de tarjetas individuales.
- `components/superadmin/plan-create-form.tsx` y `components/superadmin/plan-edit-card.tsx` se refactorizaron para reutilizarse dentro de dialogs.
- `components/superadmin-sidebar.tsx` y `components/tenant-sidebar.tsx` ahora resuelven perfil y cierre de sesión desde el avatar del usuario.

### Fixed

- Se reduce la fricción para administrar muchos planes al concentrar creación, consulta y edición en una sola vista.
- Se corrige la ausencia de un módulo de perfil para `SuperAdmin` y se alinea el patrón de cuenta entre panel tenant y panel administrativo.

## [2026-03-28] Fix seed demo auth recovery

### Changed

- `prisma/seed.ts` ahora vuelve a sincronizar los usuarios demo (`superadmin`, `admin`, `vendedor`) con sus credenciales esperadas en cada re-seed para evitar entornos locales con passwords stale o flags desalineados.
- El seed también reactiva y normaliza las memberships base del tenant `acme-logistics` durante la recarga de datos de prueba.
- El login ahora permite omitir el `slug` cuando se ingresa con una cuenta `SuperAdmin`; las cuentas tenant siguen usando `slug` para resolver su contexto.
- `auth.ts` ahora declara explícitamente `trustHost: true` para endurecer el login en despliegues detrás de proxy como Vercel y evitar bucles de autenticación por host no confiado.
- `proxy.ts` ahora protege rutas usando el wrapper oficial `auth(...)` en lugar de leer el token manualmente, alineando la resolución de sesión del borde con `/api/auth/session`.

### Fixed

- Se corrige el caso en el que `superadmin@example.com` u otros usuarios demo quedaban imposibilitados de iniciar sesión porque ya existían en la base con password antigua, `isSuperAdmin` incorrecto o memberships inactivas.

## [2026-03-28] Post Sprint 6 - Hardening de acceso y saneamiento de features

### Added

- Nuevo módulo `lib/auth-rate-limit.ts` para aplicar throttling temporal a intentos fallidos de autenticación.
- Nuevas pruebas para rate limiting de auth y para el comportamiento neutral del `loginAction`.

### Changed

- `auth.ts` ahora aplica rate limiting al proveedor de credenciales y registra intentos fallidos con contexto saneado.
- `lib/auth-actions.ts` ahora devuelve mensajes neutrales de login y frena intentos ya bloqueados antes de relanzar auth.
- `lib/feature-catalog.ts`, `feature-service.ts` y la UI `SuperAdmin` ahora distinguen entre features soportadas y features futuras.
- `.env.example` y `README.md` ahora documentan la configuración de rate limiting para auth.

### Fixed

- Se elimina la fuga de información por mensajes diferenciados en login (`tenant`, membresía o acceso a superadmin).
- Se evita que features no implementadas sigan ofreciéndose o activándose desde planes y settings de tenants.

## [2026-03-28] Sprint 6 - Hardening para producción

### Added

- Nuevo módulo `lib/env.ts` para validación central de variables críticas y defaults seguros fuera de producción.
- Nuevo módulo `lib/http-security.ts` para construir headers defensivos reutilizables.
- Nuevos fallbacks `app/error.tsx` y `app/global-error.tsx` para degradación segura en App Router.
- Nuevas pruebas para hardening de entorno, logger y headers de seguridad.

### Changed

- `middleware.ts` se migró a `proxy.ts` para alinearse con la convención de Next.js 16.
- `auth.ts`, `lib/db.ts`, `prisma.config.ts` y `prisma/seed.ts` ahora consumen validación compartida de entorno.
- `lib/logger.ts` ahora soporta niveles, contexto estructurado y salida JSON en producción.
- `next.config.ts` ahora endurece el runtime con `reactStrictMode` y elimina `X-Powered-By`.
- `.env.example` ahora documenta `AUTH_SECRET`, `NODE_ENV` y `LOG_LEVEL`.

### Fixed

- Se elimina el warning de deprecación por convención `middleware` durante el build.
- Se evita depender de secretos implícitos al centralizar `AUTH_SECRET` para auth/proxy.
- Se endurecen las respuestas HTTP con headers defensivos y trazabilidad básica por request.

## [2026-03-28] Sprint 5 - Invitaciones y onboarding de usuarios

### Added

- Nuevo modelo `TeamInvitation` para invitaciones seguras por tenant con expiración y aceptación trazable.
- Nueva ruta pública `app/(auth)/invite/[token]` para onboarding por enlace.
- Nuevas server actions para crear, cancelar, regenerar y aceptar invitaciones.
- Utilidades `lib/team-invitations.ts` para hashing de tokens y resolución de estado.
- Nuevas pruebas para validadores de invitación y helpers de onboarding.

### Changed

- `team/new` ahora genera invitaciones en lugar de crear contraseñas desde el panel.
- `team/page.tsx` ahora muestra invitaciones abiertas, su estado y acciones operativas.
- `team-actions.ts` ahora reserva cupos teniendo en cuenta invitaciones pendientes además de miembros activos.
- Los mensajes de autenticación y autorregistro ahora apuntan al flujo de invitaciones administradas por el tenant.

### Fixed

- Se evita sobreasignar usuarios por encima del límite del plan cuando ya existen invitaciones pendientes.
- Se evita aceptar invitaciones expiradas, canceladas o ya utilizadas.

## [2026-03-28] Sprint 4 - Import + Dedupe MVP (cierre)

### Added

- Nueva ruta `app/[tenantSlug]/leads/import` para importar leads por CSV pegado en texto.
- Nueva ruta `app/[tenantSlug]/leads/dedupe` para revisar y fusionar grupos duplicados.
- Server actions `importLeadsAction` y `mergeDuplicateLeadsAction`.
- Utilidades `lib/import-utils.ts` y `lib/dedupe-utils.ts` para parsing, normalización y merge.
- Nuevos tests para importación, deduplicación, validadores y permisos del módulo comercial.
- Preflight de importación para analizar filas válidas, duplicados y errores antes de confirmar la carga.
- Preview del merge en el diálogo de duplicados para visualizar el resultado estimado antes de fusionar.
- Test de catálogo de features para fijar el alcance del Sprint 4 por plan.

### Changed

- El módulo `leads` ahora expone accesos directos a importación y revisión de duplicados.
- `lead-permissions.ts` incorpora permisos explícitos para importación y gestión de duplicados.
- `validators.ts` ahora soporta schemas de importación CSV y merge de duplicados.
- La sidebar tenant ahora expone `Importación` y `Duplicados` cuando el tenant tiene esas features activas.
- El dashboard tenant ahora resume grupos duplicados y ofrece accesos directos a las herramientas del Sprint 4.
- El seed principal ahora deja `acme-logistics` materializado sobre `Growth` para que `IMPORT` y `DEDUPE` queden disponibles en demos y QA.
- `README.md` marca Sprint 4 como completado y deja Sprint 5 listo como siguiente candidato.

### Fixed

- Se evita importar leads que ya colisionan por RUC, email o teléfono.
- La fusión de duplicados consolida teléfonos, correos y notas en el lead principal sin perder el registro activo.
- Se evita confirmar importaciones sobre un CSV modificado sin volver a ejecutar el análisis previo.

## [2026-03-28] Sprint 3 - Lead detail y dashboard operativo

### Added

- Nueva ruta `app/[tenantSlug]/leads/[id]` con vista detallada del lead.
- Historial de reasignaciones dentro del detalle del lead, incluyendo resolución desde la misma pantalla.
- Helper compartido `lib/lead-status.ts` para etiquetas, variantes y buckets del pipeline.
- Caso de prueba para helpers de estado y distribución del pipeline.

### Changed

- El dashboard tenant ahora muestra métricas operativas, distribución por estado y actividad reciente.
- El listado de leads incorpora navegación directa al detalle de cada prospecto.
- La presentación de estados de lead y reasignación quedó unificada entre dashboard, listado y detalle.

### Fixed

- Se reduce la duplicación de lógica de labels/variants de estados entre vistas del módulo comercial.

## [2026-03-27] Sprint 2.3 - Prisma config y base de pruebas

### Added

- `prisma.config.ts` como punto central de configuración para schema, migrations y seed.
- Integración de `@prisma/adapter-pg` para Prisma Client y el seed.
- `vitest.config.ts` y suite inicial de pruebas unitarias.
- Casos de prueba para ownership de leads, permisos y validadores.
- Caso de prueba para verificar la configuración de Prisma.

### Changed

- Upgrade de `prisma` y `@prisma/client` a `7.6.0`.
- `package.json` ahora expone scripts de `test`, `test:watch` y `prisma:validate`.
- `README.md` pasó de plantilla genérica a documentación viva del producto.
- La configuración de seed dejó de depender de `package.json#prisma`.

### Fixed

- Se eliminó el warning del editor por `datasource.url` en `schema.prisma` al migrar a Prisma 7.
- Se eliminó el warning por `package.json#prisma` deprecado mediante `prisma.config.ts`.

## [2026-03-27] Sprint 2.2 - Reasignaciones y validaciones del core comercial

### Added

- Diálogo de resolución de reasignaciones con owner final y nota opcional.
- Reglas explícitas para owners elegibles de leads (`VENDEDOR`, `SUPERVISOR`, `ADMIN`).

### Changed

- Los listados y acciones de leads usan owners asignables en vez de cualquier miembro activo.
- La aprobación de reasignaciones exige owner final válido.

### Fixed

- Se bloquean solicitudes pendientes duplicadas por lead.
- Se bloquea sugerir al owner actual como nuevo owner en solicitudes de reasignación.
- Se evita asignar leads a miembros inactivos o con roles no elegibles.

## [2026-03-27] Sprint 2.1 - Estabilización del módulo Team

### Added

- Remoción real de miembros desde la UI.
- Salvaguardas para no dejar un tenant sin administradores activos.

### Changed

- `SUPERVISOR` conserva visibilidad del módulo, pero la gestión queda limitada a `ADMIN` y `SuperAdmin`.
- La ruta `team/new` ahora se protege del lado servidor.

### Fixed

- Se corrigió la inconsistencia entre permisos visibles en la UI y permisos reales en las server actions.
- Se evita que un administrador se desactive o elimine su propia membresía por error.
