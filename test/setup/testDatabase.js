const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Clean specific tables in the database
 * Use this after each test to maintain isolation
 */
async function cleanDatabase() {
  const tablenames = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter(name => name !== '_prisma_migrations')
    .map(name => `"public"."${name}"`)
    .join(', ');

  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  } catch (error) {
    console.log({ error });
  }
}

/**
 * Reset database to initial seeded state
 */
async function resetDatabase() {
  await cleanDatabase();
  
  // Re-run seed
  const { execSync } = require('child_process');
  execSync('npm run seed', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  });
}

/**
 * Get Prisma client for tests
 */
function getPrismaClient() {
  return prisma;
}

/**
 * Close database connection
 */
async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = {
  cleanDatabase,
  resetDatabase,
  getPrismaClient,
  disconnectDatabase,
  prisma
};
