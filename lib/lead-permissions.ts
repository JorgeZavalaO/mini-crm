import { hasRole } from '@/lib/rbac';
import type { QuoteStatus } from '@prisma/client';

type LeadPermissionContext = {
  userId: string;
  role: string | null;
  isSuperAdmin: boolean;
  isActiveMember: boolean;
};

type LeadOwnership = {
  ownerId: string | null;
};

export function canEditLead(ctx: LeadPermissionContext, ownership: LeadOwnership): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.isActiveMember) return false;
  if (!ownership.ownerId) return true;
  if (ownership.ownerId === ctx.userId) return true;
  return hasRole(ctx.role, 'SUPERVISOR');
}

export function canAssignLeads(ctx: LeadPermissionContext): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.isActiveMember) return false;
  return hasRole(ctx.role, 'SUPERVISOR');
}

export function canResolveReassignment(ctx: LeadPermissionContext): boolean {
  return canAssignLeads(ctx);
}

export function canImportLeads(ctx: LeadPermissionContext): boolean {
  return canAssignLeads(ctx);
}

export function canManageDuplicateLeads(ctx: LeadPermissionContext): boolean {
  return canAssignLeads(ctx);
}

export function canCreateInteraction(ctx: LeadPermissionContext): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.isActiveMember;
}

export function canEditInteraction(ctx: LeadPermissionContext, authorId: string): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.isActiveMember) return false;
  if (ctx.userId === authorId) return true;
  return hasRole(ctx.role, 'SUPERVISOR');
}

export function canDeleteInteraction(ctx: LeadPermissionContext, authorId: string): boolean {
  return canEditInteraction(ctx, authorId);
}

export function canUploadDocument(ctx: LeadPermissionContext): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.isActiveMember;
}

export function canDeleteDocument(ctx: LeadPermissionContext, uploadedById: string): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.isActiveMember) return false;
  if (ctx.userId === uploadedById) return true;
  return hasRole(ctx.role, 'SUPERVISOR');
}

export function canCreateQuote(ctx: LeadPermissionContext): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.isActiveMember;
}

export function canEditQuote(
  ctx: LeadPermissionContext,
  ownership: { createdById: string; status: QuoteStatus },
): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.isActiveMember) return false;
  if (ownership.status !== 'BORRADOR') return hasRole(ctx.role, 'SUPERVISOR');
  if (ctx.userId === ownership.createdById) return true;
  return hasRole(ctx.role, 'SUPERVISOR');
}

export function canDeleteQuote(
  ctx: LeadPermissionContext,
  ownership: { createdById: string; status: QuoteStatus },
): boolean {
  return canEditQuote(ctx, ownership);
}

export function canChangeQuoteStatus(ctx: LeadPermissionContext): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.isActiveMember) return false;
  return hasRole(ctx.role, 'VENDEDOR');
}

// ─── Task permissions ────────────────────────────────────

export function canCreateTask(ctx: LeadPermissionContext): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.isActiveMember;
}

export function canEditTask(
  ctx: LeadPermissionContext,
  ownership: { createdById: string; assignedToId: string | null },
): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.isActiveMember) return false;
  if (ctx.userId === ownership.createdById) return true;
  if (ctx.userId === ownership.assignedToId) return true;
  return hasRole(ctx.role, 'SUPERVISOR');
}

export function canDeleteTask(
  ctx: LeadPermissionContext,
  ownership: { createdById: string; assignedToId: string | null },
): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.isActiveMember) return false;
  if (ctx.userId === ownership.createdById) return true;
  return hasRole(ctx.role, 'SUPERVISOR');
}

export function canCompleteTask(
  ctx: LeadPermissionContext,
  ownership: { createdById: string; assignedToId: string | null },
): boolean {
  return canEditTask(ctx, ownership);
}

/** SUPERVISOR+ (or superAdmin) can assign tasks to other members. */
export function canAssignTaskToOthers(ctx: LeadPermissionContext): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.isActiveMember) return false;
  return hasRole(ctx.role, 'SUPERVISOR');
}

/** SUPERVISOR+ (or superAdmin) can see all tenant tasks. Lower roles only see their own. */
export function canViewAllTasks(ctx: LeadPermissionContext): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.isActiveMember) return false;
  return hasRole(ctx.role, 'SUPERVISOR');
}

// ─── Notification permissions ────────────────────────────

export function canDeleteNotification(ctx: LeadPermissionContext): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.isActiveMember;
}

// ─── Portal permissions ─────────────────────────────────

export function canCreatePortalToken(ctx: LeadPermissionContext): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.isActiveMember) return false;
  return hasRole(ctx.role, 'SUPERVISOR');
}

export function canRevokePortalToken(ctx: LeadPermissionContext): boolean {
  return canCreatePortalToken(ctx);
}
