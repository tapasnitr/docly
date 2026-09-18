import { NextResponse, type NextRequest } from 'next/server';

// Authentication-aware routing scaffold. Matches routes that will require a
// session once auth exists; currently a pass-through.
//
// TODO(auth): read the session/JWT cookie here and redirect to /login when
// missing, for any path under /dashboard (or wherever the protected area
// ends up living). Intentionally not implemented yet - this milestone only
// establishes the structure, per the current scope (no auth features yet).
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
