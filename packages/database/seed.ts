import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
// Loads the repo-root .env the same way packages/config does (see its
// comment) - this script runs standalone via `node`, not through the API,
// so nothing else populates process.env.DATABASE_URL for it.
loadDotenv({ path: resolve(process.cwd(), '../../.env') });

import bcrypt from 'bcryptjs';
import { prisma } from './src/index.js';

// Seeds a public, read-only demo account so a visitor can explore the real
// app without registering. The demo user is VIEWER everywhere (organization
// role and every project's membership role) - it can browse every screen but
// can't create, edit, or delete anything, so a shared, publicly-known login
// can never be broken by whoever's using it at the time.
//
// Credentials here are the source of truth - keep them in sync with
// apps/web/src/lib/demo.ts, which is what the "View Demo" button uses.
const DEMO_EMAIL = 'demo@docly.dev';
const DEMO_PASSWORD = 'DemoAccess123';
const SALT_ROUNDS = 12;

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: 'Demo Viewer',
      passwordHash,
      emailVerified: true,
    },
  });

  // A handful of other seeded users purely to populate member lists and
  // activity - not real logins anyone is meant to use.
  const teammates = await Promise.all(
    [
      { email: 'alex.chen@acme-demo.dev', name: 'Alex Chen' },
      { email: 'priya.sharma@acme-demo.dev', name: 'Priya Sharma' },
      { email: 'marcus.webb@acme-demo.dev', name: 'Marcus Webb' },
    ].map((data) =>
      prisma.user.upsert({
        where: { email: data.email },
        update: {},
        create: { ...data, passwordHash },
      })
    )
  );
  const [alex, priya, marcus] = teammates;

  const organization = await prisma.organization.upsert({
    where: { slug: 'acme-corp-demo' },
    update: {},
    create: { name: 'Acme Corp', slug: 'acme-corp-demo' },
  });

  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: alex.id, organizationId: organization.id } },
    update: {},
    create: { userId: alex.id, organizationId: organization.id, role: 'OWNER' },
  });
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: priya.id, organizationId: organization.id } },
    update: {},
    create: { userId: priya.id, organizationId: organization.id, role: 'ADMIN' },
  });
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: marcus.id, organizationId: organization.id } },
    update: {},
    create: { userId: marcus.id, organizationId: organization.id, role: 'MEMBER' },
  });
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: demoUser.id, organizationId: organization.id } },
    update: {},
    create: { userId: demoUser.id, organizationId: organization.id, role: 'VIEWER' },
  });

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

  const projectSeeds = [
    {
      name: 'Website Redesign',
      description: 'Refresh the marketing site with the new brand system and a faster checkout flow.',
      status: 'ACTIVE' as const,
      startDate: daysAgo(30),
      dueDate: daysAgo(-14),
      createdById: alex.id,
      leadId: alex.id,
      members: [{ userId: priya.id, role: 'MEMBER' as const }],
    },
    {
      name: 'Q3 Marketing Campaign',
      description: 'Plan and launch the Q3 multi-channel campaign, including creative and analytics tracking.',
      status: 'PLANNING' as const,
      startDate: daysAgo(-7),
      dueDate: daysAgo(-60),
      createdById: priya.id,
      leadId: priya.id,
      members: [{ userId: marcus.id, role: 'MEMBER' as const }],
    },
    {
      name: 'Customer Portal Migration',
      description: 'Migrate legacy customer accounts to the new self-serve portal.',
      status: 'COMPLETED' as const,
      startDate: daysAgo(90),
      dueDate: daysAgo(10),
      createdById: alex.id,
      leadId: marcus.id,
      members: [{ userId: alex.id, role: 'MEMBER' as const }],
    },
  ];

  for (const seed of projectSeeds) {
    const existing = await prisma.project.findFirst({
      where: { organizationId: organization.id, name: seed.name },
    });
    const project =
      existing ??
      (await prisma.project.create({
        data: {
          organizationId: organization.id,
          name: seed.name,
          description: seed.description,
          status: seed.status,
          startDate: seed.startDate,
          dueDate: seed.dueDate,
          createdById: seed.createdById,
        },
      }));

    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: seed.leadId } },
      update: {},
      create: { projectId: project.id, userId: seed.leadId, role: 'LEAD' },
    });
    for (const member of seed.members) {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: member.userId } },
        update: {},
        create: { projectId: project.id, userId: member.userId, role: member.role },
      });
    }
    // The demo viewer needs an explicit ProjectMember row (VIEWER) on every
    // project - project access is a subset of organization access, so
    // without this row the demo account would get a 404 on project detail
    // pages (see apps/api/src/middleware/require-project-role.ts).
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: demoUser.id } },
      update: {},
      create: { projectId: project.id, userId: demoUser.id, role: 'VIEWER' },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        userId: seed.createdById,
        action: 'project.created',
        resourceType: 'project',
        resourceId: project.id,
        changes: JSON.stringify({ name: seed.name }),
        createdAt: seed.startDate,
      },
    });
  }

  // A few documents purely for the dashboard's document counts/recent-list -
  // inserted directly (no real upload pipeline exists yet), so the demo
  // dashboard doesn't look empty.
  const documentSeeds = [
    { title: 'Project Requirements.pdf', filename: 'project-requirements.pdf', size: 482_000 },
    { title: 'Architecture Notes.docx', filename: 'architecture-notes.docx', size: 128_500 },
    { title: 'Brand Guidelines.pdf', filename: 'brand-guidelines.pdf', size: 2_340_000 },
  ];
  for (const doc of documentSeeds) {
    await prisma.document.upsert({
      where: { s3Key: `demo/${doc.filename}` },
      update: {},
      create: {
        organizationId: organization.id,
        uploadedById: alex.id,
        title: doc.title,
        filename: doc.filename,
        size: doc.size,
        status: 'ready',
        s3Key: `demo/${doc.filename}`,
      },
    });
  }

  console.log(`Seeded demo organization "${organization.name}" (${organization.id}).`);
  console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
