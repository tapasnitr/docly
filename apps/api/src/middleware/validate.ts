import type { ZodSchema } from 'zod';
import { ValidationError } from '../lib/errors.js';

// Validation strategy: route handlers validate untrusted input (body/params/query)
// through this helper rather than trusting types alone. Zod schemas live next to
// the controller/route that uses them. Failures raise a ValidationError, which the
// central error handler turns into a 400 with structured field-level details.
export function parseWithSchema<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Request validation failed', result.error.flatten());
  }
  return result.data;
}
