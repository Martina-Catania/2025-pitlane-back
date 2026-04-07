// routes/mealConsumptions.js
const express = require('express');
const router = express.Router();
const mealConsumptionsLib = require('../controllers/mealConsumptionsLib');

/**
 * GET /meal-consumptions
 * Get all meal consumptions with optional filters
 */
router.get('/', async (req, res) => {
    try {
        const { profileId, groupId, source, startDate, endDate } = req.query;
        
        const filters = {};
        if (profileId) filters.profileId = profileId;
        if (groupId) filters.groupId = groupId;
        if (source) filters.source = source;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
        
        const consumptions = await mealConsumptionsLib.getMealConsumptions(filters);
        
        res.json(consumptions);
    } catch (error) {
        console.error('Error fetching meal consumptions:', error);
        res.status(500).json({ 
            error: 'Failed to fetch meal consumptions',
            details: error.message 
        });
    }
});

/**
 * GET /meal-consumptions/user/:profileId
 * Get meal consumptions for a specific user
 */
router.get('/user/:profileId', async (req, res) => {
    try {
        const { profileId } = req.params;
        const { source, startDate, endDate, individualOnly } = req.query;
        
        const filters = { 
            profileId
        };
        if (source) filters.source = source;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
        if (individualOnly === 'true') filters.individualOnly = true;
        
        const consumptions = await mealConsumptionsLib.getMealConsumptions(filters);
        
        res.json(consumptions);
    } catch (error) {
        console.error('Error fetching user meal consumptions:', error);
        res.status(500).json({ 
            error: 'Failed to fetch user meal consumptions',
            details: error.message 
        });
    }
});

/**
 * GET /meal-consumptions/:id
 * Get a specific meal consumption by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const consumption = await mealConsumptionsLib.getMealConsumptionById(id);
        
        if (!consumption) {
            return res.status(404).json({ error: 'Meal consumption not found' });
        }
        
        res.json(consumption);
    } catch (error) {
        console.error('Error fetching meal consumption:', error);
        res.status(500).json({ 
            error: 'Failed to fetch meal consumption',
            details: error.message 
        });
    }
});

/**
 * POST /meal-consumptions/individual
 * Create an individual meal consumption record
 */
router.post('/individual', async (req, res) => {
    try {
        const { name, description, mealId, profileId, consumedAt } = req.body;
        
        console.log('[POST /meal-consumptions/individual] Received request:', {
            name,
            profileId,
            mealId,
            isFullMealOnly: true
        });
        
        if (!profileId || !mealId) {
            return res.status(400).json({ 
                error: 'ProfileId and mealId are required' 
            });
        }
        
        const consumptionData = { name, description, mealId, consumedAt };
        const newConsumption = await mealConsumptionsLib.createIndividualMealConsumption(
            consumptionData, 
            profileId
        );
        
        res.status(201).json(newConsumption);
    } catch (error) {
        console.error('Error creating individual meal consumption:', error);
        
        if (error.message.includes('Meal') && error.message.includes('not found')) {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to create individual meal consumption',
            details: error.message 
        });
    }
});

/**
 * POST /meal-consumptions/group
 * Create a group meal consumption record
 */
router.post('/group', async (req, res) => {
    try {
        const { name, description, mealId, profileId, groupId, consumedAt } = req.body;
        
        console.log('[POST /meal-consumptions/group] Received request:', {
            name,
            profileId,
            groupId,
            mealId,
            isFullMealOnly: true
        });
        
        if (!profileId || !groupId || !mealId) {
            return res.status(400).json({ 
                error: 'ProfileId, groupId, and mealId are required' 
            });
        }
        
        const consumptionData = { name, description, mealId, groupId, consumedAt };
        const newConsumption = await mealConsumptionsLib.createGroupMealConsumption(
            consumptionData, 
            profileId
        );
        
        res.status(201).json(newConsumption);
    } catch (error) {
        console.error('Error creating group meal consumption:', error);
        
        if (error.message.includes('Group') || 
            error.message.includes('Meal') ||
            error.message.includes('member')) {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to create group meal consumption',
            details: error.message 
        });
    }
});

/**
 * PUT /meal-consumptions/:id
 * Update a meal consumption record
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, profileId, consumedAt } = req.body;
        
        if (!profileId) {
            return res.status(400).json({ 
                error: 'Profile ID is required' 
            });
        }
        
        const consumptionData = { name, description, consumedAt };
        const updatedConsumption = await mealConsumptionsLib.updateMealConsumption(
            id, 
            consumptionData, 
            profileId
        );
        
        res.json(updatedConsumption);
    } catch (error) {
        console.error('Error updating meal consumption:', error);
        
        if (error.message === 'Consumption not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message === 'Unauthorized to update this consumption') {
            return res.status(403).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to update meal consumption',
            details: error.message 
        });
    }
});

/**
 * DELETE /meal-consumptions/:id
 * Delete a meal consumption record (soft delete)
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { profileId } = req.body;
        
        if (!profileId) {
            return res.status(400).json({ 
                error: 'Profile ID is required' 
            });
        }
        
        await mealConsumptionsLib.deleteMealConsumption(id, profileId);
        
        res.json({ message: 'Meal consumption deleted successfully' });
    } catch (error) {
        console.error('Error deleting meal consumption:', error);
        
        if (error.message === 'Consumption not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message === 'Unauthorized to delete this consumption') {
            return res.status(403).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to delete meal consumption',
            details: error.message 
        });
    }
});

/**
 * GET /meal-consumptions/stats
 * Get meal consumption statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const { profileId, groupId, source, startDate, endDate } = req.query;
        
        const filters = {};
        if (profileId) filters.profileId = profileId;
        if (groupId) filters.groupId = groupId;
        if (source) filters.source = source;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
        
        const stats = await mealConsumptionsLib.getMealConsumptionStats(filters);
        
        res.json(stats);
    } catch (error) {
        console.error('Error fetching meal consumption stats:', error);
        res.status(500).json({ 
            error: 'Failed to fetch meal consumption stats',
            details: error.message 
        });
    }
});

/**
 * GET /meal-consumptions/groups/:groupId/filtered-meals
 * Get meals filtered by group dietary restrictions
 */
router.get('/groups/:groupId/filtered-meals', async (req, res) => {
    try {
        const { groupId } = req.params;
        const filteredMeals = await mealConsumptionsLib.getGroupFilteredMeals(groupId);
        
        res.json(filteredMeals);
    } catch (error) {
        console.error('Error fetching group filtered meals:', error);
        
        if (error.message === 'Group not found') {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to fetch group filtered meals',
            details: error.message 
        });
    }
});

/**
 * GET /meal-consumptions/groups/:groupId/most-consumed
 * Get the most consumed meals by a group
 */
router.get('/groups/:groupId/most-consumed', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { limit = 3 } = req.query;
        
        const mostConsumedMeals = await mealConsumptionsLib.getGroupMostConsumedMeals(groupId, parseInt(limit));
        
        res.json(mostConsumedMeals);
    } catch (error) {
        console.error('Error fetching group most consumed meals:', error);
        
        if (error.message === 'Group not found') {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to fetch group most consumed meals',
            details: error.message 
        });
    }
});

module.exports = router;
