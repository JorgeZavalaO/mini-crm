import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signInMock, headersMock, getStatusMock, getClientIpFromHeadersMock, MockAuthError } =
  vi.hoisted(() => ({
    signInMock: vi.fn(),
    headersMock: vi.fn(),
    getStatusMock: vi.fn(),
    getClientIpFromHeadersMock: vi.fn(),
    MockAuthError: class MockAuthError extends Error {},
  }));

vi.mock('@/auth', () => ({
  signIn: signInMock,
}));

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

vi.mock('next-auth', () => ({
  AuthError: MockAuthError,
}));

vi.mock('@/lib/auth-rate-limit', () => ({
  authRateLimiter: {
    getStatus: getStatusMock,
  },
}));

vi.mock('@/lib/http-security', () => ({
  getClientIpFromHeaders: getClientIpFromHeadersMock,
}));

import { loginAction } from '@/lib/auth-actions';

function createLoginFormData() {
  const formData = new FormData();
  formData.set('slug', 'acme-logistics');
  formData.set('email', 'admin@acme.com');
  formData.set('password', 'secret');
  return formData;
}

describe('loginAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue({ get: vi.fn(() => null) });
    getClientIpFromHeadersMock.mockReturnValue('203.0.113.10');
    getStatusMock.mockReturnValue({ limited: false, scope: null, retryAfterMs: 0 });
  });

  it('responde con mensaje neutral cuando la autenticacion falla', async () => {
    signInMock.mockRejectedValue(new MockAuthError('invalid'));

    const result = await loginAction(undefined, createLoginFormData());

    expect(result).toEqual({
      error: 'No se pudo iniciar sesion. Verifica tus credenciales o el acceso al panel.',
    });
  });

  it('bloquea el intento cuando el rate limiter ya marco un bloqueo', async () => {
    getStatusMock.mockReturnValue({ limited: true, scope: 'identity', retryAfterMs: 120_000 });

    const result = await loginAction(undefined, createLoginFormData());

    expect(signInMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: 'Demasiados intentos de acceso. Espera unos minutos antes de volver a intentar.',
    });
  });
});
