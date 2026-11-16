'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@docly/ui';
import { useAuth } from '../../lib/auth-context';
import { getErrorMessage } from '../../lib/errors';
import { validateConfirmPassword, validateEmail, validateName, validatePassword } from '../../lib/auth-validation';
import { FormField } from './FormField';

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(password, confirmPassword),
    };
    setFieldErrors(errors);
    if (errors.name || errors.email || errors.password || errors.confirmPassword) {
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ name, email, password, confirmPassword });
      router.push('/dashboard');
    } catch (error) {
      // Duplicate-email registration surfaces the API's error message
      // directly (e.g. "An account with this email already exists").
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
        label="Name"
        name="name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        disabled={isSubmitting}
      />

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
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        disabled={isSubmitting}
      />
      <p className="-mt-2 text-xs text-slate-500">
        At least 8 characters, with an uppercase letter, a lowercase letter, and a number.
      </p>

      <FormField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={fieldErrors.confirmPassword}
        disabled={isSubmitting}
      />

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  );
}
