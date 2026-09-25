import type { FastifyInstance } from 'fastify';
import { authController } from '../../controllers/auth.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    authController.register
  );
  app.post('/auth/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, authController.login);
  app.post('/auth/logout', authController.logout);
  app.post('/auth/refresh', authController.refresh);

  app.post(
    '/auth/verify-email',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    authController.verifyEmail
  );
  app.post(
    '/auth/forgot-password',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    authController.forgotPassword
  );
  app.post(
    '/auth/reset-password',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    authController.resetPassword
  );

  // Protected: requires a valid access token (header or cookie).
  app.get('/auth/me', { preHandler: authenticate }, authController.me);
  app.post(
    '/auth/resend-verification',
    { preHandler: authenticate, config: { rateLimit: { max: 3, timeWindow: '15 minutes' } } },
    authController.resendVerification
  );
}
