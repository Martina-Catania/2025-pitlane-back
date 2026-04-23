const express = require('express');
const router = express.Router();
const mealsLib = require('../controllers/mealsLib');
const BadgesLibrary = require('../controllers/badgesLib');

// GET /meals/all - Get all meals from all users with profile information
router.get('/all', async (req, res) => {
    try {
        const meals = await mealsLib.getAllMealsWithProfiles();
        res.json(meals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /meals/user - Get all meals created by a specific user (using profileId from query)
router.get('/user', async (req, res) => {
    try {
        const { profileId } = req.query;
        
        if (!profileId) {
            return res.status(400).json({ error: 'profileId query parameter is required' });
        }

        // profileId should be a UUID string, no conversion needed
        if (typeof profileId !== 'string' || profileId.trim() === '') {
            return res.status(400).json({ error: 'Invalid profileId format' });
        }
        
        const meals = await mealsLib.getMeals(profileId);
        
        res.json(meals || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /meals - Get all meals or filter by profile
router.get('/', async (req, res) => {
    try {
        const { profileId } = req.query;
        const meals = await mealsLib.getMeals(profileId);
        res.json(meals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /meals/recommended/:profileId - Get recommended meals for a profile
router.get('/recommended/:profileId', async (req, res) => {
    try {
        const meals = await mealsLib.getRecommendedMealsForProfile(req.params.profileId);
        if (meals === null) return res.status(404).json({ error: 'Profile not found' });
        res.json(meals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /meals/:id - Get a specific meal by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const meal = await mealsLib.getMealById(parseInt(id));
        if (!meal) {
            return res.status(404).json({ error: 'Meal not found' });
        }
        res.json(meal);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /meals - Create a new meal
router.post('/', async (req, res) => {
    try {
        console.log('=== MEAL CREATION DEBUG ===');
        console.log('Full request body:', JSON.stringify(req.body, null, 2));
        
        const { name, description, profileId, foodIds, mealFoods } = req.body;
        
        console.log('Extracted values:');
        console.log('- name:', name);
        console.log('- profileId:', profileId);
        console.log('- foodIds:', foodIds);
        console.log('- mealFoods:', mealFoods);
        
        // Support both new format (mealFoods with quantities) and old format (foodIds)
        const mealData = mealFoods || foodIds;
        
        console.log('Using mealData:', mealData);
        
        if (!name || !profileId || !mealData || !Array.isArray(mealData) || mealData.length === 0) {
            console.log('Validation failed:');
            console.log('- name present:', !!name);
            console.log('- profileId present:', !!profileId);
            console.log('- mealData present:', !!mealData);
            console.log('- mealData is array:', Array.isArray(mealData));
            console.log('- mealData length:', mealData?.length);
            
            return res.status(400).json({ 
                error: 'Name, profileId, and at least one food item are required. Use either "mealFoods" (with quantities) or "foodIds" (legacy format).' 
            });
        }

        console.log('Creating meal with data:', mealData);
        const meal = await mealsLib.createMeal(name, description, profileId, mealData);
        console.log('Meal created successfully:', meal.MealID);
        
        // Create response object with meal data
        const response = {
            ...meal,
            badgeNotifications: []
        };
        
        // Award badge for creating a meal
        try {
            const badgeResult = await BadgesLibrary.checkAndAwardBadges(profileId, 'meal_created');
            console.log('[Meals] Badge check result:', JSON.stringify(badgeResult, null, 2));
            if (badgeResult.success && badgeResult.badgeNotifications && badgeResult.badgeNotifications.length > 0) {
                console.log(`User ${profileId} earned ${badgeResult.badgeNotifications.length} badge achievement(s) for creating a meal!`);
                response.badgeNotifications = badgeResult.badgeNotifications;
            } else {
                console.log('[Meals] No badge notifications to add');
            }
        } catch (badgeError) {
            console.error('Error awarding meal creation badge:', badgeError);
            // Don't fail the meal creation if badge awarding fails
        }
        
        console.log('[Meals] Final response:', { mealId: response.MealID, hasBadgeNotifications: response.badgeNotifications?.length > 0 });
        res.status(201).json(response);
    } catch (error) {
        console.error('Error in meal creation:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /meals/:id - Update a meal
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, foodIds, mealFoods } = req.body;
        
        // Use mealFoods if provided (new format with quantities), otherwise fallback to foodIds
        const updateData = mealFoods || foodIds;
        
        const meal = await mealsLib.updateMeal(parseInt(id), name, description, updateData);
        if (!meal) {
            return res.status(404).json({ error: 'Meal not found' });
        }
        res.json(meal);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /meals/:id - Delete a meal
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await mealsLib.deleteMeal(parseInt(id));
        if (!deleted) {
            return res.status(404).json({ error: 'Meal not found' });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;