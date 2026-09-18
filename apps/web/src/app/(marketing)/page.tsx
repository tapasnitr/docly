import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@docly/ui';

const pillars = [
  {
    title: 'Bring it together',
    description: 'Upload PDFs, docs, and spreadsheets into one organized knowledge base.',
  },
  {
    title: 'Make it useful',
    description: 'Ask plain-language questions and get answers linked to the exact source.',
  },
  {
    title: 'Share with confidence',
    description: 'Give every teammate the right view with roles and workspace-level access.',
  },
];

export default function MarketingHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-16 px-6 py-16">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">docly</span>
        <nav className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Dashboard
          </Link>
          <Button size="sm">Get started</Button>
        </nav>
      </header>

      <section className="flex flex-col gap-4">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Documents, finally organized
        </p>
        <h1 className="max-w-2xl text-5xl font-semibold leading-tight tracking-tight text-slate-900">
          Your team&apos;s second brain.
        </h1>
        <p className="max-w-xl text-lg text-slate-600">
          Docly turns scattered documents into a living, searchable knowledge base your whole
          team can trust.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {pillars.map((pillar) => (
          <Card key={pillar.title}>
            <CardHeader>
              <CardTitle>{pillar.title}</CardTitle>
              <CardDescription>{pillar.description}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </section>
    </main>
  );
}
