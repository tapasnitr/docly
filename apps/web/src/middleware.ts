import { NextResponse, type NextRequest } from 'next/server';

// Fast-path redirect for the protected (app) area: if there's no access-token
// cookie at all, there's no point rendering the route just to have the
// server-side check in (app)/layout.tsx bounce it - redirect here instead.
//
// This is a UX optimization, not the security boundary: a present-but-expired
// or forged cookie still gets through this check. The real boundary is
// (app)/layout.tsx (which calls the API's /auth/me and only trusts a real
// 200 response) and the API's `authenticate` middleware on every protected
// endpoint, which actually verifies the JWT signature.
export function middleware(request: NextRequest) {
  const hasAccessToken = request.cookies.has('docly_access_token');

  if (!hasAccessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
