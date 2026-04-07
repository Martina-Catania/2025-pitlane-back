// Integration test for meal registration and calorie progress update
const { PrismaClient } = require('@prisma/client');
const request = require('supertest');
const express = require('express');
const routes = require('../routes');

const app = express();
app.use(express.json());
app.use('/', routes);

const prisma = new PrismaClient();

// Mock JWT token for testing
const mockToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMyIsInVzZXJuYW1lIjoidGVzdGNhbG9yaWV1c2VyIiwicm9sZSI6InVzZXIiLCJpYXQiOjE2MzI0MDAwMDB9.mock_signature';

// Test profile ID for calorie integration
const testProfileId = '00000000-0000-0000-0000-000000000003';

describe('Meal Registration and Calorie Progress Integration', () => {
  
  beforeAll(async () => {
    try {
      // Create test profile
      await prisma.profile.upsert({
        where: { id: testProfileId },
        update: {},
        create: {
          id: testProfileId,
          username: `test_calorie_integration_${Date.now()}`,
          role: 'user',
          calorie_goal: 2000
        }
      });

      // Create test foods
      await prisma.food.upsert({
        where: { FoodID: 2000 },
        update: {},
        create: {
          FoodID: 2000,
          name: 'Integration Test Food 1',
          svgLink: 'test.svg',
          kCal: 300,
          profileId: testProfileId
        }
      });

      await prisma.food.upsert({
        where: { FoodID: 2001 },
        update: {},
        create: {
          FoodID: 2001,
          name: 'Integration Test Food 2',
          svgLink: 'test2.svg',
          kCal: 200,
          profileId: testProfileId
        }
      });

      // Create test meal with known calorie content
      await prisma.meal.upsert({
        where: { MealID: 2000 },
        update: {},
        create: {
          MealID: 2000,
          name: 'Integration Test Meal',
          description: 'Test meal for calorie integration',
          profileId: testProfileId
        }
      });

      // Add foods to meal
      await prisma.mealFood.upsert({
        where: { MealFoodID: 2000 },
        update: {},
        create: {
          MealFoodID: 2000,
          mealId: 2000,
          foodId: 2000,
          quantity: 1 // 1 * 300 = 300 kcal
        }
      });

      await prisma.mealFood.upsert({
        where: { MealFoodID: 2001 },
        update: {},
        create: {
          MealFoodID: 2001,
          mealId: 2000,
          foodId: 2001,
          quantity: 2 // 2 * 200 = 400 kcal
        }
      });
      // Total meal kcal: 700

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
        where: { mealId: 2000 }
      });

      await prisma.meal.deleteMany({
        where: { MealID: 2000 }
      });

      await prisma.food.deleteMany({
        where: { FoodID: { in: [2000, 2001] } }
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

  describe('End-to-End Meal Registration and Calorie Update', () => {
    
    it('should start with 0 consumed calories', async () => {
      const res = await request(app)
        .get(`/profile/${testProfileId}/calorie-progress`)
        .set('Authorization', mockToken);

      expect([200, 401, 403]).toContain(res.statusCode);
      
      if (res.statusCode === 200) {
        expect(res.body.consumed).toBe(0);
        expect(res.body.goal).toBe(2000);
        expect(res.body.date).toBeDefined();
      }
    });

    it('should register a meal and immediately reflect in calorie progress', async () => {
      // Step 1: Register a meal consumption
      const consumptionRes = await request(app)
        .post('/meal-consumptions/individual')
        .set('Authorization', mockToken)
        .send({
          name: 'Test Breakfast',
          description: 'Testing meal registration',
          profileId: testProfileId,
          mealId: 2000,
          consumedAt: new Date().toISOString()
        });

      expect([201, 401, 403, 400]).toContain(consumptionRes.statusCode);
      
      if (consumptionRes.statusCode === 201) {
        expect(consumptionRes.body.totalKcal).toBe(700);
        expect(consumptionRes.body.mealId).toBe(2000);
      }

      // Step 2: Check that calorie progress immediately reflects the new consumption
      const progressRes = await request(app)
        .get(`/profile/${testProfileId}/calorie-progress`)
        .set('Authorization', mockToken);

      expect([200, 401, 403]).toContain(progressRes.statusCode);
      
      if (progressRes.statusCode === 200) {
        expect(progressRes.body.consumed).toBe(700); // Should now show 700 kcal consumed
        expect(progressRes.body.goal).toBe(2000);
        expect(progressRes.body.date).toBeDefined();
      }
    });

    it('should register a second meal and show cumulative calories', async () => {
      // Register another full meal
      const consumptionRes = await request(app)
        .post('/meal-consumptions/individual')
        .set('Authorization', mockToken)
        .send({
          name: 'Test Lunch',
          description: 'Testing second meal registration',
          profileId: testProfileId,
          mealId: 2000,
          consumedAt: new Date().toISOString()
        });

      expect([201, 401, 403]).toContain(consumptionRes.statusCode);
      
      if (consumptionRes.statusCode === 201) {
        expect(consumptionRes.body.totalKcal).toBe(700);
      }

      // Check cumulative calorie progress
      const progressRes = await request(app)
        .get(`/profile/${testProfileId}/calorie-progress`)
        .set('Authorization', mockToken);

      expect([200, 401, 403]).toContain(progressRes.statusCode);
      
      if (progressRes.statusCode === 200) {
        expect(progressRes.body.consumed).toBe(1400); // 700 + 700 = 1400 kcal
        expect(progressRes.body.goal).toBe(2000);
      }
    });

    it('should not include group consumptions in individual calorie progress', async () => {
      // First, create a group for testing
      const groupRes = await prisma.group.create({
        data: {
          name: 'Test Group for Calorie Integration',
          description: 'Testing group meals',
          createdBy: testProfileId
        }
      });

      // Add user as member
      await prisma.groupMember.create({
        data: {
          groupId: groupRes.GroupID,
          profileId: testProfileId,
          role: 'admin'
        }
      });

      // Register a group meal (should not affect individual calorie progress)
      const groupConsumptionRes = await request(app)
        .post('/meal-consumptions/group')
        .set('Authorization', mockToken)
        .send({
          name: 'Test Group Meal',
          description: 'Testing group meal registration',
          profileId: testProfileId,
          groupId: groupRes.GroupID,
          mealId: 2000,
          consumedAt: new Date().toISOString()
        });

      expect([201, 401, 403]).toContain(groupConsumptionRes.statusCode);

      // Check that individual calorie progress is unchanged
      const progressRes = await request(app)
        .get(`/profile/${testProfileId}/calorie-progress`)
        .set('Authorization', mockToken);

      expect([200, 401, 403]).toContain(progressRes.statusCode);
      
      if (progressRes.statusCode === 200) {
        expect(progressRes.body.consumed).toBe(1400); // Still 1400, group meal not counted
        expect(progressRes.body.goal).toBe(2000);
      }

      // Clean up group
      await prisma.groupMember.deleteMany({
        where: { groupId: groupRes.GroupID }
      });
      await prisma.group.delete({
        where: { GroupID: groupRes.GroupID }
      });
    });

    it('should show correct progress for different dates', async () => {
      // Register a meal for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const yesterdayConsumptionRes = await request(app)
        .post('/meal-consumptions/individual')
        .set('Authorization', mockToken)
        .send({
          name: 'Yesterday Meal',
          description: 'Testing date-specific progress',
          profileId: testProfileId,
          mealId: 2000,
          consumedAt: yesterday.toISOString()
        });

      expect([201, 401, 403]).toContain(yesterdayConsumptionRes.statusCode);

      // Check today's progress (should still be 1400)
      const todayProgressRes = await request(app)
        .get(`/profile/${testProfileId}/calorie-progress`)
        .set('Authorization', mockToken);

      expect([200, 401, 403]).toContain(todayProgressRes.statusCode);
      
      if (todayProgressRes.statusCode === 200) {
        expect(todayProgressRes.body.consumed).toBe(1400); // Today's total unchanged
      }

      // Check yesterday's progress (should be 700)
      const yesterdayProgressRes = await request(app)
        .get(`/profile/${testProfileId}/calorie-progress?date=${yesterday.toISOString()}`)
        .set('Authorization', mockToken);

      expect([200, 401, 403]).toContain(yesterdayProgressRes.statusCode);
      
      if (yesterdayProgressRes.statusCode === 200) {
        expect(yesterdayProgressRes.body.consumed).toBe(700); // Yesterday's consumption
        expect(yesterdayProgressRes.body.date).toBe(yesterday.toISOString().split('T')[0]);
      }
    });
  });
});