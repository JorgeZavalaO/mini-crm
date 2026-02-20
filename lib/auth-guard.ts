import { auth } from '@/auth';
import { db } from '@/lib/db';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { hasRole, type Role } from '@/lib/rbac';
import type { FeatureKey } from '@prisma/client';
import { forbidden, redirect } from 'next/navigation';
import type { Session } from 'next-auth';

export interface TenantContext {
  session: Session;
  tenant: { id: string; name: string; slug: string; isActive: boolean };
  membership: { id: string; role: string; isActive: boolean } | null;
}

/**
 * Validate the current user has access to a tenant identified by slug.
 * SuperAdmins can access any tenant (impersonation).
 * Regular users must have an active membership to the tenant.
 */
export async function requireTenantAccess(tenantSlug: string): Promise<TenantContext> {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const tenant = await db.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, name: true, slug: true, isActive: true },
  });

  if (!tenant || !tenant.isActive) {
    redirect('/login');
  }

  // SuperAdmin can access any tenant without membership
  if (session.user.isSuperAdmin) {
    return {
      session: session as Session,
      tenant,
      membership: null, // SuperAdmin impersonating, no membership
    };
  }

  // Regular user: must have an active membership
  const membership = await db.membership.findUnique({
    where: {
      userId_tenantId: { userId: session.user.id, tenantId: tenant.id },
    },
    select: { id: true, role: true, isActive: true },
  });

  if (!membership || !membership.isActive) {
    // User doesn't belong to this tenant
    if (session.user.tenantSlug) {
      redirect(`/${session.user.tenantSlug}/dashboard`);
    }
    redirect('/login');
  }

  return {
    session: session as Session,
    tenant,
    membership,
  };
}

/**
 * Require minimum role level within a tenant.
 * SuperAdmins always pass.
 */
export async function requireTenantRole(
  tenantSlug: string,
  requiredRole: Role,
): Promise<TenantContext> {
  const ctx = await requireTenantAccess(tenantSlug);

  // SuperAdmin bypass
  if (ctx.session.user.isSuperAdmin) return ctx;

  if (!ctx.membership || !hasRole(ctx.membership.role, requiredRole)) {
    redirect(`/${tenantSlug}/dashboard`);
  }

  return ctx;
}

/**
 * Require the current user to be a SuperAdmin.
 */
export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!session.user.isSuperAdmin) redirect('/login');
  return session;
}

export async function requireTenantFeature(tenantSlug: string, featureKey: FeatureKey) {
  const ctx = await requireTenantAccess(tenantSlug);
  const enabled = await isTenantFeatureEnabled(ctx.tenant.id, featureKey);

  if (!enabled) {
    forbidden();
  }

  return ctx;
}

export async function assertTenantFeatureById(tenantId: string, featureKey: FeatureKey) {
  const enabled = await isTenantFeatureEnabled(tenantId, featureKey);
  if (!enabled) {
    throw new Error(`Feature ${featureKey} disabled`);
  }
}
