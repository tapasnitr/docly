import type { Metadata } from 'next';
import { Navbar } from '../../components/marketing/Navbar';
import { Hero } from '../../components/marketing/Hero';
import { ProblemSection } from '../../components/marketing/ProblemSection';
import { FeaturesGrid } from '../../components/marketing/FeaturesGrid';
import { AISection } from '../../components/marketing/AISection';
import { DocumentPipeline } from '../../components/marketing/DocumentPipeline';
import { ProjectSection } from '../../components/marketing/ProjectSection';
import { MultiTenancySection } from '../../components/marketing/MultiTenancySection';
import { ArchitectureSection } from '../../components/marketing/ArchitectureSection';
import { RealtimeSection } from '../../components/marketing/RealtimeSection';
import { AnalyticsSection } from '../../components/marketing/AnalyticsSection';
import { CommandPalette } from '../../components/marketing/CommandPalette';
import { WorkflowSection } from '../../components/marketing/WorkflowSection';
import { SecuritySection } from '../../components/marketing/SecuritySection';
import { EngineeringSection } from '../../components/marketing/EngineeringSection';
import { TechStackSection } from '../../components/marketing/TechStackSection';
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
        <DocumentPipeline />
        <ProjectSection />
        <MultiTenancySection />
        <ArchitectureSection />
        <RealtimeSection />
        <AnalyticsSection />
        <CommandPalette />
        <WorkflowSection />
        <SecuritySection />
        <EngineeringSection />
        <TechStackSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
