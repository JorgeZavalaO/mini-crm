/**
 * RBAC – Role-Based Access Control helpers.
 *
 * Roles (tenant-level):
 *   ADMIN > SUPERVISOR > VENDEDOR > FREELANCE > PASANTE
 *
 * SuperAdmin is a platform flag on User, not a tenant role.
 */

export const ROLES = ['ADMIN', 'SUPERVISOR', 'VENDEDOR', 'FREELANCE', 'PASANTE'] as const;

export type Role = (typeof ROLES)[number];

/** Numeric weight – higher = more permissions. */
const ROLE_WEIGHT: Record<Role, number> = {
  ADMIN: 50,
  SUPERVISOR: 40,
  VENDEDOR: 30,
  FREELANCE: 20,
  PASANTE: 10,
};

/**
 * Returns true if `userRole` has at least the same level as `requiredRole`.
 *
 * Example: hasRole("ADMIN", "VENDEDOR") → true
 */
export function hasRole(userRole: string | null | undefined, requiredRole: Role): boolean {
  if (!userRole) return false;
  const weight = ROLE_WEIGHT[userRole as Role];
  if (weight === undefined) return false;
  return weight >= ROLE_WEIGHT[requiredRole];
}

/**
 * Returns true when `userRole` is exactly the given role.
 */
export function isRole(userRole: string | null | undefined, role: Role): boolean {
  return userRole === role;
}
