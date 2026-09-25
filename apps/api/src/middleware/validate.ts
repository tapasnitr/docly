import type { ZodType, ZodTypeDef } from 'zod';
import { ValidationError } from '../lib/errors.js';

// Validation strategy: route handlers validate untrusted input (body/params/query)
// through this helper rather than trusting types alone. Zod schemas live next to
// the controller/route that uses them. Failures raise a ValidationError, which the
// central error handler turns into a 400 with structured field-level details.
//
// Constrained on ZodType<T, any, any> rather than the ZodSchema<T> alias (which
// pins the schema's Input type to T too) - a schema using `.default()` or
// `.transform()` has an Input type that differs from its Output (T), and pinning
// both to the same T would make TypeScript infer a nonsensical T from two
// different positions at once.
export function parseWithSchema<T>(schema: ZodType<T, ZodTypeDef, unknown>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Request validation failed', result.error.flatten());
  }
  return result.data;
}
