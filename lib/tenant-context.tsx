'use client';

import { createContext, useContext } from 'react';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

interface TenantContextValue {
  tenant: TenantInfo;
  role: string | null;
  isSuperAdmin: boolean;
}

const TenantCtx = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  tenant,
  role,
  isSuperAdmin,
  children,
}: TenantContextValue & { children: React.ReactNode }) {
  return <TenantCtx.Provider value={{ tenant, role, isSuperAdmin }}>{children}</TenantCtx.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantCtx);
  if (!ctx) throw new Error('useTenant must be used within <TenantProvider>');
  return ctx;
}
