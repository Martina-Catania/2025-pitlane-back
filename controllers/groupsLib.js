// controllers/groupsLib.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get all groups with their members
 */
async function getAllGroups() {
    return prisma.group.findMany({
        where: {
            isActive: true
        },
        include: {
            members: {
                where: {
                    isActive: true
                },
                include: {
                    profile: {
                        select: {
                            id: true,
                            username: true,
                            role: true
                        }
                    }
                }
            },
            creator: {
                select: {
                    id: true,
                    username: true,
                    role: true
                }
            },
            _count: {
                select: {
                    members: {
                        where: {
                            isActive: true
                        }
                    },
                    mealConsumptions: {
                        where: {
                            isActive: true
                        }
                    }
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
}

/**
 * Get groups where a user is a member or creator
 */
async function getUserGroups(profileId) {
    return prisma.group.findMany({
        where: {
            isActive: true,
            OR: [
                { createdBy: profileId },
                {
                    members: {
                        some: {
                            profileId: profileId,
                            isActive: true
                        }
                    }
                }
            ]
        },
        include: {
            members: {
                where: {
                    isActive: true
                },
                include: {
                    profile: {
                        select: {
                            id: true,
                            username: true,
                            role: true
                        }
                    }
                }
            },
            creator: {
                select: {
                    id: true,
                    username: true,
                    role: true
                }
            },
            _count: {
                select: {
                    members: {
                        where: {
                            isActive: true
                        }
                    },
                    mealConsumptions: {
                        where: {
                            isActive: true
                        }
                    }
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
}

/**
 * Get a specific group by ID with full details
 */
async function getGroupById(groupId) {
    return prisma.group.findUnique({
        where: {
            GroupID: parseInt(groupId),
            isActive: true
        },
        include: {
            members: {
                where: {
                    isActive: true
                },
                include: {
                    profile: {
                        select: {
                            id: true,
                            username: true,
                            role: true,
                            Preference: true,
                            DietaryRestriction: true
                        }
                    }
                }
            },
            creator: {
                select: {
                    id: true,
                    username: true,
                    role: true
                }
            },
            mealConsumptions: {
                where: {
                    isActive: true,
                    type: 'group' // Only show group-level consumptions in group activity
                },
                include: {
                    meal: true,
                    profile: {
                        select: {
                            id: true,
                            username: true
                        }
                    },
                    foodPortions: {
                        include: {
                            food: true
                        }
                    }
                },
                orderBy: {
                    consumedAt: 'desc'
                }
            }
        }
    });
}

/**
 * Create a new group
 */
async function createGroup(groupData, creatorId) {
    const { name, description } = groupData;
    
    return prisma.group.create({
        data: {
            name,
            description,
            createdBy: creatorId,
            members: {
                create: {
                    profileId: creatorId,
                    role: 'admin'
                }
            }
        },
        include: {
            members: {
                include: {
                    profile: {
                        select: {
                            id: true,
                            username: true,
                            role: true
                        }
                    }
                }
            },
            creator: {
                select: {
                    id: true,
                    username: true,
                    role: true
                }
            }
        }
    });
}

/**
 * Update group information
 */
async function updateGroup(groupId, groupData, userId) {
    const { name, description } = groupData;
    
    // Check if user is admin of the group or creator
    const group = await prisma.group.findUnique({
        where: { GroupID: parseInt(groupId) },
        include: {
            members: {
                where: {
                    profileId: userId,
                    isActive: true
                }
            }
        }
    });

    if (!group) {
        throw new Error('Group not found');
    }

    const isCreator = group.createdBy === userId;
    const isGroupAdmin = group.members.some(member => 
        member.profileId === userId && member.role === 'admin'
    );

    if (!isCreator && !isGroupAdmin) {
        throw new Error('Insufficient permissions to update group');
    }

    return prisma.group.update({
        where: {
            GroupID: parseInt(groupId)
        },
        data: {
            name,
            description,
            updatedAt: new Date()
        },
        include: {
            members: {
                where: {
                    isActive: true
                },
                include: {
                    profile: {
                        select: {
                            id: true,
                            username: true,
                            role: true
                        }
                    }
                }
            },
            creator: {
                select: {
                    id: true,
                    username: true,
                    role: true
                }
            }
        }
    });
}

/**
 * Add a member to a group
 */
async function addGroupMember(groupId, profileId, role = 'member') {
    // Check if user is already a member
    const existingMember = await prisma.groupMember.findUnique({
        where: {
            groupId_profileId: {
                groupId: parseInt(groupId),
                profileId: profileId
            }
        }
    });

    if (existingMember) {
        if (existingMember.isActive) {
            throw new Error('User is already a member of this group');
        } else {
            // Reactivate membership
            return prisma.groupMember.update({
                where: {
                    GroupMemberID: existingMember.GroupMemberID
                },
                data: {
                    isActive: true,
                    role,
                    joinedAt: new Date()
                },
                include: {
                    profile: {
                        select: {
                            id: true,
                            username: true,
                            role: true
                        }
                    }
                }
            });
        }
    }

    return prisma.groupMember.create({
        data: {
            groupId: parseInt(groupId),
            profileId,
            role
        },
        include: {
            profile: {
                select: {
                    id: true,
                    username: true,
                    role: true
                }
            }
        }
    });
}

/**
 * Send invitation to join a group
 */
async function sendGroupInvitation(groupId, invitedUserId, invitedById, message = null) {
    // Check if group exists and inviter has permission
    const group = await prisma.group.findUnique({
        where: { GroupID: parseInt(groupId) },
        include: {
            members: {
                where: {
                    profileId: invitedById,
                    isActive: true
                }
            }
        }
    });

    if (!group) {
        throw new Error('Group not found');
    }

    const isCreator = group.createdBy === invitedById;
    const isGroupAdmin = group.members.some(member => 
        member.profileId === invitedById && member.role === 'admin'
    );

    if (!isCreator && !isGroupAdmin) {
        throw new Error('Insufficient permissions to send invitations');
    }

    // Check if user is already a member
    const existingMember = await prisma.groupMember.findUnique({
        where: {
            groupId_profileId: {
                groupId: parseInt(groupId),
                profileId: invitedUserId
            }
        }
    });

    if (existingMember && existingMember.isActive) {
        throw new Error('User is already a member of this group');
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.groupInvitation.findUnique({
        where: {
            groupId_invitedUserId: {
                groupId: parseInt(groupId),
                invitedUserId: invitedUserId
            }
        }
    });

    if (existingInvitation && existingInvitation.status === 'pending') {
        return {
            ...existingInvitation,
            alreadyPending: true,
            message: 'There is already a pending invitation for this user'
        };
    }

    // Create or update invitation
    if (existingInvitation) {
        return prisma.groupInvitation.update({
            where: {
                InvitationID: existingInvitation.InvitationID
            },
            data: {
                status: 'pending',
                message,
                invitedById,
                createdAt: new Date(),
                respondedAt: null
            },
            include: {
                group: {
                    select: {
                        GroupID: true,
                        name: true,
                        description: true
                    }
                },
                invitedBy: {
                    select: {
                        id: true,
                        username: true
                    }
                },
                invitedUser: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            }
        });
    } else {
        return prisma.groupInvitation.create({
            data: {
                groupId: parseInt(groupId),
                invitedUserId,
                invitedById,
                message,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            },
            include: {
                group: {
                    select: {
                        GroupID: true,
                        name: true,
                        description: true
                    }
                },
                invitedBy: {
                    select: {
                        id: true,
                        username: true
                    }
                },
                invitedUser: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            }
        });
    }
}

/**
 * Remove a member from a group (soft delete)
 */
async function removeGroupMember(groupId, profileId, requesterId) {
    const group = await prisma.group.findUnique({
        where: { GroupID: parseInt(groupId) },
        include: {
            members: {
                where: {
                    profileId: requesterId,
                    isActive: true
                }
            }
        }
    });

    if (!group) {
        throw new Error('Group not found');
    }

    const requesterMember = group.members.find(member => member.profileId === requesterId);
    const isCreator = group.createdBy === requesterId;
    const isGroupAdmin = requesterMember && requesterMember.role === 'admin';
    const isSelf = profileId === requesterId;

    if (!isCreator && !isGroupAdmin && !isSelf) {
        throw new Error('Insufficient permissions to remove member');
    }

    return prisma.groupMember.updateMany({
        where: {
            groupId: parseInt(groupId),
            profileId: profileId
        },
        data: {
            isActive: false
        }
    });
}

/**
 * Delete a group (soft delete)
 */
async function deleteGroup(groupId, userId) {
    const group = await prisma.group.findUnique({
        where: { GroupID: parseInt(groupId) }
    });

    if (!group) {
        throw new Error('Group not found');
    }

    if (group.createdBy !== userId) {
        throw new Error('Only the group creator can delete the group');
    }

    return prisma.group.update({
        where: {
            GroupID: parseInt(groupId)
        },
        data: {
            isActive: false,
            updatedAt: new Date()
        }
    });
}

/**
 * Get group preferences and dietary restrictions aggregated from all members
 */
async function getGroupDietaryInfo(groupId) {
    const group = await prisma.group.findUnique({
        where: {
            GroupID: parseInt(groupId),
            isActive: true
        },
        include: {
            members: {
                where: {
                    isActive: true
                },
                include: {
                    profile: {
                        include: {
                            Preference: true,
                            DietaryRestriction: true
                        }
                    }
                }
            }
        }
    });

    if (!group) {
        throw new Error('Group not found');
    }

    // Aggregate preferences and dietary restrictions from all members
    const allPreferences = [];
    const allDietaryRestrictions = [];

    group.members.forEach(member => {
        allPreferences.push(...member.profile.Preference);
        allDietaryRestrictions.push(...member.profile.DietaryRestriction);
    });

    // Remove duplicates
    const uniquePreferences = allPreferences.filter((pref, index, self) =>
        index === self.findIndex(p => p.PreferenceID === pref.PreferenceID)
    );

    const uniqueDietaryRestrictions = allDietaryRestrictions.filter((restriction, index, self) =>
        index === self.findIndex(r => r.DietaryRestrictionID === restriction.DietaryRestrictionID)
    );

    return {
        groupId: group.GroupID,
        groupName: group.name,
        memberCount: group.members.length,
        preferences: uniquePreferences,
        dietaryRestrictions: uniqueDietaryRestrictions
    };
}

/**
 * Get user's pending invitations
 */
async function getUserInvitations(userId, status = 'pending') {
    return prisma.groupInvitation.findMany({
        where: {
            invitedUserId: userId,
            status: status,
            group: {
                isActive: true
            }
        },
        include: {
            group: {
                select: {
                    GroupID: true,
                    name: true,
                    description: true,
                    createdAt: true
                }
            },
            invitedBy: {
                select: {
                    id: true,
                    username: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
}

/**
 * Respond to group invitation (accept/reject)
 */
async function respondToInvitation(invitationId, userId, response) {
    const invitation = await prisma.groupInvitation.findUnique({
        where: {
            InvitationID: parseInt(invitationId)
        },
        include: {
            group: true,
        }
    });

    if (!invitation) {
        throw new Error('Invitation not found');
    }

    if (invitation.invitedUserId !== userId) {
        throw new Error('Unauthorized to respond to this invitation');
    }

    if (invitation.status !== 'pending') {
        throw new Error('Invitation has already been responded to');
    }

    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        // Auto-expire the invitation
        await prisma.groupInvitation.update({
            where: {
                InvitationID: parseInt(invitationId)
            },
            data: {
                status: 'expired',
                respondedAt: new Date()
            }
        });
        throw new Error('Invitation has expired');
    }

    const status = response === 'accept' ? 'accepted' : 'rejected';
    
    // Update invitation status
    const updatedInvitation = await prisma.groupInvitation.update({
        where: {
            InvitationID: parseInt(invitationId)
        },
        data: {
            status,
            respondedAt: new Date()
        },
        include: {
            group: {
                select: {
                    GroupID: true,
                    name: true,
                    description: true
                }
            },
            invitedBy: {
                select: {
                    id: true,
                    username: true
                }
            }
        }
    });

    // If accepted, add user to group
    if (response === 'accept') {
        await addGroupMember(invitation.groupId, userId, 'member');
    }

    return updatedInvitation;
}

/**
 * Search users by username
 */
async function searchUsers(query, excludeUserIds = []) {
    return prisma.profile.findMany({
        where: {
            username: {
                contains: query,
                mode: 'insensitive'
            },
            id: {
                notIn: excludeUserIds
            }
        },
        select: {
            id: true,
            username: true,
            role: true
        },
        take: 10 // Limit results
    });
}

/**
 * Get groups with recent activity for user's dashboard
 */
async function getUserDashboardGroups(profileId, limit = 5) {
    return prisma.group.findMany({
        where: {
            isActive: true,
            OR: [
                { createdBy: profileId },
                {
                    members: {
                        some: {
                            profileId: profileId,
                            isActive: true
                        }
                    }
                }
            ]
        },
        include: {
            members: {
                where: {
                    isActive: true
                },
                select: {
                    profile: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                }
            },
            _count: {
                select: {
                    mealConsumptions: {
                        where: {
                            isActive: true,
                            consumedAt: {
                                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                            }
                        }
                    }
                }
            }
        },
        orderBy: {
            updatedAt: 'desc'
        },
        take: limit
    });
}

/**
 * Get pending invitations for a group
 */
async function getGroupPendingInvitations(groupId, requesterId) {
    // Verify the requester has permission to view invitations (must be admin or creator)
    const group = await prisma.group.findUnique({
        where: { GroupID: parseInt(groupId) },
        include: {
            members: {
                where: { isActive: true },
                select: {
                    profileId: true,
                    role: true
                }
            }
        }
    });

    if (!group) {
        throw new Error('Group not found');
    }

    const isCreator = group.createdBy === requesterId;
    const isAdmin = group.members.some(member => 
        member.profileId === requesterId && member.role === 'admin'
    );

    if (!isCreator && !isAdmin) {
        throw new Error('Insufficient permissions to view pending invitations');
    }

    // Get pending invitations for the group
    return await prisma.groupInvitation.findMany({
        where: {
            groupId: parseInt(groupId),
            status: 'pending'
        },
        include: {
            invitedUser: {
                select: {
                    id: true,
                    username: true,
                    role: true
                }
            },
            invitedBy: {
                select: {
                    id: true,
                    username: true,
                    role: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
}

/**
 * Cancel a pending invitation
 */
async function cancelGroupInvitation(invitationId, requesterId) {
    const invitation = await prisma.groupInvitation.findUnique({
        where: {
            InvitationID: parseInt(invitationId)
        },
        include: {
            group: {
                include: {
                    members: {
                        where: { isActive: true },
                        select: {
                            profileId: true,
                            role: true
                        }
                    }
                }
            }
        }
    });

    if (!invitation) {
        throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
        throw new Error('Can only cancel pending invitations');
    }

    // Check permissions - must be creator, admin, or the person who sent the invitation
    const isCreator = invitation.group.createdBy === requesterId;
    const isAdmin = invitation.group.members.some(member => 
        member.profileId === requesterId && member.role === 'admin'
    );
    const isInviter = invitation.invitedById === requesterId;

    if (!isCreator && !isAdmin && !isInviter) {
        throw new Error('Insufficient permissions to cancel this invitation');
    }

    // Delete the pending invitation from the database
    // Return the deleted record (invited user + inviter info) for the caller
    return await prisma.groupInvitation.delete({
        where: {
            InvitationID: parseInt(invitationId)
        },
        include: {
            invitedUser: {
                select: {
                    id: true,
                    username: true,
                    role: true
                }
            },
            invitedBy: {
                select: {
                    id: true,
                    username: true,
                    role: true
                }
            }
        }
    });
}

module.exports = {
    getAllGroups,
    getUserGroups,
    getGroupById,
    createGroup,
    updateGroup,
    addGroupMember,
    sendGroupInvitation,
    removeGroupMember,
    deleteGroup,
    getGroupDietaryInfo,
    getUserInvitations,
    respondToInvitation,
    searchUsers,
    getUserDashboardGroups,
    getGroupPendingInvitations,
    cancelGroupInvitation
};