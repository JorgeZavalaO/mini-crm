import { requireTenantRole } from '@/lib/auth-guard';
import { getCompanyProfileAction } from '@/lib/company-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Building2 } from 'lucide-react';
import { CompanyLogoUpload } from '@/components/company/company-logo-upload';
import { CompanyProfileForm } from '@/components/company/company-profile-form';

export default async function CompanyPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  await requireTenantRole(tenantSlug, 'ADMIN');

  const profile = await getCompanyProfileAction(tenantSlug);

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Empresa</h1>
          <p className="text-sm text-muted-foreground">
            Configura la información corporativa que aparece en cotizaciones y documentos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Logo card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logo</CardTitle>
          </CardHeader>
          <CardContent>
            <CompanyLogoUpload tenantSlug={tenantSlug} currentLogoUrl={profile.companyLogoUrl} />
          </CardContent>
        </Card>

        {/* Profile form card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Información corporativa</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <CompanyProfileForm tenantSlug={tenantSlug} initialData={profile} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
