// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.dietaryRestriction.upsert({
    where: { DietaryRestrictionID: 0 },
    update: { name: 'For Everyone' },
    create: { DietaryRestrictionID: 0, name: 'For Everyone' },
  });

  // Create Preferences
  const healthy = await prisma.preference.upsert({
    where: { name: 'Healthy' },
    update: {},
    create: { name: 'Healthy' },
  });
  const vegan = await prisma.preference.upsert({
    where: { name: 'Vegan' },
    update: {},
    create: { name: 'Vegan' },
  });

  // Create Dietary Restrictions
  const glutenFree = await prisma.dietaryRestriction.upsert({
    where: { name: 'Gluten Free' },
    update: {},
    create: { name: 'Gluten Free' },
  });
  const lactoseFree = await prisma.dietaryRestriction.upsert({
    where: { name: 'Lactose Free' },
    update: {},
    create: { name: 'Lactose Free' },
  });

  // Create Profile (only id and username)
  const testProfile = await prisma.profile.upsert({
    where: { username: 'testuser' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001', // Example UUID, replace as needed
      username: 'testuser',
    },
  });

  // Skip foods creation if they already exist to avoid conflicts

  // Create Badges
  console.log('Creating badges...');
  
  const groupCreatorBadge = await prisma.badge.upsert({
    where: { name: 'Group Creator' },
    update: {
      iconUrl: null,  
      badgeType: 'group_creation'
    },
    create: {
      name: 'Group Creator',
      description: 'Created your first group to share meals with friends',
      badgeType: 'group_creation',
      iconUrl: null,  
      isActive: true,
    },
  });

  const votingParticipantBadge = await prisma.badge.upsert({
    where: { name: 'Democracy Enthusiast' },
    update: {
      iconUrl: null,  
      badgeType: 'voting_participation'
    },
    create: {
      name: 'Democracy Enthusiast',
      description: 'Participated in group meal voting sessions',
      badgeType: 'voting_participation',
      iconUrl: null,  
      isActive: true,
    },
  });

  const votingWinnerBadge = await prisma.badge.upsert({
    where: { name: 'Taste Maker' },
    update: {
      iconUrl: null,  
      badgeType: 'voting_winner'
    },
    create: {
      name: 'Taste Maker',
      description: 'Your meal proposals have won group voting sessions',
      badgeType: 'voting_winner',
      iconUrl: null,  
      isActive: true,
    },
  });

  const mealCreatorBadge = await prisma.badge.upsert({
    where: { name: 'Chef' },
    update: {
      iconUrl: null,  
      badgeType: 'meal_creation'
    },
    create: {
      name: 'Chef',
      description: 'Created and shared meal recipes with the community',
      badgeType: 'meal_creation',
      iconUrl: null,  
      isActive: true,
    },
  });

  console.log('Badges created successfully!');

  // Create Badge Requirements (Bronze: 1, Silver: 10, Gold: 50, Diamond: 100)
  console.log('Creating badge requirements...');

  const badges = [groupCreatorBadge, votingParticipantBadge, votingWinnerBadge, mealCreatorBadge];
  const levels = [
    { level: 'bronze', count: 1, desc: 'Complete 1 action' },
    { level: 'silver', count: 10, desc: 'Complete 10 actions' },
    { level: 'gold', count: 50, desc: 'Complete 50 actions' },
    { level: 'diamond', count: 100, desc: 'Complete 100 actions' }
  ];

  for (const badge of badges) {
    for (const { level, count, desc } of levels) {
      await prisma.badgeRequirement.upsert({
        where: {
          badgeId_level: {
            badgeId: badge.BadgeID,
            level: level
          }
        },
        update: {
          requiredCount: count,
          description: desc
        },
        create: {
          badgeId: badge.BadgeID,
          level: level,
          requiredCount: count,
          description: desc
        }
      });
    }
  }

  console.log('Badge requirements created successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
