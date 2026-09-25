import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { userService } from '../services/user.service.js';
import { parseWithSchema } from '../middleware/validate.js';
import { sendSuccess } from '../lib/api-response.js';
import { toPublicUser } from '../lib/sanitize-user.js';
import { clearAuthCookies } from '../lib/cookies.js';

// Same rules as auth.controller.ts's registerSchema password, kept in sync by
// hand rather than shared - see the note there on why schemas live next to
// their controller instead of a central registry.
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters').optional(),
    email: z.string().trim().toLowerCase().email('Invalid email address').optional(),
    avatarUrl: z.string().trim().url('Must be a valid URL').max(2048).nullable().optional(),
    emailNotifications: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// Controller layer: parses the request, calls the service, shapes the
// response. Every route here is scoped to the authenticated caller's own
// account (request.user.userId) - there is no :userId param, by design.
export const userController = {
  async updateProfile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = parseWithSchema(updateProfileSchema, request.body);
    const user = await userService.updateProfile(request.user.userId, input);
    sendSuccess(reply, { user: toPublicUser(user) });
  },

  async changePassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = parseWithSchema(changePasswordSchema, request.body);
    await userService.changePassword(request.user.userId, input);
    // Every refresh token was just revoked (see user.service.ts) - clear this
    // response's cookies too so the browser doesn't keep offering a dead one.
    clearAuthCookies(reply);
    sendSuccess(reply, { message: 'Password changed successfully. Please sign in again.' });
  },
};
