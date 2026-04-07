'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { hasRole, type Role, ROLES } from '@/lib/rbac';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function assertTeamAccess(tenantId: string) {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');

  // SuperAdmin can manage any tenant
  if (session.user.isSuperAdmin) return session;

  // Check membership with at least SUPERVISOR role
  const membership = await db.membership.findUnique({
    where: {
      userId_tenantId: { userId: session.user.id, tenantId },
    },
  });

  if (!membership || !membership.isActive || !hasRole(membership.role, 'ADMIN')) {
    throw new Error('No autorizado');
  }

  return session;
}

async function ensureUserSlotAvailable(tenantId: string) {
  const now = new Date();
  const [tenant, activeMembers, pendingInvitations] = await Promise.all([
    db.tenant.findUnique({
      where: { id: tenantId },
      select: { maxUsers: true, deletedAt: true },
    }),
    db.membership.count({ where: { tenantId, isActive: true } }),
    db.teamInvitation.count({
      where: {
        tenantId,
        acceptedAt: null,
        canceledAt: null,
        expiresAt: { gt: now },
      },
    }),
  ]);

  if (!tenant || tenant.deletedAt) {
    throw new Error('Tenant no disponible');
  }

  if (tenant.maxUsers && activeMembers + pendingInvitations >= tenant.maxUsers) {
    throw new Error('Limite de usuarios alcanzado para este tenant');
  }
}

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function ensureUserSlotAvailableTx(tx: TxClient, tenantId: string) {
  const now = new Date();
  const [tenant, activeMembers, pendingInvitations] = await Promise.all([
    tx.tenant.findUnique({
      where: { id: tenantId },
      select: { maxUsers: true, deletedAt: true },
    }),
    tx.membership.count({ where: { tenantId, isActive: true } }),
    tx.teamInvitation.count({
      where: {
        tenantId,
        acceptedAt: null,
        canceledAt: null,
        expiresAt: { gt: now },
      },
    }),
  ]);

  if (!tenant || tenant.deletedAt) {
    throw new Error('Tenant no disponible');
  }

  if (tenant.maxUsers && activeMembers + pendingInvitations >= tenant.maxUsers) {
    throw new Error('Limite de usuarios alcanzado para este tenant');
  }
}

async function ensureAdminCoverage(
  tenantId: string,
  membership: { id: string; role: Role; isActive: boolean },
) {
  if (membership.role !== 'ADMIN' || !membership.isActive) {
    return;
  }

  const remainingAdmins = await db.membership.count({
    where: {
      tenantId,
      isActive: true,
      role: 'ADMIN',
      NOT: { id: membership.id },
    },
  });

  if (remainingAdmins === 0) {
    throw new Error('No puedes dejar al tenant sin administradores activos');
  }
}

// ────────────────────────────────────────────────────────
// Create member (user + membership in tenant)
// ────────────────────────────────────────────────────────

export async function createMemberAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
) {
  const tenantId = formData.get('tenantId') as string;
  const tenantSlug = formData.get('tenantSlug') as string;
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const role = formData.get('role') as string;

  await assertTeamAccess(tenantId);

  if (!name || !email || !password || !role) {
    return { error: 'Todos los campos son requeridos' };
  }

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' };
  }

  if (!ROLES.includes(role as Role)) {
    return { error: 'Rol inválido' };
  }

  // Check if user already exists
  const user = await db.user.findUnique({ where: { email } });

  if (user) {
    // Check if already a member of this tenant
    const existingMembership = await db.membership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });

    if (existingMembership) {
      return { error: 'Este usuario ya es miembro de esta empresa' };
    }

    // Add membership inside a transaction to make the slot check atomic
    try {
      await db.$transaction(async (tx) => {
        await ensureUserSlotAvailableTx(tx, tenantId);
        await tx.membership.create({
          data: { userId: user.id, tenantId, role: role as Role },
        });
      });
    } catch (error) {
      if (error instanceof Error) return { error: error.message };
      return { error: 'No se pudo validar el limite de usuarios' };
    }
  } else {
    // Create new user + membership inside a single transaction so the slot check is atomic
    const hashed = await hashPassword(password);

    try {
      await db.$transaction(async (tx) => {
        await ensureUserSlotAvailableTx(tx, tenantId);

        const newUser = await tx.user.create({
          data: { name, email, password: hashed },
        });

        await tx.membership.create({
          data: { userId: newUser.id, tenantId, role: role as Role },
        });
      });
    } catch (error) {
      if (error instanceof Error) return { error: error.message };
      return { error: 'No se pudo crear el usuario' };
    }
  }

  redirect(`/${tenantSlug}/team`);
}

// ────────────────────────────────────────────────────────
// Update member role
// ────────────────────────────────────────────────────────

export async function updateMemberRoleAction(
  membershipId: string,
  newRole: string,
  tenantSlug: string,
) {
  const membership = await db.membership.findUnique({
    where: { id: membershipId },
  });
  if (!membership) throw new Error('Membership no encontrada');

  await assertTeamAccess(membership.tenantId);

  if (!ROLES.includes(newRole as Role)) {
    throw new Error('Rol inválido');
  }

  await db.membership.update({
    where: { id: membershipId },
    data: { role: newRole as Role },
  });

  redirect(`/${tenantSlug}/team`);
}

// ────────────────────────────────────────────────────────
// Toggle member active/inactive
// ────────────────────────────────────────────────────────

export async function toggleMemberAction(
  membershipId: string,
  tenantSlug: string,
): Promise<{ success: boolean; isActive: boolean; userName: string }> {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');

  const membership = await db.membership.findUnique({
    where: { id: membershipId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!membership) throw new Error('Membership no encontrada');

  await assertTeamAccess(membership.tenantId);

  if (!session.user.isSuperAdmin && membership.userId === session.user.id) {
    throw new Error('No puedes desactivar tu propia membresia');
  }

  if (membership.isActive) {
    await ensureAdminCoverage(membership.tenantId, {
      id: membership.id,
      role: membership.role,
      isActive: membership.isActive,
    });
  }

  if (!membership.isActive) {
    await ensureUserSlotAvailable(membership.tenantId);
  }

  const updated = await db.membership.update({
    where: { id: membershipId },
    data: { isActive: !membership.isActive },
  });

  revalidatePath(`/${tenantSlug}/team`);
  return { success: true, isActive: updated.isActive, userName: membership.user.name ?? 'Usuario' };
}

// ────────────────────────────────────────────────────────
// Remove member from tenant
// ────────────────────────────────────────────────────────

export async function removeMemberAction(
  membershipId: string,
  tenantSlug: string,
): Promise<{ success: boolean; userName: string }> {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');

  const membership = await db.membership.findUnique({
    where: { id: membershipId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!membership) throw new Error('Membership no encontrada');

  await assertTeamAccess(membership.tenantId);

  if (!session.user.isSuperAdmin && membership.userId === session.user.id) {
    throw new Error('No puedes eliminar tu propia membresia');
  }

  await ensureAdminCoverage(membership.tenantId, {
    id: membership.id,
    role: membership.role,
    isActive: membership.isActive,
  });

  await db.membership.delete({ where: { id: membershipId } });

  revalidatePath(`/${tenantSlug}/team`);
  return { success: true, userName: membership.user.name ?? 'Usuario' };
}
