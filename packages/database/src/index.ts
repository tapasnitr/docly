import { PrismaClient } from '@prisma/client';

// Create a single instance of Prisma for the application
export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Handle connection cleanup
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export * from '@prisma/client';
