'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@docly/ui';
import { useAuth } from '../../lib/auth-context';

export function LogoutButton() {
  const router = useRouter();
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
      {isLoggingOut ? 'Signing out...' : 'Sign out'}
    </Button>
  );
}
