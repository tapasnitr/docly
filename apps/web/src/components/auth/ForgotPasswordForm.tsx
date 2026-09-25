'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@docly/ui';
import { requestPasswordReset } from '../../lib/account-api';
import { getErrorMessage } from '../../lib/errors';
import { validateEmail } from '../../lib/auth-validation';
import { FormField } from './FormField';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set on submit regardless of the API's response - see requestPasswordReset,
  // which never reveals whether the email is registered.
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const error = validateEmail(email);
    setFieldError(error);
    if (error) {
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <p className="text-sm text-slate-600">
        If an account exists for <span className="font-medium text-slate-900">{email}</span>, we&apos;ve sent a link
        to reset your password. It expires soon, so use it shortly.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      ) : null}

      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldError}
        disabled={isSubmitting}
      />

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? 'Sending...' : 'Send reset link'}
      </Button>
    </form>
  );
}
