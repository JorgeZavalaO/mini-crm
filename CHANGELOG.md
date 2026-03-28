# Changelog

Todos los cambios relevantes del proyecto se documentan aquí por hito/sprint.

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
