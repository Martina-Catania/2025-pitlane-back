// controllers/mealConsumptionsLib.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get all meal consumptions with filters
 */
async function getMealConsumptions(filters = {}) {
    const { profileId, groupId, source, startDate, endDate, individualOnly } = filters;
    
    let whereClause = {
        isActive: true
    };

    if (profileId) {
        whereClause.profileId = profileId;
        // When querying by profileId for individual history (no groupId specified),
        // exclude group-level consumptions by default
        // Only show individual consumptions (type='individual'), not group-level records (type='group')
        if (!groupId && individualOnly !== false) {
            whereClause.type = 'individual'; // Only show individual consumptions
        }
    }

    if (groupId) {
        whereClause.groupId = parseInt(groupId);
    }

    // If individualOnly flag is explicitly set, only get individual consumptions (not group-level)
    if (individualOnly === true) {
        whereClause.type = 'individual';
    }

    if (source) {
        whereClause.source = source;
    }

    if (startDate || endDate) {
        whereClause.consumedAt = {};
        if (startDate) {
            whereClause.consumedAt.gte = new Date(startDate);
        }
        if (endDate) {
            whereClause.consumedAt.lte = new Date(endDate);
        }
    }

    return prisma.mealConsumption.findMany({
        where: whereClause,
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
                    },
                    profile: {
                        select: {
                            id: true,
                            username: true
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
            },
            votingSession: {
                select: {
                    VotingSessionID: true,
                    completedAt: true
                }
            },
            gameSession: {
                select: {
                    GameSessionID: true,
                    gameType: true,
                    endTime: true
                }
            }
        },
        orderBy: {
            consumedAt: 'desc'
        }
    });
}

/**
 * Get a specific meal consumption by ID
 */
async function getMealConsumptionById(consumptionId) {
    return prisma.mealConsumption.findUnique({
        where: {
            MealConsumptionID: parseInt(consumptionId),
            isActive: true
        },
        include: {
            meal: {
                include: {
                    mealFoods: {
                        include: {
                            food: {
                                include: {
                                    dietaryRestrictions: true,
                                    preferences: true,
                                    profile: {
                                        select: {
                                            id: true,
                                            username: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    profile: {
                        select: {
                            id: true,
                            username: true
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
                include: {
                    members: {
                        where: {
                            isActive: true
                        },
                        include: {
                            profile: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        }
                    }
                }
            },
            votingSession: {
                select: {
                    VotingSessionID: true,
                    completedAt: true,
                    title: true
                }
            },
            gameSession: {
                select: {
                    GameSessionID: true,
                    gameType: true,
                    endTime: true
                }
            }
        }
    });
}

/**
 * Create individual meal consumption record
 * Supports both full meals and partial portions
 */
async function createIndividualMealConsumption(consumptionData, profileId) {
    const { name, description, mealId, consumedAt, portions } = consumptionData;
    
    if (!mealId) {
        throw new Error('Meal ID is required');
    }

    if (consumedAt) {
        const consumedDate = new Date(consumedAt);
        if (!Number.isNaN(consumedDate.getTime()) && consumedDate > new Date()) {
            throw new Error('Future consumptions must be planned first');
        }
    }

    // Fetch meal data
    const mealData = await prisma.meal.findUnique({
        where: { MealID: mealId },
        include: {
            mealFoods: {
                include: {
                    food: true
                }
            }
        }
    });
    
    if (!mealData) {
        throw new Error(`Meal with ID ${mealId} not found`);
    }

    let totalKcal = 0;
    let portionFraction = 1.0;
    let foodPortionsData = [];

    if (portions && portions.foodPortions && portions.foodPortions.length > 0) {
        // PARTIAL PORTION FLOW
        portionFraction = portions.portionFraction || 1.0;
        
        foodPortionsData = portions.foodPortions.map(fp => {
            const mealFood = mealData.mealFoods.find(mf => mf.foodId === fp.foodId);
            if (!mealFood) {
                throw new Error(`Food ${fp.foodId} not found in meal ${mealId}`);
            }
            
            // Calculate actual quantity consumed
            const quantityConsumed = fp.absoluteQuantity !== undefined 
                ? fp.absoluteQuantity 
                : mealFood.quantity * fp.portionFraction;
            
            return {
                foodId: fp.foodId,
                portionFraction: fp.portionFraction,
                quantityConsumed: quantityConsumed
            };
        });

        // Calculate calories from actual food portions consumed
        totalKcal = foodPortionsData.reduce((sum, fp) => {
            const food = mealData.mealFoods.find(mf => mf.foodId === fp.foodId).food;
            return sum + (food.kCal * fp.quantityConsumed);
        }, 0);
    } else {
        // FULL MEAL FLOW
        totalKcal = mealData.mealFoods.reduce((sum, mealFood) => 
            sum + (mealFood.food.kCal * mealFood.quantity), 0
        );
        
        // Create food portions for full meal
        foodPortionsData = mealData.mealFoods.map(mf => ({
            foodId: mf.foodId,
            portionFraction: 1.0,
            quantityConsumed: mf.quantity
        }));
    }

    console.log('[createIndividualMealConsumption] Creating consumption with:', {
        name,
        mealId,
        portionFraction,
        totalKcal,
        foodPortionsCount: foodPortionsData.length
    });

    const mealConsumption = await prisma.mealConsumption.create({
        data: {
            name: name || mealData.name,
            description: description || `Individual consumption of ${mealData.name}`,
            profileId,
            mealId,
            type: 'individual',
            source: 'individual',
            portionFraction,
            quantity: 1,
            totalKcal: Math.round(totalKcal),
            consumedAt: consumedAt ? new Date(consumedAt) : new Date(),
            foodPortions: {
                create: foodPortionsData
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
            }
        }
    });
    
    console.log('[createIndividualMealConsumption] Consumption created:', {
        consumptionId: mealConsumption.MealConsumptionID,
        foodPortionsCount: mealConsumption.foodPortions.length
    });
    
    return mealConsumption;
}

/**
 * Create group meal consumption record
 * Supports both full meals and partial portions
 */
async function createGroupMealConsumption(consumptionData, profileId) {
    const { name, description, mealId, groupId, consumedAt, portions } = consumptionData;
    
    if (!mealId) {
        throw new Error('Meal ID is required');
    }

    if (!groupId) {
        throw new Error('Group ID is required for group consumption');
    }

    if (consumedAt) {
        const consumedDate = new Date(consumedAt);
        if (!Number.isNaN(consumedDate.getTime()) && consumedDate > new Date()) {
            throw new Error('Future consumptions must be planned first');
        }
    }

    // Verify that the user is a member of the group and get all group members
    const groupInfo = await prisma.group.findUnique({
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
                            username: true
                        }
                    }
                }
            }
        }
    });

    if (!groupInfo) {
        throw new Error('Group not found');
    }

    // Verify that the user is a member of the group
    const userIsMember = groupInfo.members.some(member => member.profile.id === profileId);
    if (!userIsMember) {
        throw new Error('User is not a member of this group');
    }

    // Fetch meal data
    const mealData = await prisma.meal.findUnique({
        where: { MealID: mealId },
        include: {
            mealFoods: {
                include: {
                    food: true
                }
            }
        }
    });
    
    if (!mealData) {
        throw new Error(`Meal with ID ${mealId} not found`);
    }

    let totalKcal = 0;
    let portionFraction = 1.0;
    let foodPortionsData = [];

    if (portions && portions.foodPortions && portions.foodPortions.length > 0) {
        // PARTIAL PORTION FLOW
        portionFraction = portions.portionFraction || 1.0;
        
        foodPortionsData = portions.foodPortions.map(fp => {
            const mealFood = mealData.mealFoods.find(mf => mf.foodId === fp.foodId);
            if (!mealFood) {
                throw new Error(`Food ${fp.foodId} not found in meal ${mealId}`);
            }
            
            const quantityConsumed = fp.absoluteQuantity !== undefined 
                ? fp.absoluteQuantity 
                : mealFood.quantity * fp.portionFraction;
            
            return {
                foodId: fp.foodId,
                portionFraction: fp.portionFraction,
                quantityConsumed: quantityConsumed
            };
        });

        totalKcal = foodPortionsData.reduce((sum, fp) => {
            const food = mealData.mealFoods.find(mf => mf.foodId === fp.foodId).food;
            return sum + (food.kCal * fp.quantityConsumed);
        }, 0);
    } else {
        // FULL MEAL FLOW
        totalKcal = mealData.mealFoods.reduce((sum, mealFood) => 
            sum + (mealFood.food.kCal * mealFood.quantity), 0
        );
        
        foodPortionsData = mealData.mealFoods.map(mf => ({
            foodId: mf.foodId,
            portionFraction: 1.0,
            quantityConsumed: mf.quantity
        }));
    }

    // Use a transaction to create group consumption and individual consumptions for each member
    const result = await prisma.$transaction(async (tx) => {
        // Create individual consumption records for each group member
        const individualConsumptions = await Promise.all(
            groupInfo.members.map(async (member) => {
                return tx.mealConsumption.create({
                    data: {
                        name: `${name || mealData.name} (Group: ${groupInfo.name})`,
                        description: `Group meal consumption: ${description || mealData.name}`,
                        profileId: member.profile.id,
                        mealId,
                        groupId: parseInt(groupId),
                        type: 'group', // Mark as group-level consumption
                        source: 'group',
                        portionFraction,
                        quantity: 1,
                        totalKcal: Math.round(totalKcal),
                        consumedAt: consumedAt ? new Date(consumedAt) : new Date(),
                        foodPortions: {
                            create: foodPortionsData
                        }
                    },
                    include: {
                        profile: {
                            select: {
                                id: true,
                                username: true,
                                role: true
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
                        },
                        foodPortions: {
                            include: {
                                food: true
                            }
                        }
                    }
                });
            })
        );

        // Return the consumption for the requesting user
        const userConsumption = individualConsumptions.find(c => c.profileId === profileId);
        
        return {
            userConsumption,
            individualConsumptions,
            memberCount: groupInfo.members.length
        };
    });

    return result.userConsumption;
}

/**
 * Update meal consumption record
 */
async function updateMealConsumption(consumptionId, consumptionData, profileId) {
    const { name, description, consumedAt } = consumptionData;
    
    // Check if consumption exists and belongs to the user
    const existingConsumption = await prisma.mealConsumption.findUnique({
        where: {
            MealConsumptionID: parseInt(consumptionId)
        }
    });

    if (!existingConsumption) {
        throw new Error('Consumption not found');
    }

    if (existingConsumption.profileId !== profileId) {
        throw new Error('Unauthorized to update this consumption');
    }

    return prisma.mealConsumption.update({
        where: {
            MealConsumptionID: parseInt(consumptionId)
        },
        data: {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(consumedAt && { consumedAt: new Date(consumedAt) })
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
}

/**
 * Delete meal consumption record (soft delete)
 */
async function deleteMealConsumption(consumptionId, profileId) {
    const existingConsumption = await prisma.mealConsumption.findUnique({
        where: {
            MealConsumptionID: parseInt(consumptionId)
        }
    });

    if (!existingConsumption) {
        throw new Error('Consumption not found');
    }

    if (existingConsumption.profileId !== profileId) {
        throw new Error('Unauthorized to delete this consumption');
    }

    return prisma.mealConsumption.update({
        where: {
            MealConsumptionID: parseInt(consumptionId)
        },
        data: {
            isActive: false
        }
    });
}

/**
 * Get consumption statistics for a user or group
 */
async function getMealConsumptionStats(filters = {}) {
    const { profileId, groupId, source, startDate, endDate } = filters;
    
    let whereClause = {
        isActive: true
    };

    if (profileId) {
        whereClause.profileId = profileId;
    }

    if (groupId) {
        whereClause.groupId = parseInt(groupId);
    }

    if (source) {
        whereClause.source = source;
    }

    if (startDate || endDate) {
        whereClause.consumedAt = {};
        if (startDate) {
            whereClause.consumedAt.gte = new Date(startDate);
        }
        if (endDate) {
            whereClause.consumedAt.lte = new Date(endDate);
        }
    }

    const stats = await prisma.mealConsumption.aggregate({
        where: whereClause,
        _count: {
            MealConsumptionID: true
        },
        _sum: {
            totalKcal: true
        },
        _avg: {
            totalKcal: true
        }
    });

    return {
        totalConsumptions: stats._count.MealConsumptionID || 0,
        totalKcal: stats._sum.totalKcal || 0,
        averageKcal: Math.round(stats._avg.totalKcal || 0)
    };
}

/**
 * Get filtered meals based on group dietary preferences and restrictions
 */
async function getGroupFilteredMeals(groupId) {
    const groupInfo = await prisma.group.findUnique({
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

    if (!groupInfo) {
        throw new Error('Group not found');
    }

    // Collect all dietary restrictions from group members
    const allDietaryRestrictions = [];
    groupInfo.members.forEach(member => {
        allDietaryRestrictions.push(...member.profile.DietaryRestriction);
    });

    // Remove duplicates
    const uniqueDietaryRestrictions = allDietaryRestrictions.filter((restriction, index, self) =>
        index === self.findIndex(r => r.DietaryRestrictionID === restriction.DietaryRestrictionID)
    );

    // Get meals that don't violate any group member's dietary restrictions
    const restrictionIds = uniqueDietaryRestrictions.map(r => r.DietaryRestrictionID);
    
    // Get all meals and filter them based on their foods' dietary restrictions
    const allMeals = await prisma.meal.findMany({
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
            },
            profile: {
                select: {
                    id: true,
                    username: true
                }
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    // Filter meals based on dietary restrictions
    const filteredMeals = allMeals.filter(meal => {
        return !meal.mealFoods.some(mealFood => 
            mealFood.food.dietaryRestrictions.some(restriction => 
                restrictionIds.includes(restriction.DietaryRestrictionID)
            )
        );
    });

    return {
        groupId: groupInfo.GroupID,
        groupName: groupInfo.name,
        memberCount: groupInfo.members.length,
        appliedRestrictions: uniqueDietaryRestrictions,
        availableMeals: filteredMeals
    };
}

/**
 * Get most consumed meals by a group (top N)
 */
async function getGroupMostConsumedMeals(groupId, limit = 3) {
    const groupInfo = await prisma.group.findUnique({
        where: {
            GroupID: parseInt(groupId),
            isActive: true
        },
        include: {
            members: {
                where: { isActive: true },
                select: { profileId: true }
            }
        }
    });

    if (!groupInfo) {
        throw new Error('Group not found');
    }

    // Get member profile IDs
    const memberProfileIds = groupInfo.members.map(member => member.profileId);

    // Get consumptions from group members
    const consumptions = await prisma.mealConsumption.findMany({
        where: {
            profileId: { in: memberProfileIds },
            isActive: true
        },
        include: {
            meal: {
                include: {
                    mealFoods: {
                        include: {
                            food: {
                                select: {
                                    FoodID: true,
                                    name: true,
                                    kCal: true
                                }
                            }
                        }
                    }
                }
            },
            profile: {
                select: {
                    id: true,
                    username: true
                }
            }
        },
        orderBy: {
            consumedAt: 'desc'
        }
    });

    // Count meal occurrences and calculate stats
    const mealStats = {};
    
    consumptions.forEach(consumption => {
        const meal = consumption.meal;
        const mealKey = `${meal.name}_${meal.MealID}`;
        
        if (!mealStats[mealKey]) {
            mealStats[mealKey] = {
                mealId: meal.MealID,
                name: meal.name,
                description: meal.description,
                count: 0,
                totalKcal: 0,
                foods: meal.mealFoods.map(mf => ({
                    name: mf.food.name,
                    kcal: mf.food.kCal,
                    quantity: mf.quantity
                })),
                consumedBy: new Set()
            };
        }
        
        mealStats[mealKey].count += consumption.quantity || 1;
        mealStats[mealKey].totalKcal += consumption.totalKcal;
        mealStats[mealKey].consumedBy.add(consumption.profile.username);
    });

    // Convert to array, calculate averages, and sort by consumption count
    const sortedMeals = Object.values(mealStats)
        .map(meal => ({
            ...meal,
            averageKcal: meal.count > 0 ? Math.round(meal.totalKcal / meal.count) : 0,
            consumedBy: Array.from(meal.consumedBy),
            uniqueConsumers: meal.consumedBy.size
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    return {
        groupId: parseInt(groupId),
        groupName: groupInfo.name,
        memberCount: groupInfo.members.length,
        mostConsumedMeals: sortedMeals,
        totalConsumptions: consumptions.length
    };
}

module.exports = {
    getMealConsumptions,
    getMealConsumptionById,
    createIndividualMealConsumption,
    createGroupMealConsumption,
    updateMealConsumption,
    deleteMealConsumption,
    getMealConsumptionStats,
    getGroupFilteredMeals,
    getGroupMostConsumedMeals
};
