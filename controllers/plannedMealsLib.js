const { PrismaClient } = require('@prisma/client');
const mealConsumptionsLib = require('./mealConsumptionsLib');

const prisma = new PrismaClient();
let hasLoggedMissingPlannedMealTable = false;

function parseDateOrThrow(value, fieldName) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid ${fieldName}`);
    }
    return parsed;
}

async function getMealWithFoods(mealId) {
    const meal = await prisma.meal.findUnique({
        where: { MealID: parseInt(mealId) },
        include: {
            mealFoods: {
                include: {
                    food: true
                }
            }
        }
    });

    if (!meal) {
        throw new Error('Meal not found');
    }

    return meal;
}

function calculateEstimatedKcal(meal) {
    return meal.mealFoods.reduce((acc, item) => {
        return acc + (item.food.kCal * item.quantity);
    }, 0);
}

function buildPlannedFoodItemsFromMeal(meal, portions) {
    if (!portions || !Array.isArray(portions.foodPortions) || portions.foodPortions.length === 0) {
        return meal.mealFoods
            .map(item => ({
                foodId: item.foodId,
                quantity: item.quantity
            }))
            .filter(item => item.quantity > 0);
    }

    const selectedByFoodId = new Map();
    for (const portion of portions.foodPortions) {
        selectedByFoodId.set(portion.foodId, portion);
    }

    const foodItems = meal.mealFoods.map(item => {
        const portion = selectedByFoodId.get(item.foodId);
        let quantity = item.quantity;

        if (portion) {
            if (typeof portion.absoluteQuantity === 'number') {
                quantity = portion.absoluteQuantity;
            } else if (typeof portion.portionFraction === 'number') {
                quantity = item.quantity * portion.portionFraction;
            }
        }

        return {
            foodId: item.foodId,
            quantity: Number(quantity)
        };
    });

    return foodItems.filter(item => Number.isFinite(item.quantity) && item.quantity > 0);
}

async function validateGroupMembership(groupId, profileId) {
    if (!groupId) {
        return null;
    }

    const group = await prisma.group.findUnique({
        where: {
            GroupID: parseInt(groupId),
            isActive: true
        },
        include: {
            members: {
                where: {
                    profileId,
                    isActive: true
                }
            }
        }
    });

    if (!group) {
        throw new Error('Group not found');
    }

    if (group.members.length === 0) {
        throw new Error('User is not a member of this group');
    }

    return group;
}

function buildPlannedMealsWhere(filters = {}) {
    const {
        profileId,
        groupId,
        status,
        startDate,
        endDate,
        onlyFuture = false,
        onlyOverdue = false,
        includeInactive = false
    } = filters;

    const where = {};

    if (!includeInactive) {
        where.isActive = true;
    }

    if (profileId) {
        where.profileId = profileId;
    }

    if (groupId !== undefined && groupId !== null) {
        where.groupId = parseInt(groupId);
    }

    if (status) {
        where.status = status;
    }

    if (onlyFuture) {
        where.plannedFor = { gte: new Date() };
    }

    if (onlyOverdue) {
        where.plannedFor = { lt: new Date() };
        if (!status) {
            where.status = {
                in: ['awaiting_confirmation', 'scheduled']
            };
        }
    }

    if (startDate || endDate) {
        where.plannedFor = where.plannedFor || {};
        if (startDate) {
            where.plannedFor.gte = parseDateOrThrow(startDate, 'startDate');
        }
        if (endDate) {
            where.plannedFor.lte = parseDateOrThrow(endDate, 'endDate');
        }
    }

    return where;
}

async function createPlannedMeal(data) {
    const { profileId, mealId, groupId, plannedFor, resolutionNote } = data;

    if (!profileId || !mealId || !plannedFor) {
        throw new Error('profileId, mealId and plannedFor are required');
    }

    const plannedDate = parseDateOrThrow(plannedFor, 'plannedFor');
    if (plannedDate <= new Date()) {
        throw new Error('plannedFor must be a future date');
    }

    await validateGroupMembership(groupId, profileId);
    const meal = await getMealWithFoods(mealId);

    const estimatedKcal = Math.round(calculateEstimatedKcal(meal));

    return prisma.plannedMeal.create({
        data: {
            profileId,
            groupId: groupId ? parseInt(groupId) : null,
            mealId: parseInt(mealId),
            plannedFor: plannedDate,
            status: 'scheduled',
            estimatedKcal,
            resolutionNote: resolutionNote || null,
            foodItems: {
                create: meal.mealFoods.map(item => ({
                    foodId: item.foodId,
                    quantity: item.quantity
                }))
            }
        },
        include: {
            meal: {
                include: {
                    mealFoods: {
                        include: {
                            food: true
                        }
                    }
                }
            },
            group: {
                select: {
                    GroupID: true,
                    name: true
                }
            },
            profile: {
                select: {
                    id: true,
                    username: true
                }
            },
            foodItems: {
                include: {
                    food: true
                }
            }
        }
    });
}

async function getPlannedMeals(filters = {}) {
    if (filters.onlyOverdue) {
        await markOverduePlannedMealsAsAwaitingConfirmation();
    }

    const where = buildPlannedMealsWhere(filters);

    return prisma.plannedMeal.findMany({
        where,
        include: {
            meal: {
                include: {
                    mealFoods: {
                        include: {
                            food: true
                        }
                    }
                }
            },
            group: {
                select: {
                    GroupID: true,
                    name: true
                }
            },
            profile: {
                select: {
                    id: true,
                    username: true
                }
            },
            mealConsumption: {
                select: {
                    MealConsumptionID: true,
                    totalKcal: true,
                    consumedAt: true
                }
            },
            foodItems: {
                where: {
                    isActive: true
                },
                include: {
                    food: true
                }
            }
        },
        orderBy: {
            plannedFor: 'asc'
        }
    });
}

async function getPlannedMealById(plannedMealId) {
    return prisma.plannedMeal.findUnique({
        where: {
            PlannedMealID: parseInt(plannedMealId)
        },
        include: {
            meal: {
                include: {
                    mealFoods: {
                        include: {
                            food: true
                        }
                    }
                }
            },
            group: {
                include: {
                    members: {
                        where: {
                            isActive: true
                        },
                        select: {
                            profileId: true
                        }
                    }
                }
            },
            profile: {
                select: {
                    id: true,
                    username: true
                }
            },
            foodItems: {
                include: {
                    food: true
                }
            },
            confirmations: {
                orderBy: {
                    confirmedAt: 'desc'
                }
            }
        }
    });
}

async function getAggregatedShoppingList(filters = {}) {
    const {
        profileId,
        groupId,
        startDate,
        endDate,
        includePurchased = true
    } = filters;

    const plannedMealWhere = buildPlannedMealsWhere({
        profileId,
        groupId,
        startDate,
        endDate,
        onlyFuture: true
    });

    const foodItems = await prisma.plannedMealFood.findMany({
        where: {
            isActive: true,
            ...(includePurchased ? {} : { isPurchased: false }),
            plannedMeal: plannedMealWhere
        },
        include: {
            food: {
                select: {
                    FoodID: true,
                    name: true,
                    svgLink: true,
                    kCal: true
                }
            },
            plannedMeal: {
                select: {
                    PlannedMealID: true,
                    plannedFor: true,
                    meal: {
                        select: {
                            MealID: true,
                            name: true
                        }
                    }
                }
            }
        }
    });

    const grouped = new Map();

    for (const item of foodItems) {
        const key = item.foodId;
        if (!grouped.has(key)) {
            grouped.set(key, {
                foodId: item.food.FoodID,
                foodName: item.food.name,
                svgLink: item.food.svgLink,
                kCal: item.food.kCal,
                totalQuantity: 0,
                purchasedQuantity: 0,
                isPurchased: true,
                entries: []
            });
        }

        const agg = grouped.get(key);
        agg.totalQuantity += item.quantity;
        agg.purchasedQuantity += item.isPurchased ? item.quantity : 0;
        agg.isPurchased = agg.isPurchased && item.isPurchased;
        agg.entries.push({
            plannedMealFoodId: item.PlannedMealFoodID,
            plannedMealId: item.plannedMeal.PlannedMealID,
            plannedFor: item.plannedMeal.plannedFor,
            meal: item.plannedMeal.meal,
            quantity: item.quantity,
            isPurchased: item.isPurchased
        });
    }

    return Array.from(grouped.values()).sort((a, b) => a.foodName.localeCompare(b.foodName));
}

async function updateShoppingItemStatus(data) {
    const {
        foodId,
        isPurchased,
        profileId,
        groupId,
        startDate,
        endDate
    } = data;

    if (!foodId || typeof isPurchased !== 'boolean') {
        throw new Error('foodId and isPurchased are required');
    }

    if (!profileId && !groupId) {
        throw new Error('profileId or groupId is required');
    }

    if (groupId) {
        await validateGroupMembership(groupId, profileId);
    }

    const plannedMealWhere = buildPlannedMealsWhere({
        profileId,
        groupId,
        startDate,
        endDate,
        onlyFuture: true
    });

    const updateResult = await prisma.plannedMealFood.updateMany({
        where: {
            foodId: parseInt(foodId),
            isActive: true,
            plannedMeal: plannedMealWhere
        },
        data: {
            isPurchased,
            purchasedAt: isPurchased ? new Date() : null,
            purchasedById: isPurchased ? profileId : null
        }
    });

    return {
        updatedCount: updateResult.count,
        foodId: parseInt(foodId),
        isPurchased
    };
}

async function markOverduePlannedMealsAsAwaitingConfirmation() {
    try {
        const result = await prisma.plannedMeal.updateMany({
            where: {
                isActive: true,
                status: 'scheduled',
                plannedFor: {
                    lt: new Date()
                }
            },
            data: {
                status: 'awaiting_confirmation'
            }
        });

        return result.count;
    } catch (error) {
        if (error?.code === 'P2021') {
            if (!hasLoggedMissingPlannedMealTable) {
                console.warn('⚠️ Planned meal tables are not available yet. Run migrations to enable planned meal scheduler.');
                hasLoggedMissingPlannedMealTable = true;
            }
            return 0;
        }
        throw error;
    }
}

async function resolvePlannedMeal(plannedMealId, payload, requesterId) {
    const { wasConsumed, action, note, newPlannedFor, portions } = payload;

    if (typeof wasConsumed !== 'boolean') {
        throw new Error('wasConsumed is required');
    }

    const plannedMeal = await getPlannedMealById(plannedMealId);
    if (!plannedMeal || !plannedMeal.isActive) {
        throw new Error('Planned meal not found');
    }

    if (plannedMeal.groupId) {
        await validateGroupMembership(plannedMeal.groupId, requesterId);
    } else if (plannedMeal.profileId !== requesterId) {
        throw new Error('Unauthorized to resolve this planned meal');
    }

    if (!['scheduled', 'awaiting_confirmation'].includes(plannedMeal.status)) {
        throw new Error(`Planned meal cannot be resolved from status ${plannedMeal.status}`);
    }

    if (plannedMeal.plannedFor > new Date()) {
        throw new Error('This planned meal is still in the future');
    }

    let createdConsumption = null;
    let createdReschedule = null;

    if (wasConsumed) {
        if (plannedMeal.groupId) {
            createdConsumption = await mealConsumptionsLib.createGroupMealConsumption({
                name: plannedMeal.meal.name,
                description: `Consumed from planned meal #${plannedMeal.PlannedMealID}`,
                mealId: plannedMeal.mealId,
                groupId: plannedMeal.groupId,
                consumedAt: plannedMeal.plannedFor.toISOString(),
                portions
            }, requesterId);
        } else {
            createdConsumption = await mealConsumptionsLib.createIndividualMealConsumption({
                name: plannedMeal.meal.name,
                description: `Consumed from planned meal #${plannedMeal.PlannedMealID}`,
                mealId: plannedMeal.mealId,
                consumedAt: plannedMeal.plannedFor.toISOString(),
                portions
            }, plannedMeal.profileId);
        }

        await prisma.plannedMeal.update({
            where: {
                PlannedMealID: plannedMeal.PlannedMealID
            },
            data: {
                status: 'consumed',
                isActive: false,
                resolvedAt: new Date(),
                resolvedById: requesterId,
                resolutionNote: note || null,
                consumptionId: createdConsumption.MealConsumptionID
            }
        });
    } else if (action === 'rescheduled') {
        if (!newPlannedFor) {
            throw new Error('newPlannedFor is required for reschedule');
        }

        const nextDate = parseDateOrThrow(newPlannedFor, 'newPlannedFor');
        if (nextDate <= new Date()) {
            throw new Error('newPlannedFor must be a future date');
        }

        createdReschedule = await prisma.plannedMeal.create({
            data: {
                profileId: plannedMeal.profileId,
                groupId: plannedMeal.groupId,
                mealId: plannedMeal.mealId,
                plannedFor: nextDate,
                status: 'scheduled',
                estimatedKcal: plannedMeal.estimatedKcal,
                resolutionNote: note || null,
                foodItems: {
                    create: plannedMeal.foodItems
                        .filter(item => item.isActive)
                        .map(item => ({
                            foodId: item.foodId,
                            quantity: item.quantity
                        }))
                }
            },
            include: {
                foodItems: true
            }
        });

        await prisma.plannedMeal.update({
            where: {
                PlannedMealID: plannedMeal.PlannedMealID
            },
            data: {
                status: 'rescheduled',
                isActive: false,
                resolvedAt: new Date(),
                resolvedById: requesterId,
                resolutionNote: note || null
            }
        });
    } else if (action === 'cancelled') {
        await prisma.plannedMeal.update({
            where: {
                PlannedMealID: plannedMeal.PlannedMealID
            },
            data: {
                status: 'cancelled',
                isActive: false,
                resolvedAt: new Date(),
                resolvedById: requesterId,
                resolutionNote: note || null
            }
        });
    } else {
        throw new Error('action must be rescheduled or cancelled when wasConsumed is false');
    }

    await prisma.plannedMealFood.updateMany({
        where: {
            plannedMealId: plannedMeal.PlannedMealID,
            isActive: true
        },
        data: {
            isActive: false
        }
    });

    const confirmation = await prisma.plannedMealConfirmation.create({
        data: {
            plannedMealId: plannedMeal.PlannedMealID,
            userId: requesterId,
            wasConsumed,
            action: wasConsumed ? 'consumed' : action,
            note: note || null
        }
    });

    return {
        confirmation,
        consumption: createdConsumption,
        rescheduledTo: createdReschedule
    };
}

async function updateScheduledPlannedMeal(plannedMealId, requesterId, payload) {
    const { mealId, plannedFor, portions } = payload || {};

    if (!requesterId) {
        throw new Error('requesterId is required');
    }

    if (!mealId && !plannedFor && !portions) {
        throw new Error('At least one field (mealId, plannedFor, portions) is required');
    }

    const current = await getPlannedMealById(plannedMealId);
    if (!current || !current.isActive) {
        throw new Error('Planned meal not found');
    }

    if (current.status !== 'scheduled') {
        throw new Error(`Only scheduled planned meals can be edited (current status: ${current.status})`);
    }

    if (current.plannedFor <= new Date()) {
        throw new Error('Only future planned meals can be edited');
    }

    if (current.groupId) {
        await validateGroupMembership(current.groupId, requesterId);
    } else if (current.profileId !== requesterId) {
        throw new Error('Unauthorized to edit this planned meal');
    }

    const nextMealId = mealId ? parseInt(mealId) : current.mealId;
    const nextPlannedFor = plannedFor ? parseDateOrThrow(plannedFor, 'plannedFor') : current.plannedFor;

    if (nextPlannedFor <= new Date()) {
        throw new Error('plannedFor must be a future date');
    }

    const meal = await getMealWithFoods(nextMealId);
    const foodItems = buildPlannedFoodItemsFromMeal(meal, portions);

    if (foodItems.length === 0) {
        throw new Error('Planned meal must include at least one food item');
    }

    const estimatedKcal = Math.round(foodItems.reduce((sum, item) => {
        const mealFood = meal.mealFoods.find(row => row.foodId === item.foodId);
        if (!mealFood) {
            return sum;
        }
        return sum + (mealFood.food.kCal * item.quantity);
    }, 0));

    await prisma.$transaction(async (tx) => {
        await tx.plannedMeal.update({
            where: {
                PlannedMealID: parseInt(plannedMealId)
            },
            data: {
                mealId: nextMealId,
                plannedFor: nextPlannedFor,
                estimatedKcal
            }
        });

        await tx.plannedMealFood.deleteMany({
            where: {
                plannedMealId: parseInt(plannedMealId)
            }
        });

        await tx.plannedMealFood.createMany({
            data: foodItems.map(item => ({
                plannedMealId: parseInt(plannedMealId),
                foodId: item.foodId,
                quantity: item.quantity
            }))
        });
    });

    return getPlannedMealById(plannedMealId);
}

async function deleteScheduledPlannedMeal(plannedMealId, requesterId) {
    if (!requesterId) {
        throw new Error('requesterId is required');
    }

    const current = await getPlannedMealById(plannedMealId);
    if (!current || !current.isActive) {
        throw new Error('Planned meal not found');
    }

    if (current.status !== 'scheduled') {
        throw new Error(`Only scheduled planned meals can be removed (current status: ${current.status})`);
    }

    if (current.plannedFor <= new Date()) {
        throw new Error('Only future planned meals can be removed');
    }

    if (current.groupId) {
        await validateGroupMembership(current.groupId, requesterId);
    } else if (current.profileId !== requesterId) {
        throw new Error('Unauthorized to delete this planned meal');
    }

    await prisma.$transaction(async (tx) => {
        await tx.plannedMealFood.deleteMany({
            where: {
                plannedMealId: parseInt(plannedMealId)
            }
        });

        await tx.plannedMeal.delete({
            where: {
                PlannedMealID: parseInt(plannedMealId)
            }
        });
    });

    return {
        deleted: true,
        plannedMealId: parseInt(plannedMealId)
    };
}

function startPlannedMealScheduler() {
    console.log('🔄 Starting planned meal scheduler...');

    markOverduePlannedMealsAsAwaitingConfirmation()
        .then(count => {
            if (count > 0) {
                console.log(`✅ Initial check: ${count} planned meal(s) moved to awaiting confirmation`);
            }
        })
        .catch(err => console.error('❌ Error in initial planned meal scheduler check:', err));

    setInterval(async () => {
        try {
            const count = await markOverduePlannedMealsAsAwaitingConfirmation();
            if (count > 0) {
                console.log(`🔄 Planned meal scheduler: ${count} planned meal(s) moved to awaiting confirmation`);
            }
        } catch (error) {
            console.error('❌ Error in planned meal scheduler:', error);
        }
    }, 60000);

    console.log('✅ Planned meal scheduler started (checks every 60 seconds)');
}

module.exports = {
    createPlannedMeal,
    getPlannedMeals,
    getPlannedMealById,
    getAggregatedShoppingList,
    updateShoppingItemStatus,
    markOverduePlannedMealsAsAwaitingConfirmation,
    resolvePlannedMeal,
    updateScheduledPlannedMeal,
    deleteScheduledPlannedMeal,
    startPlannedMealScheduler
};
