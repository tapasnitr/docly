import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { JwtPayload } from '@docly/types';
import type { User } from '@docly/database';
import { authService } from '../services/auth.service.js';
import { parseWithSchema } from '../middleware/validate.js';
import { sendSuccess } from '../lib/api-response.js';
import { toPublicUser } from '../lib/sanitize-user.js';
import { setAuthCookies, clearAuthCookies, REFRESH_TOKEN_COOKIE } from '../lib/cookies.js';

// Password validation: length plus a mix of character classes, to rule out
// the weakest passwords without imposing an unpronounceable-string
// requirement. Schemas live next to the controller that uses them - no
// central schema registry to keep in sync.
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

function buildJwtPayload(user: User): Omit<JwtPayload, 'iat' | 'exp'> {
  return { userId: user.id };
}

async function issueSession(reply: FastifyReply, user: User, refreshToken: string): Promise<void> {
  const accessToken = await reply.jwtSign(buildJwtPayload(user));
  setAuthCookies(reply, { accessToken, refreshToken });
}

// Controller layer: parses the request, calls the service, shapes the
// response. Business logic (duplicate-email checks, password hashing, token
// rotation) lives in auth.service.ts - this only handles HTTP concerns:
// validating input, signing the JWT, setting cookies, and never returning a
// password hash.
export const authController = {
  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = parseWithSchema(registerSchema, request.body);
    const { user, refreshToken } = await authService.register(input);
    await issueSession(reply, user, refreshToken);
    sendSuccess(reply, { user: toPublicUser(user) }, 201);
  },

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = parseWithSchema(loginSchema, request.body);
    const { user, refreshToken } = await authService.login(input);
    await issueSession(reply, user, refreshToken);
    sendSuccess(reply, { user: toPublicUser(user) });
  },

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE];
    await authService.logout(refreshToken);
    clearAuthCookies(reply);
    sendSuccess(reply, { message: 'Logged out successfully' });
  },

  async refresh(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE];
    const result = await authService.refresh(refreshToken);
    await issueSession(reply, result.user, result.refreshToken);
    sendSuccess(reply, { user: toPublicUser(result.user) });
  },

  async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = await authService.getCurrentUser(request.user.userId);
    sendSuccess(reply, { user: toPublicUser(user) });
  },

  async verifyEmail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { token } = parseWithSchema(verifyEmailSchema, request.body);
    const user = await authService.verifyEmail(token);
    sendSuccess(reply, { user: toPublicUser(user) });
  },

  async resendVerification(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await authService.resendVerificationEmail(request.user.userId);
    sendSuccess(reply, { message: 'Verification email sent' });
  },

  async forgotPassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { email } = parseWithSchema(forgotPasswordSchema, request.body);
    await authService.forgotPassword(email);
    // Identical response whether or not the email is registered - never
    // reveal account existence through this endpoint.
    sendSuccess(reply, { message: 'If an account exists for that email, a password reset link has been sent' });
  },

  async resetPassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { token, password } = parseWithSchema(resetPasswordSchema, request.body);
    await authService.resetPassword(token, password);
    sendSuccess(reply, { message: 'Password reset successfully' });
  },
};
