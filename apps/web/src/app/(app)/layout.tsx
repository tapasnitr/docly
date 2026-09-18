// Shell layout for the authenticated area of the app. Route-group boundary
// (does not affect the URL) so everything under (app)/ can later share a
// sidebar/nav and a session check, without touching the (marketing) routes.
//
// TODO(auth): once authentication exists, verify the session here (or in
// middleware.ts) and redirect unauthenticated requests to /login. Left as a
// pass-through for now per the current milestone (foundation only, no auth).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
