import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../lib/auth-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Server-only env var (already used by the API to build email links) -
// `metadata` is computed at build/request time on the server, so this
// doesn't need a NEXT_PUBLIC_ prefix.
const SITE_URL = process.env.WEB_APP_URL ?? 'http://localhost:3000';
const TITLE = "Docly | Your team's second brain";
const DESCRIPTION =
  'Bring your projects, tasks, documents, and organizational knowledge together in one secure, multi-tenant workspace.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | Docly',
  },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Docly',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
