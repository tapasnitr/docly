import type { User } from '@docly/types';
import { apiFetch } from './api-client';

export function requestPasswordReset(email: string): Promise<{ message: string }> {
  return apiFetch('/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
}

export function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return apiFetch('/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
}

export function verifyEmail(token: string): Promise<{ user: User }> {
  return apiFetch('/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
}

export function resendVerificationEmail(): Promise<{ message: string }> {
  return apiFetch('/v1/auth/resend-verification', { method: 'POST' });
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  emailNotifications?: boolean;
}

export function updateProfile(input: UpdateProfileInput): Promise<{ user: User }> {
  return apiFetch('/v1/users/me', { method: 'PATCH', body: JSON.stringify(input) });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return apiFetch('/v1/users/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
