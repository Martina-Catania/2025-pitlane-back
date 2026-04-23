const request = require('supertest');
const express = require('express');
const routes = require('../routes');

const app = express();
app.use(express.json());
app.use('/', routes);

describe('Foods API', () => {
  it('GET /foods should return an array', async () => {
    const res = await request(app).get('/foods');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // it('POST /foods should create a food', async () => {
  //   const res = await request(app)
  //     .post('/foods')
  //     .send({
  //       name: 'Pizza Test',
  //       svgLink: '/images/pizza.svg',
  //       preferences: [],
  //       dietaryRestrictions: []
  //     });
  //   expect(res.statusCode).toBe(201);
  //   expect(res.body).toHaveProperty('FoodID');
  //   expect(res.body).toHaveProperty('name', 'Pizza Test');
  //   // Cleanup
  //   await request(app).delete(`/foods/${res.body.FoodID}`);
  // });

  ////////FALTA DEFINIR SI EL NOMBRE DE LA COMIDA ES UNICO O NO////////

  // it('POST /foods should return 409 if unique value already exists', async () => {
  //   await request(app)
  //     .post('/foods')
  //     .send({
  //       name: 'UniqueFood',
  //       svgLink: '/images/uniquefood.svg',
  //       preferences: [],
  //       dietaryRestrictions: []
  //     });
  //   const res = await request(app)
  //     .post('/foods')
  //     .send({
  //       name: 'UniqueFood',
  //       svgLink: '/images/uniquefood.svg',
  //       preferences: [],
  //       dietaryRestrictions: []
  //     });
  //   // Accept 409 if name is unique, else 201
  //   expect([409]).toContain(res.statusCode);
  //   await request(app).delete('/foods/name/UniqueFood');
  // });

  it('POST /foods/by-preference-and-restriction with body should return an array', async () => {
    const res = await request(app)
      .post('/foods/by-preference-and-restriction')
      .send({ preferenceId: 1, restrictionId: 1 });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /foods/recommended/1 should return an array or 404', async () => {
    // Create a profile to ensure userId 1 exists for testing
    const res = await request(app).get('/foods/recommended/98c933a7-7e1b-47aa-93ca-d1e05eac97d8');
    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });
});
