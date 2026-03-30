import { describe, expect, it } from 'vitest';
import { AppError, getPublicErrorMessage, isAppError } from '@/lib/errors';

describe('AppError', () => {
  it('crea instancia con mensaje y status', () => {
    const error = new AppError('algo salió mal', 400);

    expect(error.message).toBe('algo salió mal');
    expect(error.status).toBe(400);
  });

  it('es instancia de Error y de AppError', () => {
    const error = new AppError('fallo', 500);

    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });

  it('usa status 500 por defecto cuando no se especifica', () => {
    const error = new AppError('error interno');

    expect(error.status).toBe(500);
  });

  it('acepta un code opcional', () => {
    const error = new AppError('duplicado', 409, 'DUPLICATE_RUC');

    expect(error.code).toBe('DUPLICATE_RUC');
  });

  it('code es undefined cuando no se proporciona', () => {
    const error = new AppError('sin code', 400);

    expect(error.code).toBeUndefined();
  });
});

describe('isAppError', () => {
  it('retorna true para instancias de AppError', () => {
    expect(isAppError(new AppError('test', 400))).toBe(true);
  });

  it('retorna false para instancias de Error genérico', () => {
    expect(isAppError(new Error('generic'))).toBe(false);
  });

  it('retorna false para valores no-error', () => {
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
    expect(isAppError('string')).toBe(false);
    expect(isAppError(42)).toBe(false);
    expect(isAppError({})).toBe(false);
  });
});

describe('getPublicErrorMessage', () => {
  it('retorna el mensaje del AppError', () => {
    const error = new AppError('mensaje público', 400);

    expect(getPublicErrorMessage(error)).toBe('mensaje público');
  });

  it('retorna el fallback por defecto para Error genérico', () => {
    const error = new Error('error interno');

    expect(getPublicErrorMessage(error)).toBe('Ocurrió un error inesperado. Inténtalo nuevamente.');
  });

  it('retorna el fallback personalizado cuando se proporciona', () => {
    const error = new Error('x');

    expect(getPublicErrorMessage(error, 'Fallo inesperado')).toBe('Fallo inesperado');
  });

  it('retorna el fallback para valores no-error', () => {
    expect(getPublicErrorMessage(null)).toBe('Ocurrió un error inesperado. Inténtalo nuevamente.');
    expect(getPublicErrorMessage(undefined)).toBe(
      'Ocurrió un error inesperado. Inténtalo nuevamente.',
    );
  });
});
