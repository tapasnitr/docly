import { Suspense } from 'react';
import { AuthCard } from '../../../components/auth/AuthCard';
import { VerifyEmailStatus } from '../../../components/auth/VerifyEmailStatus';

export const metadata = {
  title: 'Verify email | Docly',
};

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Email verification" description="Confirming your email address.">
      <Suspense fallback={null}>
        <VerifyEmailStatus />
      </Suspense>
    </AuthCard>
  );
}
