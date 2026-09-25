'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { verifyEmail } from '../../lib/account-api';
import { getErrorMessage } from '../../lib/errors';

type Status = 'verifying' | 'success' | 'error';

export function VerifyEmailStatus() {
  const token = useSearchParams().get('token');
  const [status, setStatus] = useState<Status>('verifying');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('This verification link is missing its token.');
      return;
    }

    let cancelled = false;
    verifyEmail(token)
      .then(() => {
        if (!cancelled) {
          setStatus('success');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error');
          setError(getErrorMessage(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === 'verifying') {
    return <p className="text-sm text-slate-600">Verifying your email address...</p>;
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-emerald-600">Your email address has been verified.</p>
        <Link href="/dashboard" className="font-medium text-slate-900 hover:underline">
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p role="alert" className="text-sm text-red-600">
        {error ?? 'This verification link is invalid or has expired.'}
      </p>
      <Link href="/dashboard" className="font-medium text-slate-900 hover:underline">
        Go to dashboard to request a new link
      </Link>
    </div>
  );
}
