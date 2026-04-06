const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const { app } = require('../index');
const { generateUUID } = require('./helpers/testHelpers');

const prisma = new PrismaClient();

describe('Planned Meals API', () => {
  let profileId;
  let mealId;
  let foodA;
  let foodB;

  beforeAll(async () => {
    profileId = generateUUID();

    await prisma.profile.create({
      data: {
        id: profileId,
        username: `planned_meals_${Date.now()}`,
        role: 'user'
      }
    });

    foodA = await prisma.food.create({
      data: {
        name: `Planned Food A ${Date.now()}`,
        svgLink: '/planned-a.svg',
        kCal: 120,
        profileId
      }
    });

    foodB = await prisma.food.create({
      data: {
        name: `Planned Food B ${Date.now()}`,
        svgLink: '/planned-b.svg',
        kCal: 90,
        profileId
      }
    });

    const meal = await prisma.meal.create({
      data: {
        name: `Planned Meal ${Date.now()}`,
        description: 'Meal for planned-meals tests',
        profileId,
        mealFoods: {
          create: [
            { foodId: foodA.FoodID, quantity: 2 },
            { foodId: foodB.FoodID, quantity: 3 }
          ]
        }
      }
    });

    mealId = meal.MealID;
  });

  afterAll(async () => {
    await prisma.plannedMealConfirmation.deleteMany({
      where: {
        userId: profileId
      }
    });

    await prisma.plannedMealFood.deleteMany({
      where: {
        purchasedById: profileId
      }
    });

    await prisma.plannedMeal.deleteMany({
      where: {
        profileId
      }
    });

    await prisma.mealConsumption.deleteMany({
      where: {
        profileId
      }
    });

    await prisma.mealFood.deleteMany({
      where: {
        mealId
      }
    });

    await prisma.meal.deleteMany({
      where: {
        MealID: mealId
      }
    });

    await prisma.food.deleteMany({
      where: {
        FoodID: {
          in: [foodA.FoodID, foodB.FoodID]
        }
      }
    });

    await prisma.profile.deleteMany({
      where: {
        id: profileId
      }
    });

    await prisma.$disconnect();
  });

  it('creates a planned meal and auto-adds food items', async () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/planned-meals')
      .send({
        profileId,
        mealId,
        plannedFor: futureDate
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.profileId).toBe(profileId);
    expect(res.body.mealId).toBe(mealId);
    expect(res.body.foodItems).toHaveLength(2);
    expect(Array.isArray(res.body.badgeNotifications)).toBe(true);
  });

  it('aggregates quantities for duplicate foods across planned meals', async () => {
    const futureDateA = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const futureDateB = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

    await request(app)
      .post('/planned-meals')
      .send({ profileId, mealId, plannedFor: futureDateA });

    await request(app)
      .post('/planned-meals')
      .send({ profileId, mealId, plannedFor: futureDateB });

    const listRes = await request(app)
      .get(`/planned-meals/shopping/list?profileId=${profileId}&includePurchased=true`);

    expect(listRes.statusCode).toBe(200);

    const breadLikeA = listRes.body.find(item => item.foodId === foodA.FoodID);
    const breadLikeB = listRes.body.find(item => item.foodId === foodB.FoodID);

    expect(breadLikeA.totalQuantity).toBeGreaterThanOrEqual(4);
    expect(breadLikeB.totalQuantity).toBeGreaterThanOrEqual(6);
  });

  it('updates purchase status on grouped shopping item', async () => {
    const listRes = await request(app)
      .get(`/planned-meals/shopping/list?profileId=${profileId}&includePurchased=true`);

    const target = listRes.body.find(item => item.foodId === foodA.FoodID);

    const updateRes = await request(app)
      .put('/planned-meals/shopping/status')
      .send({
        profileId,
        foodId: target.foodId,
        isPurchased: true
      });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.isPurchased).toBe(true);
    expect(updateRes.body.updatedCount).toBeGreaterThan(0);
  });

  it('resolves overdue planned meal as consumed and removes foods from active list', async () => {
    const overdueMeal = await prisma.plannedMeal.create({
      data: {
        profileId,
        mealId,
        plannedFor: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'awaiting_confirmation',
        estimatedKcal: 510,
        foodItems: {
          create: [
            { foodId: foodA.FoodID, quantity: 2 },
            { foodId: foodB.FoodID, quantity: 3 }
          ]
        }
      }
    });

    const resolveRes = await request(app)
      .put(`/planned-meals/${overdueMeal.PlannedMealID}/resolve`)
      .send({
        requesterId: profileId,
        wasConsumed: true,
        note: 'Consumed as planned'
      });

    expect(resolveRes.statusCode).toBe(200);
    expect(resolveRes.body.consumption).toBeTruthy();

    const refreshed = await prisma.plannedMeal.findUnique({
      where: { PlannedMealID: overdueMeal.PlannedMealID }
    });
    expect(refreshed.status).toBe('consumed');
    expect(refreshed.isActive).toBe(false);

    const inactiveFoodItems = await prisma.plannedMealFood.findMany({
      where: {
        plannedMealId: overdueMeal.PlannedMealID
      }
    });

    expect(inactiveFoodItems.every(item => item.isActive === false)).toBe(true);
  });

  it('reschedules overdue planned meal and creates a fresh future planned meal', async () => {
    const overdueMeal = await prisma.plannedMeal.create({
      data: {
        profileId,
        mealId,
        plannedFor: new Date(Date.now() - 3 * 60 * 60 * 1000),
        status: 'awaiting_confirmation',
        estimatedKcal: 510,
        foodItems: {
          create: [
            { foodId: foodA.FoodID, quantity: 2 },
            { foodId: foodB.FoodID, quantity: 3 }
          ]
        }
      }
    });

    const nextDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const resolveRes = await request(app)
      .put(`/planned-meals/${overdueMeal.PlannedMealID}/resolve`)
      .send({
        requesterId: profileId,
        wasConsumed: false,
        action: 'rescheduled',
        newPlannedFor: nextDate,
        note: 'Rescheduled because not consumed'
      });

    expect(resolveRes.statusCode).toBe(200);
    expect(resolveRes.body.rescheduledTo).toBeTruthy();

    const oldRecord = await prisma.plannedMeal.findUnique({
      where: { PlannedMealID: overdueMeal.PlannedMealID }
    });
    expect(oldRecord.status).toBe('rescheduled');
    expect(oldRecord.isActive).toBe(false);

    const newRecord = await prisma.plannedMeal.findUnique({
      where: { PlannedMealID: resolveRes.body.rescheduledTo.PlannedMealID },
      include: { foodItems: true }
    });
    expect(newRecord.status).toBe('scheduled');
    expect(newRecord.foodItems.length).toBeGreaterThan(0);
  });
});
