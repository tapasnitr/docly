import Link from 'next/link';
import { AuthCard } from '../../../components/auth/AuthCard';
import { ForgotPasswordForm } from '../../../components/auth/ForgotPasswordForm';

export const metadata = {
  title: 'Forgot password | Docly',
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we'll send you a link to reset it."
      footer={
        <Link href="/login" className="font-medium text-slate-900 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
