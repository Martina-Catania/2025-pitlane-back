const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class BadgesLibrary {
  // Get all available badges
  static async getAllBadges() {
    try {
      const badges = await prisma.badge.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      });
      return { success: true, data: badges };
    } catch (error) {
      console.error('Error fetching badges:', error);
      return { success: false, error: 'Failed to fetch badges' };
    }
  }

  // Get user badges with badge details (including level information)
  static async getUserBadges(profileId) {
    try {
      const userBadges = await prisma.userBadge.findMany({
        where: { 
          profileId: profileId
        },
        include: {
          badge: {
            include: {
              requirements: true
            }
          }
        },
        orderBy: { earnedAt: 'desc' }
      });
      
      return { 
        success: true, 
        data: userBadges.map(ub => ({
          ...ub.badge,
          currentLevel: ub.currentLevel,
          earnedAt: ub.earnedAt,
          lastUpgraded: ub.lastUpgraded,
          progress: ub.progress,
          isCompleted: ub.isCompleted,
          requirements: ub.badge.requirements
        }))
      };
    } catch (error) {
      console.error('Error fetching user badges:', error);
      return { success: false, error: 'Failed to fetch user badges' };
    }
  }

  // Get badge progress for a user (including incomplete badges)
  static async getUserBadgeProgress(profileId) {
    try {
      const allBadges = await prisma.badge.findMany({
        where: { isActive: true },
        include: {
          requirements: {
            orderBy: { requiredCount: 'asc' }
          }
        }
      });

      const userBadges = await prisma.userBadge.findMany({
        where: { profileId: profileId },
        include: { 
          badge: {
            include: {
              requirements: {
                orderBy: { requiredCount: 'asc' }
              }
            }
          }
        }
      });

      const badgeProgress = allBadges.map(badge => {
        const userBadge = userBadges.find(ub => ub.badgeId === badge.BadgeID);
        
        // Get requirements for current and next level
        let currentLevelReq = null;
        let nextLevelReq = null;
        
        if (userBadge) {
          currentLevelReq = badge.requirements.find(r => r.level === userBadge.currentLevel);
          const levelOrder = ['bronze', 'silver', 'gold', 'diamond'];
          const currentIndex = levelOrder.indexOf(userBadge.currentLevel);
          if (currentIndex < levelOrder.length - 1) {
            const nextLevel = levelOrder[currentIndex + 1];
            nextLevelReq = badge.requirements.find(r => r.level === nextLevel);
          }
        } else {
          // User doesn't have badge yet, show bronze requirement
          currentLevelReq = badge.requirements.find(r => r.level === 'bronze');
        }

        return {
          badge,
          currentLevel: userBadge ? userBadge.currentLevel : null,
          progress: userBadge ? userBadge.progress : 0,
          isCompleted: userBadge ? userBadge.isCompleted : false,
          earnedAt: userBadge ? userBadge.earnedAt : null,
          lastUpgraded: userBadge ? userBadge.lastUpgraded : null,
          currentLevelRequirement: currentLevelReq,
          nextLevelRequirement: nextLevelReq,
          hasEarned: !!userBadge
        };
      });

      return { success: true, data: badgeProgress };
    } catch (error) {
      console.error('Error fetching badge progress:', error);
      return { success: false, error: 'Failed to fetch badge progress' };
    }
  }

  // Get next badge level
  static getNextLevel(currentLevel) {
    const levelOrder = ['bronze', 'silver', 'gold', 'diamond'];
    const currentIndex = levelOrder.indexOf(currentLevel);
    if (currentIndex === -1 || currentIndex === levelOrder.length - 1) return null;
    return levelOrder[currentIndex + 1];
  }

  // Award or upgrade a badge for a user
  static async awardBadge(profileId, badgeId, incrementProgress = 1) {
    try {
      // Check if badge exists and get all requirements
      const badge = await prisma.badge.findUnique({
        where: { BadgeID: badgeId, isActive: true },
        include: {
          requirements: {
            orderBy: { requiredCount: 'asc' }
          }
        }
      });

      if (!badge) {
        return { success: false, error: 'Badge not found' };
      }

      // Check if user already has this badge
      const existingUserBadge = await prisma.userBadge.findUnique({
        where: { 
          profileId_badgeId: { 
            profileId: profileId, 
            badgeId: badgeId 
          }
        },
        include: { badge: true }
      });

      const newProgress = existingUserBadge ? existingUserBadge.progress + incrementProgress : incrementProgress;

      if (existingUserBadge) {
        // Check if we can upgrade to a higher level
        const nextLevel = this.getNextLevel(existingUserBadge.currentLevel);
        
        if (!nextLevel) {
          // Already at max level (diamond)
          return { 
            success: true, 
            data: existingUserBadge, 
            alreadyMaxLevel: true,
            progress: newProgress
          };
        }

        const nextLevelRequirement = badge.requirements.find(r => r.level === nextLevel);
        
        if (nextLevelRequirement && newProgress >= nextLevelRequirement.requiredCount) {
          // Upgrade to next level
          const isMaxLevel = nextLevel === 'diamond';
          const updatedUserBadge = await prisma.userBadge.update({
            where: { UserBadgeID: existingUserBadge.UserBadgeID },
            data: { 
              currentLevel: nextLevel,
              progress: newProgress,
              lastUpgraded: new Date(),
              isCompleted: isMaxLevel
            },
            include: { badge: true }
          });

          return { 
            success: true, 
            data: updatedUserBadge,
            leveledUp: true,
            oldLevel: existingUserBadge.currentLevel,
            newLevel: nextLevel,
            progress: newProgress
          };
        } else {
          // Just update progress, no level up
          const updatedUserBadge = await prisma.userBadge.update({
            where: { UserBadgeID: existingUserBadge.UserBadgeID },
            data: { 
              progress: newProgress
            },
            include: { badge: true }
          });

          return { 
            success: true, 
            data: updatedUserBadge,
            progressUpdated: true,
            progress: newProgress
          };
        }
      } else {
        // Create new user badge at bronze level
        const bronzeRequirement = badge.requirements.find(r => r.level === 'bronze');
        
        if (!bronzeRequirement) {
          return { success: false, error: 'Bronze level requirement not found' };
        }

        const hasEarnedBronze = newProgress >= bronzeRequirement.requiredCount;

        const userBadge = await prisma.userBadge.create({
          data: {
            profileId: profileId,
            badgeId: badgeId,
            currentLevel: 'bronze',
            progress: newProgress,
            isCompleted: false, // Never completed on first award
            earnedAt: hasEarnedBronze ? new Date() : undefined
          },
          include: { badge: true }
        });

        return { 
          success: true, 
          data: userBadge,
          newlyEarned: hasEarnedBronze,
          newLevel: 'bronze',
          progress: newProgress
        };
      }
    } catch (error) {
      console.error('Error awarding badge:', error);
      return { success: false, error: 'Failed to award badge' };
    }
  }

  // Check and award badges based on user actions
  static async checkAndAwardBadges(profileId, action, data = {}) {
    const results = [];

    try {
      switch (action) {
        case 'group_created':
          const groupCreatorBadge = await prisma.badge.findFirst({
            where: { badgeType: 'group_creation', isActive: true }
          });
          if (groupCreatorBadge) {
            const result = await this.awardBadge(profileId, groupCreatorBadge.BadgeID, 1);
            results.push(result);
          }
          break;

        case 'meal_created':
          const mealCreatorBadge = await prisma.badge.findFirst({
            where: { badgeType: 'meal_creation', isActive: true }
          });
          if (mealCreatorBadge) {
            const result = await this.awardBadge(profileId, mealCreatorBadge.BadgeID, 1);
            results.push(result);
          }
          break;

        case 'planned_meal_created':
          const mealPlanningBadge = await prisma.badge.findFirst({
            where: { badgeType: 'meal_planning', isActive: true }
          });
          if (mealPlanningBadge) {
            const result = await this.awardBadge(profileId, mealPlanningBadge.BadgeID, 1);
            results.push(result);
          }
          break;

        case 'voting_participated':
          const votingParticipantBadge = await prisma.badge.findFirst({
            where: { badgeType: 'voting_participation', isActive: true }
          });
          if (votingParticipantBadge) {
            const result = await this.awardBadge(profileId, votingParticipantBadge.BadgeID, 1);
            results.push(result);
          }
          break;

        case 'voting_won':
          const votingWinnerBadge = await prisma.badge.findFirst({
            where: { badgeType: 'voting_winner', isActive: true }
          });
          if (votingWinnerBadge) {
            const result = await this.awardBadge(profileId, votingWinnerBadge.BadgeID, 1);
            results.push(result);
          }
          break;

        case 'game_clicker_won':
          const clickerWinnerBadge = await prisma.badge.findFirst({
            where: { badgeType: 'game_clicker_winner', isActive: true }
          });
          if (clickerWinnerBadge) {
            const result = await this.awardBadge(profileId, clickerWinnerBadge.BadgeID, 1);
            results.push(result);
          }
          break;

        case 'game_roulette_won':
          const rouletteWinnerBadge = await prisma.badge.findFirst({
            where: { badgeType: 'game_roulette_winner', isActive: true }
          });
          if (rouletteWinnerBadge) {
            const result = await this.awardBadge(profileId, rouletteWinnerBadge.BadgeID, 1);
            results.push(result);
          }
          break;

        default:
          console.warn(`Unknown badge action: ${action}`);
      }

      // Filter results for newly earned or leveled up badges
      const badgeNotifications = results
        .filter(r => r.success && (r.newlyEarned || r.leveledUp))
        .map(r => ({
          badge: r.data.badge,
          level: r.newLevel || r.data.currentLevel,
          isNewBadge: r.newlyEarned,
          isLevelUp: r.leveledUp,
          oldLevel: r.oldLevel,
          progress: r.progress
        }));

      return {
        success: true,
        badgeNotifications,
        allResults: results
      };

    } catch (error) {
      console.error('Error checking and awarding badges:', error);
      return { success: false, error: 'Failed to check badges' };
    }
  }

  // Get badge statistics for a user
  static async getUserBadgeStats(profileId) {
    try {
      const allBadges = await prisma.badge.findMany({
        where: { isActive: true },
        include: {
          requirements: true
        }
      });

      // Count total unique badge types
      const totalBadges = allBadges.length;

      // Count how many badge types user has earned (at any level)
      const earnedBadges = await prisma.userBadge.count({
        where: { 
          profileId: profileId
        }
      });

      // Get recent badges or level ups
      const recentBadges = await prisma.userBadge.findMany({
        where: { 
          profileId: profileId
        },
        include: { badge: true },
        orderBy: { lastUpgraded: 'desc' },
        take: 3
      });

      // Count how many badges are at max level (diamond)
      const diamondBadges = await prisma.userBadge.count({
        where: {
          profileId: profileId,
          currentLevel: 'diamond'
        }
      });

      return {
        success: true,
        data: {
          totalBadges,
          earnedBadges,
          diamondBadges,
          completionPercentage: totalBadges > 0 ? Math.round((earnedBadges / totalBadges) * 100) : 0,
          recentBadges: recentBadges.map(ub => ({
            ...ub.badge,
            currentLevel: ub.currentLevel,
            earnedAt: ub.earnedAt,
            lastUpgraded: ub.lastUpgraded,
            progress: ub.progress
          }))
        }
      };
    } catch (error) {
      console.error('Error fetching badge statistics:', error);
      return { success: false, error: 'Failed to fetch badge statistics' };
    }
  }

  // Check retroactive badges automatically with proper progress count
  static async checkRetroactiveBadges(profileId) {
    try {
      console.log(`Starting retroactive check for user: ${profileId}`);
      
      // Check if user already has any badges (indicating retroactive check was done)
      const existingBadges = await prisma.userBadge.count({
        where: { profileId: profileId }
      });

      console.log(`User ${profileId} currently has ${existingBadges} badges`);

      // If user already has badges, skip retroactive check
      if (existingBadges > 0) {
        console.log(`⏭Skipping retroactive check - user already has badges`);
        return { success: true, message: 'User already has badges, skipping retroactive check' };
      }

      console.log(`Running automatic retroactive badge check for user: ${profileId}`);
      const results = [];

      // Check for group creation badge - count and award based on actual count
      const groupsCreated = await prisma.group.count({
        where: { 
          createdBy: profileId,
          isActive: true 
        }
      });
      if (groupsCreated > 0) {
        const groupBadge = await prisma.badge.findFirst({
          where: { badgeType: 'group_creation', isActive: true }
        });
        if (groupBadge) {
          const result = await this.awardBadge(profileId, groupBadge.BadgeID, groupsCreated);
          results.push({ action: 'group_created', count: groupsCreated, result });
        }
      }

      // Check for meal creation badge
      const mealsCreated = await prisma.meal.count({
        where: { profileId: profileId }
      });
      if (mealsCreated > 0) {
        const mealBadge = await prisma.badge.findFirst({
          where: { badgeType: 'meal_creation', isActive: true }
        });
        if (mealBadge) {
          const result = await this.awardBadge(profileId, mealBadge.BadgeID, mealsCreated);
          results.push({ action: 'meal_created', count: mealsCreated, result });
        }
      }

      // Check for planned meal creation badge
      const plannedMealsCreated = await prisma.plannedMeal.count({
        where: { profileId: profileId }
      });
      if (plannedMealsCreated > 0) {
        const plannedMealBadge = await prisma.badge.findFirst({
          where: { badgeType: 'meal_planning', isActive: true }
        });
        if (plannedMealBadge) {
          const result = await this.awardBadge(profileId, plannedMealBadge.BadgeID, plannedMealsCreated);
          results.push({ action: 'planned_meal_created', count: plannedMealsCreated, result });
        }
      }

      // Check for voting participation badge
      const votesParticipated = await prisma.votingSessionParticipant.count({
        where: { 
          userId: profileId
        }
      });
      if (votesParticipated > 0) {
        const votingBadge = await prisma.badge.findFirst({
          where: { badgeType: 'voting_participation', isActive: true }
        });
        if (votingBadge) {
          const result = await this.awardBadge(profileId, votingBadge.BadgeID, votesParticipated);
          results.push({ action: 'voting_participated', count: votesParticipated, result });
        }
      }

      // Check for voting winner badge
      const votingSessions = await prisma.votingSession.count({
        where: { 
          status: 'completed',
          winnerMealId: { not: null },
          winnerMeal: { profileId: profileId }
        }
      });
      if (votingSessions > 0) {
        const winnerBadge = await prisma.badge.findFirst({
          where: { badgeType: 'voting_winner', isActive: true }
        });
        if (winnerBadge) {
          const result = await this.awardBadge(profileId, winnerBadge.BadgeID, votingSessions);
          results.push({ action: 'voting_won', count: votingSessions, result });
        }
      }

      // Collect notifications for newly earned or leveled up badges
      const badgeNotifications = results
        .filter(r => r.result.success && (r.result.newlyEarned || r.result.leveledUp))
        .map(r => ({
          badge: r.result.data.badge,
          level: r.result.newLevel || r.result.data.currentLevel,
          isNewBadge: r.result.newlyEarned,
          isLevelUp: r.result.leveledUp,
          count: r.count
        }));

      if (badgeNotifications.length > 0) {
        console.log(`User ${profileId} automatically earned ${badgeNotifications.length} retroactive badge(s) or level(s)!`);
      }

      return {
        success: true,
        badgeNotifications,
        summary: {
          groupsCreated,
          mealsCreated,
          plannedMealsCreated,
          votesParticipated,
          votingSessionsWon: votingSessions
        }
      };

    } catch (error) {
      console.error('Error in automatic retroactive badge check:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = BadgesLibrary;