export class AppError extends Error {
  status: number;
  code?: string;
  /** When true, the message is safe to expose directly to API consumers. */
  isPublic: boolean;
  constructor(message: string, status = 500, code?: string, isPublic?: boolean) {
    super(message);
    this.status = status;
    this.code = code;
    // Client errors (4xx) are safe to expose; internal errors (5xx) are not by default
    this.isPublic = isPublic !== undefined ? isPublic : status < 500;
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
  if (error instanceof AppError && error.isPublic) {
    return error.message;
  }

  return fallback;
}
