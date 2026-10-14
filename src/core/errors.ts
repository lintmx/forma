export class FormaError extends Error {
  constructor(public code: string, message: string, public status = 422, public details?: unknown) {
    super(message);
    this.name = 'FormaError';
  }
}

export function publicError(error: unknown) {
  if (error instanceof FormaError) return { code: error.code, message: error.message, status: error.status, details: error.details };
  return { code: 'INTERNAL_ERROR', message: 'Rendering failed', status: 500, details: undefined };
}
