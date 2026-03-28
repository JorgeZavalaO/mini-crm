import { hasRole } from '@/lib/rbac';

export type LeadOwnerOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type LeadOwnerMembership = {
  role: string;
  isActive: boolean;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

export function canOwnLeads(role: string | null | undefined): boolean {
  return hasRole(role, 'VENDEDOR');
}

export function isAssignableLeadOwner(membership: {
  role: string | null | undefined;
  isActive: boolean;
}): boolean {
  return membership.isActive && canOwnLeads(membership.role);
}

export function toLeadOwnerOption(membership: LeadOwnerMembership): LeadOwnerOption {
  return {
    id: membership.user.id,
    name: membership.user.name ?? '',
    email: membership.user.email,
    role: membership.role,
  };
}

export function getAssignableLeadOwnerOptions(
  memberships: LeadOwnerMembership[],
): LeadOwnerOption[] {
  return memberships.filter(isAssignableLeadOwner).map(toLeadOwnerOption);
}
