import Link from 'next/link';
import { AuthCard } from '../../../components/auth/AuthCard';
import { LoginForm } from '../../../components/auth/LoginForm';

export const metadata = {
  title: 'Sign in | Docly',
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Sign in to access your workspace."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-slate-900 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
