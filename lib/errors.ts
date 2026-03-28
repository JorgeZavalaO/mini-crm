export class AppError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function getPublicErrorMessage(
  error: unknown,
  fallback = 'Ocurrió un error inesperado. Inténtalo nuevamente.',
) {
  if (error instanceof AppError) {
    return error.message;
  }

  return fallback;
}
