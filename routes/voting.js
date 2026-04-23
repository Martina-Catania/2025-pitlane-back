const express = require('express');
const router = express.Router();
const { prisma } = require('../config/prismaClient');
const {
    startVotingSession,
    proposeMeal,
    startVotingPhase,
    castVote,
    completeVotingSession,
    getVotingSession,
    getGroupActiveVotingSessions,
    checkAndTransitionVotingSessions,
    createGroupConsumptionFromVote,
    confirmReadyForVoting,
    confirmVotes,
    cleanupVotingSession,
    getConfirmationStatus
} = require('../controllers/votingLib');

/**
 * GET /voting/groups/:groupId/initial
 * Get active voting sessions for initial load
 */
router.get('/groups/:groupId/initial', async (req, res) => {
    try {
        const { groupId } = req.params;
        const sessions = await getGroupActiveVotingSessions(groupId);
        
        res.json(sessions);
    } catch (error) {
        console.error('Error getting active voting sessions:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /voting/sessions/start
 * Start a new voting session
 * Body: { initiatorId, groupId, title?, description? }
 */
router.post('/sessions/start', async (req, res) => {
    try {
        const { initiatorId, groupId, title, description } = req.body;

        if (!initiatorId || !groupId) {
            return res.status(400).json({ 
                error: 'Missing required fields: initiatorId and groupId are required' 
            });
        }

        const session = await startVotingSession(initiatorId, groupId, title, description);
        res.status(201).json(session);
    } catch (error) {
        console.error('Error starting voting session:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /voting/check-transitions
 * Check and auto-transition voting sessions based on time
 * This could be called by a cron job or periodically
 */
router.post('/check-transitions', async (req, res) => {
    try {
        const results = await checkAndTransitionVotingSessions();
        res.json({
            message: 'Session transitions checked',
            results
        });
    } catch (error) {
        console.error('Error checking session transitions:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /voting/sessions/:sessionId/propose
 * Propose a meal for voting
 * Body: { mealId, proposedById }
 */
router.post('/sessions/:sessionId/propose', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { mealId, proposedById } = req.body;

        if (!mealId || !proposedById) {
            return res.status(400).json({ 
                error: 'Missing required fields: mealId and proposedById are required' 
            });
        }

        const proposal = await proposeMeal(sessionId, mealId, proposedById);
        res.status(201).json(proposal);
    } catch (error) {
        console.error('Error proposing meal:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /voting/sessions/:sessionId/start-voting
 * Transition session from proposal to voting phase
 */
router.post('/sessions/:sessionId/start-voting', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await startVotingPhase(sessionId);
        res.json(session);
    } catch (error) {
        console.error('Error starting voting phase:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * DELETE /voting/sessions/:sessionId/vote/:voteId
 * Remove a vote
 */
router.delete('/sessions/:sessionId/vote/:voteId', async (req, res) => {
    try {
        const { sessionId, voteId } = req.params;

        // Get the vote to check session status
        const vote = await require('../config/prismaClient').vote.findUnique({
            where: { VoteID: parseInt(voteId) },
            include: {
                votingSession: true
            }
        });

        if (!vote) {
            return res.status(404).json({ error: 'Vote not found' });
        }

        if (vote.votingSessionId !== parseInt(sessionId)) {
            return res.status(400).json({ error: 'Vote does not belong to this session' });
        }

        if (vote.votingSession.status !== 'voting_phase') {
            return res.status(400).json({ error: 'Cannot remove vote - voting is not active' });
        }

        // Soft delete the vote
        const updatedVote = await require('../config/prismaClient').vote.update({
            where: { VoteID: parseInt(voteId) },
            data: { isActive: false }
        });

        // Update vote count on meal proposal
        const voteCount = await require('../config/prismaClient').vote.count({
            where: {
                mealProposalId: vote.mealProposalId,
                voteType: 'up',
                isActive: true
            }
        });

        await require('../config/prismaClient').mealProposal.update({
            where: { MealProposalID: vote.mealProposalId },
            data: { voteCount }
        });

        res.json({ message: 'Vote removed successfully', vote: updatedVote });
    } catch (error) {
        console.error('Error removing vote:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /voting/sessions/:sessionId/vote
 * Cast a vote for a meal proposal
 * Body: { mealProposalId, voterId, voteType? }
 */
router.post('/sessions/:sessionId/vote', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { mealProposalId, voterId, voteType = 'up' } = req.body;

        if (!mealProposalId || !voterId) {
            return res.status(400).json({ 
                error: 'Missing required fields: mealProposalId and voterId are required' 
            });
        }

        const vote = await castVote(sessionId, mealProposalId, voterId, voteType);
        
        // Create response object with vote data
        const response = {
            ...vote,
            badgeNotifications: []
        };
        
        // Award badge for voting participation
        try {
            const BadgesLibrary = require('../controllers/badgesLib');
            const badgeResult = await BadgesLibrary.checkAndAwardBadges(voterId, 'voting_participated');
            console.log('[Voting] Badge check result:', JSON.stringify(badgeResult, null, 2));
            if (badgeResult.success && badgeResult.badgeNotifications && badgeResult.badgeNotifications.length > 0) {
                console.log(`User ${voterId} earned ${badgeResult.badgeNotifications.length} badge achievement(s) for voting!`);
                response.badgeNotifications = badgeResult.badgeNotifications;
            } else {
                console.log('[Voting] No badge notifications to add');
            }
        } catch (badgeError) {
            console.error('Error awarding voting participation badge:', badgeError);
            // Don't fail the vote if badge awarding fails
        }
        
        console.log('[Voting] Final response:', { voteId: response.VoteID, hasBadgeNotifications: response.badgeNotifications?.length > 0 });
        res.status(201).json(response);
    } catch (error) {
        console.error('Error casting vote:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /voting/sessions/:sessionId/complete
 * Complete voting session and determine winner
 */
router.post('/sessions/:sessionId/complete', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await completeVotingSession(sessionId);
        res.json(result);
    } catch (error) {
        console.error('Error completing voting session:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /voting/sessions/:sessionId/create-consumption
 * Create group consumption from completed voting session
 * Body: { profileId, consumedAt?, quantity?, name?, description? }
 */
router.post('/sessions/:sessionId/create-consumption', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const consumptionData = req.body;

        if (!consumptionData.profileId) {
            return res.status(400).json({ 
                error: 'Missing required field: profileId is required' 
            });
        }

        const consumption = await createGroupConsumptionFromVote(sessionId, consumptionData);
        res.status(201).json(consumption);
    } catch (error) {
        console.error('Error creating consumption from vote:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /voting/sessions/:sessionId/confirm-ready
 * Mark user as ready for voting (proposal phase confirmation)
 * Body: { userId }
 */
router.post('/sessions/:sessionId/confirm-ready', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ 
                error: 'Missing required field: userId is required' 
            });
        }

        const confirmation = await confirmReadyForVoting(sessionId, userId);
        res.status(201).json(confirmation);
    } catch (error) {
        console.error('Error confirming ready for voting:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /voting/sessions/:sessionId/confirm-votes
 * Confirm user's votes (voting phase confirmation)
 * Body: { userId }
 */
router.post('/sessions/:sessionId/confirm-votes', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ 
                error: 'Missing required field: userId is required' 
            });
        }

        const confirmation = await confirmVotes(sessionId, userId);
        res.status(201).json(confirmation);
    } catch (error) {
        console.error('Error confirming votes:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /voting/sessions/:sessionId/confirmation-status
 * Get confirmation status for a voting session
 */
router.get('/sessions/:sessionId/confirmation-status', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const status = await getConfirmationStatus(sessionId);
        res.json(status);
    } catch (error) {
        console.error('Error getting confirmation status:', error);
        res.status(404).json({ error: error.message });
    }
});

/**
 * POST /voting/sessions/:sessionId/cleanup
 * Clean up temporary voting data after session completion
 */
router.post('/sessions/:sessionId/cleanup', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await cleanupVotingSession(sessionId);
        res.json({
            message: 'Voting session cleaned up successfully',
            result
        });
    } catch (error) {
        console.error('Error cleaning up voting session:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /voting/sessions/check-transitions
 * Manually trigger session transitions check (useful for serverless environments)
 * This endpoint can be called periodically to ensure expired sessions are handled
 */
router.post('/sessions/check-transitions', async (req, res) => {
    try {
        console.log('[VotingAPI] Manual transition check triggered');
        const results = await checkAndTransitionVotingSessions();
        
        res.json({
            success: true,
            processedCount: results.length,
            results: results
        });
    } catch (error) {
        console.error('Error checking session transitions:', error);
        res.status(500).json({ 
            error: 'Failed to check session transitions',
            details: error.message 
        });
    }
});

/**
 * GET /voting/sessions/:sessionId
 * Get voting session details
 * NOTE: This must be LAST of all /sessions/:sessionId routes to avoid matching
 * sub-routes like /sessions/:sessionId/confirm-ready
 */
router.get('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await getVotingSession(sessionId);
        
        res.json(session);
    } catch (error) {
        console.error('Error getting voting session:', error);
        res.status(404).json({ error: error.message });
    }
});



// Convenience aliases for simpler REST patterns (used by tests)
router.post('/start', async (req, res) => {
  try {
    const { groupId, initiatorId } = req.body;
    if (!groupId || !initiatorId) {
      return res.status(400).json({ error: 'Missing required fields: groupId, initiatorId' });
    }
    const session = await startVotingSession(initiatorId, groupId);
    res.status(201).json(session);
  } catch (error) {
    console.error('[voting] Error starting voting session:', error);
    if (error.message.includes('already an active voting session')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:sessionId/propose', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { mealId, profileId, proposedById } = req.body;
    const userId = profileId || proposedById;

    if (!mealId || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields: mealId and profileId are required' 
      });
    }

    const proposal = await proposeMeal(sessionId, mealId, userId);
    res.status(201).json(proposal);
  } catch (error) {
    console.error('Error proposing meal:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:sessionId/vote', async (req, res) => {
  const existingRoute = router.stack.find(layer => layer.route?.path === '/sessions/:sessionId/vote');
  return existingRoute.route.stack[0].handle(req, res);
});

router.post('/:sessionId/finalize', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await completeVotingSession(sessionId);
    res.status(200).json(session);
  } catch (error) {
    console.error('[voting] Error finalizing voting:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/group/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const session = await getGroupActiveVotingSessions(parseInt(groupId));
    if (!session) {
      return res.status(404).json({ error: 'No active voting session found' });
    }
    res.status(200).json(session);
  } catch (error) {
    console.error('[voting] Error getting active session:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:sessionId/cancel', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { initiatorId } = req.body;
    
    const session = await prisma.votingSession.findUnique({
      where: { VotingSessionID: parseInt(sessionId) }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Voting session not found' });
    }
    
    if (session.initiatorId !== initiatorId) {
      return res.status(403).json({ error: 'Only the initiator can cancel the voting session' });
    }
    
    const updated = await prisma.votingSession.update({
      where: { VotingSessionID: parseInt(sessionId) },
      data: { status: 'cancelled' }
    });
    
    res.status(200).json(updated);
  } catch (error) {
    console.error('[voting] Error cancelling voting:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
