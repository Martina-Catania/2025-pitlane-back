const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BadgesLibrary = require('./badgesLib');

/**
 * Create group-level consumption record for a completed game
 * Individual consumptions are created only when participants select their portions
 */
async function recordGroupConsumptionForGame(session) {
  try {
    if (!session || session.status !== 'completed' || !session.winningMeal) return;

    const groupId = session.groupId;
    // Calculate total Kcal of the winning meal
    const totalKcal = session.winningMeal.mealFoods.reduce((sum, mf) => {
      return sum + (mf.food.kCal * mf.quantity);
    }, 0);

    const name = `${session.winningMeal.name} (Game: ${session.gameType})`;
    const description = `Chosen from ${session.gameType} game session #${session.GameSessionID}`;

    // Create a single group-level consumption record
    // This shows in group activity but NOT in individual histories
    // Individual consumptions are created when users select their portions
    await prisma.mealConsumption.create({
      data: {
        name,
        description: `Group game consumption: ${description}`,
        profileId: session.hostId, // Use game host as the representative
        mealId: session.winningMealId,
        groupId: groupId,
        type: 'group', // Group-level record
        source: 'game',
        gameSessionId: session.GameSessionID,
        portionFraction: 1.0,
        quantity: 1,
        totalKcal: Math.round(totalKcal),
        consumedAt: session.endTime || new Date(),
        foodPortions: {
          create: session.winningMeal.mealFoods.map(mf => ({
            foodId: mf.foodId,
            portionFraction: 1.0,
            quantityConsumed: mf.quantity
          }))
        }
      }
    });

    console.log(`[gamesLib] Created group-level consumption for game #${session.GameSessionID}`);
  } catch (err) {
    console.error('[gamesLib] Error recording group consumption for game:', err);
  }
}

/**
 * Create a new game session
 */
async function createGameSession(groupId, hostId, gameType, duration = 30, minPlayers = 1) {
  try {
    // Verify host is a member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: parseInt(groupId),
        profileId: hostId
      }
    });

    if (!membership) {
      throw new Error('Host is not a member of this group');
    }

    // Check if there's already an active game session for this group
    const existingSession = await prisma.gameSession.findFirst({
      where: {
        groupId: parseInt(groupId),
        status: {
          in: ['waiting', 'ready', 'countdown', 'playing', 'submitting']
        }
      }
    });

    if (existingSession) {
      throw new Error('There is already an active game session for this group');
    }

    const gameSession = await prisma.gameSession.create({
      data: {
        groupId: parseInt(groupId),
        hostId,
        gameType,
        duration: parseInt(duration),
        minPlayers: parseInt(minPlayers),
        status: 'waiting'
      },
      include: {
        host: {
          select: {
            id: true,
            username: true
          }
        },
        group: {
          select: {
            GroupID: true,
            name: true
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
        }
      }
    });

    return gameSession;
  } catch (error) {
    console.error('[gamesLib] Error creating game session:', error);
    throw error;
  }
}

/**
 * Join a game session with a meal proposal
 */
async function joinGameSession(gameSessionId, profileId, mealId) {
  try {
    const gameSession = await prisma.gameSession.findUnique({
      where: { GameSessionID: parseInt(gameSessionId) },
      include: {
        group: true,
        participants: true
      }
    });

    if (!gameSession) {
      throw new Error('Game session not found');
    }

    if (gameSession.status !== 'waiting' && gameSession.status !== 'ready') {
      throw new Error('Cannot join game - game has already started or finished');
    }

    // Verify user is a member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: gameSession.groupId,
        profileId
      }
    });

    if (!membership) {
      throw new Error('You must be a member of the group to join this game');
    }

    // Check if already participating
    const existingParticipant = gameSession.participants.find(
      p => p.profileId === profileId
    );

    if (existingParticipant) {
      // Update meal if different
      if (mealId && existingParticipant.mealId !== parseInt(mealId)) {
        const updated = await prisma.gameParticipant.update({
          where: { GameParticipantID: existingParticipant.GameParticipantID },
          data: { mealId: parseInt(mealId) },
          include: {
            profile: {
              select: {
                id: true,
                username: true
              }
            },
            meal: true
          }
        });
        return updated;
      }
      return existingParticipant;
    }

    // Verify meal belongs to the user
    if (mealId) {
      const meal = await prisma.meal.findUnique({
        where: { MealID: parseInt(mealId) }
      });

      if (!meal) {
        throw new Error('Invalid meal selection');
      }
    }

    const participant = await prisma.gameParticipant.create({
      data: {
        gameSessionId: parseInt(gameSessionId),
        profileId,
        mealId: mealId ? parseInt(mealId) : null,
        isReady: false
      },
      include: {
        profile: {
          select: {
            id: true,
            username: true
          }
        },
        meal: true
      }
    });

    return participant;
  } catch (error) {
    console.error('[gamesLib] Error joining game session:', error);
    throw error;
  }
}

/**
 * Mark player as ready
 */
async function markPlayerReady(gameSessionId, profileId, isReady = true) {
  try {
    const participant = await prisma.gameParticipant.findFirst({
      where: {
        gameSessionId: parseInt(gameSessionId),
        profileId
      }
    });

    if (!participant) {
      throw new Error('Participant not found');
    }

    const updated = await prisma.gameParticipant.update({
      where: { GameParticipantID: participant.GameParticipantID },
      data: { isReady },
      include: {
        profile: {
          select: {
            id: true,
            username: true
          }
        },
        meal: true
      }
    });

    // Check if all participants are ready
    const allParticipants = await prisma.gameParticipant.findMany({
      where: { gameSessionId: parseInt(gameSessionId) }
    });

    // Get the game session to check minPlayers
    const gameSession = await prisma.gameSession.findUnique({
      where: { GameSessionID: parseInt(gameSessionId) }
    });

    const allReady = allParticipants.length >= gameSession.minPlayers && 
                     allParticipants.every(p => p.isReady);

    if (allReady) {
      await prisma.gameSession.update({
        where: { GameSessionID: parseInt(gameSessionId) },
        data: { status: 'ready' }
      });
    }

    return updated;
  } catch (error) {
    console.error('[gamesLib] Error marking player ready:', error);
    throw error;
  }
}

/**
 * Start game countdown (host only)
 */
async function startGameCountdown(gameSessionId, hostId) {
  try {
    const gameSession = await prisma.gameSession.findUnique({
      where: { GameSessionID: parseInt(gameSessionId) }
    });

    if (!gameSession) {
      throw new Error('Game session not found');
    }

    if (gameSession.hostId !== hostId) {
      throw new Error('Only the host can start the game');
    }

    if (gameSession.status !== 'ready') {
      throw new Error('Game is not ready to start');
    }

    const updated = await prisma.gameSession.update({
      where: { GameSessionID: parseInt(gameSessionId) },
      data: { 
        status: 'countdown',
        updatedAt: new Date()
      },
      include: {
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
        }
      }
    });

    return updated;
  } catch (error) {
    console.error('[gamesLib] Error starting countdown:', error);
    throw error;
  }
}

/**
 * Transition from countdown to playing
 */
async function startGamePlaying(gameSessionId) {
  try {
    const updated = await prisma.gameSession.update({
      where: { GameSessionID: parseInt(gameSessionId) },
      data: { 
        status: 'playing',
        startTime: new Date()
      },
      include: {
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
        }
      }
    });

    return updated;
  } catch (error) {
    console.error('[gamesLib] Error starting game playing:', error);
    throw error;
  }
}

/**
 * End game and transition to submitting state
 */
async function endGameTime(gameSessionId) {
  try {
    const updated = await prisma.gameSession.update({
      where: { GameSessionID: parseInt(gameSessionId) },
      data: { 
        status: 'submitting',
        endTime: new Date()
      },
      include: {
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
        }
      }
    });

    return updated;
  } catch (error) {
    console.error('[gamesLib] Error ending game time:', error);
    throw error;
  }
}

/**
 * Submit click count for a participant
 */
async function submitClickCount(gameSessionId, profileId, clickCount) {
  try {
    const gameSession = await prisma.gameSession.findUnique({
      where: { GameSessionID: parseInt(gameSessionId) }
    });

    if (!gameSession) {
      throw new Error('Game session not found');
    }

    if (gameSession.status !== 'submitting' && gameSession.status !== 'playing') {
      throw new Error('Cannot submit clicks at this time');
    }

    const participant = await prisma.gameParticipant.findFirst({
      where: {
        gameSessionId: parseInt(gameSessionId),
        profileId
      }
    });

    if (!participant) {
      throw new Error('Participant not found');
    }

    const updated = await prisma.gameParticipant.update({
      where: { GameParticipantID: participant.GameParticipantID },
      data: {
        clickCount: parseInt(clickCount),
        hasSubmitted: true,
        submittedAt: new Date()
      },
      include: {
        profile: {
          select: {
            id: true,
            username: true
          }
        },
        meal: true
      }
    });

    // Check if all participants have submitted
    const allParticipants = await prisma.gameParticipant.findMany({
      where: { gameSessionId: parseInt(gameSessionId) }
    });

    const allSubmitted = allParticipants.every(p => p.hasSubmitted);

    if (allSubmitted) {
      // Determine winner
      const winner = allParticipants.reduce((max, p) => 
        p.clickCount > max.clickCount ? p : max
      );

      const completed = await prisma.gameSession.update({
        where: { GameSessionID: parseInt(gameSessionId) },
        data: {
          status: 'completed',
          winnerId: winner.profileId,
          winningMealId: winner.mealId
        },
        include: {
          group: {
            include: {
              members: {
                where: { isActive: true },
                select: { profileId: true }
              }
            }
          },
          winningMeal: {
            include: {
              mealFoods: { include: { food: true } }
            }
          }
        }
      });

      await recordGroupConsumptionForGame(completed);
      
      // Award badge to the winner and get notifications
      const badgeResult = await BadgesLibrary.checkAndAwardBadges(winner.profileId, 'game_clicker_won');
      
      // Attach badge notifications to updated participant
      if (badgeResult.success && badgeResult.badgeNotifications && badgeResult.badgeNotifications.length > 0) {
        updated.badgeNotifications = badgeResult.badgeNotifications;
        console.log(`[gamesLib] Winner ${winner.profileId} earned ${badgeResult.badgeNotifications.length} badge(s)!`);
      }
    }

    return updated;
  } catch (error) {
    console.error('[gamesLib] Error submitting click count:', error);
    throw error;
  }
}

/**
 * Get game session with full details
 */
async function getGameSession(gameSessionId) {
  try {
    const gameSession = await prisma.gameSession.findUnique({
      where: { GameSessionID: parseInt(gameSessionId) },
      include: {
        host: {
          select: {
            id: true,
            username: true
          }
        },
        winner: {
          select: {
            id: true,
            username: true
          }
        },
        winningMeal: true,
        group: {
          select: {
            GroupID: true,
            name: true,
            description: true
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
            clickCount: 'desc'
          }
        }
      }
    });

    return gameSession;
  } catch (error) {
    console.error('[gamesLib] Error getting game session:', error);
    throw error;
  }
}

/**
 * Get active game session for a group
 */
async function getActiveGameSession(groupId) {
  try {
    const gameSession = await prisma.gameSession.findFirst({
      where: {
        groupId: parseInt(groupId),
        status: {
          in: ['waiting', 'ready', 'countdown', 'playing', 'submitting']
        }
      },
      include: {
        host: {
          select: {
            id: true,
            username: true
          }
        },
        group: {
          select: {
            GroupID: true,
            name: true
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return gameSession;
  } catch (error) {
    console.error('[gamesLib] Error getting active game session:', error);
    throw error;
  }
}

/**
 * Cancel a game session (host only)
 */
async function cancelGameSession(gameSessionId, hostId) {
  try {
    const gameSession = await prisma.gameSession.findUnique({
      where: { GameSessionID: parseInt(gameSessionId) },
      include: {
        participants: true
      }
    });

    if (!gameSession) {
      throw new Error('Game session not found');
    }

    if (gameSession.hostId !== hostId) {
      throw new Error('Only the host can cancel the game');
    }

    if (gameSession.status === 'completed') {
      throw new Error('Cannot cancel a completed game');
    }

    // Check if any meals have been proposed (for roulette games)
    if (gameSession.gameType === 'roulette') {
      const hasMealsProposed = gameSession.participants.some(p => p.mealId !== null);
      if (hasMealsProposed) {
        throw new Error('Cannot cancel game after meals have been proposed');
      }
    }

    // Check if game has started (for clicker games)
    if (gameSession.gameType === 'egg_clicker' && ['playing', 'submitting'].includes(gameSession.status)) {
      throw new Error('Cannot cancel game after it has started');
    }

    const updated = await prisma.gameSession.update({
      where: { GameSessionID: parseInt(gameSessionId) },
      data: { status: 'cancelled' }
    });

    return updated;
  } catch (error) {
    console.error('[gamesLib] Error cancelling game session:', error);
    throw error;
  }
}

/**
 * Force complete game (host can skip waiting for all submissions)
 */
async function forceCompleteGame(gameSessionId, hostId) {
  try {
    const gameSession = await prisma.gameSession.findUnique({
      where: { GameSessionID: parseInt(gameSessionId) },
      include: {
        participants: {
          include: {
            profile: { select: { id: true, username: true } },
            meal: { select: { MealID: true, name: true } }
          }
        }
      }
    });

    if (!gameSession) {
      throw new Error('Game session not found');
    }

    if (gameSession.hostId !== hostId) {
      throw new Error('Only the host can force complete the game');
    }

    if (gameSession.status !== 'submitting') {
      throw new Error('Game must be in submitting state to force complete');
    }

    // Determine winner from submitted participants only
    const submittedParticipants = gameSession.participants.filter(p => p.hasSubmitted);

    if (submittedParticipants.length === 0) {
      throw new Error('At least one player must have submitted their score');
    }

    // Find winner (highest click count among submitted)
    const winner = submittedParticipants.reduce((prev, current) =>
      current.clickCount > prev.clickCount ? current : prev
    );

    const updatedGame = await prisma.gameSession.update({
      where: { GameSessionID: parseInt(gameSessionId) },
      data: {
        status: 'completed',
        winnerId: winner.profileId,
        winningMealId: winner.mealId
      },
      include: {
        participants: {
          include: {
            profile: { select: { id: true, username: true } },
            meal: { select: { MealID: true, name: true } }
          },
          orderBy: { clickCount: 'desc' }
        },
        winner: { select: { id: true, username: true } },
        winningMeal: { include: { mealFoods: { include: { food: true } } } },
        group: {
          include: {
            members: { where: { isActive: true }, select: { profileId: true } }
          }
        }
      }
    });

    await recordGroupConsumptionForGame(updatedGame);
    
    // Award badge to the winner and get notifications
    const badgeResult = await BadgesLibrary.checkAndAwardBadges(winner.profileId, 'game_clicker_won');
    
    // Attach badge notifications to game response
    if (badgeResult.success && badgeResult.badgeNotifications && badgeResult.badgeNotifications.length > 0) {
      updatedGame.badgeNotifications = badgeResult.badgeNotifications;
      console.log(`[gamesLib] Winner ${winner.profileId} earned ${badgeResult.badgeNotifications.length} badge(s)!`);
    }

    return updatedGame;
  } catch (error) {
    console.error('[gamesLib] Error forcing game completion:', error);
    throw error;
  }
}

module.exports = {
  createGameSession,
  joinGameSession,
  markPlayerReady,
  startGameCountdown,
  startGamePlaying,
  endGameTime,
  submitClickCount,
  getGameSession,
  getActiveGameSession,
  cancelGameSession,
  forceCompleteGame,
  /**
   * Complete a roulette game by selecting a random participant's meal
   * Only host can trigger the spin. Works when status is 'ready' or 'playing'/'submitting'.
   */
  /**
   * Determine roulette winner without completing the game (for animation)
   */
  determineRouletteWinner: async function (gameSessionId, hostId) {
    try {
      const gameSession = await prisma.gameSession.findUnique({
        where: { GameSessionID: parseInt(gameSessionId) },
        include: {
          participants: {
            include: {
              profile: { select: { id: true, username: true } },
              meal: { select: { MealID: true, name: true } }
            }
          }
        }
      });

      if (!gameSession) {
        throw new Error('Game session not found');
      }

      if (gameSession.gameType !== 'roulette') {
        throw new Error('This action is only valid for roulette games');
      }

      if (gameSession.hostId !== hostId) {
        throw new Error('Only the host can spin the roulette');
      }

      if (['cancelled', 'completed'].includes(gameSession.status)) {
        throw new Error('Game is not active');
      }

      // Eligible participants: have a proposed meal
      const eligible = gameSession.participants.filter(p => p.mealId);

      if (eligible.length === 0) {
        throw new Error('No meal proposals to select from');
      }

      // Randomly pick one
      const idx = Math.floor(Math.random() * eligible.length);
      const winner = eligible[idx];

      // Return winner info and all meals for animation
      return {
        winnerId: winner.GameParticipantID,
        winnerProfileId: winner.profileId,
        winnerMealId: winner.mealId,
        meals: eligible.map(p => ({
          id: p.GameParticipantID,
          profileId: p.profileId,
          username: p.profile.username,
          mealId: p.mealId,
          mealName: p.meal?.name || 'Unknown'
        }))
      };
    } catch (error) {
      console.error('[gamesLib] Error determining roulette winner:', error);
      throw error;
    }
  },

  completeRoulette: async function (gameSessionId, hostId, winnerProfileId = null) {
    try {
      const gameSession = await prisma.gameSession.findUnique({
        where: { GameSessionID: parseInt(gameSessionId) },
        include: {
          participants: {
            include: {
              profile: { select: { id: true, username: true } },
              meal: { select: { MealID: true, name: true } }
            }
          }
        }
      });

      if (!gameSession) {
        throw new Error('Game session not found');
      }

      if (gameSession.gameType !== 'roulette') {
        throw new Error('This action is only valid for roulette games');
      }

      if (gameSession.hostId !== hostId) {
        throw new Error('Only the host can spin the roulette');
      }

      if (['cancelled', 'completed'].includes(gameSession.status)) {
        throw new Error('Game is not active');
      }

      // Eligible participants: have a proposed meal
      const eligible = gameSession.participants.filter(p => p.mealId);

      if (eligible.length === 0) {
        throw new Error('No meal proposals to select from');
      }

      // Use predetermined winner if provided, otherwise pick randomly
      let winner;
      if (winnerProfileId) {
        winner = eligible.find(p => p.profileId === winnerProfileId);
        if (!winner) {
          throw new Error('Predetermined winner not found among eligible participants');
        }
      } else {
        // Randomly pick one
        const idx = Math.floor(Math.random() * eligible.length);
        winner = eligible[idx];
      }

      const updatedGame = await prisma.gameSession.update({
        where: { GameSessionID: parseInt(gameSessionId) },
        data: {
          status: 'completed',
          winnerId: winner.profileId,
          winningMealId: winner.mealId
        },
        include: {
          participants: {
            include: {
              profile: { select: { id: true, username: true } },
              meal: { select: { MealID: true, name: true } }
            }
          },
          winner: { select: { id: true, username: true } },
          winningMeal: { include: { mealFoods: { include: { food: true } } } },
          group: {
            include: {
              members: { where: { isActive: true }, select: { profileId: true } }
            }
          }
        }
      });

      await recordGroupConsumptionForGame(updatedGame);
      
      // Award badge to the winner and get notifications
      const badgeResult = await BadgesLibrary.checkAndAwardBadges(winner.profileId, 'game_roulette_won');
      
      // Attach badge notifications to game response
      if (badgeResult.success && badgeResult.badgeNotifications && badgeResult.badgeNotifications.length > 0) {
        updatedGame.badgeNotifications = badgeResult.badgeNotifications;
        console.log(`[gamesLib] Winner ${winner.profileId} earned ${badgeResult.badgeNotifications.length} badge(s)!`);
      }

      return updatedGame;
    } catch (error) {
      console.error('[gamesLib] Error completing roulette:', error);
      throw error;
    }

  },
};
