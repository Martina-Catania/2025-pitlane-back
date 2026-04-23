const { PrismaClient } = require('@prisma/client');

// Create Prisma Client instance
const prisma = new PrismaClient();

module.exports = { prisma };
