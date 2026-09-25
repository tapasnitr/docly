import type { User } from '@docly/database';
import { config } from '@docly/config';
import { userRepository } from '../repositories/user.repository.js';
import { refreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { verificationTokenRepository } from '../repositories/verification-token.repository.js';
import { hashPassword, verifyPasswordTimingSafe } from '../lib/password.js';
import { generateSecureToken, hashSecureToken, parseDurationToSeconds } from '../lib/tokens.js';
import { sendVerificationEmail } from '../lib/email.js';
import { ConflictError, UnauthorizedError } from '../lib/errors.js';

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  emailNotifications?: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// Service layer: business logic for the current user's own profile (as
// opposed to user.repository.ts's cross-domain lookups). Every method here
// operates on the authenticated caller's own userId - there is no "update
// someone else's profile" path.
export const userService = {
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }

    const emailChanged = input.email !== undefined && input.email !== user.email;
    if (emailChanged) {
      const existing = await userRepository.findByEmail(input.email as string);
      if (existing && existing.id !== userId) {
        throw new ConflictError('An account with this email already exists');
      }
    }

    const updated = await userRepository.update(userId, {
      name: input.name,
      email: input.email,
      avatarUrl: input.avatarUrl,
      emailNotifications: input.emailNotifications,
      // Changing the email address means the new address hasn't been proven
      // yet - the same as at registration, so it goes back to unverified.
      ...(emailChanged ? { emailVerified: false } : {}),
    });

    if (emailChanged) {
      await verificationTokenRepository.invalidateAllForUser(userId);
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + parseDurationToSeconds(config.EMAIL_VERIFICATION_EXPIRY) * 1000);
      await verificationTokenRepository.create({ userId, tokenHash: hashSecureToken(token), expiresAt });
      try {
        await sendVerificationEmail(updated.email, token);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to send verification email', err);
      }
    }

    return updated;
  },

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }

    const currentValid = await verifyPasswordTimingSafe(input.currentPassword, user.passwordHash);
    if (!currentValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const passwordHash = await hashPassword(input.newPassword);
    await userRepository.update(userId, { passwordHash });
    // Force every other session to re-authenticate with the new password -
    // the current one keeps working until its access token naturally expires.
    await refreshTokenRepository.revokeAllForUser(userId);
  },
};
