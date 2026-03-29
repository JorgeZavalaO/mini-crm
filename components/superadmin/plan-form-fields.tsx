import type { FeatureKey } from '@prisma/client';
import { FEATURE_DESCRIPTION, FEATURE_LABEL, SUPPORTED_FEATURE_KEYS } from '@/lib/feature-catalog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type PlanFormValues = {
  name: string;
  description: string;
  maxUsers: number | string;
  maxStorageGb: number | string;
  retentionDays: number | string;
  enabledFeatures: FeatureKey[];
};

type PlanFormFieldsProps = {
  idPrefix: string;
  values: PlanFormValues;
};

export function PlanFormFields({ idPrefix, values }: PlanFormFieldsProps) {
  const enabledSet = new Set(values.enabledFeatures);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-name`}>Nombre</Label>
          <Input id={`${idPrefix}-name`} name="name" defaultValue={values.name} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-max-users`}>Max usuarios</Label>
          <Input
            id={`${idPrefix}-max-users`}
            name="maxUsers"
            type="number"
            min={1}
            defaultValue={values.maxUsers}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-max-storage`}>Storage (GB)</Label>
          <Input
            id={`${idPrefix}-max-storage`}
            name="maxStorageGb"
            type="number"
            min={1}
            defaultValue={values.maxStorageGb}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-retention-days`}>Retencion (dias)</Label>
          <Input
            id={`${idPrefix}-retention-days`}
            name="retentionDays"
            type="number"
            min={1}
            defaultValue={values.retentionDays}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-description`}>Descripcion</Label>
        <Textarea
          id={`${idPrefix}-description`}
          name="description"
          defaultValue={values.description}
          placeholder="Plan para equipos en crecimiento..."
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Features incluidas</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SUPPORTED_FEATURE_KEYS.map((featureKey: FeatureKey) => (
            <label
              key={featureKey}
              className="flex items-start gap-2 rounded-md border p-2 text-sm"
            >
              <input
                type="checkbox"
                name="enabledFeatures"
                value={featureKey}
                defaultChecked={enabledSet.has(featureKey)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{FEATURE_LABEL[featureKey]}</span>
                <span className="block text-xs text-muted-foreground">
                  {FEATURE_DESCRIPTION[featureKey]}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Las features futuras o no implementadas permanecen fuera del catalogo comercial hasta su
          entrega real.
        </p>
      </div>
    </>
  );
}
