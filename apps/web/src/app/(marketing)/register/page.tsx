import Link from 'next/link';
import { AuthCard } from '../../../components/auth/AuthCard';
import { RegisterForm } from '../../../components/auth/RegisterForm';

export const metadata = {
  title: 'Create account | Docly',
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Set up your workspace in a few seconds."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-slate-900 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
