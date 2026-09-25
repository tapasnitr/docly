'use client';

import { useState, type FormEvent } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@docly/ui';
import { useAuth } from '../../../lib/auth-context';
import { changePassword, resendVerificationEmail, updateProfile } from '../../../lib/account-api';
import { getErrorMessage } from '../../../lib/errors';
import { validateConfirmPassword, validateEmail, validateName, validatePassword } from '../../../lib/auth-validation';
import { FormField } from '../../../components/auth/FormField';

export default function SettingsPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Account settings</h1>

      <EmailVerificationBanner emailVerified={user.emailVerified} />
      <ProfileCard />
      <PasswordCard />
    </main>
  );
}

function EmailVerificationBanner({ emailVerified }: { emailVerified: boolean }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (emailVerified) {
    return null;
  }

  async function handleResend() {
    setStatus('sending');
    setError(null);
    try {
      await resendVerificationEmail();
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(getErrorMessage(err));
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div>
          <p className="text-sm font-medium text-amber-900">Your email address is not verified.</p>
          {status === 'sent' ? (
            <p className="text-sm text-amber-800">Verification email sent - check your inbox.</p>
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleResend} disabled={status === 'sending' || status === 'sent'}>
          {status === 'sending' ? 'Sending...' : 'Resend email'}
        </Button>
      </CardContent>
    </Card>
  );
}

function ProfileCard() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [emailNotifications, setEmailNotifications] = useState(user?.emailNotifications ?? true);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const errors = { name: validateName(name), email: validateEmail(email) };
    setFieldErrors(errors);
    if (errors.name || errors.email) {
      return;
    }

    setIsSaving(true);
    try {
      const emailChanged = email !== user?.email;
      const { user: updated } = await updateProfile({
        name,
        email,
        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
        emailNotifications,
      });
      setUser(updated);
      setSuccessMessage(emailChanged ? 'Saved. Check your new email address for a verification link.' : 'Saved.');
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update your name, email, photo, and notification preferences.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          ) : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

          <FormField label="Name" name="name" value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} disabled={isSaving} />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email
              </label>
              {user?.emailVerified ? (
                <Badge variant="success">Verified</Badge>
              ) : (
                <Badge variant="warning">Unverified</Badge>
              )}
            </div>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              disabled={isSaving}
            />
            {fieldErrors.email ? <p className="text-sm text-red-600">{fieldErrors.email}</p> : null}
          </div>
          <FormField
            label="Profile photo URL"
            name="avatarUrl"
            type="url"
            placeholder="https://..."
            value={avatarUrl ?? ''}
            onChange={(e) => setAvatarUrl(e.target.value)}
            disabled={isSaving}
          />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              disabled={isSaving}
              className="h-4 w-4 rounded border-slate-300"
            />
            Email me about account and organization activity
          </label>

          <Button type="submit" disabled={isSaving} className="self-start">
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ currentPassword?: string; newPassword?: string; confirmPassword?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const errors = {
      currentPassword: currentPassword ? undefined : 'Current password is required',
      newPassword: validatePassword(newPassword),
      confirmPassword: validateConfirmPassword(newPassword, confirmPassword),
    };
    setFieldErrors(errors);
    if (errors.currentPassword || errors.newPassword || errors.confirmPassword) {
      return;
    }

    setIsSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccessMessage('Password changed. Your other sessions have been signed out.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Changing your password signs you out of every other session.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          ) : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

          <FormField
            label="Current password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            error={fieldErrors.currentPassword}
            disabled={isSaving}
          />
          <FormField
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={fieldErrors.newPassword}
            disabled={isSaving}
          />
          <FormField
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={fieldErrors.confirmPassword}
            disabled={isSaving}
          />

          <Button type="submit" disabled={isSaving} className="self-start">
            {isSaving ? 'Saving...' : 'Change password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
