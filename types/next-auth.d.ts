import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      isSuperAdmin: boolean;
      tenantId: string | null;
      role: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    isSuperAdmin?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    isSuperAdmin: boolean;
    tenantId: string | null;
    role: string | null;
  }
}
