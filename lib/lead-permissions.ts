import { hasRole } from '@/lib/rbac';

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
