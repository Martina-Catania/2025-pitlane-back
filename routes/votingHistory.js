const express = require('express');
const router = express.Router();
const votingHistoryLib = require('../controllers/votingHistoryLib');

/**
 * GET /voting/history/groups/:groupId
 * Get voting history for a group
 */
router.get('/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    console.log('[Voting History] Getting history for group:', groupId);

    const history = await votingHistoryLib.getGroupVotingHistory(
      groupId,
      parseInt(limit),
      parseInt(offset)
    );

    console.log('[Voting History] Found sessions:', history.sessions?.length || 0);

    res.json(history);
  } catch (error) {
    console.error('[Voting History] Error getting voting history:', error);
    res.status(500).json({ error: error.message || 'Failed to get voting history' });
  }
});

/**
 * GET /voting/history/sessions/:sessionId
 * Get detailed info about a specific voting session
 */
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await votingHistoryLib.getVotingSessionDetails(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check for expired participants and default them
    await votingHistoryLib.defaultExpiredParticipants(sessionId);

    // Get updated session
    const updatedSession = await votingHistoryLib.getVotingSessionDetails(sessionId);

    res.json(updatedSession);
  } catch (error) {
    console.error('Error getting session details:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /voting/history/sessions/:sessionId/portions
 * Select meal portion for current user
 */
router.post('/sessions/:sessionId/portions', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, mealPortionFraction, foodPortions } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!mealPortionFraction || !foodPortions || !Array.isArray(foodPortions)) {
      return res.status(400).json({ 
        error: 'mealPortionFraction and foodPortions array are required' 
      });
    }

    const participant = await votingHistoryLib.selectMealPortion(
      sessionId,
      userId,
      { mealPortionFraction, foodPortions }
    );

    res.json(participant);
  } catch (error) {
    console.error('Error selecting portion:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /voting/history/sessions/:sessionId/participants/:userId
 * Get participant status and portion selection
 */
router.get('/sessions/:sessionId/participants/:userId', async (req, res) => {
  try {
    const { sessionId, userId } = req.params;

    const status = await votingHistoryLib.getParticipantStatus(sessionId, userId);

    if (!status) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    res.json(status);
  } catch (error) {
    console.error('Error getting participant status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /voting/history/sessions/:sessionId/track-participant
 * Track a participant (internal use when they vote/confirm)
 */
router.post('/sessions/:sessionId/track-participant', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const participant = await votingHistoryLib.trackParticipant(sessionId, userId);

    res.json(participant);
  } catch (error) {
    console.error('Error tracking participant:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
