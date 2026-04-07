const express = require('express');
const router = express.Router();
const foodsRouter = require('./foods');
const profilesRouter = require('./profile');
const mealsRouter = require('./meals');
const groupsRouter = require('./groups');
const mealConsumptionsRouter = require('./mealConsumptions');
const votingRouter = require('./voting');
const votingHistoryRouter = require('./votingHistory');
const badgesRouter = require('./badges');
const gamesRouter = require('./games');
const gameHistoryRouter = require('./gameHistory');
const plannedMealsRouter = require('./plannedMeals');

const preferencesRouter = require('./preferences');
const dietaryRestrictionsRouter = require('./dietaryRestrictions');

router.use('/foods', foodsRouter);
router.use('/profile', profilesRouter);
router.use('/meals', mealsRouter);
router.use('/groups', groupsRouter);
router.use('/meal-consumptions', mealConsumptionsRouter);
router.use('/voting', votingRouter);
router.use('/voting/history', votingHistoryRouter);
router.use('/badges', badgesRouter);
router.use('/games', gamesRouter);
router.use('/game-history', gameHistoryRouter);
router.use('/planned-meals', plannedMealsRouter);

router.use('/preferences', preferencesRouter);
router.use('/dietary-restrictions', dietaryRestrictionsRouter);

module.exports = router;
