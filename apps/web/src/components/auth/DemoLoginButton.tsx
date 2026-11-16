'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, type ButtonProps } from '@docly/ui';
import { useAuth } from '../../lib/auth-context';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../../lib/demo';
import { getErrorMessage } from '../../lib/errors';

interface DemoLoginButtonProps extends Omit<ButtonProps, 'onClick'> {
  label?: string;
}

// Logs straight into the public read-only demo account (see lib/demo.ts) and
// lands on the dashboard - no registration, no credentials to type. Reuses
// the same login() the real sign-in form uses, so it's exercising the real
// auth flow, not a special bypass.
//
// Renders nothing if someone is already signed in - every usage site (hero,
// navbar, final CTA) could otherwise silently swap a real user's session for
// the demo account, logging them out of their own workspace by accident.
export function DemoLoginButton({ label = 'View Demo', ...buttonProps }: DemoLoginButtonProps) {
  const router = useRouter();
  const { login, status } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'authenticated') {
    return null;
  }

  async function handleClick() {
    setError(null);
    setIsLoading(true);
    try {
      await login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      router.push('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" onClick={handleClick} disabled={isLoading} {...buttonProps}>
        {isLoading ? 'Loading demo...' : label}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
