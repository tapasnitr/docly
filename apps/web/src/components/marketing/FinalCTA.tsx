import Link from 'next/link';
import { Button } from '@docly/ui';
import { Reveal } from './ui/Reveal';
import { GradientBlob } from './ui/GradientBlob';
import { DemoLoginButton } from '../auth/DemoLoginButton';

export function FinalCTA() {
  return (
    <section className="px-6 py-24">
      <Reveal>
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-8 py-16 text-center">
          <GradientBlob className="-right-16 -top-16 h-64 w-64 bg-fuchsia-500/20" />
          <GradientBlob className="-left-16 bottom-0 h-64 w-64 bg-indigo-500/20" />
          <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Bring your team&apos;s knowledge together.
          </h2>
          <p className="relative max-w-xl text-slate-300">
            Build one workspace for projects, documents, collaboration, and AI-powered
            organizational knowledge.
          </p>
          <div className="relative flex flex-wrap items-center justify-center gap-3">
            <Link href="/register">
              <Button
                size="lg"
                className="border-0 bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20 hover:from-indigo-400 hover:to-fuchsia-400"
              >
                Create Your Workspace
              </Button>
            </Link>
            <DemoLoginButton
              label="Explore Demo"
              size="lg"
              variant="outline"
              className="border-slate-600 text-white hover:bg-slate-800"
            />
          </div>
          <p className="relative text-xs text-slate-500">Built as a production-style multi-tenant SaaS platform.</p>
        </div>
      </Reveal>
    </section>
  );
}
