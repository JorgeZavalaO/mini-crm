'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FeatureKey } from '@prisma/client';
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  CheckSquare,
  Clock,
  CreditCard,
  FileSearch,
  FileText,
  GitMerge,
  Globe,
  HardDrive,
  LayoutDashboard,
  MessageSquare,
  Package,
  Upload,
  UserCheck,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  COMING_SOON_FEATURE_KEYS,
  FEATURE_DESCRIPTION,
  FEATURE_LABEL,
  SUPPORTED_FEATURE_KEYS,
} from '@/lib/feature-catalog';
import {
  setTenantFeatureAction,
  updateTenantBasicsAction,
  updateTenantPlanAndLimitsAction,
} from '@/lib/superadmin-actions';
import { buildSearchHref } from '@/lib/pagination';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPagination } from '@/components/ui/list-pagination';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const FEATURE_ICONS: Record<FeatureKey, LucideIcon> = {
  CRM_LEADS: Users,
  ASSIGNMENTS: UserCheck,
  INTERACTIONS: MessageSquare,
  TASKS: CheckSquare,
  DOCUMENTS: FileText,
  IMPORT: Upload,
  DEDUPE: GitMerge,
  DASHBOARD: LayoutDashboard,
  QUOTING_BASIC: FileSearch,
  CLIENT_PORTAL: Globe,
  NOTIFICATIONS: Bell,
};

const FEATURE_COLOR: Record<FeatureKey, string> = {
  CRM_LEADS: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  ASSIGNMENTS: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  INTERACTIONS: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  TASKS: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  DOCUMENTS: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  IMPORT: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  DEDUPE: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  DASHBOARD: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  QUOTING_BASIC: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  CLIENT_PORTAL: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  NOTIFICATIONS: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  VENDEDOR: 'Vendedor',
  FREELANCE: 'Freelance',
  PASANTE: 'Pasante',
};

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ADMIN: 'default',
  SUPERVISOR: 'secondary',
  VENDEDOR: 'outline',
  FREELANCE: 'outline',
  PASANTE: 'outline',
};

interface TenantSettingsTabsProps {
  tenant: {
    id: string;
    name: string;
    slug: string;
    planId: string | null;
    maxUsers: number | null;
    maxStorageGb: number | null;
    retentionDays: number | null;
  };
  plans: Array<{
    id: string;
    name: string;
    maxUsers: number;
    maxStorageGb: number;
    retentionDays: number;
    isActive: boolean;
  }>;
  features: Array<{ featureKey: FeatureKey; enabled: boolean; config: unknown }>;
  memberships: Array<{
    id: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
    user: { id: string; name: string | null; email: string };
  }>;
  membershipCounts: {
    total: number;
    active: number;
    inactive: number;
  };
  membershipPagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    startItem: number;
    endItem: number;
  };
}

export function TenantSettingsTabs({
  tenant,
  plans,
  features,
  memberships,
  membershipCounts,
  membershipPagination,
}: TenantSettingsTabsProps) {
  const router = useRouter();
  const [basicState, basicAction, basicPending] = useActionState(
    updateTenantBasicsAction,
    undefined,
  );
  const [limitsState, limitsAction, limitsPending] = useActionState(
    updateTenantPlanAndLimitsAction,
    undefined,
  );

  useEffect(() => {
    if (basicState?.success) {
      toast.success(basicState.success);
      router.refresh();
    }
  }, [basicState?.success, router]);

  useEffect(() => {
    if (limitsState?.success) {
      toast.success(limitsState.success);
      router.refresh();
    }
  }, [limitsState?.success, router]);

  const initialFeatureMap = useMemo(() => {
    const map = new Map(features.map((f) => [f.featureKey, f]));
    return SUPPORTED_FEATURE_KEYS.map((featureKey) => ({
      featureKey,
      enabled: map.get(featureKey)?.enabled ?? false,
      configText:
        map.get(featureKey)?.config && map.get(featureKey)?.config !== null
          ? JSON.stringify(map.get(featureKey)?.config, null, 2)
          : '',
    }));
  }, [features]);

  const [featureRows, setFeatureRows] = useState(initialFeatureMap);
  const [featureSaving, setFeatureSaving] = useState<string | null>(null);
  const [expandedConfigKey, setExpandedConfigKey] = useState<string | null>(null);
  const [planId, setPlanId] = useState(tenant.planId ?? plans[0]?.id ?? '');

  const membershipPageHref = (page: number) => buildSearchHref({}, { membershipPage: page });

  async function saveFeature(index: number, enabled: boolean, configText: string) {
    const row = featureRows[index];
    if (!row) return;

    setFeatureSaving(row.featureKey);
    try {
      await setTenantFeatureAction(tenant.id, row.featureKey, enabled, configText);
      setFeatureRows((prev) =>
        prev.map((item, idx) => (idx === index ? { ...item, enabled, configText } : item)),
      );
      toast.success(`Modulo ${FEATURE_LABEL[row.featureKey]} actualizado`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el modulo';
      toast.error(message);
    } finally {
      setFeatureSaving(null);
    }
  }

  return (
    <Tabs defaultValue="resumen" className="space-y-4">
      <TabsList>
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="limites">Límites y plan</TabsTrigger>
        <TabsTrigger value="modulos">Módulos</TabsTrigger>
        <TabsTrigger value="miembros">
          Miembros
          <Badge variant="secondary" className="ml-1.5 text-[10px]">
            {membershipCounts.active}
          </Badge>
        </TabsTrigger>
      </TabsList>

      {/* ─── Tab: Resumen ─── */}
      <TabsContent value="resumen">
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Datos básicos</p>
              <p className="text-xs text-muted-foreground">
                Nombre público e identificador único del tenant.
              </p>
            </div>
          </div>
          <Separator />
          <form action={basicAction} className="space-y-5 px-5 py-5">
            <input type="hidden" name="tenantId" value={tenant.id} />
            {basicState?.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{basicState.error}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre empresa</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={tenant.name}
                  placeholder="Acme Logistics"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Nombre que verán los usuarios al iniciar sesión.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug (URL)</Label>
                <div className="flex items-center rounded-md border focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
                  <span className="select-none border-r bg-muted px-3 py-2 text-xs text-muted-foreground rounded-l-md">
                    /
                  </span>
                  <Input
                    id="slug"
                    name="slug"
                    defaultValue={tenant.slug}
                    placeholder="acme-logistics"
                    required
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  Cambiar el slug invalida todas las URLs activas del tenant.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={basicPending}>
                {basicPending ? 'Guardando...' : 'Guardar datos básicos'}
              </Button>
            </div>
          </form>
        </div>
      </TabsContent>

      {/* ─── Tab: Límites y plan ─── */}
      <TabsContent value="limites">
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Plan y límites operativos</p>
              <p className="text-xs text-muted-foreground">
                Plan comercial y cuotas máximas asignadas al tenant.
              </p>
            </div>
          </div>
          <Separator />
          <form action={limitsAction} className="space-y-6 px-5 py-5">
            <input type="hidden" name="tenantId" value={tenant.id} />
            {limitsState?.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{limitsState.error}</AlertDescription>
              </Alert>
            )}

            {/* Selector de plan */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                Plan
              </Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      <span className="flex items-center gap-2">
                        {plan.name}
                        {!plan.isActive && (
                          <Badge variant="outline" className="text-[10px]">
                            inactivo
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="planId" value={planId} />
              {/* Preview del plan seleccionado */}
              {(() => {
                const selected = plans.find((p) => p.id === planId);
                if (!selected) return null;
                return (
                  <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Por defecto: {selected.maxUsers} usuarios
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      Por defecto: {selected.maxStorageGb} GB
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Por defecto: {selected.retentionDays} días
                    </span>
                  </div>
                );
              })()}
            </div>

            <Separator />

            {/* Límites personalizados */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Límites personalizados
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="maxUsers" className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    Máx. usuarios
                  </Label>
                  <Input
                    id="maxUsers"
                    name="maxUsers"
                    type="number"
                    min={1}
                    defaultValue={tenant.maxUsers ?? 10}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxStorageGb" className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                    Storage (GB)
                  </Label>
                  <Input
                    id="maxStorageGb"
                    name="maxStorageGb"
                    type="number"
                    min={1}
                    defaultValue={tenant.maxStorageGb ?? 5}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="retentionDays" className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    Retención (días)
                  </Label>
                  <Input
                    id="retentionDays"
                    name="retentionDays"
                    type="number"
                    min={1}
                    defaultValue={tenant.retentionDays ?? 180}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Checkbox bundle */}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                name="applyFeatureBundle"
                value="true"
                className="mt-0.5 h-4 w-4"
              />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Aplicar bundle de módulos del plan</p>
                <p className="text-xs text-muted-foreground">
                  Sobreescribe los módulos habilitados con los del plan seleccionado.
                </p>
              </div>
            </label>

            <div className="flex justify-end">
              <Button type="submit" disabled={limitsPending}>
                {limitsPending ? 'Guardando...' : 'Guardar plan y límites'}
              </Button>
            </div>
          </form>
        </div>
      </TabsContent>

      <TabsContent value="modulos" className="space-y-6">
        {/* Header con resumen */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Solo módulos con soporte operativo pueden activarse.
          </p>
          <Badge variant="secondary" className="shrink-0">
            {featureRows.filter((r) => r.enabled).length} / {featureRows.length} activos
          </Badge>
        </div>

        {/* Módulos operativos */}
        <div className="space-y-3">
          {featureRows.map((row, idx) => {
            const Icon = FEATURE_ICONS[row.featureKey];
            const isExpanded = expandedConfigKey === row.featureKey;
            const isSaving = featureSaving === row.featureKey;

            return (
              <div
                key={row.featureKey}
                className={cn(
                  'rounded-lg border p-4 transition-colors',
                  row.enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Icono */}
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      FEATURE_COLOR[row.featureKey],
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Texto */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium leading-none">{FEATURE_LABEL[row.featureKey]}</p>
                      <Badge variant={row.enabled ? 'default' : 'secondary'} className="text-xs">
                        {row.enabled ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {FEATURE_DESCRIPTION[row.featureKey]}
                    </p>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
                      onClick={() => setExpandedConfigKey(isExpanded ? null : row.featureKey)}
                    >
                      {isExpanded ? 'Ocultar config' : 'Config'}
                    </button>
                    <Switch
                      checked={row.enabled}
                      disabled={isSaving}
                      onCheckedChange={(checked) => saveFeature(idx, checked, row.configText)}
                    />
                  </div>
                </div>

                {/* Config JSON colapsable */}
                {isExpanded && (
                  <div className="mt-4 space-y-2 border-t pt-4">
                    <Label
                      htmlFor={`cfg-${row.featureKey}`}
                      className="text-xs text-muted-foreground"
                    >
                      Config JSON (opcional)
                    </Label>
                    <Textarea
                      id={`cfg-${row.featureKey}`}
                      value={row.configText}
                      onChange={(e) =>
                        setFeatureRows((prev) =>
                          prev.map((item, itemIdx) =>
                            itemIdx === idx ? { ...item, configText: e.target.value } : item,
                          ),
                        )
                      }
                      className="min-h-24 font-mono text-xs"
                      placeholder='{ "key": "value" }'
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => saveFeature(idx, row.enabled, row.configText)}
                    >
                      {isSaving ? 'Guardando...' : 'Guardar config'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Próximamente */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Próximamente</h3>
          </div>
          {COMING_SOON_FEATURE_KEYS.map((featureKey) => {
            const Icon = FEATURE_ICONS[featureKey];
            return (
              <div key={featureKey} className="rounded-lg border border-dashed p-4 opacity-55">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      FEATURE_COLOR[featureKey],
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium leading-none">{FEATURE_LABEL[featureKey]}</p>
                      <Badge variant="outline" className="text-xs">
                        Próximamente
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {FEATURE_DESCRIPTION[featureKey]}
                    </p>
                  </div>
                  <Switch disabled checked={false} className="shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>
      {/* ─── Tab: Miembros ─── */}
      <TabsContent value="miembros" className="space-y-4">
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Miembros del tenant</p>
                <p className="text-xs text-muted-foreground">
                  Usuarios con acceso activo o suspendido.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">{membershipCounts.active} activos</Badge>
              {membershipCounts.inactive > 0 && (
                <Badge variant="outline">{membershipCounts.inactive} inactivos</Badge>
              )}
            </div>
          </div>
          <Separator />
          {memberships.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Ningún miembro registrado.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {memberships.map((m) => {
                const initials = (m.user.name ?? m.user.email)
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase();
                const joinDate = new Date(m.createdAt).toLocaleDateString('es-MX', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
                return (
                  <li key={m.id} className="flex items-center gap-4 px-5 py-3.5">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.user.name ?? (
                          <span className="text-muted-foreground italic">Sin nombre</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={ROLE_VARIANT[m.role] ?? 'outline'} className="text-xs">
                        {ROLE_LABEL[m.role] ?? m.role}
                      </Badge>
                      <Badge variant={m.isActive ? 'default' : 'destructive'} className="text-xs">
                        {m.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                      <span className="hidden text-xs text-muted-foreground sm:block">
                        {joinDate}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-5 py-4">
            <ListPagination
              currentPage={membershipPagination.currentPage}
              totalPages={membershipPagination.totalPages}
              totalItems={membershipCounts.total}
              startItem={membershipPagination.startItem}
              endItem={membershipPagination.endItem}
              hrefForPage={membershipPageHref}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
