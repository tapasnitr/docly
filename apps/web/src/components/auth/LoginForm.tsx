'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@docly/ui';
import { useAuth } from '../../lib/auth-context';
import { getErrorMessage } from '../../lib/errors';
import { validateEmail } from '../../lib/auth-validation';
import { FormField } from './FormField';

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const emailError = validateEmail(email);
    const passwordError = password ? undefined : 'Password is required';
    setFieldErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch (error) {
      // Invalid credentials and "account doesn't exist" surface the exact
      // same message from the API - shown here as-is, not remapped.
      setFormError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
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
        error={fieldErrors.email}
        disabled={isSubmitting}
      />

      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        disabled={isSubmitting}
      />
      <Link href="/forgot-password" className="-mt-2 self-end text-sm font-medium text-slate-600 hover:underline">
        Forgot password?
      </Link>

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}
