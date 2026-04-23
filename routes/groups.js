// routes/groups.js
const express = require('express');
const router = express.Router();
const groupsLib = require('../controllers/groupsLib');
const BadgesLibrary = require('../controllers/badgesLib');

/**
 * GET /groups
 * Get all groups or user's groups
 */
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;
        
        let groups;
        if (userId) {
            groups = await groupsLib.getUserGroups(userId);
        } else {
            groups = await groupsLib.getAllGroups();
        }
        
        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ 
            error: 'Failed to fetch groups',
            details: error.message 
        });
    }
});

/**
 * GET /groups/:id
 * Get a specific group by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const group = await groupsLib.getGroupById(id);
        
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        res.json(group);
    } catch (error) {
        console.error('Error fetching group:', error);
        res.status(500).json({ 
            error: 'Failed to fetch group',
            details: error.message 
        });
    }
});

/**
 * POST /groups
 * Create a new group
 */
router.post('/', async (req, res) => {
    try {
        const { name, description, createdBy } = req.body;
        
        if (!name || !createdBy) {
            return res.status(400).json({ 
                error: 'Name and createdBy are required' 
            });
        }
        
        const groupData = { name, description };
        const newGroup = await groupsLib.createGroup(groupData, createdBy);
        
        // Create response object with group data
        const response = {
            ...newGroup,
            badgeNotifications: []
        };
        
        // Award badge for creating a group
        try {
            const badgeResult = await BadgesLibrary.checkAndAwardBadges(createdBy, 'group_created');
            console.log('[Groups] Badge check result:', JSON.stringify(badgeResult, null, 2));
            if (badgeResult.success && badgeResult.badgeNotifications && badgeResult.badgeNotifications.length > 0) {
                console.log(`User ${createdBy} earned ${badgeResult.badgeNotifications.length} badge achievement(s) for creating a group!`);
                response.badgeNotifications = badgeResult.badgeNotifications;
            } else {
                console.log('[Groups] No badge notifications to add');
            }
        } catch (badgeError) {
            console.error('Error awarding group creation badge:', badgeError);
            // Don't fail the group creation if badge awarding fails
        }
        
        console.log('[Groups] Final response:', { groupId: response.GroupID, hasBadgeNotifications: response.badgeNotifications?.length > 0 });
        res.status(201).json(response);
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ 
            error: 'Failed to create group',
            details: error.message 
        });
    }
});

/**
 * PUT /groups/:id
 * Update a group
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                error: 'User ID is required' 
            });
        }
        
        const groupData = { name, description };
        const updatedGroup = await groupsLib.updateGroup(id, groupData, userId);
        
        res.json(updatedGroup);
    } catch (error) {
        console.error('Error updating group:', error);
        
        if (error.message === 'Group not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message === 'Insufficient permissions to update group') {
            return res.status(403).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to update group',
            details: error.message 
        });
    }
});

/**
 * DELETE /groups/:id
 * Delete a group (soft delete)
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                error: 'User ID is required' 
            });
        }
        
        await groupsLib.deleteGroup(id, userId);
        
        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Error deleting group:', error);
        
        if (error.message === 'Group not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message === 'Only the group creator can delete the group') {
            return res.status(403).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to delete group',
            details: error.message 
        });
    }
});

/**
 * POST /groups/:id/members
 * Add a member to a group (DEPRECATED - use invitations instead)
 */
router.post('/:id/members', async (req, res) => {
    try {
        const { id } = req.params;
        const { profileId, role } = req.body;
        
        if (!profileId) {
            return res.status(400).json({ 
                error: 'Profile ID is required' 
            });
        }
        
        const newMember = await groupsLib.addGroupMember(id, profileId, role);
        
        res.status(201).json(newMember);
    } catch (error) {
        console.error('Error adding group member:', error);
        
        if (error.message === 'User is already a member of this group') {
            return res.status(409).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to add group member',
            details: error.message 
        });
    }
});

/**
 * POST /groups/:id/invite
 * Send invitation to join a group
 */
router.post('/:id/invite', async (req, res) => {
    try {
        const { id } = req.params;
        const { invitedUserId, invitedById, message } = req.body;
        
        if (!invitedUserId || !invitedById) {
            return res.status(400).json({ 
                error: 'Invited user ID and inviter ID are required' 
            });
        }
        
        const invitation = await groupsLib.sendGroupInvitation(id, invitedUserId, invitedById, message);
        
        // Check if this is an already pending invitation
        if (invitation.alreadyPending) {
            return res.status(409).json({ 
                error: invitation.message,
                alreadyPending: true,
                invitation: invitation
            });
        }
        
        res.status(201).json(invitation);
    } catch (error) {
        console.error('Error sending group invitation:', error);
        
        if (error.message === 'Group not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message === 'Insufficient permissions to send invitations' ||
            error.message === 'User is already a member of this group') {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to send group invitation',
            details: error.message 
        });
    }
});

/**
 * DELETE /groups/:id/members/:profileId
 * Remove a member from a group
 */
router.delete('/:id/members/:profileId', async (req, res) => {
    try {
        const { id, profileId } = req.params;
        const { requesterId } = req.body;
        
        if (!requesterId) {
            return res.status(400).json({ 
                error: 'Requester ID is required' 
            });
        }
        
        await groupsLib.removeGroupMember(id, profileId, requesterId);
        
        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('Error removing group member:', error);
        
        if (error.message === 'Group not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message === 'Insufficient permissions to remove member') {
            return res.status(403).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to remove group member',
            details: error.message 
        });
    }
});

/**
 * GET /groups/:id/dietary-info
 * Get aggregated dietary preferences and restrictions for a group
 */
router.get('/:id/dietary-info', async (req, res) => {
    try {
        const { id } = req.params;
        const dietaryInfo = await groupsLib.getGroupDietaryInfo(id);
        
        res.json(dietaryInfo);
    } catch (error) {
        console.error('Error fetching group dietary info:', error);
        
        if (error.message === 'Group not found') {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to fetch group dietary info',
            details: error.message 
        });
    }
});

/**
 * GET /groups/:id/invitations
 * Get pending invitations for a group
 */
router.get('/:id/invitations', async (req, res) => {
    try {
        const { id } = req.params;
        const { requesterId } = req.query;
        
        if (!requesterId) {
            return res.status(400).json({ 
                error: 'Requester ID is required' 
            });
        }
        
        const invitations = await groupsLib.getGroupPendingInvitations(id, requesterId);
        
        res.json(invitations);
    } catch (error) {
        console.error('Error fetching group pending invitations:', error);
        
        if (error.message === 'Group not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message === 'Insufficient permissions to view pending invitations') {
            return res.status(403).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to fetch group pending invitations',
            details: error.message 
        });
    }
});

/**
 * DELETE /groups/invitations/:invitationId
 * Cancel a pending invitation
 */
router.delete('/invitations/:invitationId', async (req, res) => {
    try {
        const { invitationId } = req.params;
        const { requesterId } = req.body;
        
        if (!requesterId) {
            return res.status(400).json({ 
                error: 'Requester ID is required' 
            });
        }
        
        const cancelledInvitation = await groupsLib.cancelGroupInvitation(invitationId, requesterId);
        
        res.json(cancelledInvitation);
    } catch (error) {
        console.error('Error cancelling invitation:', error);
        
        if (error.message === 'Invitation not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message === 'Can only cancel pending invitations' ||
            error.message === 'Insufficient permissions to cancel this invitation') {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to cancel invitation',
            details: error.message 
        });
    }
});

/**
 * GET /groups/invitations/:userId
 * Get user's pending invitations
 */
router.get('/invitations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.query;
        
        const invitations = await groupsLib.getUserInvitations(userId, status);
        
        res.json(invitations);
    } catch (error) {
        console.error('Error fetching user invitations:', error);
        res.status(500).json({ 
            error: 'Failed to fetch user invitations',
            details: error.message 
        });
    }
});

/**
 * PUT /groups/invitations/:invitationId/respond
 * Respond to group invitation
 */
router.put('/invitations/:invitationId/respond', async (req, res) => {
    try {
        const { invitationId } = req.params;
        const { userId, response } = req.body;
        
        if (!userId || !response) {
            return res.status(400).json({ 
                error: 'User ID and response are required' 
            });
        }
        
        if (!['accept', 'reject'].includes(response)) {
            return res.status(400).json({ 
                error: 'Response must be "accept" or "reject"' 
            });
        }
        
        const result = await groupsLib.respondToInvitation(invitationId, userId, response);
        
        res.json(result);
    } catch (error) {
        console.error('Error responding to invitation:', error);
        
        if (error.message === 'Invitation not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message === 'Unauthorized to respond to this invitation' ||
            error.message === 'Invitation has already been responded to' ||
            error.message === 'Invitation has expired') {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Failed to respond to invitation',
            details: error.message 
        });
    }
});

/**
 * GET /groups/search/users
 * Search users by username
 */
router.get('/search/users', async (req, res) => {
    try {
        const { query, excludeIds } = req.query;
        
        if (!query || query.length < 2) {
            return res.status(400).json({ 
                error: 'Query must be at least 2 characters long' 
            });
        }
        
        const excludeUserIds = excludeIds ? excludeIds.split(',') : [];
        const users = await groupsLib.searchUsers(query, excludeUserIds);
        
        res.json(users);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ 
            error: 'Failed to search users',
            details: error.message 
        });
    }
});

/**
 * GET /groups/dashboard/:userId
 * Get groups with recent activity for user's dashboard
 */
router.get('/dashboard/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit } = req.query;
        
        const groups = await groupsLib.getUserDashboardGroups(userId, limit ? parseInt(limit) : 5);
        
        res.json(groups);
    } catch (error) {
        console.error('Error fetching dashboard groups:', error);
        res.status(500).json({ 
            error: 'Failed to fetch dashboard groups',
            details: error.message 
        });
    }
});


/**
 * GET /groups/user/:profileId
 * Get all groups for a specific user
 */
router.get('/user/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const groups = await groupsLib.getUserGroups(profileId);
    res.status(200).json(groups);
  } catch (error) {
    console.error('[groups] Error getting user groups:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
