const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = async () => {
  console.log('\n🧹 Cleaning up test environment...\n');

  try {
    // Close Prisma connection
    await prisma.$disconnect();
    console.log('✅ Database connections closed\n');

    console.log('✨ Test environment cleanup complete!\n');
  } catch (error) {
    console.error('❌ Error during test cleanup:', error.message);
    await prisma.$disconnect();
  }
};
