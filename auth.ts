import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/password';

const SUPERADMIN_SLUG = 'superadmin';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        slug: { label: 'Empresa / Plataforma', type: 'text' },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const slug = (credentials?.slug as string | undefined)?.trim().toLowerCase();
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;

        if (!slug || !email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await verifyPassword(password, user.password);
        if (!valid) return null;

        // ── Acceso al panel superadmin ───────────────────────────
        if (slug === SUPERADMIN_SLUG) {
          if (!user.isSuperAdmin) return null;
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            isSuperAdmin: true,
            tenantId: null,
            tenantSlug: null,
            role: null,
          };
        }

        // ── Acceso a cuenta empresa ──────────────────────────────
        const tenant = await db.tenant.findUnique({
          where: { slug },
          select: { id: true, slug: true, isActive: true, deletedAt: true },
        });

        if (!tenant || !tenant.isActive || tenant.deletedAt) return null;

        const membership = await db.membership.findUnique({
          where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
          select: { role: true, isActive: true, tenantId: true },
        });

        if (!membership || !membership.isActive) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isSuperAdmin: user.isSuperAdmin,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          role: membership.role,
        };
      },
    }),
  ],

  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.isSuperAdmin = (user.isSuperAdmin as boolean) ?? false;
        token.tenantId = (user.tenantId as string | null) ?? null;
        token.tenantSlug = (user.tenantSlug as string | null) ?? null;
        token.role = (user.role as string | null) ?? null;
      }

      // Programmatic session update (e.g. tenant switch)
      if (trigger === 'update' && session) {
        if (session.tenantId !== undefined) token.tenantId = session.tenantId;
        if (session.tenantSlug !== undefined) token.tenantSlug = session.tenantSlug;
        if (session.role !== undefined) token.role = session.role;
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.isSuperAdmin = token.isSuperAdmin as boolean;
      session.user.tenantId = token.tenantId as string | null;
      session.user.tenantSlug = token.tenantSlug as string | null;
      session.user.role = token.role as string | null;
      return session;
    },
  },
});
