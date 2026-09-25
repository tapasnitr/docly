import type { FastifyInstance } from 'fastify';
import { userController } from '../../controllers/user.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

// Profile management for the authenticated caller's own account. Deliberately
// no :userId param - every handler acts on request.user.userId, never a
// value the client supplies.
export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.patch('/users/me', { preHandler: authenticate }, userController.updateProfile);
  app.patch('/users/me/password', { preHandler: authenticate }, userController.changePassword);
}
