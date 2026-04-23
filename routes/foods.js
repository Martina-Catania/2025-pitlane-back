
const express = require('express');
const router = express.Router();
const foodsController = require('../controllers/foodsLib');

// GET /foods/for-user?restrictions=1,2,3 - get foods filtered by user dietary restrictions
router.get('/for-user', async (req, res) => {
    try {
        const { restrictions } = req.query;
        const userRestrictions = restrictions ? restrictions.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
        const foods = await foodsController.getFoodsForUser(userRestrictions);
        res.json(foods);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /foods/user/:profileId - get foods created by a specific user
router.get('/user/:profileId', async (req, res) => {
    try {
        const foods = await foodsController.getFoodsByProfileId(req.params.profileId);
        res.json(foods);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /foods/by-preference/:preferenceId
router.get('/by-preference/:preferenceId', async (req, res) => {
    try {
        const foods = await foodsController.getFoodsByPreference(req.params.preferenceId);
        res.json(foods);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /foods/by-restriction/:restrictionId
router.get('/by-restriction/:restrictionId', async (req, res) => {
    try {
        const foods = await foodsController.getFoodsByRestriction(req.params.restrictionId);
        res.json(foods);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /foods/by-preference-and-restriction
router.post('/by-preference-and-restriction', async (req, res) => {
    try {
        const { preferenceId, restrictionId } = req.body;
        const foods = await foodsController.getFoodsByPreferenceAndRestriction(preferenceId, restrictionId);
        res.json(foods);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /foods/recommended/:profileId
router.get('/recommended/:profileId', async (req, res) => {
    try {
        const foods = await foodsController.getRecommendedFoodsForProfile(req.params.profileId);
        if (foods === null) return res.status(404).json({ error: 'Profile not found' });
        res.json(foods);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

// DELETE /foods/:id - delete a food by id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await foodsController.deleteFood(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Food not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /foods/:id - get food by id
router.get('/:id', async (req, res) => {
    try {
        const food = await foodsController.getFoodById(req.params.id);
        if (!food) return res.status(404).json({ error: 'Food not found' });
        res.json(food);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /foods/:id - update a food by id
router.put('/:id', async (req, res) => {
    try {
        const { name, svgLink, kCal, preferences, dietaryRestrictions } = req.body;
        const updatedFood = await foodsController.updateFood(req.params.id, { name, svgLink, kCal, preferences, dietaryRestrictions });
        if (!updatedFood) return res.status(404).json({ error: 'Food not found' });
        res.json(updatedFood);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /foods - get all foods
router.get('/', async (req, res) => {
    try {
        const foods = await foodsController.getAllFoods();
        res.json(foods);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /foods - create a new food
router.post('/', async (req, res) => {
    try {
        const { name, svgLink, kCal, preferences, dietaryRestrictions, hasNoRestrictions, profileId } = req.body;
        
        if (!profileId) {
            return res.status(400).json({ error: 'profileId is required' });
        }

        const food = await foodsController.createFood({ name, svgLink, kCal, preferences, dietaryRestrictions, hasNoRestrictions, profileId });
        res.status(201).json(food);
    } catch (err) {
        if (err.code === 'P2002') {
            res.status(409).json({ error: 'Food with this unique value already exists' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});