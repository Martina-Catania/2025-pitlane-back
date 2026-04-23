const { execSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');
const postgres = require('postgres');

// Load test environment variables
const envPath = path.resolve(__dirname, '../../.env.test');
dotenv.config({ path: envPath });

module.exports = async () => {
  console.log('\n🚀 Starting test environment setup...\n');

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('❌ DATABASE_URL is not set. Configure it in .env.test before running tests.');
    }

    // Verify local PostgreSQL connectivity before running migrations.
    console.log('🔎 Checking local PostgreSQL connection...');
    const connectionUrl = new URL(process.env.DATABASE_URL);
    connectionUrl.searchParams.delete('schema');

    const sql = postgres(connectionUrl.toString(), {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 5,
    });

    try {
      await sql`SELECT 1`;
      console.log('✅ PostgreSQL is reachable!\n');
    } catch (error) {
      throw new Error(
        `❌ Could not connect to PostgreSQL using DATABASE_URL. ` +
        `Start your local PostgreSQL service and verify credentials/database in .env.test. ` +
        `Original error: ${error.message}`
      );
    } finally {
      await sql.end({ timeout: 5 });
    }

    // Run Prisma migrations
    console.log('📦 Running Prisma migrations...');
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });
    console.log('✅ Migrations completed!\n');

    // Generate Prisma Client
    // Generate Prisma Client (skip if fails due to file lock)
    console.log('🔨 Generating Prisma Client...');
    try {
      execSync('npx prisma generate', {
        stdio: 'inherit'
      });
      console.log('✅ Prisma Client generated!\n');
    } catch (error) {
      console.log('⚠️  Prisma Client generation skipped (already exists or file locked)\n');
    }

    // Run seed script
    console.log('🌱 Seeding test database...');
    execSync('npm run seed', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });
    console.log('✅ Database seeded!\n');

    console.log('✨ Test environment setup complete!\n');
  } catch (error) {
    console.error('❌ Error during test setup:', error.message);
    throw error;
  }
};
