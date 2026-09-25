'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@docly/ui';
import { useCurrentOrganization } from '../../lib/use-current-organization';
import { roleBadgeVariant } from '../../lib/role-badge';

const ORG_ID_IN_PATH = /^\/organizations\/([^/]+)/;

// Lets the user jump between the organizations they belong to from anywhere
// in the (app) shell. /dashboard isn't organization-scoped by URL, so
// picking an org here is what tells it which one to show (see
// lib/use-current-organization.ts) - selecting one also navigates there. On
// an already organization-scoped page (settings/members), the URL's own id
// takes precedence for the "you are here" highlight.
export function OrganizationSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { organizations, status, currentOrganizationId, setCurrentOrganizationId } = useCurrentOrganization();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (status === 'loading') {
    return <div className="h-9 w-40 animate-pulse rounded-md bg-slate-100" />;
  }

  const urlOrgId = ORG_ID_IN_PATH.exec(pathname ?? '')?.[1];
  const highlightedId = urlOrgId ?? currentOrganizationId;
  const highlightedOrg = organizations.find((org) => org.id === highlightedId);

  function handleSelect(organizationId: string) {
    setCurrentOrganizationId(organizationId);
    setOpen(false);
    router.push('/dashboard');
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <span className="max-w-[10rem] truncate">{highlightedOrg?.name ?? 'Organizations'}</span>
        <span aria-hidden="true" className="text-slate-400">
          ▾
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 z-10 mt-2 w-64 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {organizations.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No organizations yet</p>
          ) : (
            organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => handleSelect(org.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="truncate">{org.name}</span>
                <Badge variant={roleBadgeVariant(org.role)}>{org.role}</Badge>
              </button>
            ))
          )}
          <div className="my-1 border-t border-slate-200" />
          <Link
            href="/organizations"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            All organizations
          </Link>
        </div>
      ) : null}
    </div>
  );
}
