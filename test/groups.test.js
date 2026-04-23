const request = require('supertest');
const { app } = require('../index');
const { cleanDatabase, prisma } = require('./setup/testDatabase');
const { createTestProfile, createTestGroup } = require('./helpers/testHelpers');

describe('Groups API', () => {
  let testProfile1, testProfile2;

  beforeAll(async () => {
    await cleanDatabase();
    
    // Create test profiles
    testProfile1 = await prisma.profile.create({
      data: createTestProfile({ username: 'groupuser1' })
    });
    
    testProfile2 = await prisma.profile.create({
      data: createTestProfile({ username: 'groupuser2' })
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('POST /groups', () => {
    it('should create a new group', async () => {
      const groupData = {
        name: 'Test Group',
        description: 'A test group',
        createdBy: testProfile1.id
      };

      const response = await request(app)
        .post('/groups')
        .send(groupData)
        .expect(201);

      expect(response.body).toHaveProperty('GroupID');
      expect(response.body.name).toBe(groupData.name);
      expect(response.body.createdBy).toBe(testProfile1.id);
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/groups')
        .send({ name: 'Incomplete Group' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /groups', () => {
    it('should return all active groups', async () => {
      const response = await request(app)
        .get('/groups')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /groups/user/:profileId', () => {
    it('should return groups for a specific user', async () => {
      // Create a group with the user
      await prisma.group.create({
        data: {
          ...createTestGroup(testProfile1.id),
          members: {
            create: {
              profileId: testProfile1.id,
              role: 'admin'
            }
          }
        }
      });

      const response = await request(app)
        .get(`/groups/user/${testProfile1.id}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /groups/:id', () => {
    it('should return a specific group by ID', async () => {
      const group = await prisma.group.create({
        data: createTestGroup(testProfile1.id)
      });

      const response = await request(app)
        .get(`/groups/${group.GroupID}`)
        .expect(200);

      expect(response.body.GroupID).toBe(group.GroupID);
    });

    it('should return 404 for non-existent group', async () => {
      const response = await request(app)
        .get('/groups/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /groups/:id', () => {
    it('should update a group', async () => {
      const group = await prisma.group.create({
        data: createTestGroup(testProfile1.id, { name: 'Original Group Name' })
      });

      const updateData = {
        name: 'Updated Group Name',
        description: 'Updated description',
        userId: testProfile1.id
      };

      const response = await request(app)
        .put(`/groups/${group.GroupID}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('Updated Group Name');
    });
  });

  describe('DELETE /groups/:id', () => {
    it('should soft delete a group', async () => {
      const group = await prisma.group.create({
        data: createTestGroup(testProfile1.id)
      });

      await request(app)
        .delete(`/groups/${group.GroupID}`)
        .send({ userId: testProfile1.id })
        .expect(200);

      // Verify group is soft deleted
      const deletedGroup = await prisma.group.findUnique({
        where: { GroupID: group.GroupID }
      });
      expect(deletedGroup.isActive).toBe(false);
    });
  });

  describe('POST /groups/:id/members', () => {
    it('should add a member to a group', async () => {
      const group = await prisma.group.create({
        data: {
          ...createTestGroup(testProfile1.id),
          members: {
            create: {
              profileId: testProfile1.id,
              role: 'admin'
            }
          }
        }
      });

      const memberData = {
        profileId: testProfile2.id,
        requesterId: testProfile1.id
      };

      const response = await request(app)
        .post(`/groups/${group.GroupID}/members`)
        .send(memberData)
        .expect(201);

      expect(response.body).toHaveProperty('GroupMemberID');
      expect(response.body.profileId).toBe(testProfile2.id);
    });
  });

  describe('DELETE /groups/:id/members/:profileId', () => {
    it('should remove a member from a group', async () => {
      const group = await prisma.group.create({
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

      await request(app)
        .delete(`/groups/${group.GroupID}/members/${testProfile2.id}`)
        .send({ requesterId: testProfile1.id })
        .expect(200);

      // Verify member is soft deleted
      const member = await prisma.groupMember.findFirst({
        where: {
          groupId: group.GroupID,
          profileId: testProfile2.id
        }
      });
      expect(member.isActive).toBe(false);
    });
  });
});
