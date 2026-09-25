import type { User } from '@docly/database';
import { config } from '@docly/config';
import { userRepository } from '../repositories/user.repository.js';
import { authRepository } from '../repositories/auth.repository.js';
import { refreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { verificationTokenRepository } from '../repositories/verification-token.repository.js';
import { passwordResetTokenRepository } from '../repositories/password-reset-token.repository.js';
import { hashPassword, verifyPasswordTimingSafe } from '../lib/password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  generateSecureToken,
  hashSecureToken,
  parseDurationToSeconds,
} from '../lib/tokens.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email.js';
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from '../lib/errors.js';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User;
  refreshToken: string;
}

async function issueRefreshToken(userId: string): Promise<string> {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + parseDurationToSeconds(config.JWT_REFRESH_EXPIRY) * 1000);

  await refreshTokenRepository.create({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt,
  });

  return refreshToken;
}

// Issues a fresh verification token (invalidating any outstanding one) and
// emails it. Best-effort: a transient email failure shouldn't fail
// registration or a resend request, so this only logs.
async function issueAndSendVerificationEmail(user: Pick<User, 'id' | 'email'>): Promise<void> {
  await verificationTokenRepository.invalidateAllForUser(user.id);
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + parseDurationToSeconds(config.EMAIL_VERIFICATION_EXPIRY) * 1000);
  await verificationTokenRepository.create({ userId: user.id, tokenHash: hashSecureToken(token), expiresAt });

  try {
    await sendVerificationEmail(user.email, token);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to send verification email', err);
  }
}

// Service layer: business logic for the auth domain. Never touches
// Fastify's request/reply - controllers own signing the JWT and setting
// cookies, this only decides whether a request is allowed and what it does
// to the data.
export const authService = {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      // Same message regardless of *why* the email is taken, so this can't be
      // used to fingerprint accounts beyond "this email is registered".
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createUserWithOrganization({
      email: input.email,
      name: input.name,
      passwordHash,
    });

    await issueAndSendVerificationEmail(user);

    const refreshToken = await issueRefreshToken(user.id);
    return { user, refreshToken };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await userRepository.findByEmail(input.email);

    // Locked-out accounts fail before a password comparison happens at all -
    // this necessarily reveals that the account exists (there's no
    // lockout state to leak for one that doesn't), which is the accepted
    // trade-off of implementing lockout at all.
    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedError('Too many failed attempts. Please try again later.');
    }

    // Compare against a real hash when the user exists, and a dummy one when
    // they don't - so a wrong password and an unknown email fail in roughly
    // the same time and with the exact same error, and can't be used to
    // enumerate which emails have accounts.
    const passwordValid = await verifyPasswordTimingSafe(input.password, user?.passwordHash);
    if (!user || !passwordValid) {
      if (user) {
        await registerFailedAttempt(user);
      }
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status === 'DISABLED') {
      throw new ForbiddenError('This account has been disabled. Contact support for help.');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await userRepository.update(user.id, { failedLoginAttempts: 0, lockedUntil: null });
    }

    const refreshToken = await issueRefreshToken(user.id);
    return { user, refreshToken };
  },

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedError('Invalid or expired session');
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const existing = await refreshTokenRepository.findValidByHash(tokenHash);
    if (!existing) {
      throw new UnauthorizedError('Invalid or expired session');
    }

    const user = await userRepository.findById(existing.userId);
    if (!user) {
      throw new UnauthorizedError('Invalid or expired session');
    }

    // Rotate: the old refresh token is single-use. Revoking it here means a
    // stolen-and-replayed refresh token stops working the moment the
    // legitimate client uses it (or vice versa).
    await refreshTokenRepository.revokeById(existing.id);
    const nextRefreshToken = await issueRefreshToken(user.id);

    return { user, refreshToken: nextRefreshToken };
  },

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }
    await refreshTokenRepository.revokeByHash(hashRefreshToken(refreshToken));
  },

  async getCurrentUser(userId: string): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }
    return user;
  },

  async verifyEmail(token: string): Promise<User> {
    const record = await verificationTokenRepository.findValidByHash(hashSecureToken(token));
    if (!record) {
      throw new BadRequestError('This verification link is invalid or has expired');
    }

    await verificationTokenRepository.consumeById(record.id);
    return userRepository.update(record.userId, { emailVerified: true });
  },

  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }
    if (user.emailVerified) {
      throw new ConflictError('This email address is already verified');
    }
    await issueAndSendVerificationEmail(user);
  },

  // Always succeeds from the caller's point of view regardless of whether
  // the email is registered - the controller returns the same generic
  // message either way, so this can't be used to enumerate accounts.
  async forgotPassword(email: string): Promise<void> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return;
    }

    await passwordResetTokenRepository.invalidateAllForUser(user.id);
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + parseDurationToSeconds(config.PASSWORD_RESET_EXPIRY) * 1000);
    await passwordResetTokenRepository.create({ userId: user.id, tokenHash: hashSecureToken(token), expiresAt });

    try {
      await sendPasswordResetEmail(user.email, token);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to send password reset email', err);
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await passwordResetTokenRepository.findValidByHash(hashSecureToken(token));
    if (!record) {
      throw new BadRequestError('This password reset link is invalid or has expired');
    }

    const passwordHash = await hashPassword(newPassword);
    await passwordResetTokenRepository.consumeById(record.id);
    await userRepository.update(record.userId, { passwordHash, failedLoginAttempts: 0, lockedUntil: null });
    // A successful reset proves control of the mailbox, which is a stronger
    // signal than any live session - kill every existing session so a
    // stolen-and-still-logged-in session doesn't outlive the reset.
    await refreshTokenRepository.revokeAllForUser(record.userId);
  },
};

async function registerFailedAttempt(user: User): Promise<void> {
  const failedLoginAttempts = user.failedLoginAttempts + 1;
  const shouldLock = failedLoginAttempts >= config.LOGIN_LOCKOUT_THRESHOLD;

  await userRepository.update(user.id, {
    failedLoginAttempts: shouldLock ? 0 : failedLoginAttempts,
    lockedUntil: shouldLock
      ? new Date(Date.now() + parseDurationToSeconds(config.LOGIN_LOCKOUT_DURATION) * 1000)
      : user.lockedUntil,
  });
}
