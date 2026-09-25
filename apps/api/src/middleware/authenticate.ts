import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../lib/errors.js';

// Authentication middleware: verifies the JWT (from the Authorization header
// or, if absent, the access-token cookie - see @fastify/jwt's `cookie` option
// in app.ts) and populates `request.user`. Attach as a `preHandler` to any
// route that requires a signed-in user.
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError('Authentication required');
  }
}
