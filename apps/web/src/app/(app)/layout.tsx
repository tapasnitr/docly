import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/session';
import { AuthProvider } from '../../lib/auth-context';
import { AppShell } from '../../components/shell/AppShell';

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
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
