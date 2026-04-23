const request = require('supertest');
const { app } = require('../index');
const { cleanDatabase, prisma } = require('./setup/testDatabase');
const { createTestProfile, createTestGroup, createTestMeal } = require('./helpers/testHelpers');

describe('Voting API', () => {
  let testGroup, testProfile1, testProfile2, testMeal1, testMeal2;

  beforeAll(async () => {
    await cleanDatabase();
    
    // Create test profiles
    testProfile1 = await prisma.profile.create({
      data: createTestProfile({ username: 'voter1' })
    });
    
    testProfile2 = await prisma.profile.create({
      data: createTestProfile({ username: 'voter2' })
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
      data: createTestMeal(testProfile1.id, { name: 'Pizza' })
    });
    
    testMeal2 = await prisma.meal.create({
      data: createTestMeal(testProfile2.id, { name: 'Pasta' })
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('POST /voting/start', () => {
    it('should start a new voting session', async () => {
      const votingData = {
        groupId: testGroup.GroupID,
        initiatorId: testProfile1.id,
        duration: 300
      };

      const response = await request(app)
        .post('/voting/start')
        .send(votingData)
        .expect(201);

      expect(response.body).toHaveProperty('VotingSessionID');
      expect(response.body.groupId).toBe(testGroup.GroupID);
      expect(response.body.status).toBe('proposal_phase');
    });

    it('should not allow multiple active voting sessions', async () => {
      // Clean up any existing sessions first
      await prisma.votingSession.deleteMany({
        where: { groupId: testGroup.GroupID }
      });

      // Start first session
      await request(app)
        .post('/voting/start')
        .send({
          groupId: testGroup.GroupID,
          initiatorId: testProfile1.id
        })
        .expect(201);

      // Try to start second session
      const response = await request(app)
        .post('/voting/start')
        .send({
          groupId: testGroup.GroupID,
          initiatorId: testProfile1.id
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /voting/:sessionId/propose', () => {
    it('should allow member to propose a meal', async () => {
      // Create a new voting session
      const session = await prisma.votingSession.create({
        data: {
          groupId: testGroup.GroupID,
          initiatorId: testProfile1.id,
          status: 'proposal_phase',
          proposalEndsAt: new Date(Date.now() + 300000)
        }
      });

      const proposalData = {
        profileId: testProfile1.id,
        mealId: testMeal1.MealID
      };

      const response = await request(app)
        .post(`/voting/${session.VotingSessionID}/propose`)
        .send(proposalData)
        .expect(201);

      expect(response.body).toHaveProperty('MealProposalID');
      expect(response.body.mealId).toBe(testMeal1.MealID);
    });

    it('should not allow proposals in voting phase', async () => {
      const session = await prisma.votingSession.create({
        data: {
          groupId: testGroup.GroupID,
          initiatorId: testProfile1.id,
          status: 'voting_phase',
          proposalEndsAt: new Date(Date.now() - 1000),
          votingEndsAt: new Date(Date.now() + 300000)
        }
      });

      const response = await request(app)
        .post(`/voting/${session.VotingSessionID}/propose`)
        .send({
          profileId: testProfile1.id,
          mealId: testMeal1.MealID
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /voting/:sessionId/vote', () => {
    it('should allow member to cast a vote', async () => {
      // Create session with proposed meals
      const session = await prisma.votingSession.create({
        data: {
          groupId: testGroup.GroupID,
          initiatorId: testProfile1.id,
          status: 'voting_phase',
          proposalEndsAt: new Date(Date.now() - 1000),
          votingEndsAt: new Date(Date.now() + 300000),
          proposals: {
            create: {
              proposedById: testProfile1.id,
              mealId: testMeal1.MealID
            }
          }
        },
        include: { proposals: true }
      });

      const voteData = {
        voterId: testProfile2.id,
        mealProposalId: session.proposals[0].MealProposalID
      };

      const response = await request(app)
        .post(`/voting/${session.VotingSessionID}/vote`)
        .send(voteData)
        .expect(201);

      expect(response.body).toHaveProperty('VoteID');
    });
  });

  describe('POST /voting/:sessionId/finalize', () => {
    it('should finalize voting and create meal consumptions', async () => {
      // Create complete voting scenario
      const session = await prisma.votingSession.create({
        data: {
          groupId: testGroup.GroupID,
          initiatorId: testProfile1.id,
          status: 'voting_phase',
          proposalEndsAt: new Date(Date.now() - 1000),
          votingEndsAt: new Date(Date.now() + 300000),
          proposals: {
            create: {
              proposedById: testProfile1.id,
              mealId: testMeal1.MealID
            }
          }
        },
        include: { proposals: true }
      });

      // Add some votes
      await prisma.vote.create({
        data: {
          votingSessionId: session.VotingSessionID,
          voterId: testProfile1.id,
          mealProposalId: session.proposals[0].MealProposalID
        }
      });

      const response = await request(app)
        .post(`/voting/${session.VotingSessionID}/finalize`)
        .send({ initiatorId: testProfile1.id })
        .expect(200);

      expect(response.body).toHaveProperty('session');
      expect(response.body.session).toHaveProperty('winnerMeal');
    });
  });

  describe('GET /voting/group/:groupId', () => {
    it('should return active voting session for group', async () => {
      await prisma.votingSession.deleteMany({
        where: { groupId: testGroup.GroupID }
      });

      await prisma.votingSession.create({
        data: {
          groupId: testGroup.GroupID,
          initiatorId: testProfile1.id,
          status: 'proposal_phase',
          proposalEndsAt: new Date(Date.now() + 300000)
        }
      });

      const response = await request(app)
        .get(`/voting/group/${testGroup.GroupID}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('VotingSessionID');
      expect(response.body[0].groupId).toBe(testGroup.GroupID);
    });
  });

  describe('POST /voting/:sessionId/cancel', () => {
    it('should allow initiator to cancel voting session', async () => {
      const session = await prisma.votingSession.create({
        data: {
          groupId: testGroup.GroupID,
          initiatorId: testProfile1.id,
          status: 'proposal_phase',
          proposalEndsAt: new Date(Date.now() + 300000)
        }
      });

      const response = await request(app)
        .post(`/voting/${session.VotingSessionID}/cancel`)
        .send({ initiatorId: testProfile1.id })
        .expect(200);

      expect(response.body.status).toBe('cancelled');
    });
  });
});
