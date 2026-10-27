import { z } from 'zod';
import { apiErrorSchema, idempotencyKeySchema } from './contracts.js';

export class RequestValidationError extends Error {
  readonly code = 'validation_error';
  readonly fields: Record<string, string[]>;

  constructor(error: z.ZodError) {
    super('The request contains invalid values.');
    this.fields = Object.fromEntries(error.issues.map(issue => [
      issue.path.length ? issue.path.join('.') : '_request',
      [issue.message],
    ]));
  }
}

export function parseRequest<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new RequestValidationError(result.error);
  return result.data;
}

export function requireIdempotencyKey(value: string | undefined): string {
  const result = idempotencyKeySchema.safeParse(value);
  if (!result.success) throw new RequestValidationError(result.error);
  return result.data;
}

export function errorBody(error: RequestValidationError, requestId?: string): z.infer<typeof apiErrorSchema> {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(requestId ? { requestId } : {}),
      fields: error.fields,
    },
  };
}
