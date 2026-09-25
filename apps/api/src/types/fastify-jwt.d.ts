import '@fastify/jwt';
import type { JwtPayload } from '@docly/types';

// Types the payload passed to `reply.jwtSign()` and returned by
// `request.jwtVerify()` / `request.user`. Deliberately just an identity claim
// (userId) - see JwtPayload's own comment for why organization role isn't in
// here.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: Pick<JwtPayload, 'userId'>;
    user: JwtPayload;
  }
}
