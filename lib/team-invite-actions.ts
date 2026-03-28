'use server';

import { revalidatePath } from 'next/cache';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { getTenantActionContextById } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { hashPassword, verifyPassword } from '@/lib/password';
import { hasRole } from '@/lib/rbac';
import {
  formatTeamInvitationDate,
  getTeamInvitationPreviewByToken,
} from '@/lib/team-invite-service';
import {
  createTeamInvitationToken,
  getTeamInvitationExpiresAt,
  getTeamInvitationStatus,
  hashTeamInvitationToken,
  isTeamInvitationPending,
} from '@/lib/team-invitations';
import { acceptTeamInvitationSchema, createTeamInvitationSchema } from '@/lib/validators';

type TeamInviteDbClient = Pick<typeof db, 'tenant' | 'membership' | 'teamInvitation' | 'user'>;

type TeamInviteFormState = {
  error?: string;
  success?: boolean;
  invitePath?: string;
  inviteEmail?: string;
  expiresAtLabel?: string;
};

async function assertTeamInviteManagementAccess(tenantId: string) {
  const ctx = await getTenantActionContextById(tenantId);

  if (!ctx.session.user.isSuperAdmin && !hasRole(ctx.membership?.role, 'ADMIN')) {
    throw new AppError('No autorizado para gestionar invitaciones', 403);
  }

  return ctx;
}

async function assertInvitationSeatReservationAvailable(
  client: TeamInviteDbClient,
  tenantId: string,
) {
  const now = new Date();
  const [tenant, activeMembers, pendingInvitations] = await Promise.all([
    client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true, deletedAt: true, maxUsers: true },
    }),
    client.membership.count({ where: { tenantId, isActive: true } }),
    client.teamInvitation.count({
      where: {
        tenantId,
        acceptedAt: null,
        canceledAt: null,
        expiresAt: { gt: now },
      },
    }),
  ]);

  if (!tenant || !tenant.isActive || tenant.deletedAt) {
    throw new AppError('Tenant no disponible', 404);
  }

  if (tenant.maxUsers && activeMembers + pendingInvitations >= tenant.maxUsers) {
    throw new AppError('Limite de usuarios alcanzado para este tenant', 400);
  }
}

async function assertInvitationAcceptanceSeatAvailable(
  client: TeamInviteDbClient,
  tenantId: string,
) {
  const [tenant, activeMembers] = await Promise.all([
    client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true, deletedAt: true, maxUsers: true },
    }),
    client.membership.count({ where: { tenantId, isActive: true } }),
  ]);

  if (!tenant || !tenant.isActive || tenant.deletedAt) {
    throw new AppError('Tenant no disponible', 404);
  }

  if (tenant.maxUsers && activeMembers >= tenant.maxUsers) {
    throw new AppError('El tenant ya no tiene cupos disponibles para aceptar la invitación', 400);
  }
}

function revalidateTeamInviteViews(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/team`);
  revalidatePath(`/${tenantSlug}/team/new`);
}

async function assertInvitationCanBeCreated(
  client: TeamInviteDbClient,
  tenantId: string,
  email: string,
) {
  const now = new Date();
  const [existingMembership, pendingInvitation] = await Promise.all([
    client.membership.findFirst({
      where: { tenantId, user: { email } },
      select: { id: true, isActive: true },
    }),
    client.teamInvitation.findFirst({
      where: {
        tenantId,
        email,
        acceptedAt: null,
        canceledAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true },
    }),
  ]);

  if (existingMembership?.isActive) {
    throw new AppError('Este usuario ya es miembro activo de la empresa', 400);
  }

  if (existingMembership && !existingMembership.isActive) {
    throw new AppError(
      'Este usuario ya tiene una membresía inactiva. Reactívalo desde el equipo.',
      400,
    );
  }

  if (pendingInvitation) {
    throw new AppError('Ya existe una invitación pendiente para este email', 400);
  }
}

async function issueInvitationLink(invitationId: string, tenantSlug: string) {
  const invitation = await db.teamInvitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      tenantId: true,
      acceptedAt: true,
      canceledAt: true,
      expiresAt: true,
    },
  });

  if (!invitation) {
    throw new AppError('Invitación no encontrada', 404);
  }

  await assertTeamInviteManagementAccess(invitation.tenantId);

  const status = getTeamInvitationStatus(invitation);
  if (status === 'ACCEPTED') {
    throw new AppError('La invitación ya fue aceptada', 400);
  }

  if (status === 'CANCELED') {
    throw new AppError('La invitación fue cancelada y no puede regenerarse', 400);
  }

  if (status === 'EXPIRED') {
    await assertInvitationSeatReservationAvailable(db, invitation.tenantId);
  }

  const { rawToken, tokenHash } = createTeamInvitationToken();
  const expiresAt = getTeamInvitationExpiresAt();

  await db.teamInvitation.update({
    where: { id: invitation.id },
    data: {
      tokenHash,
      expiresAt,
    },
  });

  revalidateTeamInviteViews(tenantSlug);

  return {
    invitePath: `/invite/${rawToken}`,
    expiresAtLabel: formatTeamInvitationDate(expiresAt),
  };
}

export async function createTeamInvitationAction(
  _prevState: TeamInviteFormState | undefined,
  formData: FormData,
): Promise<TeamInviteFormState> {
  const parsed = createTeamInvitationSchema.safeParse({
    tenantId: formData.get('tenantId'),
    tenantSlug: formData.get('tenantSlug'),
    email: formData.get('email'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Solicitud inválida' };
  }

  try {
    const ctx = await assertTeamInviteManagementAccess(parsed.data.tenantId);
    await assertInvitationSeatReservationAvailable(db, parsed.data.tenantId);
    await assertInvitationCanBeCreated(db, parsed.data.tenantId, parsed.data.email);

    const { rawToken, tokenHash } = createTeamInvitationToken();
    const expiresAt = getTeamInvitationExpiresAt();

    await db.teamInvitation.create({
      data: {
        tenantId: parsed.data.tenantId,
        email: parsed.data.email,
        role: parsed.data.role,
        tokenHash,
        invitedById: ctx.session.user.id,
        expiresAt,
      },
    });

    revalidateTeamInviteViews(parsed.data.tenantSlug);

    return {
      success: true,
      invitePath: `/invite/${rawToken}`,
      inviteEmail: parsed.data.email,
      expiresAtLabel: formatTeamInvitationDate(expiresAt),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'No se pudo crear la invitación',
    };
  }
}

export async function refreshTeamInvitationLinkAction(invitationId: string, tenantSlug: string) {
  return issueInvitationLink(invitationId, tenantSlug);
}

export async function cancelTeamInvitationAction(invitationId: string, tenantSlug: string) {
  const invitation = await db.teamInvitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      tenantId: true,
      email: true,
      acceptedAt: true,
      canceledAt: true,
      expiresAt: true,
    },
  });

  if (!invitation) {
    throw new AppError('Invitación no encontrada', 404);
  }

  await assertTeamInviteManagementAccess(invitation.tenantId);

  const status = getTeamInvitationStatus(invitation);
  if (status === 'ACCEPTED') {
    throw new AppError('La invitación ya fue aceptada', 400);
  }

  if (status === 'CANCELED') {
    throw new AppError('La invitación ya estaba cancelada', 400);
  }

  await db.teamInvitation.update({
    where: { id: invitation.id },
    data: { canceledAt: new Date() },
  });

  revalidateTeamInviteViews(tenantSlug);

  return {
    success: true,
    inviteEmail: invitation.email,
  };
}

export async function acceptTeamInvitationAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
) {
  const parsed = acceptTeamInvitationSchema.safeParse({
    token: formData.get('token'),
    name: formData.get('name'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Solicitud inválida' };
  }

  const invitePreview = await getTeamInvitationPreviewByToken(parsed.data.token);
  if (!invitePreview) {
    return { error: 'La invitación no existe o ya no está disponible' };
  }

  if (invitePreview.status !== 'PENDING') {
    return {
      error: `La invitación ya no puede aceptarse (${invitePreview.statusLabel.toLowerCase()})`,
    };
  }

  const tokenHash = hashTeamInvitationToken(parsed.data.token);

  try {
    await db.$transaction(async (tx) => {
      const invitation = await tx.teamInvitation.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          tenantId: true,
          email: true,
          role: true,
          expiresAt: true,
          acceptedAt: true,
          canceledAt: true,
        },
      });

      if (!invitation || !isTeamInvitationPending(invitation)) {
        throw new AppError('La invitación ya no está disponible', 400);
      }

      await assertInvitationAcceptanceSeatAvailable(tx, invitation.tenantId);

      const existingUser = await tx.user.findUnique({
        where: { email: invitation.email },
        select: { id: true, name: true, password: true },
      });

      let userId: string;

      if (existingUser) {
        const validPassword = await verifyPassword(parsed.data.password, existingUser.password);
        if (!validPassword) {
          throw new AppError(
            'Ya existe una cuenta con este email. Usa tu contraseña actual para aceptar la invitación.',
            400,
          );
        }

        const existingMembership = await tx.membership.findUnique({
          where: {
            userId_tenantId: { userId: existingUser.id, tenantId: invitation.tenantId },
          },
          select: { id: true, isActive: true },
        });

        if (existingMembership?.isActive) {
          throw new AppError('Ya formas parte de esta empresa', 400);
        }

        if (existingMembership && !existingMembership.isActive) {
          throw new AppError(
            'Tu membresía ya existe pero está inactiva. Pide al administrador que la reactive.',
            400,
          );
        }

        if (!existingUser.name) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: { name: parsed.data.name },
          });
        }

        userId = existingUser.id;
      } else {
        const passwordHash = await hashPassword(parsed.data.password);
        const user = await tx.user.create({
          data: {
            name: parsed.data.name,
            email: invitation.email,
            password: passwordHash,
          },
          select: { id: true },
        });

        userId = user.id;
      }

      const invitationUpdate = await tx.teamInvitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          canceledAt: null,
        },
        data: {
          acceptedAt: new Date(),
          acceptedByUserId: userId,
        },
      });

      if (invitationUpdate.count !== 1) {
        throw new AppError('La invitación ya fue procesada por otra sesión', 400);
      }

      await tx.membership.create({
        data: {
          userId,
          tenantId: invitation.tenantId,
          role: invitation.role,
        },
      });
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'No se pudo aceptar la invitación',
    };
  }

  revalidateTeamInviteViews(invitePreview.tenant.slug);

  try {
    await signIn('credentials', {
      slug: invitePreview.tenant.slug,
      email: invitePreview.email,
      password: parsed.data.password,
      redirectTo: `/${invitePreview.tenant.slug}/dashboard`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'La invitación se aceptó, pero no se pudo iniciar sesión automáticamente.' };
    }

    throw error;
  }

  return {};
}
