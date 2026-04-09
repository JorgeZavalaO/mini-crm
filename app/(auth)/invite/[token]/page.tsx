import Link from 'next/link';
import { getTeamInvitationPreviewByToken } from '@/lib/team-invite-service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AcceptTeamInviteForm } from './accept-team-invite-form';

function InviteUnavailableCard({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button className="w-full" asChild>
          <Link href="/login">Ir a login</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function CenteredWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

export default async function TeamInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getTeamInvitationPreviewByToken(token);

  if (!invitation) {
    return (
      <CenteredWrapper>
        <InviteUnavailableCard
          title="Invitación no disponible"
          description="El enlace no existe, ya fue invalidado o pertenece a una empresa inactiva."
        />
      </CenteredWrapper>
    );
  }

  if (invitation.status !== 'PENDING') {
    return (
      <CenteredWrapper>
        <InviteUnavailableCard
          title={`Invitación ${invitation.statusLabel.toLowerCase()}`}
          description="Pide a un administrador que genere un nuevo enlace de onboarding si aún necesitas acceso."
        />
      </CenteredWrapper>
    );
  }

  return (
    <CenteredWrapper>
      <Card>
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <Badge variant="secondary">Invitación pendiente</Badge>
          </div>
          <div>
            <CardTitle className="text-2xl">Únete a {invitation.tenant.name}</CardTitle>
            <CardDescription>
              Completa tu onboarding para entrar al tenant <strong>{invitation.tenant.slug}</strong>
              .
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
              <p className="font-medium">{invitation.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Rol inicial</p>
              <p className="font-medium">{invitation.role}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Invitado por</p>
              <p className="font-medium">
                {invitation.invitedBy.name || invitation.invitedBy.email}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Vencimiento</p>
              <p className="font-medium">{invitation.expiresAtLabel}</p>
            </div>
          </div>

          <AcceptTeamInviteForm token={token} email={invitation.email} />
        </CardContent>
      </Card>
    </CenteredWrapper>
  );
}
