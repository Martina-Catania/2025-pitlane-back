const { PrismaClient } = require('@prisma/client');
const { getCalorieProgress, updateCalorieGoal } = require('../controllers/profilesLib');

const prisma = new PrismaClient();

// Test profile ID
const testProfileId = '00000000-0000-0000-0000-000000000002';

describe('Calorie Progress API', () => {
  
  beforeAll(async () => {
    try {
      // Create test profile
      await prisma.profile.upsert({
        where: { id: testProfileId },
        update: {},
        create: {
          id: testProfileId,
          username: `test_calorie_user_${Date.now()}`,
          role: 'user',
          calorie_goal: 2000
        }
      });

      // Create test foods
      await prisma.food.upsert({
        where: { FoodID: 1000 },
        update: {},
        create: {
          FoodID: 1000,
          name: 'Test Food 1',
          svgLink: 'test.svg',
          kCal: 100,
          profileId: testProfileId
        }
      });

      await prisma.food.upsert({
        where: { FoodID: 1001 },
        update: {},
        create: {
          FoodID: 1001,
          name: 'Test Food 2',
          svgLink: 'test2.svg',
          kCal: 200,
          profileId: testProfileId
        }
      });

      // Create test meal
      await prisma.meal.upsert({
        where: { MealID: 1000 },
        update: {},
        create: {
          MealID: 1000,
          name: 'Test Meal',
          description: 'Test meal for calorie progress',
          profileId: testProfileId
        }
      });

      // Add foods to meal
      await prisma.mealFood.upsert({
        where: { MealFoodID: 1000 },
        update: {},
        create: {
          MealFoodID: 1000,
          mealId: 1000,
          foodId: 1000,
          quantity: 2 // 2 * 100 = 200 kcal
        }
      });

      await prisma.mealFood.upsert({
        where: { MealFoodID: 1001 },
        update: {},
        create: {
          MealFoodID: 1001,
          mealId: 1000,
          foodId: 1001,
          quantity: 1 // 1 * 200 = 200 kcal
        }
      });
      // Total meal kcal: 400

    } catch (error) {
      console.error('Setup error:', error);
    }
  });

  afterAll(async () => {
    try {
      // Clean up test data
      await prisma.mealConsumption.deleteMany({
        where: { profileId: testProfileId }
      });

      await prisma.mealFood.deleteMany({
        where: { mealId: 1000 }
      });

      await prisma.meal.deleteMany({
        where: { MealID: 1000 }
      });

      await prisma.food.deleteMany({
        where: { FoodID: { in: [1000, 1001] } }
      });

      await prisma.profile.deleteMany({
        where: { id: testProfileId }
      });

    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('Daily Calorie Progress Calculation', () => {
    
    it('should return 0 consumed calories when no consumptions exist for the day', async () => {
      const today = new Date();
      const progress = await getCalorieProgress(testProfileId, today);
      
      expect(progress.consumed).toBe(0);
      expect(progress.goal).toBe(2000);
      expect(progress.date).toBe(today.toISOString().split('T')[0]);
    });

    it('should calculate consumed calories only for the specific day', async () => {
      // Create consumptions for today
      const today = new Date();
      const todayConsumption = await prisma.mealConsumption.create({
        data: {
          name: 'Test Today Consumption',
          type: 'individual',
          consumedAt: today,
          profileId: testProfileId,
          mealId: 1000,
          portionFraction: 1.0,
          totalKcal: 400,
          source: 'individual'
        }
      });

      // Create consumption for yesterday (should not be included)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayConsumption = await prisma.mealConsumption.create({
        data: {
          name: 'Test Yesterday Consumption',
          type: 'individual',
          consumedAt: yesterday,
          profileId: testProfileId,
          mealId: 1000,
          portionFraction: 2,
          quantity: 1,
          totalKcal: 800, // 2 * 400 kcal
          source: 'individual'
        }
      });

      // Test today's progress
      const todayProgress = await getCalorieProgress(testProfileId, today);
      expect(todayProgress.consumed).toBe(400); // Only today's consumption
      expect(todayProgress.goal).toBe(2000);
      expect(todayProgress.date).toBe(today.toISOString().split('T')[0]);

      // Test yesterday's progress
      const yesterdayProgress = await getCalorieProgress(testProfileId, yesterday);
      expect(yesterdayProgress.consumed).toBe(800); // Only yesterday's consumption
      expect(yesterdayProgress.goal).toBe(2000);
      expect(yesterdayProgress.date).toBe(yesterday.toISOString().split('T')[0]);

      // Clean up
      await prisma.mealConsumption.deleteMany({
        where: {
          MealConsumptionID: {
            in: [todayConsumption.MealConsumptionID, yesterdayConsumption.MealConsumptionID]
          }
        }
      });
    });

    it('should handle multiple consumptions in the same day', async () => {
      const today = new Date();
      
      // Create first consumption
      const consumption1 = await prisma.mealConsumption.create({
        data: {
          name: 'Test Consumption 1',
          type: 'individual',
          consumedAt: today,
          profileId: testProfileId,
          mealId: 1000,
          portionFraction: 1.0,
          totalKcal: 400,
          source: 'individual'
        }
      });

      // Create second consumption later in the day
      const lunchTime = new Date(today);
      lunchTime.setHours(14, 0, 0, 0);
      
      const consumption2 = await prisma.mealConsumption.create({
        data: {
          name: 'Test Consumption 2',
          type: 'individual',
          consumedAt: lunchTime,
          profileId: testProfileId,
          mealId: 1000,
          portionFraction: 2,
          quantity: 1,
          totalKcal: 800,
          source: 'individual'
        }
      });

      const progress = await getCalorieProgress(testProfileId, today);
      expect(progress.consumed).toBe(1200); // 400 + 800 = 1200 kcal
      expect(progress.goal).toBe(2000);

      // Clean up
      await prisma.mealConsumption.deleteMany({
        where: {
          MealConsumptionID: {
            in: [consumption1.MealConsumptionID, consumption2.MealConsumptionID]
          }
        }
      });
    });

    it('should exclude group consumptions from personal calorie progress', async () => {
      const today = new Date();
      
      // Create individual consumption
      const individualConsumption = await prisma.mealConsumption.create({
        data: {
          name: 'Test Individual Consumption',
          type: 'individual',
          consumedAt: today,
          profileId: testProfileId,
          mealId: 1000,
          portionFraction: 1.0,
          totalKcal: 400,
          source: 'individual'
        }
      });

      // Create group consumption (should not be included)
      const groupConsumption2 = await prisma.mealConsumption.create({
        data: {
          name: 'Test Group Consumption',
          type: 'group',
          consumedAt: today,
          profileId: testProfileId,
          mealId: 1000,
          portionFraction: 3,
          quantity: 1,
          totalKcal: 1200, // 3 * 400 kcal (should not be counted)
          source: 'group'
        }
      });

      const progress = await getCalorieProgress(testProfileId, today);
      expect(progress.consumed).toBe(400); // Only individual consumption
      expect(progress.goal).toBe(2000);

      // Clean up
      await prisma.mealConsumption.deleteMany({
        where: {
          MealConsumptionID: {
            in: [individualConsumption.MealConsumptionID, groupConsumption2.MealConsumptionID]
          }
        }
      });
    });

    it('should use custom calorie goal when set', async () => {
      // Update calorie goal
      await updateCalorieGoal(testProfileId, 2500);
      
      const progress = await getCalorieProgress(testProfileId);
      expect(progress.goal).toBe(2500);

      // Reset to default
      await updateCalorieGoal(testProfileId, 2000);
    });
  });
});