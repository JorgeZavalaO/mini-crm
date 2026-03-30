import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';

describe('hashPassword', () => {
  it('produce un hash diferente al texto plano', async () => {
    const hash = await hashPassword('mysecret');

    expect(hash).not.toBe('mysecret');
  });

  it('el hash tiene el formato scrypt$<salt>$<derivedKey>', async () => {
    const hash = await hashPassword('mysecret');
    const parts = hash.split('$');

    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('scrypt');
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('produce hashes distintos para la misma contraseña por el salt aleatorio', async () => {
    const hash1 = await hashPassword('misma-password');
    const hash2 = await hashPassword('misma-password');

    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyPassword', () => {
  it('retorna true para la contraseña correcta', async () => {
    const hash = await hashPassword('contraseña-correcta');

    expect(await verifyPassword('contraseña-correcta', hash)).toBe(true);
  });

  it('retorna false para una contraseña incorrecta', async () => {
    const hash = await hashPassword('contraseña-correcta');

    expect(await verifyPassword('contraseña-incorrecta', hash)).toBe(false);
  });

  it('retorna false para un hash con formato inválido', async () => {
    expect(await verifyPassword('any', 'not-a-valid-hash')).toBe(false);
    expect(await verifyPassword('any', 'md5$salt$key')).toBe(false);
    expect(await verifyPassword('any', '')).toBe(false);
  });

  it('retorna false cuando faltan partes en el hash', async () => {
    expect(await verifyPassword('any', 'scrypt$onlysalt')).toBe(false);
    expect(await verifyPassword('any', 'scrypt$')).toBe(false);
  });
});
