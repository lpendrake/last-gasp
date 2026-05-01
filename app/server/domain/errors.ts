/** Typed domain errors. Adapters never throw these — they're produced
 * by domain functions when business rules fail. HTTP handlers catch
 * them and map to status codes (400 / 404 / 409). */

export class NotFoundError extends Error {
  constructor(message: string = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  constructor(message: string = 'Invalid') {
    super(message);
    this.name = 'ValidationError';
  }
}
