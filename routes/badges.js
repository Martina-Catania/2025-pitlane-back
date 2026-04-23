const express = require('express');
const BadgesLibrary = require('../controllers/badgesLib');
const { prisma } = require('../config/prismaClient');
const { toCamelCaseDeep } = require('../utils/caseTransform');
const router = express.Router();

function sendLibraryResult(res, result, statusCode = 200) {
  if (!result.success) {
    return res.status(500).json({ error: result.error });
  }

  return res.status(statusCode).json(toCamelCaseDeep(result.data));
}

/**
 * @route GET /badges
 * @desc Get all available badges
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const result = await BadgesLibrary.getAllBadges();

    sendLibraryResult(res, result);
  } catch (error) {
    console.error('Error in GET /badges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route GET /badges/user/:profileId
 * @desc Get badges earned by a specific user
 * @access Public
 */
router.get('/user/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;

    const result = await BadgesLibrary.getUserBadges(profileId);

    sendLibraryResult(res, result);
  } catch (error) {
    console.error('Error in GET /badges/user/:profileId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route GET /badges/user/:profileId/progress
 * @desc Get badge progress for a specific user (including incomplete badges)
 * @access Public
 */
router.get('/user/:profileId/progress', async (req, res) => {
  try {
    const { profileId } = req.params;

    const result = await BadgesLibrary.getUserBadgeProgress(profileId);

    sendLibraryResult(res, result);
  } catch (error) {
    console.error('Error in GET /badges/user/:profileId/progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route GET /badges/user/:profileId/stats
 * @desc Get badge statistics for a specific user
 * @access Public
 */
router.get('/user/:profileId/stats', async (req, res) => {
  try {
    const { profileId } = req.params;

    const result = await BadgesLibrary.getUserBadgeStats(profileId);

    sendLibraryResult(res, result);
  } catch (error) {
    console.error('Error in GET /badges/user/:profileId/stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /badges/award
 * @desc Award a badge to a user (admin function)
 * @access Private (should be called internally or by admin)
 * @body { profileId: string, badgeId: number, progress?: number }
 */
router.post('/award', async (req, res) => {
  try {
    const { profileId, badgeId, progress = 1 } = req.body;
    
    if (!profileId || !badgeId) {
      return res.status(400).json({ error: 'profileId and badgeId are required' });
    }
    
    const result = await BadgesLibrary.awardBadge(profileId, badgeId, progress);
    
    if (result.success) {
      res.json({
        message: result.alreadyCompleted ? 'Badge already completed' : 
                 result.newlyCompleted ? 'Badge awarded successfully!' : 'Progress updated',
        badge: toCamelCaseDeep(result.data.badge),
        progress: result.data.progress,
        maxProgress: result.data.maxProgress,
        isCompleted: result.data.isCompleted,
        earnedAt: result.data.earnedAt
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error in POST /badges/award:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /badges/check
 * @desc Check and award badges based on user actions
 * @access Private (should be called internally)
 * @body { profileId: string, action: string, data?: object }
 */
router.post('/check', async (req, res) => {
  try {
    const { profileId, action, data = {} } = req.body;
    
    if (!profileId || !action) {
      return res.status(400).json({ error: 'profileId and action are required' });
    }
    
    const result = await BadgesLibrary.checkAndAwardBadges(profileId, action, data);
    
    if (result.success) {
      res.json({
        message: result.badgeNotifications.length > 0 ? 
                 `Congratulations! You earned ${result.badgeNotifications.length} badge achievement(s)!` : 
                 'No new badges earned',
        badgeNotifications: toCamelCaseDeep(result.badgeNotifications),
        totalResults: result.allResults.length
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error in POST /badges/check:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /badges/award-retroactive/:profileId
 * @desc Award badges retroactively based on user's past actions
 * @access Public (for now, should be protected in production)
 */
router.post('/award-retroactive/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const results = [];
    
    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    console.log(`Starting retroactive badge check for user: ${profileId}`);

    // Import Prisma client to check user's past actions
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Check for group creation badge
    const groupsCreated = await prisma.group.count({
      where: { 
        createdBy: profileId,
        isActive: true 
      }
    });
    console.log(`User created ${groupsCreated} groups`);
    if (groupsCreated > 0) {
      const groupBadgeResult = await BadgesLibrary.checkAndAwardBadges(profileId, 'group_created');
      results.push({ action: 'group_created', count: groupsCreated, result: groupBadgeResult });
    }

    // Check for meal creation badge
    const mealsCreated = await prisma.meal.count({
      where: { profileId: profileId }
    });
    console.log(`User created ${mealsCreated} meals`);
    if (mealsCreated > 0) {
      const mealBadgeResult = await BadgesLibrary.checkAndAwardBadges(profileId, 'meal_created');
      results.push({ action: 'meal_created', count: mealsCreated, result: mealBadgeResult });
    }

    // Check for planned meal creation badge
    const plannedMealsCreated = await prisma.plannedMeal.count({
      where: { profileId: profileId }
    });
    console.log(`User created ${plannedMealsCreated} planned meals`);
    if (plannedMealsCreated > 0) {
      const plannedMealBadgeResult = await BadgesLibrary.checkAndAwardBadges(profileId, 'planned_meal_created');
      results.push({ action: 'planned_meal_created', count: plannedMealsCreated, result: plannedMealBadgeResult });
    }

    // Check for voting participation badge
    const votesParticipated = await prisma.vote.count({
      where: { 
        voterId: profileId,
        isActive: true
      }
    });
    console.log(`User participated in ${votesParticipated} votes`);
    if (votesParticipated > 0) {
      const votingBadgeResult = await BadgesLibrary.checkAndAwardBadges(profileId, 'voting_participated');
      results.push({ action: 'voting_participated', count: votesParticipated, result: votingBadgeResult });
    }

    // Check for voting winner badge
    const votingSessions = await prisma.votingSession.count({
      where: { 
        initiatorId: profileId,
        status: 'completed',
        winnerMealId: {
          not: null
        },
        winnerMeal: {
          profileId: profileId // Check if the winner meal was created by this user
        }
      }
    });
    console.log(`User won ${votingSessions} voting sessions`);
    if (votingSessions > 0) {
      const winnerBadgeResult = await BadgesLibrary.checkAndAwardBadges(profileId, 'voting_won');
      results.push({ action: 'voting_won', count: votingSessions, result: winnerBadgeResult });
    }

    await prisma.$disconnect();

    // Collect all badge notifications
    const allBadgeNotifications = results
      .filter(r => r.result.success && r.result.badgeNotifications && r.result.badgeNotifications.length > 0)
      .flatMap(r => r.result.badgeNotifications);

    res.json({
      message: allBadgeNotifications.length > 0 ? 
               `Congratulations! You earned ${allBadgeNotifications.length} badge achievement(s) for your past activities!` :
               'No new badges earned from past activities',
      badgeNotifications: toCamelCaseDeep(allBadgeNotifications),
      details: toCamelCaseDeep(results),
      summary: {
        groupsCreated,
        mealsCreated,
        plannedMealsCreated,
        votesParticipated,
        votingSessionsWon: votingSessions
      }
    });

  } catch (error) {
    console.error('Error in retroactive badge awarding:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});


/**
 * POST /badges/track
 * Track badge progress for a specific action
 */
router.post('/track', async (req, res) => {
  try {
    const { profileId, action, metadata } = req.body;
    if (!profileId || !action) {
      return res.status(400).json({ error: 'Missing required fields: profileId, action' });
    }
    const result = await BadgesLibrary.checkAndAwardBadges(profileId, action, metadata);
    res.status(200).json(toCamelCaseDeep(result));
  } catch (error) {
    console.error('Error tracking badge progress:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * PUT /badges/user/:profileId/primary
 * Set or clear the primary badge for a user
 */
router.put('/user/:profileId/primary', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { badgeId } = req.body;
    
    if (badgeId === null || badgeId === undefined) {
      // Clear the primary badge
      await prisma.profile.update({
        where: { id: profileId },
        data: { primaryBadgeId: null }
      });
      return res.status(200).json({ message: 'Primary badge cleared' });
    }
    
    // Verify the user has this badge
    const userBadge = await prisma.userBadge.findFirst({
      where: { profileId, badgeId: parseInt(badgeId) }
    });
    
    if (!userBadge) {
      return res.status(404).json({ error: 'Badge not found for this user' });
    }
    
    // Set the primary badge
    const updatedProfile = await prisma.profile.update({
      where: { id: profileId },
      data: { primaryBadgeId: parseInt(badgeId) },
      include: { primaryBadge: true }
    });
    
    res.status(200).json({ badgeId: updatedProfile.primaryBadgeId });
  } catch (error) {
    console.error('Error setting primary badge:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;
