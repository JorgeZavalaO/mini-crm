import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/password';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await verifyPassword(password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isSuperAdmin: user.isSuperAdmin,
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
      // First sign-in: persist user data + auto-select tenant
      if (user) {
        token.id = user.id as string;
        token.isSuperAdmin = ((user as Record<string, unknown>).isSuperAdmin as boolean) ?? false;

        const memberships = await db.membership.findMany({
          where: { userId: user.id as string },
        });

        if (memberships.length === 1) {
          token.tenantId = memberships[0].tenantId;
          token.role = memberships[0].role;
        } else {
          token.tenantId = null;
          token.role = null;
        }
      }

      // Programmatic session update (e.g. tenant switch)
      if (trigger === 'update' && session) {
        if (session.tenantId !== undefined) token.tenantId = session.tenantId;
        if (session.role !== undefined) token.role = session.role;
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.isSuperAdmin = token.isSuperAdmin as boolean;
      session.user.tenantId = token.tenantId as string | null;
      session.user.role = token.role as string | null;
      return session;
    },
  },
});
