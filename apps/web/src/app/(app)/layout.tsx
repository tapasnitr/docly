import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/session';
import { AuthProvider } from '../../lib/auth-context';
import { LogoutButton } from '../../components/auth/LogoutButton';
import { OrganizationSwitcher } from '../../components/organizations/OrganizationSwitcher';

// Shell layout for the authenticated area of the app. Route-group boundary
// (does not affect the URL) so everything under (app)/ shares a session
// check and nav, without touching the (marketing) routes.
//
// This is the actual security boundary for protected frontend routes: it
// calls the API's /auth/me (forwarding the request's cookies) on the server,
// and redirects to /login unless that comes back with a real user. See
// middleware.ts for the (non-authoritative) fast-path redirect.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <AuthProvider initialUser={user}>
      <div className="min-h-screen bg-slate-50">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <OrganizationSwitcher />
          <div className="flex items-center gap-4">
            <Link href="/settings" className="text-sm font-medium text-slate-600 hover:underline">
              {user.email}
            </Link>
            <LogoutButton />
          </div>
        </header>
        {children}
      </div>
    </AuthProvider>
  );
}
