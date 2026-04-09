'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart3, CheckCircle2, ClipboardList, FileText, Truck, Users } from 'lucide-react';

const perks = [
  { icon: Users, label: 'Gestión de leads y oportunidades comerciales' },
  { icon: FileText, label: 'Cotizaciones con PDF y envío por email' },
  { icon: ClipboardList, label: 'Tareas, seguimientos y control de equipo' },
  { icon: BarChart3, label: 'Dashboard con métricas en tiempo real' },
];

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="flex min-h-screen">
      {/* ── Panel izquierdo (branding) ── */}
      <div className="relative hidden flex-col justify-center overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 p-12 text-white lg:flex lg:w-1/2">
        {/* Decoración de fondo */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="absolute bottom-1/2 left-1/2 h-64 w-64 -translate-x-1/2 translate-y-1/2 rounded-full bg-emerald-600/10 blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">LogiCRM</span>
        </div>

        {/* Copy central */}
        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
            Centraliza tu operación{' '}
            <span className="bg-linear-to-r from-blue-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
              comercial
            </span>
          </h2>
          <p className="mt-4 max-w-sm text-white/60 leading-relaxed">
            Leads, cotizaciones, tareas y equipo en una sola plataforma diseñada para empresas
            logísticas.
          </p>

          <ul className="mt-8 space-y-3">
            {perks.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-white/80">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Testimonio / tagline
        <div className="relative rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="mb-2 flex gap-1">
            {[...Array(5)].map((_, i) => (
              <CheckCircle2 key={i} className="h-4 w-4 text-amber-400" />
            ))}
          </div>
          <p className="text-sm text-white/70 italic leading-relaxed">
            &ldquo;Pasamos de manejar leads en hojas de cálculo a tener toda la operación
            centralizada. El equipo ganó visibilidad y cerramos más negocios.&rdquo;
          </p>
          <p className="mt-3 text-xs font-semibold text-white/50">— Jefe Comercial, empresa logística</p>
        </div> */}
      </div>

      {/* ── Panel derecho (formulario) ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12 lg:px-12">
        {/* Logo solo en mobile */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Truck className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">LogiCRM</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Encabezado */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Bienvenido de vuelta</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresa tus credenciales para acceder a tu panel.
            </p>
          </div>

          {/* Alerta de error */}
          {state?.error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <form action={formAction} className="space-y-5">
            {/* Empresa */}
            <div className="space-y-1.5">
              <Label htmlFor="slug">Código de empresa</Label>
              <Input
                id="slug"
                name="slug"
                type="text"
                placeholder="mi-empresa"
                autoComplete="organization"
              />
              <p className="text-xs text-muted-foreground">
                Déjalo vacío si accedes como administrador del sistema.
              </p>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@empresa.com"
                required
                autoComplete="email"
              />
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="mt-7! w-full" size="lg" disabled={pending}>
              {pending ? 'Verificando...' : 'Ingresar'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            ¿No tienes cuenta?{' '}
            <Link
              href="/#plans"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Solicitar acceso
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
