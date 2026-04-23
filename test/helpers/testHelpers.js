const request = require('supertest');
const { app } = require('../../index');
const { cleanDatabase } = require('../setup/testDatabase');
const crypto = require('crypto');

/**
 * Generate a valid UUID v4
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Helper function to make authenticated requests
 * @param {string} token - Auth token
 * @returns {object} Supertest agent with auth header
 */
function authenticatedRequest(token = 'test-token') {
  return {
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    patch: (url) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  };
}

/**
 * Create test profile data
 */
function createTestProfile(overrides = {}) {
  return {
    id: generateUUID(),
    username: `testuser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    calorie_goal: 2000,
    role: 'user',
    ...overrides
  };
}

/**
 * Create test food data
 */
function createTestFood(overrides = {}) {
  return {
    name: `Test Food ${Date.now()}`,
    kCal: 100,
    svgLink: '/test-food.svg',
    isActive: true,
    ...overrides
  };
}

/**
 * Create test meal data
 */
function createTestMeal(profileId, overrides = {}) {
  return {
    name: `Test Meal ${Date.now()}`,
    description: 'Test meal description',
    profileId,
    ...overrides
  };
}

/**
 * Create test group data
 */
function createTestGroup(creatorId, overrides = {}) {
  return {
    name: `Test Group ${Date.now()}`,
    description: 'Test group description',
    createdBy: creatorId,
    ...overrides
  };
}

/**
 * Create test game session data
 */
function createTestGameSession(groupId, hostId, overrides = {}) {
  return {
    groupId,
    hostId,
    gameType: 'egg_clicker',
    duration: 30,
    minPlayers: 2,
    ...overrides
  };
}

/**
 * Clean up database after tests
 */
async function cleanupAfterTests() {
  await cleanDatabase();
}

/**
 * Wait for a condition to be true
 */
async function waitFor(condition, timeout = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timeout waiting for condition');
}

module.exports = {
  authenticatedRequest,
  createTestProfile,
  createTestFood,
  createTestMeal,
  createTestGroup,
  createTestGameSession,
  cleanupAfterTests,
  waitFor,
  generateUUID
};
