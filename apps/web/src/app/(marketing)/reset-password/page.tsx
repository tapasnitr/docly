import { Suspense } from 'react';
import { AuthCard } from '../../../components/auth/AuthCard';
import { ResetPasswordForm } from '../../../components/auth/ResetPasswordForm';

export const metadata = {
  title: 'Reset password | Docly',
};

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Reset your password" description="Choose a new password for your account.">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
