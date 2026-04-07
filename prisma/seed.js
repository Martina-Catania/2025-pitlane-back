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
  const preferenceNames = [
    'Healthy',
    'Vegan',
    'Vegetarian',
    'High Protein',
    'Low Carb',
    'Keto',
    'Mediterranean',
    'Low Sodium',
    'Pescatarian',
    'Whole Foods'
  ];

  for (const name of preferenceNames) {
    await prisma.preference.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  // Create Dietary Restrictions
  const dietaryRestrictionNames = [
    'Gluten Free',
    'Lactose Free',
    'Dairy Free',
    'Nut Free',
    'Soy Free',
    'Egg Free',
    'Shellfish Free',
    'Halal',
    'Kosher',
    'No Pork'
  ];

  for (const name of dietaryRestrictionNames) {
    await prisma.dietaryRestriction.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  // Create Profile (only id and username)
  const testProfile = await prisma.profile.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { username: 'testuser' },
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
      iconUrl: "https://uwzrnfxbkoeltqzoirks.supabase.co/storage/v1/object/public/badgePhotos/queco_group.jpeg",  
      badgeType: 'group_creation'
    },
    create: {
      name: 'Group Creator',
      description: 'Created your first group to share meals with friends',
      badgeType: 'group_creation',
      iconUrl: "https://uwzrnfxbkoeltqzoirks.supabase.co/storage/v1/object/public/badgePhotos/queco_group.jpeg",  
      isActive: true,
    },
  });

  const votingParticipantBadge = await prisma.badge.upsert({
    where: { name: 'Democracy Enthusiast' },
    update: {
      iconUrl: "https://uwzrnfxbkoeltqzoirks.supabase.co/storage/v1/object/public/badgePhotos/queco_vote.jpeg",  
      badgeType: 'voting_participation'
    },
    create: {
      name: 'Democracy Enthusiast',
      description: 'Participated in group meal voting sessions',
      badgeType: 'voting_participation',
      iconUrl: "https://uwzrnfxbkoeltqzoirks.supabase.co/storage/v1/object/public/badgePhotos/queco_vote.jpeg",  
      isActive: true,
    },
  });

  const votingWinnerBadge = await prisma.badge.upsert({
    where: { name: 'Taste Maker' },
    update: {
      iconUrl: "https://uwzrnfxbkoeltqzoirks.supabase.co/storage/v1/object/public/badgePhotos/queco_win.jpeg",  
      badgeType: 'voting_winner'
    },
    create: {
      name: 'Taste Maker',
      description: 'Your meal proposals have won group voting sessions',
      badgeType: 'voting_winner',
      iconUrl: "https://uwzrnfxbkoeltqzoirks.supabase.co/storage/v1/object/public/badgePhotos/queco_win.jpeg",  
      isActive: true,
    },
  });

  const mealCreatorBadge = await prisma.badge.upsert({
    where: { name: 'Chef' },
    update: {
      iconUrl: "https://uwzrnfxbkoeltqzoirks.supabase.co/storage/v1/object/public/badgePhotos/queco_chef.jpeg",  
      badgeType: 'meal_creation'
    },
    create: {
      name: 'Chef',
      description: 'Created and shared meal recipes with the community',
      badgeType: 'meal_creation',
      iconUrl: "https://uwzrnfxbkoeltqzoirks.supabase.co/storage/v1/object/public/badgePhotos/queco_chef.jpeg",  
      isActive: true,
    },
  });

  const mealPlannerBadge = await prisma.badge.upsert({
    where: { name: 'Meal Planner' },
    update: {
      iconUrl: "https://uwzrnfxbkoeltqzoirks.supabase.co/storage/v1/object/public/badgePhotos/queco_plan.jpeg",  
      badgeType: 'meal_planning'
    },
    create: {
      name: 'Meal Planner',
      description: 'Scheduled meals in advance for upcoming days',
      badgeType: 'meal_planning',
      iconUrl: "https://uwzrnfxbkoeltqzoirks.supabase.co/storage/v1/object/public/badgePhotos/queco_plan.jpeg",  
      isActive: true,
    },
  });

  const gameClickerWinnerBadge = await prisma.badge.upsert({
    where: { name: 'Click Master' },
    update: {
      iconUrl: "https://uwzrnfxbkoeltqzoirks.supabase.co/storage/v1/object/public/badgePhotos/queco_clicker.jpeg",
      badgeType: 'game_clicker_winner'
    },
    create: {
      name: 'Click Master',
      description: 'Won Egg Clicker games with the highest score',
      badgeType: 'game_clicker_winner',
      iconUrl: "https://uwzrnfxbkoeltqzoirks.supabase.co/storage/v1/object/public/badgePhotos/queco_clicker.jpeg",
      isActive: true,
    },
  });

  console.log('Badges created successfully!');

  // Create Badge Requirements (Bronze: 1, Silver: 10, Gold: 50, Diamond: 100)
  console.log('Creating badge requirements...');

  const badges = [groupCreatorBadge, votingParticipantBadge, votingWinnerBadge, mealCreatorBadge, mealPlannerBadge, gameClickerWinnerBadge];
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
