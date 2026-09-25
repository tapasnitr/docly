'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Boxes, Lock, Radio, Server, Sparkles } from 'lucide-react';
import { Button } from '@docly/ui';
import { HeroDashboardMockup } from './HeroDashboardMockup';
import { GradientBlob } from './ui/GradientBlob';

const TRUST_INDICATORS = [
  { icon: Boxes, label: 'Multi-Tenant', color: 'text-indigo-600 bg-indigo-50' },
  { icon: Sparkles, label: 'AI + RAG', color: 'text-fuchsia-600 bg-fuchsia-50' },
  { icon: Radio, label: 'Real-Time', color: 'text-emerald-600 bg-emerald-50' },
  { icon: Lock, label: 'Role-Based Access', color: 'text-amber-600 bg-amber-50' },
  { icon: Server, label: 'Production Architecture', color: 'text-sky-600 bg-sky-50' },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-16 sm:pt-24">
      <GradientBlob className="-left-32 -top-32 h-96 w-96 bg-indigo-300/40" />
      <GradientBlob className="-right-24 top-10 h-80 w-80 bg-fuchsia-300/30" />
      <GradientBlob className="left-1/3 top-96 h-72 w-72 bg-sky-300/20" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,theme(colors.slate.200)_1px,transparent_0)] bg-[size:32px_32px] opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-start gap-6"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-50 to-fuchsia-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Organizational Workspace
          </span>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Turn Your Team&apos;s Knowledge Into an{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
              AI-Powered Workspace
            </span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-slate-600">
            Bring your projects, tasks, documents, and organizational knowledge together in one
            secure workspace. Upload your team&apos;s knowledge, let AI understand it, and get
            answers grounded in your own documents.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/register">
              <Button
                size="lg"
                className="border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-500 hover:to-violet-500"
              >
                Create Your Workspace
              </Button>
            </Link>
            <a href="#platform">
              <Button size="lg" variant="outline">
                Explore the Platform
              </Button>
            </a>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {TRUST_INDICATORS.map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${item.color}`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
        >
          <HeroDashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}
