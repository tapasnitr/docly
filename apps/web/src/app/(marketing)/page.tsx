import type { Metadata } from 'next';
import { Navbar } from '../../components/marketing/Navbar';
import { Hero } from '../../components/marketing/Hero';
import { ProblemSection } from '../../components/marketing/ProblemSection';
import { FeaturesGrid } from '../../components/marketing/FeaturesGrid';
import { AISection } from '../../components/marketing/AISection';
import { ProjectSection } from '../../components/marketing/ProjectSection';
import { WorkflowSection } from '../../components/marketing/WorkflowSection';
import { TrustSection } from '../../components/marketing/TrustSection';
import { FAQSection } from '../../components/marketing/FAQSection';
import { FinalCTA } from '../../components/marketing/FinalCTA';
import { Footer } from '../../components/marketing/Footer';

export const metadata: Metadata = {
  title: "Turn Your Team's Knowledge Into an AI-Powered Workspace",
  description:
    "Bring your projects, tasks, documents, and organizational knowledge together in one secure, multi-tenant workspace with an AI knowledge assistant.",
};

export default function MarketingHomePage() {
  return (
    <>
      <Navbar />
      <main className="overflow-x-hidden">
        <Hero />
        <ProblemSection />
        <FeaturesGrid />
        <AISection />
        <ProjectSection />
        <WorkflowSection />
        <TrustSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
