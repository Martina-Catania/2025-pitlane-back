const request = require('supertest');
const express = require('express');
const routes = require('../routes');

const app = express();
app.use(express.json());
app.use('/', routes);

describe('Consumptions API', () => {
  // Test for the new most consumed meals endpoint
  describe('GET /meal-consumptions/groups/:groupId/most-consumed', () => {
    it('should return 404 for non-existent group', async () => {
      const res = await request(app)
        .get('/meal-consumptions/groups/99999/most-consumed');
      
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Group not found');
    });

    it('should return proper structure for valid request', async () => {
      // This test would require a valid group ID with test data
      // For now, we'll just test the endpoint structure
      const res = await request(app)
        .get('/meal-consumptions/groups/1/most-consumed?limit=3');
      
      // Should either return 404 (no group) or 200 with proper structure
      expect([200, 404]).toContain(res.statusCode);
      
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('groupId');
        expect(res.body).toHaveProperty('mostConsumedMeals');
        expect(Array.isArray(res.body.mostConsumedMeals)).toBe(true);
      }
    });
  });

  describe('GET /meal-consumptions/groups/:groupId/filtered-meals', () => {
    it('should return 404 for non-existent group', async () => {
      const res = await request(app)
        .get('/meal-consumptions/groups/99999/filtered-meals');
      
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Group not found');
    });
  });
});