# Changelog

Todos los cambios relevantes del proyecto se documentan aquí por hito/sprint.

## [2026-03-28] Fix seed demo auth recovery

### Changed

- `prisma/seed.ts` ahora vuelve a sincronizar los usuarios demo (`superadmin`, `admin`, `vendedor`) con sus credenciales esperadas en cada re-seed para evitar entornos locales con passwords stale o flags desalineados.
- El seed también reactiva y normaliza las memberships base del tenant `acme-logistics` durante la recarga de datos de prueba.
- El login ahora permite omitir el `slug` cuando se ingresa con una cuenta `SuperAdmin`; las cuentas tenant siguen usando `slug` para resolver su contexto.

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
