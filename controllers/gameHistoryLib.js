const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Format game type for user-friendly display
 * e.g., 'egg_clicker' -> 'Egg Clicker'
 */
function formatGameType(gameType) {
  return gameType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get game history for a group
 * Returns all completed game sessions with winner details
 */
async function getGroupGameHistory(groupId, limit = 10, offset = 0) {
  const sessions = await prisma.gameSession.findMany({
    where: {
      groupId: parseInt(groupId),
      status: 'completed',
      winnerId: { not: null }
    },
    include: {
      winningMeal: {
        include: {
          mealFoods: {
            include: {
              food: true
            }
          }
        }
      },
      winner: {
        select: {
          id: true,
          username: true
        }
      },
      host: {
        select: {
          id: true,
          username: true
        }
      },
      participants: {
        include: {
          profile: {
            select: {
              id: true,
              username: true
            }
          },
          meal: true
        }
      },
      _count: {
        select: {
          participants: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    skip: offset,
    take: limit
  });

  // Format the response
  const formattedSessions = sessions.map(session => ({
    sessionId: session.GameSessionID,
    gameType: session.gameType,
    duration: session.duration,
    createdAt: session.createdAt,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    winner: {
      id: session.winner?.id,
      username: session.winner?.username,
      clickCount: session.participants?.find(p => p.profileId === session.winnerId)?.clickCount || 0
    },
    winningMeal: session.winningMeal ? {
      mealId: session.winningMeal.MealID,
      name: session.winningMeal.name,
      description: session.winningMeal.description
    } : null,
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
 * Get a specific game session with full details including portions
 */
async function getGameSessionDetails(sessionId) {
  const session = await prisma.gameSession.findUnique({
    where: { GameSessionID: parseInt(sessionId) },
    include: {
      winningMeal: {
        include: {
          mealFoods: {
            include: {
              food: true
            }
          }
        }
      },
      winner: {
        select: {
          id: true,
          username: true
        }
      },
      host: {
        select: {
          id: true,
          username: true
        }
      },
      participants: {
        include: {
          profile: {
            select: {
              id: true,
              username: true
            }
          },
          meal: {
            include: {
              mealFoods: {
                include: {
                  food: true
                }
              }
            }
          }
        },
        orderBy: {
          joinedAt: 'asc'
        }
      }
    }
  });

  if (!session) {
    return null;
  }

  // Fetch meal consumptions for game session
  // Only fetch individual portion selections (type = 'individual') to check if user selected their portion
  const mealConsumptions = await prisma.mealConsumption.findMany({
    where: {
      gameSessionId: parseInt(sessionId),
      source: 'game',
      type: 'individual' // Only individual portion selections, not group-level records
    },
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
    }
  });

  // Group consumptions by profile ID
  const consumptionsByProfile = {};
  mealConsumptions.forEach(consumption => {
    if (!consumptionsByProfile[consumption.profileId]) {
      consumptionsByProfile[consumption.profileId] = [];
    }
    consumptionsByProfile[consumption.profileId].push(consumption);
  });

  // Format participant data
  const participants = session.participants.map(participant => {
    const participantConsumptions = consumptionsByProfile[participant.profileId] || [];
    const hasSelectedPortion = participantConsumptions.length > 0;
    const portionFraction = hasSelectedPortion ? participantConsumptions[0].portionFraction : undefined;
    
    return {
      participantId: participant.GameParticipantID,
      profile: {
        id: participant.profile.id,
        username: participant.profile.username
      },
      proposedMeal: participant.meal ? {
        mealId: participant.meal.MealID,
        name: participant.meal.name,
        description: participant.meal.description,
        foods: participant.meal.mealFoods.map(mf => ({
          foodId: mf.food.FoodID,
          name: mf.food.name,
          quantity: mf.quantity,
          kCal: mf.food.kCal
        }))
      } : null,
      clickCount: participant.clickCount,
      isReady: participant.isReady,
      hasSubmitted: participant.hasSubmitted,
      joinedAt: participant.joinedAt,
      submittedAt: participant.submittedAt,
      hasSelectedPortion,
      portionFraction,
      // Meal consumptions
      mealConsumptions: participantConsumptions.map(mc => ({
        mealId: mc.mealId,
        mealName: mc.meal.name,
        mealConsumptionId: mc.MealConsumptionID,
        consumedAt: mc.consumedAt,
        totalKcal: mc.totalKcal,
        foodPortions: mc.foodPortions.map(fp => ({
          foodId: fp.foodId,
          name: fp.food.name,
          portionFraction: fp.portionFraction,
          quantityConsumed: fp.quantityConsumed
        }))
      }))
    };
  });

  // Format the response
  return {
    sessionId: session.GameSessionID,
    gameType: session.gameType,
    duration: session.duration,
    status: session.status,
    createdAt: session.createdAt,
    startTime: session.startTime,
    endTime: session.endTime,
    host: {
      id: session.host.id,
      username: session.host.username
    },
    winner: session.winner ? {
      id: session.winner.id,
      username: session.winner.username,
      clickCount: participants.find(p => p.profile.id === session.winnerId)?.clickCount || 0
    } : null,
    winningMeal: session.winningMeal ? {
      mealId: session.winningMeal.MealID,
      name: session.winningMeal.name,
      description: session.winningMeal.description,
      foods: session.winningMeal.mealFoods.map(mf => ({
        foodId: mf.food.FoodID,
        name: mf.food.name,
        quantity: mf.quantity,
        kCal: mf.food.kCal
      }))
    } : null,
    participants
  };
}

/**
 * Register meal portion for a game participant
 * Allows participants to record what portions of the winning meal they consumed
 */
async function registerGameMealPortion(sessionId, profileId, mealId, portionData) {
  console.log('[Game History Lib] registerGameMealPortion called with:', {
    sessionId,
    profileId,
    mealId,
    portionData
  });
  
  const { mealPortionFraction, foodPortions } = portionData;
  
  console.log('[Game History Lib] Destructured values:', {
    mealPortionFraction,
    foodPortionsCount: foodPortions?.length
  });

  // Verify participant was in the game
  const participant = await prisma.gameParticipant.findFirst({
    where: {
      gameSessionId: parseInt(sessionId),
      profileId: profileId
    }
  });

  if (!participant) {
    throw new Error('You were not a participant in this game session');
  }

  // Verify the game is completed
  const session = await prisma.gameSession.findUnique({
    where: { GameSessionID: parseInt(sessionId) },
    include: {
      winningMeal: {
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

  if (!session || session.status !== 'completed') {
    throw new Error('Can only register portions for completed games');
  }

  if (!session.winningMeal) {
    throw new Error('Game session does not have a winning meal');
  }

  // Check if INDIVIDUAL consumption already exists for this user and game session
  // Don't find the group-level consumption - we only want to update individual portions
  const existingConsumption = await prisma.mealConsumption.findFirst({
    where: {
      profileId: profileId,
      gameSessionId: parseInt(sessionId),
      source: 'game',
      type: 'individual' // Only find individual portion selections, not group consumption
    }
  });

  // Calculate total calories from selected portions
  const totalCalories = session.winningMeal.mealFoods.reduce((sum, mealFood) => {
    const foodPortion = foodPortions.find(fp => fp.foodId === mealFood.foodId);
    const portionFraction = foodPortion ? parseFloat(foodPortion.portionFraction) : mealPortionFraction;
    const quantityConsumed = mealFood.quantity * portionFraction;
    return sum + (mealFood.food.kCal * quantityConsumed);
  }, 0);

  let mealConsumption;
  if (existingConsumption) {
    // Delete existing food portions
    await prisma.foodPortion.deleteMany({
      where: { mealConsumptionId: existingConsumption.MealConsumptionID }
    });

    // Update existing meal consumption
    mealConsumption = await prisma.mealConsumption.update({
      where: { MealConsumptionID: existingConsumption.MealConsumptionID },
      data: {
        name: `${session.winningMeal.name} (${Math.round(parseFloat(mealPortionFraction) * 100)}%)`,
        description: `From ${formatGameType(session.gameType)} game - ${Math.round(parseFloat(mealPortionFraction) * 100)}% portion`,
        type: 'individual', // Individual portion selection
        portionFraction: parseFloat(mealPortionFraction),
        totalKcal: Math.round(totalCalories),
        consumedAt: new Date(),
        foodPortions: {
          create: foodPortions.map(fp => {
            const originalFood = session.winningMeal?.mealFoods.find(mf => mf.foodId === fp.foodId);
            const quantityConsumed = originalFood 
              ? originalFood.quantity * fp.portionFraction 
              : 0;

            return {
              foodId: fp.foodId,
              portionFraction: fp.portionFraction,
              quantityConsumed: quantityConsumed
            };
          })
        }
      },
      include: {
        foodPortions: {
          include: {
            food: true
          }
        }
      }
    });
    console.log('[Game History] Updated meal consumption:', mealConsumption.MealConsumptionID);
  } else {
    // Create new individual meal consumption (no groupId - this is personal consumption)
    mealConsumption = await prisma.mealConsumption.create({
      data: {
        name: `${session.winningMeal.name} (${Math.round(parseFloat(mealPortionFraction) * 100)}%)`,
        description: `From ${formatGameType(session.gameType)} game - ${Math.round(parseFloat(mealPortionFraction) * 100)}% portion`,
        profileId: profileId,
        mealId: parseInt(mealId),
        groupId: null, // Individual consumption from game portion selection
        type: 'individual', // Individual portion selection
        source: 'game',
        gameSessionId: parseInt(sessionId),
        portionFraction: parseFloat(mealPortionFraction),
        quantity: 1,
        totalKcal: Math.round(totalCalories),
        consumedAt: new Date(),
        foodPortions: {
          create: foodPortions.map(fp => {
            const originalFood = session.winningMeal?.mealFoods.find(mf => mf.foodId === fp.foodId);
            const quantityConsumed = originalFood 
              ? originalFood.quantity * fp.portionFraction 
              : 0;

            return {
              foodId: fp.foodId,
              portionFraction: fp.portionFraction,
              quantityConsumed: quantityConsumed
            };
          })
        }
      },
      include: {
        foodPortions: {
          include: {
            food: true
          }
        }
      }
    });
    console.log('[Game History] Created meal consumption:', mealConsumption.MealConsumptionID, 'with', totalCalories, 'kCal');
  }

  return mealConsumption;
}

module.exports = {
  getGroupGameHistory,
  getGameSessionDetails,
  registerGameMealPortion
};
