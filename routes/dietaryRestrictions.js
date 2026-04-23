const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /dietary-restrictions - get all dietary restrictions
router.get('/', async (req, res) => {
  try {
    const restrictions = await prisma.dietaryRestriction.findMany();
    res.json(restrictions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /dietary-restrictions/excluding-for-everyone - get all restrictions except "For Everyone" (id = 0)
router.get('/excluding-for-everyone', async (req, res) => {
  try {
    const restrictions = await prisma.dietaryRestriction.findMany({
      where: {
        DietaryRestrictionID: {
          not: 0
        }
      }
    });
    res.json(restrictions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /dietary-restrictions - create a new dietary restriction
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const restriction = await prisma.dietaryRestriction.create({ data: { name } });
    res.status(201).json(restriction);
  } catch (err) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Dietary restriction with this name already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;

// DELETE /dietary-restrictions/:id - delete a dietary restriction by id
router.delete('/:id', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const deleted = await prisma.dietaryRestriction.delete({ where: { DietaryRestrictionID: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Dietary restriction not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});
