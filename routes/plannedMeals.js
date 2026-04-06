const express = require('express');
const router = express.Router();
const plannedMealsLib = require('../controllers/plannedMealsLib');
const BadgesLibrary = require('../controllers/badgesLib');

/**
 * POST /planned-meals
 * Create a planned meal for user or group.
 */
router.post('/', async (req, res) => {
    try {
        const { profileId, mealId, groupId, plannedFor, resolutionNote } = req.body;

        if (!profileId || !mealId || !plannedFor) {
            return res.status(400).json({ error: 'profileId, mealId and plannedFor are required' });
        }

        const plannedMeal = await plannedMealsLib.createPlannedMeal({
            profileId,
            mealId,
            groupId,
            plannedFor,
            resolutionNote
        });

        const response = {
            ...plannedMeal,
            badgeNotifications: []
        };

        try {
            const badgeResult = await BadgesLibrary.checkAndAwardBadges(profileId, 'planned_meal_created');
            if (badgeResult.success && badgeResult.badgeNotifications && badgeResult.badgeNotifications.length > 0) {
                response.badgeNotifications = badgeResult.badgeNotifications;
            }
        } catch (badgeError) {
            console.error('Error awarding planned meal creation badge:', badgeError);
            // Do not fail planned meal creation if badge awarding fails
        }

        res.status(201).json(response);
    } catch (error) {
        console.error('Error creating planned meal:', error);

        if (
            error.message.includes('required') ||
            error.message.includes('Invalid') ||
            error.message.includes('future') ||
            error.message.includes('not found') ||
            error.message.includes('member')
        ) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to create planned meal', details: error.message });
    }
});

/**
 * GET /planned-meals
 * List planned meals with optional filters.
 */
router.get('/', async (req, res) => {
    try {
        const {
            profileId,
            groupId,
            status,
            startDate,
            endDate,
            onlyFuture,
            onlyOverdue,
            includeInactive
        } = req.query;

        const plannedMeals = await plannedMealsLib.getPlannedMeals({
            profileId,
            groupId,
            status,
            startDate,
            endDate,
            onlyFuture: onlyFuture === 'true',
            onlyOverdue: onlyOverdue === 'true',
            includeInactive: includeInactive === 'true'
        });

        res.json(plannedMeals);
    } catch (error) {
        console.error('Error fetching planned meals:', error);
        res.status(500).json({ error: 'Failed to fetch planned meals', details: error.message });
    }
});

/**
 * GET /planned-meals/overdue
 * Get overdue planned meals for modal prompts.
 */
router.get('/overdue', async (req, res) => {
    try {
        const { profileId, groupId } = req.query;

        if (!profileId && !groupId) {
            return res.status(400).json({ error: 'profileId or groupId is required' });
        }

        const plannedMeals = await plannedMealsLib.getPlannedMeals({
            profileId,
            groupId,
            onlyOverdue: true
        });

        res.json(plannedMeals);
    } catch (error) {
        console.error('Error fetching overdue planned meals:', error);
        res.status(500).json({ error: 'Failed to fetch overdue planned meals', details: error.message });
    }
});

/**
 * GET /planned-meals/shopping/list
 * Get grouped shopping list derived from future planned meals.
 */
router.get('/shopping/list', async (req, res) => {
    try {
        const { profileId, groupId, startDate, endDate, includePurchased } = req.query;

        if (!profileId && !groupId) {
            return res.status(400).json({ error: 'profileId or groupId is required' });
        }

        const list = await plannedMealsLib.getAggregatedShoppingList({
            profileId,
            groupId,
            startDate,
            endDate,
            includePurchased: includePurchased !== 'false'
        });

        res.json(list);
    } catch (error) {
        console.error('Error fetching shopping list:', error);
        res.status(500).json({ error: 'Failed to fetch shopping list', details: error.message });
    }
});

/**
 * PUT /planned-meals/shopping/status
 * Mark grouped shopping items as purchased/unpurchased.
 */
router.put('/shopping/status', async (req, res) => {
    try {
        const { foodId, isPurchased, profileId, groupId, startDate, endDate } = req.body;

        const result = await plannedMealsLib.updateShoppingItemStatus({
            foodId,
            isPurchased,
            profileId,
            groupId,
            startDate,
            endDate
        });

        res.json(result);
    } catch (error) {
        console.error('Error updating shopping item status:', error);
        if (error.message.includes('required') || error.message.includes('member')) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to update shopping item status', details: error.message });
    }
});

/**
 * GET /planned-meals/:id
 * Get planned meal details.
 */
router.get('/:id', async (req, res) => {
    try {
        const plannedMeal = await plannedMealsLib.getPlannedMealById(req.params.id);
        if (!plannedMeal) {
            return res.status(404).json({ error: 'Planned meal not found' });
        }

        res.json(plannedMeal);
    } catch (error) {
        console.error('Error fetching planned meal:', error);
        res.status(500).json({ error: 'Failed to fetch planned meal', details: error.message });
    }
});

/**
 * PUT /planned-meals/:id/resolve
 * Resolve overdue planned meal: consumed, rescheduled, or cancelled.
 */
router.put('/:id/resolve', async (req, res) => {
    try {
        const { requesterId, wasConsumed, action, note, newPlannedFor, portions } = req.body;

        if (!requesterId) {
            return res.status(400).json({ error: 'requesterId is required' });
        }

        const result = await plannedMealsLib.resolvePlannedMeal(req.params.id, {
            wasConsumed,
            action,
            note,
            newPlannedFor,
            portions
        }, requesterId);

        res.json(result);
    } catch (error) {
        console.error('Error resolving planned meal:', error);

        if (
            error.message.includes('required') ||
            error.message.includes('Unauthorized') ||
            error.message.includes('future') ||
            error.message.includes('status') ||
            error.message.includes('not found') ||
            error.message.includes('member')
        ) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to resolve planned meal', details: error.message });
    }
});

module.exports = router;
