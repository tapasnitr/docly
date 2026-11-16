import Link from 'next/link';
import { AuthCard } from '../../../components/auth/AuthCard';
import { LoginForm } from '../../../components/auth/LoginForm';
import { DemoLoginButton } from '../../../components/auth/DemoLoginButton';

export const metadata = {
  title: 'Sign in | Docly',
};

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-4">
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
      <DemoLoginButton label="Or view the demo - no signup" variant="ghost" size="sm" />
    </div>
  );
}
