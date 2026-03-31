# Changelog

Todos los cambios relevantes del proyecto se documentan aquí por hito/sprint.

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
