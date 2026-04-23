const request = require('supertest');
const { app } = require('../index');
const { cleanDatabase, prisma } = require('./setup/testDatabase');
const { createTestProfile, createTestMeal, createTestFood } = require('./helpers/testHelpers');

describe('Meals API', () => {
  let testProfile;
  let testFood1, testFood2;

  beforeAll(async () => {
    await cleanDatabase();

    // Create test profile
    testProfile = await prisma.profile.create({
      data: createTestProfile()
    });

    // Create test foods
    testFood1 = await prisma.food.create({
      data: createTestFood({
        name: 'Chicken', kCal: 200, profileId: testProfile.id
      })
    });

    testFood2 = await prisma.food.create({
      data: createTestFood({ name: 'Rice', kCal: 130, profileId: testProfile.id })
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('GET /meals/all', () => {
    it('should return all meals with profile information', async () => {
      // Create a test meal
      await prisma.meal.create({
        data: {
          ...createTestMeal(testProfile.id, { name: 'Chicken Rice' }),
          mealFoods: {
            create: [
              { foodId: testFood1.FoodID, quantity: 1 },
              { foodId: testFood2.FoodID, quantity: 1 }
            ]
          }
        }
      });

      const response = await request(app)
        .get('/meals/all')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('profile');
    });
  });

  describe('GET /meals/user', () => {
    it('should return meals for a specific user', async () => {
      const response = await request(app)
        .get(`/meals/user?profileId=${testProfile.id}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 400 if profileId is missing', async () => {
      const response = await request(app)
        .get('/meals/user')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /meals', () => {
    it('should create a new meal with foods', async () => {
      const mealData = {
        name: 'New Test Meal',
        profileId: testProfile.id,
        mealFoods: [
          { foodId: testFood1.FoodID, quantity: 2 },
          { foodId: testFood2.FoodID, quantity: 1 }
        ]
      };

      const response = await request(app)
        .post('/meals')
        .send(mealData)
        .expect(201);

      expect(response.body).toHaveProperty('MealID');
      expect(response.body.name).toBe(mealData.name);
      expect(response.body.mealFoods).toHaveLength(2);
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/meals')
        .send({ name: 'Incomplete Meal' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /meals/:id', () => {
    it('should return a specific meal by ID', async () => {
      const meal = await prisma.meal.create({
        data: createTestMeal(testProfile.id, { name: 'Specific Meal' })
      });

      const response = await request(app)
        .get(`/meals/${meal.MealID}`)
        .expect(200);

      expect(response.body.MealID).toBe(meal.MealID);
      expect(response.body.name).toBe('Specific Meal');
    });

    it('should return 404 for non-existent meal', async () => {
      const response = await request(app)
        .get('/meals/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /meals/:id', () => {
    it('should update a meal', async () => {
      const meal = await prisma.meal.create({
        data: createTestMeal(testProfile.id, { name: 'Original Name' })
      });

      const updateData = {
        name: 'Updated Name',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/meals/${meal.MealID}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
      expect(response.body.description).toBe('Updated description');
    });
  });

  describe('DELETE /meals/:id', () => {
    it('should delete a meal', async () => {
      const meal = await prisma.meal.create({
        data: createTestMeal(testProfile.id, { name: 'To Be Deleted' })
      });

      await request(app)
        .delete(`/meals/${meal.MealID}`)
        .expect(204);

      // Verify meal is deleted
      const deletedMeal = await prisma.meal.findUnique({
        where: { MealID: meal.MealID }
      });
      expect(deletedMeal).toBeNull();
    });
  });

  describe('GET /meals/recommended/:profileId', () => {
    it('should return recommended meals for a profile', async () => {
      const response = await request(app)
        .get(`/meals/recommended/${testProfile.id}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
