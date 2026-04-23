const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get voting history for a group
 * Returns all completed voting sessions with winner details
 */
async function getGroupVotingHistory(groupId, limit = 10, offset = 0) {
  const sessions = await prisma.votingSession.findMany({
    where: {
      groupId: parseInt(groupId),
      status: 'completed',
      winnerMealId: { not: null }
    },
    include: {
      winnerMeal: {
        include: {
          mealFoods: {
            include: {
              food: true
            }
          }
        }
      },
      initiator: {
        select: {
          id: true,
          username: true
        }
      },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      },
      proposals: true,
      _count: {
        select: {
          participants: true
        }
      }
    },
    orderBy: {
      completedAt: 'desc'
    },
    skip: offset,
    take: limit
  });

  // Format the response
  const formattedSessions = sessions.map(session => ({
    sessionId: session.VotingSessionID,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    status: session.status,
    winnerMeal: {
      mealId: session.winnerMeal?.MealID,
      name: session.winnerMeal?.name,
      voteCount: session.proposals?.find(p => p.mealId === session.winnerMealId)?.voteCount || 0
    },
    totalVotes: session.proposals?.reduce((sum, p) => sum + (p.voteCount || 0), 0) || 0,
    participantCount: session._count.participants
  }));

  return {
    sessions: formattedSessions,
    total: formattedSessions.length,
    limit,
    offset
  };
}

/**
 * Get a specific voting session with full details including portions
 */
async function getVotingSessionDetails(sessionId) {
  const session = await prisma.votingSession.findUnique({
    where: { VotingSessionID: parseInt(sessionId) },
    include: {
      winnerMeal: {
        include: {
          mealFoods: {
            include: {
              food: true
            }
          }
        }
      },
      proposals: {
        include: {
          meal: true,
          proposedBy: {
            select: {
              id: true,
              username: true
            }
          }
        }
      },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: {
          joinedAt: 'asc'
        }
      },
      mealConsumptions: {
        include: {
          profile: {
            select: {
              id: true,
              username: true
            }
          },
          meal: true,
          foodPortions: {
            include: {
              food: true
            }
          }
        },
        where: {
          source: 'voting',
          type: 'individual' // Only individual portion selections, not group-level records
        }
      }
    }
  });

  if (!session) {
    return null;
  }

  // Format the response
  return {
    sessionId: session.VotingSessionID,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    status: session.status,
    winnerMeal: session.winnerMeal ? {
      mealId: session.winnerMeal.MealID,
      name: session.winnerMeal.name,
      description: session.winnerMeal.description,
      mealFoods: session.winnerMeal.mealFoods.map(mf => ({
        foodId: mf.food.FoodID,
        foodName: mf.food.name,
        quantity: mf.quantity,
        svgLink: mf.food.svgLink,
        kCal: mf.food.kCal
      })),
      totalCalories: session.winnerMeal.mealFoods.reduce((sum, mf) => 
        sum + (mf.food.kCal * mf.quantity), 0
      )
    } : null,
    proposals: session.proposals.map(proposal => ({
      proposalId: proposal.MealProposalID,
      mealId: proposal.mealId,
      mealName: proposal.meal.name,
      proposedBy: proposal.proposedBy?.username || null,
      voteCount: proposal.voteCount || 0
    })),
    participants: session.participants.map(participant => {
      // Calculate portion deadline: 15 minutes after session completion
      const portionDeadline = session.completedAt 
        ? new Date(session.completedAt.getTime() + 15 * 60 * 1000)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Far future if not completed

      // Find this participant's meal consumption
      const userConsumption = session.mealConsumptions.find(mc => mc.profileId === participant.userId);

      return {
        userId: participant.userId,
        userName: participant.user.username,
        hasSelectedPortion: participant.hasSelectedPortion,
        defaultedToWhole: participant.defaultedToWhole,
        portionFraction: userConsumption?.portionFraction,
        portionDeadline: portionDeadline.toISOString(),
        joinedAt: participant.joinedAt
      };
    })
  };
}

/**
 * Add or update participant when they join a voting session
 * Called when user votes or confirms readiness
 */
async function trackParticipant(sessionId, userId) {
  const session = await prisma.votingSession.findUnique({
    where: { VotingSessionID: parseInt(sessionId) }
  });

  if (!session) {
    throw new Error('Voting session not found');
  }

  // Calculate deadline: 15 minutes after completion
  // If not completed yet, set a far future date (will be updated on completion)
  const deadline = session.completedAt 
    ? new Date(session.completedAt.getTime() + 15 * 60 * 1000)
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now as placeholder

  const participant = await prisma.votingSessionParticipant.upsert({
    where: {
      votingSessionId_userId: {
        votingSessionId: parseInt(sessionId),
        userId: userId
      }
    },
    update: {
      // Update deadline if session just completed
      ...(session.completedAt && {
        portionDeadline: deadline
      })
    },
    create: {
      votingSessionId: parseInt(sessionId),
      userId: userId,
      portionDeadline: deadline
    },
    include: {
      user: {
        select: {
          id: true,
          username: true
        }
      }
    }
  });

  return participant;
}

/**
 * Update all participants' deadlines when voting session completes
 */
async function updateParticipantDeadlines(sessionId) {
  const session = await prisma.votingSession.findUnique({
    where: { VotingSessionID: parseInt(sessionId) }
  });

  if (!session || !session.completedAt) {
    throw new Error('Session not completed');
  }

  const deadline = new Date(session.completedAt.getTime() + 15 * 60 * 1000);

  await prisma.votingSessionParticipant.updateMany({
    where: {
      votingSessionId: parseInt(sessionId)
    },
    data: {
      portionDeadline: deadline
    }
  });

  return { deadline };
}

/**
 * Select portion for a participant
 * Allows user to specify what fraction of the meal and each ingredient they consumed
 */
async function selectMealPortion(sessionId, userId, portionData) {
  const { mealPortionFraction, foodPortions } = portionData;

  // Get participant
  const participant = await prisma.votingSessionParticipant.findUnique({
    where: {
      votingSessionId_userId: {
        votingSessionId: parseInt(sessionId),
        userId: userId
      }
    }
  });

  if (!participant) {
    throw new Error('Participant not found');
  }

  // Check if deadline has passed
  if (new Date() > participant.portionDeadline) {
    throw new Error('Portion selection deadline has passed');
  }

  // Get session with winner meal
  const session = await prisma.votingSession.findUnique({
    where: { VotingSessionID: parseInt(sessionId) },
    include: {
      winnerMeal: {
        include: {
          mealFoods: {
            include: {
              food: true
            }
          }
        }
      }
    }
  });

  if (!session || !session.winnerMealId) {
    throw new Error('No winner meal found');
  }

  // Calculate total calories from selected portions
  const totalCalories = session.winnerMeal.mealFoods.reduce((sum, mealFood) => {
    const foodPortion = foodPortions.find(fp => fp.foodId === mealFood.foodId);
    const portionFraction = foodPortion ? parseFloat(foodPortion.portionFraction) : mealPortionFraction;
    const quantityConsumed = mealFood.quantity * portionFraction;
    return sum + (mealFood.food.kCal * quantityConsumed);
  }, 0);

  // Find existing INDIVIDUAL meal consumption for this participant and voting session
  // Don't find the group-level consumption - we only want to update individual portions
  const existingConsumption = await prisma.mealConsumption.findFirst({
    where: {
      profileId: userId,
      votingSessionId: parseInt(sessionId),
      source: 'voting',
      type: 'individual' // Only find individual portion selections, not group consumption
    }
  });

  let mealConsumption;
  if (existingConsumption) {
    // Update existing meal consumption
    mealConsumption = await prisma.mealConsumption.update({
      where: { MealConsumptionID: existingConsumption.MealConsumptionID },
      data: {
        name: `${session.winnerMeal.name} (${Math.round(parseFloat(mealPortionFraction) * 100)}%)`,
        description: `From voting session - ${Math.round(parseFloat(mealPortionFraction) * 100)}% portion`,
        type: 'individual', // Individual portion selection
        portionFraction: parseFloat(mealPortionFraction),
        totalKcal: Math.round(totalCalories),
        consumedAt: new Date()
      }
    });
  } else {
    // Create new individual meal consumption (no groupId - this is personal consumption)
    mealConsumption = await prisma.mealConsumption.create({
      data: {
        name: `${session.winnerMeal.name} (${Math.round(parseFloat(mealPortionFraction) * 100)}%)`,
        groupId: null, // Individual consumption from voting portion selection
        type: 'individual', // Individual portion selection
        description: `From voting session - ${Math.round(parseFloat(mealPortionFraction) * 100)}% portion`,
        profileId: userId,
        mealId: session.winnerMealId,
        source: 'voting',
        votingSessionId: parseInt(sessionId),
        portionFraction: parseFloat(mealPortionFraction),
        quantity: 1,
        totalKcal: Math.round(totalCalories)
      }
    });
  }

  // Delete existing food portions
  await prisma.foodPortion.deleteMany({
    where: {
      mealConsumptionId: mealConsumption.MealConsumptionID
    }
  });

  // Create food portions
  const foodPortionPromises = foodPortions.map(fp => {
    const originalFood = session.winnerMeal.mealFoods.find(mf => mf.foodId === fp.foodId);
    const quantityConsumed = originalFood ? originalFood.quantity * parseFloat(fp.portionFraction) : 0;

    return prisma.foodPortion.create({
      data: {
        mealConsumptionId: mealConsumption.MealConsumptionID,
        foodId: fp.foodId,
        portionFraction: parseFloat(fp.portionFraction),
        quantityConsumed: quantityConsumed
      }
    });
  });

  await Promise.all(foodPortionPromises);

  // Mark participant as having selected portion
  await prisma.votingSessionParticipant.update({
    where: { ParticipantID: participant.ParticipantID },
    data: {
      hasSelectedPortion: true,
      selectedAt: new Date()
    }
  });

  // Get updated participant with meal consumption
  const userMealConsumption = await prisma.mealConsumption.findFirst({
    where: {
      profileId: userId,
      votingSessionId: parseInt(sessionId),
      source: 'voting'
    },
    include: {
      foodPortions: {
        include: {
          food: true
        }
      }
    }
  });

  const updatedParticipant = await prisma.votingSessionParticipant.findUnique({
    where: { ParticipantID: participant.ParticipantID }
  });

  return {
    ...updatedParticipant,
    mealConsumption: userMealConsumption
  };
}

/**
 * Default participants to whole meal if deadline passed
 * Called by a cron job or when viewing history
 */
async function defaultExpiredParticipants(sessionId) {
  const now = new Date();
  
  const expiredParticipants = await prisma.votingSessionParticipant.findMany({
    where: {
      votingSessionId: parseInt(sessionId),
      hasSelectedPortion: false,
      portionDeadline: { lt: now },
      defaultedToWhole: false
    },
    include: {
      votingSession: {
        include: {
          winnerMeal: {
            include: {
              mealFoods: true
            }
          }
        }
      }
    }
  });

  const results = [];

  for (const participant of expiredParticipants) {
    if (!participant.votingSession.winnerMealId) continue;

    // Calculate total kcal
    const winnerMeal = participant.votingSession.winnerMeal;
    const totalKcal = winnerMeal.mealFoods.reduce((sum, mf) => sum + (mf.food.kCal * mf.quantity), 0);

    // Create whole meal consumption with food portions
    const mealConsumption = await prisma.mealConsumption.create({
      data: {
        name: `${winnerMeal.name} (100% - auto-defaulted)`,
        description: `From voting session - automatically defaulted to whole meal`,
        profileId: participant.userId,
        mealId: participant.votingSession.winnerMealId,
        source: 'voting',
        votingSessionId: participant.votingSessionId,
        portionFraction: 1.0,
        quantity: 1,
        totalKcal: Math.round(totalKcal),
        foodPortions: {
          create: winnerMeal.mealFoods.map(mf => ({
            foodId: mf.foodId,
            portionFraction: 1.0,
            quantityConsumed: mf.quantity
          }))
        }
      }
    });

    // Mark as defaulted
    await prisma.votingSessionParticipant.update({
      where: { ParticipantID: participant.ParticipantID },
      data: {
        defaultedToWhole: true,
        hasSelectedPortion: true,
        selectedAt: now
      }
    });

    results.push({
      participantId: participant.ParticipantID,
      userId: participant.userId,
      defaulted: true
    });
  }

  return results;
}

/**
 * Get participant portion selection status
 */
async function getParticipantStatus(sessionId, userId) {
  const participant = await prisma.votingSessionParticipant.findUnique({
    where: {
      votingSessionId_userId: {
        votingSessionId: parseInt(sessionId),
        userId: userId
      }
    }
  });

  if (!participant) {
    return null;
  }

  // Get meal consumption for this participant
  // Only check for individual consumption (type = 'individual'), not group-level record
  const mealConsumption = await prisma.mealConsumption.findFirst({
    where: {
      profileId: userId,
      votingSessionId: parseInt(sessionId),
      source: 'voting',
      type: 'individual' // Only individual portion selections
    },
    include: {
      foodPortions: {
        include: {
          food: true
        }
      }
    }
  });

  const now = new Date();
  const deadlinePassed = now > participant.portionDeadline;
  const timeRemaining = participant.portionDeadline - now;

  return {
    ...participant,
    mealConsumption,
    deadlinePassed,
    timeRemaining: deadlinePassed ? 0 : timeRemaining
  };
}

/**
 * Create meal consumption from completed voting session
 * This is called when a user wants to register the voted meal
 */
async function createMealConsumptionFromVotingSession(sessionId, profileId) {
  const session = await prisma.votingSession.findUnique({
    where: { VotingSessionID: parseInt(sessionId) },
    include: {
      winnerMeal: {
        include: {
          mealFoods: {
            include: {
              food: true
            }
          }
        }
      },
      group: true
    }
  });

  if (!session) {
    throw new Error('Voting session not found');
  }

  if (session.status !== 'completed') {
    throw new Error('Voting session is not completed yet');
  }

  if (!session.winnerMeal) {
    throw new Error('No winner meal found for this voting session');
  }

  // Check if consumption already exists
  const existing = await prisma.mealConsumption.findFirst({
    where: {
      profileId,
      votingSessionId: parseInt(sessionId),
      source: 'voting'
    }
  });

  if (existing) {
    return existing; // Already created
  }

  // Calculate total kcal
  const totalKcal = session.winnerMeal.mealFoods.reduce((sum, mealFood) => 
    sum + (mealFood.food.kCal * mealFood.quantity), 0
  );

  // Create meal consumption with food portions
  const mealConsumption = await prisma.mealConsumption.create({
    data: {
      name: session.winnerMeal.name,
      description: `Group meal from voting session: ${session.title || 'Voting'}`,
      profileId,
      mealId: session.winnerMealId,
      groupId: session.groupId,
      type: 'group', // Group-level consumption for Recent Activity
      source: 'voting',
      votingSessionId: parseInt(sessionId),
      portionFraction: 1.0,
      quantity: 1,
      totalKcal: Math.round(totalKcal),
      foodPortions: {
        create: session.winnerMeal.mealFoods.map(mf => ({
          foodId: mf.foodId,
          portionFraction: 1.0,
          quantityConsumed: mf.quantity
        }))
      }
    },
    include: {
      meal: {
        include: {
          mealFoods: {
            include: {
              food: {
                include: {
                  dietaryRestrictions: true,
                  preferences: true
                }
              }
            }
          }
        }
      },
      foodPortions: {
        include: {
          food: true
        }
      },
      profile: {
        select: {
          id: true,
          username: true,
          role: true
        }
      },
      group: {
        select: {
          GroupID: true,
          name: true,
          description: true
        }
      }
    }
  });

  return mealConsumption;
}

module.exports = {
  getGroupVotingHistory,
  getVotingSessionDetails,
  trackParticipant,
  updateParticipantDeadlines,
  selectMealPortion,
  defaultExpiredParticipants,
  getParticipantStatus,
  createMealConsumptionFromVotingSession
};
