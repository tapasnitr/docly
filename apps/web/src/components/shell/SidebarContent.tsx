'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, FileText, Folder, LayoutDashboard, LogOut, Plus, Settings, Users } from 'lucide-react';
import { cn } from '@docly/ui';
import { useAuth } from '../../lib/auth-context';
import { useWorkspace } from '../../lib/workspace-context';
import { CreateProjectDialog } from './CreateProjectDialog';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';

const linkBase = 'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors';
const linkIdle = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
const linkActive = 'bg-slate-900 text-white';

function NavLink({
  href,
  icon: Icon,
  active,
  children,
}: {
  href: string;
  icon: typeof Folder;
  active: boolean;
  children: string;
}) {
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className={cn(linkBase, active ? linkActive : linkIdle)}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{children}</span>
    </Link>
  );
}

function WorkspaceSwitcher({ onCreate }: { onCreate: () => void }) {
  const router = useRouter();
  const { organizations, organizationsStatus, activeOrganization, selectOrganization } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (organizationsStatus === 'loading') {
    return <div className="h-11 animate-pulse rounded-md bg-slate-100" />;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-2.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold uppercase text-white">
          {activeOrganization?.name.charAt(0) ?? '?'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">
            {activeOrganization?.name ?? 'No workspace'}
          </span>
          <span className="block text-xs text-slate-500">Workspace</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute inset-x-0 z-20 mt-2 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              role="option"
              aria-selected={org.id === activeOrganization?.id}
              onClick={() => {
                selectOrganization(org.id);
                setOpen(false);
                router.push('/dashboard');
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="min-w-0 flex-1 truncate">{org.name}</span>
              {org.id === activeOrganization?.id ? <Check className="h-4 w-4 text-slate-900" /> : null}
            </button>
          ))}
          <div className="my-1 border-t border-slate-200" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCreate();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            New workspace
          </button>
          <Link
            href="/organizations"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Manage workspaces
          </Link>
        </div>
      ) : null}
    </div>
  );
}

// The sidebar's content, shared by the fixed desktop column and the mobile
// drawer. Everything is scoped to the active workspace.
export function SidebarContent() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, logout } = useAuth();
  const { activeOrganization, projects, projectsStatus } = useWorkspace();
  const [workspaceDialog, setWorkspaceDialog] = useState(false);
  const [projectDialog, setProjectDialog] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const orgId = activeOrganization?.id;
  const base = orgId ? `/organizations/${orgId}` : null;
  // VIEWER is read-only at the workspace level, same rule the API enforces.
  const canCreateProject = activeOrganization ? activeOrganization.role !== 'VIEWER' : false;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link href="/dashboard" className="px-2 pt-1 text-lg font-semibold tracking-tight text-slate-900">
        Docly
      </Link>

      <WorkspaceSwitcher onCreate={() => setWorkspaceDialog(true)} />

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Workspace">
        <NavLink href="/dashboard" icon={LayoutDashboard} active={pathname === '/dashboard'}>
          Dashboard
        </NavLink>

        {base ? (
          <>
            <NavLink href={`${base}/projects`} icon={Folder} active={pathname === `${base}/projects`}>
              All projects
            </NavLink>

            <div className="mt-3 flex items-center justify-between px-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projects</span>
              {canCreateProject ? (
                <button
                  type="button"
                  onClick={() => setProjectDialog(true)}
                  aria-label="New project"
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <Plus className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {projectsStatus === 'loading' ? (
              <div className="flex flex-col gap-1.5 px-3 py-1">
                <div className="h-4 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              </div>
            ) : projectsStatus === 'error' ? (
              <p className="px-3 text-xs text-red-600">Couldn&apos;t load projects.</p>
            ) : projects.length === 0 ? (
              <p className="px-3 text-xs text-slate-500">
                No projects yet.
                {canCreateProject ? (
                  <button
                    type="button"
                    onClick={() => setProjectDialog(true)}
                    className="ml-1 font-medium text-slate-900 underline"
                  >
                    Create one
                  </button>
                ) : null}
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {projects.map((project) => {
                  const href = `${base}/projects/${project.id}`;
                  const active = pathname === href;
                  return (
                    <li key={project.id}>
                      <Link
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'block truncate rounded-md py-1.5 pl-8 pr-3 text-sm transition-colors',
                          active ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        {project.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 flex flex-col gap-1 border-t border-slate-200 pt-3">
              <NavLink href={`${base}/documents`} icon={FileText} active={pathname === `${base}/documents`}>
                Documents
              </NavLink>
              <NavLink href={`${base}/members`} icon={Users} active={pathname === `${base}/members`}>
                Members
              </NavLink>
              <NavLink href={`${base}/settings`} icon={Settings} active={pathname === `${base}/settings`}>
                Workspace settings
              </NavLink>
            </div>
          </>
        ) : null}
      </nav>

      <div className="flex items-center gap-2 border-t border-slate-200 pt-3">
        <Link
          href="/settings"
          className="min-w-0 flex-1 rounded-md px-2 py-1.5 hover:bg-slate-100"
          title="Account settings"
        >
          <span className="block truncate text-sm font-medium text-slate-900">{user?.name ?? 'Account'}</span>
          <span className="block truncate text-xs text-slate-500">{user?.email}</span>
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {workspaceDialog ? <CreateWorkspaceDialog onClose={() => setWorkspaceDialog(false)} /> : null}
      {projectDialog && orgId ? <CreateProjectDialog organizationId={orgId} onClose={() => setProjectDialog(false)} /> : null}
    </div>
  );
}
