'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Globe,
  LayoutDashboard,
  Package,
  Shield,
  Truck,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ─── Datos estáticos ──────────────────────────────────────────────────────── */

const features = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard operativo',
    description:
      'Visualiza el pipeline por estado, tendencia mensual de leads y actividad reciente de tu equipo en tiempo real.',
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
  },
  {
    icon: Users,
    title: 'Gestión de leads',
    description:
      'Crea, asigna y reasigna leads con historial de propietarios. Filtra por estado, fuente, responsable y más.',
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
  },
  {
    icon: FileText,
    title: 'Cotizaciones con PDF',
    description:
      'Genera cotizaciones con ítems, impuestos y múltiples monedas. Descarga PDF al instante y envía al cliente por email.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    icon: Upload,
    title: 'Importación masiva',
    description:
      'Carga leads desde Excel o CSV. Previsualiza, valida y confirma antes de persistir. Detecta duplicados automáticamente.',
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
  },
  {
    icon: ClipboardList,
    title: 'Módulo de tareas',
    description:
      'Crea tareas con prioridades (Urgente, Alta, Media, Baja), fechas límite y asignación por rol. Nunca pierdas un seguimiento.',
    color: 'text-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
  },
  {
    icon: Bell,
    title: 'Notificaciones inteligentes',
    description:
      'Alertas persistentes para leads sin asignar, cotizaciones aceptadas o rechazadas y reasignaciones pendientes.',
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
  },
  {
    icon: Package,
    title: 'Catálogo de productos',
    description:
      'Administra tu catálogo con precios en PEN/USD. Usa los productos directamente al crear cotizaciones.',
    color: 'text-teal-600',
    bg: 'bg-teal-50 dark:bg-teal-950/40',
  },
  {
    icon: Globe,
    title: 'Portal del cliente',
    description:
      'Comparte un enlace seguro para que tu cliente consulte el estado de sus cotizaciones sin necesidad de cuenta.',
    color: 'text-sky-600',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
  },
  {
    icon: Shield,
    title: 'Seguridad & roles',
    description:
      'Cinco roles predefinidos: Admin, Supervisor, Vendedor, Freelance y Pasante. Cada miembro ve y hace exactamente lo que su puesto requiere.',
    color: 'text-slate-600',
    bg: 'bg-slate-50 dark:bg-slate-950/40',
  },
];

const steps = [
  {
    number: '01',
    title: 'Configura tu empresa',
    description:
      'Registra tu organización, personaliza el nombre de tu empresa y activa los módulos que se adaptan a tu operación.',
  },
  {
    number: '02',
    title: 'Incorpora a tu equipo',
    description:
      'Invita a tus colaboradores por enlace seguro. Cada uno recibe el acceso y los permisos que su rol requiere.',
  },
  {
    number: '03',
    title: 'Cierra más negocios',
    description:
      'Gestiona el pipeline, emite cotizaciones profesionales, da seguimiento a tareas y convierte más oportunidades.',
  },
];

const stats = [
  { value: '100', label: 'Operación centralizada', suffix: '%' },
  { value: '5', label: 'Roles configurables', suffix: '' },
  { value: '2', label: 'Monedas (PEN / USD)', suffix: '' },
  { value: '0', label: 'Instalación requerida', suffix: '' },
];

const roles = [
  { name: 'Admin', description: 'Control total de la empresa: equipo, módulos y configuración.' },
  {
    name: 'Supervisor',
    description: 'Gestiona leads, cotizaciones, tareas y puede reasignar oportunidades.',
  },
  {
    name: 'Vendedor',
    description: 'Trabaja sus propios leads y genera cotizaciones para sus clientes.',
  },
  {
    name: 'Freelance',
    description: 'Acceso acotado a los leads y oportunidades asignadas a su perfil.',
  },
  { name: 'Pasante', description: 'Vista de solo lectura para aprendices, auditores o invitados.' },
];

const plans = [
  {
    name: 'Básico',
    price: 'A consultar',
    description: 'Para equipos pequeños que quieren ordenar y potenciar su operación comercial.',
    features: [
      'Gestión completa de leads',
      'Dashboard con métricas en tiempo real',
      'Importación masiva (Excel / CSV)',
      'Detección automática de duplicados',
      'Hasta 5 usuarios',
      'Control de acceso por rol',
    ],
    cta: 'Contactar',
    highlighted: false,
  },
  {
    name: 'Profesional',
    price: 'A consultar',
    description:
      'Para empresas logísticas con operaciones en crecimiento y mayor volumen de oportunidades.',
    features: [
      'Todo lo del plan Básico',
      'Usuarios ilimitados',
      'Cotizaciones con PDF y envío por email',
      'Catálogo de productos (PEN / USD)',
      'Módulo de tareas con prioridades',
      'Notificaciones persistentes',
      'Documentos adjuntos con acceso seguro',
      'Portal de consulta para clientes',
    ],
    cta: 'Contactar',
    highlighted: true,
  },
  {
    name: 'Empresarial',
    price: 'A consultar',
    description:
      'Para organizaciones con múltiples equipos y necesidades de personalización avanzada.',
    features: [
      'Todo lo del plan Profesional',
      'Equipos y organizaciones múltiples',
      'Configuración de roles personalizada',
      'Integraciones a medida',
      'Soporte prioritario dedicado',
      'Onboarding asistido',
    ],
    cta: 'Contactar',
    highlighted: false,
  },
];

/* ─── Componente principal ─────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">LogiCRM</span>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Funcionalidades
            </a>
            <a href="#workflow" className="transition-colors hover:text-foreground">
              Cómo funciona
            </a>
            <a href="#roles" className="transition-colors hover:text-foreground">
              Roles
            </a>
            <a href="#plans" className="transition-colors hover:text-foreground">
              Planes
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Ingresar</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="#plans">
                Solicitar demo <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-linear-to-b from-slate-950 via-slate-900 to-slate-800 px-6 pb-32 pt-24 text-white">
        {/* Fondo decorativo */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-64 w-full -translate-x-1/2 bg-linear-to-t from-slate-950/80 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <Badge
            variant="outline"
            className="mb-6 border-white/20 bg-white/10 text-white/80 backdrop-blur-sm"
          >
            <Zap className="mr-1 h-3 w-3 text-amber-400" />
            CRM especializado para equipos logísticos
          </Badge>

          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            El CRM diseñado para{' '}
            <span className="bg-linear-to-r from-blue-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
              equipos logísticos
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-white/70 md:text-xl">
            Gestiona leads, emite cotizaciones profesionales, coordina tareas y ofrece a tu cliente
            visibilidad de su proceso — todo desde una sola plataforma pensada para la operación
            logística.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="h-12 px-8 text-base" asChild>
              <a href="#plans">
                Solicitar demo <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 border-white/25 bg-white/10 px-8 text-base text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              asChild
            >
              <a href="#features">
                Ver funcionalidades <ChevronRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-white/50">
            {[
              'Fácil de configurar',
              'Tu equipo listo en minutos',
              'Datos siempre seguros',
              'Soporte incluido',
              'Sin instalación',
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Mock dashboard preview */}
        <div className="relative mx-auto mt-20 max-w-5xl">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur-sm">
            {/* Barra de título del mock */}
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-rose-500" />
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <div className="ml-4 h-5 w-64 rounded bg-white/10" />
            </div>
            {/* Mock content */}
            <div className="grid grid-cols-4 gap-0">
              {/* Sidebar mock */}
              <div className="col-span-1 border-r border-white/10 p-4">
                <div className="mb-4 h-8 w-full rounded bg-white/10" />
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5"
                    style={{ background: i === 0 ? 'rgba(255,255,255,0.12)' : 'transparent' }}
                  >
                    <div className="h-4 w-4 rounded bg-white/20" />
                    <div className="h-3 rounded bg-white/20" style={{ width: `${60 + i * 8}%` }} />
                  </div>
                ))}
              </div>
              {/* Main content mock */}
              <div className="col-span-3 p-4">
                {/* Stats row */}
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {['Leads totales', 'En progreso', 'Ganados'].map((label, i) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="mb-1 text-xs text-white/40">{label}</div>
                      <div className="text-xl font-bold text-white">{[128, 43, 27][i]}</div>
                    </div>
                  ))}
                </div>
                {/* Chart mock */}
                <div className="mb-4 flex h-28 items-end gap-1 rounded-lg border border-white/10 bg-white/5 p-3">
                  {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-linear-to-t from-blue-500 to-violet-500 opacity-80"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                {/* Table mock */}
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 grid grid-cols-4 gap-2 text-xs text-white/30">
                    {['Empresa', 'Estado', 'Responsable', 'Actualizado'].map((h) => (
                      <div key={h}>{h}</div>
                    ))}
                  </div>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="mb-2 grid grid-cols-4 gap-2">
                      {[...Array(4)].map((_, j) => (
                        <div
                          key={j}
                          className="h-4 rounded bg-white/10"
                          style={{ width: `${70 + Math.random() * 30}%` }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Glow bottom */}
          <div className="absolute -bottom-8 left-1/2 h-16 w-3/4 -translate-x-1/2 bg-blue-600/20 blur-3xl" />
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-b bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-4xl font-extrabold text-primary">
                  {stat.value}
                  {stat.suffix}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <Badge variant="secondary" className="mb-4">
              <BarChart3 className="mr-1 h-3 w-3" />
              Funcionalidades
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Todo lo que tu equipo necesita
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Desde la captación del lead hasta el cierre del negocio, LogiCRM cubre cada etapa del
              proceso comercial en logística.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className={`mb-4 inline-flex rounded-lg p-2.5 ${feature.bg}`}>
                    <Icon className={`h-5 w-5 ${feature.color}`} />
                  </div>
                  <h3 className="mb-2 font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section id="workflow" className="bg-muted/40 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <Badge variant="secondary" className="mb-4">
              Cómo funciona
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Operativo en minutos</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Sin configuraciones complejas. Tu equipo empieza a trabajar desde el primer día.
            </p>
          </div>

          <div className="relative grid gap-8 md:grid-cols-3">
            {/* Línea conectora (solo desktop) */}
            <div className="absolute left-[16.67%] right-[16.67%] top-10 hidden h-px bg-border md:block" />

            {steps.map((step) => (
              <div key={step.number} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-background text-2xl font-extrabold text-primary shadow-sm">
                  {step.number}
                </div>
                <h3 className="mb-2 font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ── */}
      <section id="roles" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="secondary" className="mb-4">
                <Shield className="mr-1 h-3 w-3" />
                Control de acceso
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Cada persona ve y hace lo que le corresponde
              </h2>
              <p className="mt-4 text-muted-foreground">
                El sistema de roles granular garantiza que la información sensible solo sea
                accesible para quienes deben verla. Sin permisos enredados, sin configuración manual
                complicada.
              </p>
              <Button className="mt-8" asChild>
                <a href="#plans">
                  Hablar con el equipo <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="grid gap-3">
              {roles.map((role) => (
                <div
                  key={role.name}
                  className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {role.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{role.name}</p>
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Planes ── */}
      <section id="plans" className="bg-muted/40 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <Badge variant="secondary" className="mb-4">
              Planes
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Crece a tu ritmo</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Empieza rápido y escala cuando tu operación lo requiera. Todos los planes incluyen
              onboarding asistido y soporte continuo.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-8 shadow-sm transition-shadow hover:shadow-md ${
                  plan.highlighted ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'
                }`}
              >
                {plan.highlighted && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white hover:bg-amber-500">
                    Más popular
                  </Badge>
                )}

                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p
                  className={`mt-1 text-sm ${
                    plan.highlighted ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}
                >
                  {plan.description}
                </p>

                <p className="my-6 text-2xl font-bold text-muted-foreground italic">{plan.price}</p>

                <ul className="mb-8 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 ${
                          plan.highlighted ? 'text-primary-foreground/80' : 'text-emerald-600'
                        }`}
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.highlighted ? 'secondary' : 'default'}
                  asChild
                >
                  <a href="mailto:ventas@logicrm.pe">{plan.cta}</a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-16 text-center text-white shadow-2xl">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl" />
            <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />
          </div>

          <Truck className="mx-auto mb-4 h-10 w-10 text-blue-400" />
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Tu operación logística, bajo control
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Centraliza la gestión comercial de tu empresa logística. Leads, cotizaciones, tareas y
            equipo en una sola plataforma. Configura tu empresa en minutos.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="h-12 px-10 text-base" asChild>
              <a href="mailto:ventas@logicrm.pe">
                Solicitar demo <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t px-6 py-10 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Truck className="h-4 w-4" />
            LogiCRM
          </div>
          <p>© {new Date().getFullYear()} LogiCRM. CRM para equipos logísticos.</p>
          <div className="flex gap-4">
            <Link href="/login" className="transition-colors hover:text-foreground">
              Ingresar
            </Link>
            <a href="#features" className="transition-colors hover:text-foreground">
              Funcionalidades
            </a>
            <a href="#plans" className="transition-colors hover:text-foreground">
              Planes
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
