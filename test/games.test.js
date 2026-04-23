const request = require('supertest');
const { app } = require('../index');
const { cleanDatabase, prisma } = require('./setup/testDatabase');
const { createTestProfile, createTestGroup, createTestGameSession, createTestMeal } = require('./helpers/testHelpers');

describe('Games API', () => {
  let testGroup, testProfile1, testProfile2, testMeal1, testMeal2;

  beforeAll(async () => {
    await cleanDatabase();
    
    // Create test profiles
    testProfile1 = await prisma.profile.create({
      data: createTestProfile({ username: 'player1' })
    });
    
    testProfile2 = await prisma.profile.create({
      data: createTestProfile({ username: 'player2' })
    });

    // Create test group with members
    testGroup = await prisma.group.create({
      data: {
        ...createTestGroup(testProfile1.id),
        members: {
          create: [
            { profileId: testProfile1.id, role: 'admin' },
            { profileId: testProfile2.id, role: 'member' }
          ]
        }
      }
    });

    // Create test meals
    testMeal1 = await prisma.meal.create({
      data: createTestMeal(testProfile1.id, { name: 'Meal 1' })
    });
    
    testMeal2 = await prisma.meal.create({
      data: createTestMeal(testProfile2.id, { name: 'Meal 2' })
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('POST /games', () => {
    it('should create a new egg clicker game session', async () => {
      const gameData = {
        groupId: testGroup.GroupID,
        hostId: testProfile1.id,
        gameType: 'egg_clicker',
        duration: 30,
        minPlayers: 2
      };

      const response = await request(app)
        .post('/games')
        .send(gameData)
        .expect(201);

      expect(response.body).toHaveProperty('GameSessionID');
      expect(response.body.gameType).toBe('egg_clicker');
      expect(response.body.status).toBe('waiting');
    });

    it('should create a roulette game session', async () => {
      // Clean up existing games
      await prisma.gameSession.deleteMany({
        where: { groupId: testGroup.GroupID }
      });

      const gameData = {
        groupId: testGroup.GroupID,
        hostId: testProfile1.id,
        gameType: 'roulette',
        duration: 30,
        minPlayers: 2
      };

      const response = await request(app)
        .post('/games')
        .send(gameData)
        .expect(201);

      expect(response.body.gameType).toBe('roulette');
    });

    it('should not allow multiple active games in same group', async () => {
      // Clean up
      await prisma.gameSession.deleteMany({
        where: { groupId: testGroup.GroupID }
      });

      // Create first game
      await request(app)
        .post('/games')
        .send({
          groupId: testGroup.GroupID,
          hostId: testProfile1.id,
          gameType: 'egg_clicker'
        })
        .expect(201);

      // Try to create second game
      const response = await request(app)
        .post('/games')
        .send({
          groupId: testGroup.GroupID,
          hostId: testProfile1.id,
          gameType: 'roulette'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /games/:id', () => {
    it('should return a game session by ID', async () => {
      const game = await prisma.gameSession.create({
        data: {
          ...createTestGameSession(testGroup.GroupID, testProfile1.id),
          status: 'waiting'
        }
      });

      const response = await request(app)
        .get(`/games/${game.GameSessionID}`)
        .expect(200);

      expect(response.body.GameSessionID).toBe(game.GameSessionID);
    });

    it('should return 404 for non-existent game', async () => {
      const response = await request(app)
        .get('/games/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /games/:id/join', () => {
    it('should allow player to join game', async () => {
      const game = await prisma.gameSession.create({
        data: {
          ...createTestGameSession(testGroup.GroupID, testProfile1.id),
          status: 'waiting'
        }
      });

      const joinData = {
        profileId: testProfile2.id,
        mealId: testMeal2.MealID
      };

      const response = await request(app)
        .post(`/games/${game.GameSessionID}/join`)
        .send(joinData)
        .expect(200);

      expect(response.body).toHaveProperty('GameParticipantID');
      expect(response.body.profileId).toBe(testProfile2.id);
    });

    it('should not allow joining completed game', async () => {
      const game = await prisma.gameSession.create({
        data: {
          ...createTestGameSession(testGroup.GroupID, testProfile1.id),
          status: 'completed'
        }
      });

      const response = await request(app)
        .post(`/games/${game.GameSessionID}/join`)
        .send({
          profileId: testProfile2.id,
          mealId: testMeal2.MealID
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /games/:id/ready', () => {
    it('should mark player as ready', async () => {
      const game = await prisma.gameSession.create({
        data: {
          ...createTestGameSession(testGroup.GroupID, testProfile1.id),
          status: 'waiting',
          participants: {
            create: {
              profileId: testProfile1.id,
              mealId: testMeal1.MealID,
              isReady: false
            }
          }
        }
      });

      const response = await request(app)
        .post(`/games/${game.GameSessionID}/ready`)
        .send({ profileId: testProfile1.id, isReady: true })
        .expect(200);

      expect(response.body.isReady).toBe(true);
    });
  });

  describe('POST /games/:id/start', () => {
    it('should start game when all players ready', async () => {
      const game = await prisma.gameSession.create({
        data: {
          ...createTestGameSession(testGroup.GroupID, testProfile1.id),
          status: 'ready',
          minPlayers: 2,
          participants: {
            create: [
              { profileId: testProfile1.id, mealId: testMeal1.MealID, isReady: true },
              { profileId: testProfile2.id, mealId: testMeal2.MealID, isReady: true }
            ]
          }
        }
      });

      const response = await request(app)
        .post(`/games/${game.GameSessionID}/start`)
        .send({ hostId: testProfile1.id })
        .expect(200);

      expect(response.body.status).toBe('playing');
    });

    it('should not allow non-host to start game', async () => {
      const game = await prisma.gameSession.create({
        data: {
          ...createTestGameSession(testGroup.GroupID, testProfile1.id),
          status: 'ready'
        }
      });

      const response = await request(app)
        .post(`/games/${game.GameSessionID}/start`)
        .send({ hostId: testProfile2.id })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /games/:id/submit', () => {
    it('should submit click count for egg clicker', async () => {
      const game = await prisma.gameSession.create({
        data: {
          ...createTestGameSession(testGroup.GroupID, testProfile1.id),
          gameType: 'egg_clicker',
          status: 'playing',
          participants: {
            create: {
              profileId: testProfile1.id,
              mealId: testMeal1.MealID,
              clickCount: 0
            }
          }
        }
      });

      const response = await request(app)
        .post(`/games/${game.GameSessionID}/submit`)
        .send({ profileId: testProfile1.id, clickCount: 150 })
        .expect(200);

      expect(response.body.clickCount).toBe(150);
    });
  });

  describe('POST /games/:id/cancel', () => {
    it('should allow host to cancel game', async () => {
      const game = await prisma.gameSession.create({
        data: {
          ...createTestGameSession(testGroup.GroupID, testProfile1.id),
          status: 'waiting'
        }
      });

      const response = await request(app)
        .post(`/games/${game.GameSessionID}/cancel`)
        .send({ hostId: testProfile1.id })
        .expect(200);

      expect(response.body.status).toBe('cancelled');
    });

    it('should not allow non-host to cancel', async () => {
      const game = await prisma.gameSession.create({
        data: {
          ...createTestGameSession(testGroup.GroupID, testProfile1.id),
          status: 'waiting'
        }
      });

      const response = await request(app)
        .post(`/games/${game.GameSessionID}/cancel`)
        .send({ hostId: testProfile2.id })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /games/group/:groupId/active', () => {
    it('should return active game for group', async () => {
      await prisma.gameSession.deleteMany({
        where: { groupId: testGroup.GroupID }
      });

      await prisma.gameSession.create({
        data: {
          ...createTestGameSession(testGroup.GroupID, testProfile1.id),
          status: 'waiting'
        }
      });

      const response = await request(app)
        .get(`/games/group/${testGroup.GroupID}/active`)
        .expect(200);

      expect(response.body).toHaveProperty('GameSessionID');
    });

    it('should return null when no active game', async () => {
      await prisma.gameSession.deleteMany({
        where: { groupId: testGroup.GroupID }
      });

      const response = await request(app)
        .get(`/games/group/${testGroup.GroupID}/active`)
        .expect(200);

      expect(response.body).toBeNull();
    });
  });
});
