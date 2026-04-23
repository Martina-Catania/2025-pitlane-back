// controllers/foodsLib.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAllFoods() {
    return prisma.food.findMany({
        include: { dietaryRestrictions: true, preferences: true, profile: true }
    });
}

// Get foods that match user's dietary restrictions (including For Everyone foods with id=0)
async function getFoodsForUser(userDietaryRestrictions = []) {
    // If user has no restrictions, they can eat any food
    if (userDietaryRestrictions.length === 0) {
        return prisma.food.findMany({
            include: { dietaryRestrictions: true, preferences: true, profile: true }
        });
    }

    // If user has restrictions, they can only eat:
    // 1. Foods tagged "For Everyone" (id = 0)
    // 2. Foods that match their specific dietary restrictions
    return prisma.food.findMany({
        where: {
            OR: [
                // Foods with no dietary restrictions (available to everyone)
                {
                    dietaryRestrictions: {
                        none: {}
                    }
                },
                // Foods with "For Everyone" restriction (if it exists)
                {
                    dietaryRestrictions: {
                        some: {
                            OR: [
                                { DietaryRestrictionID: 0 },
                                { name: { contains: "For Everyone", mode: 'insensitive' } },
                                { name: { contains: "everyone", mode: 'insensitive' } }
                            ]
                        }
                    }
                },
                // Foods that match user's dietary restrictions
                {
                    dietaryRestrictions: {
                        some: {
                            DietaryRestrictionID: {
                                in: userDietaryRestrictions
                            }
                        }
                    }
                }
            ]
        },
        include: { dietaryRestrictions: true, preferences: true, profile: true }
    });
}

async function getFoodById(id) {

    foodId = parseInt(id);

    if (isNaN(foodId)) {
        throw new Error(`Invalid FoodID: ${id}`);
    }

    return prisma.food.findUnique({
        where: { FoodID: parseInt(foodId) },
        include: { dietaryRestrictions: true, preferences: true, profile: true }
    });
}

async function getFoodsByPreference(preferenceId) {
    return prisma.food.findMany({
        where: { preferences: { some: { PreferenceID: parseInt(preferenceId) } } },
        include: { dietaryRestrictions: true, preferences: true, profile: true }
    });
}

async function getFoodsByRestriction(restrictionId) {
    return prisma.food.findMany({
        where: { dietaryRestrictions: { some: { DietaryRestrictionID: parseInt(restrictionId) } } },
        include: { dietaryRestrictions: true, preferences: true, profile: true }
    });
}

async function getFoodsByProfileId(profileId) {
    return prisma.food.findMany({
        where: { profileId: profileId },
        include: { dietaryRestrictions: true, preferences: true, profile: true }
    });
}

async function getFoodsByPreferenceAndRestriction(preferenceId, restrictionId) {
    // If both params are present, return intersection, else fallback to one
    if (preferenceId && restrictionId) {
        const foodsByPref = await getFoodsByPreference(preferenceId);
        const foodsByRestr = await getFoodsByRestriction(restrictionId);
        // Intersection by FoodID
        const idsByRestr = new Set(foodsByRestr.map(f => f.FoodID));
        return foodsByPref.filter(f => idsByRestr.has(f.FoodID));
    } else if (preferenceId) {
        return getFoodsByPreference(preferenceId);
    } else if (restrictionId) {
        return getFoodsByRestriction(restrictionId);
    } else {
        return getAllFoods();
    }
}

async function getRecommendedFoodsForProfile(profileId) {
    const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        include: { Preference: true, DietaryRestriction: true }
    });
    if (!profile) return null;

    const userRestrictions = profile.DietaryRestriction.map(r => r.DietaryRestrictionID);

    // Base query to match user preferences
    const baseQuery = {
        where: {
            AND: [
                // Match user preferences
                {
                    preferences: {
                        some: {
                            PreferenceID: {
                                in: profile.Preference.map(p => p.PreferenceID)
                            }
                        }
                    }
                }
            ]
        },
        include: { dietaryRestrictions: true, preferences: true, profile: true }
    };

    // If user has no dietary restrictions, they can eat any food with their preferences
    if (userRestrictions.length === 0) {
        return prisma.food.findMany(baseQuery);
    }

    // If user has restrictions, add dietary restriction filtering
    baseQuery.where.AND.push({
        OR: [
            // Foods with no dietary restrictions (available to everyone)
            {
                dietaryRestrictions: {
                    none: {}
                }
            },
            // Foods with "For Everyone" restriction (if it exists)
            {
                dietaryRestrictions: {
                    some: {
                        OR: [
                            { DietaryRestrictionID: 0 },
                            { name: { contains: "For Everyone", mode: 'insensitive' } },
                            { name: { contains: "everyone", mode: 'insensitive' } }
                        ]
                    }
                }
            },
            // Foods that match user's dietary restrictions
            {
                dietaryRestrictions: {
                    some: {
                        DietaryRestrictionID: {
                            in: userRestrictions
                        }
                    }
                }
            }
        ]
    });

    return prisma.food.findMany(baseQuery);
}

module.exports = {
    getAllFoods,
    getFoodsForUser,
    getFoodById,
    getFoodsByPreference,
    getFoodsByRestriction,
    getFoodsByPreferenceAndRestriction,
    getFoodsByProfileId,
    getRecommendedFoodsForProfile,
    createFood,
    deleteFood,
    updateFood
};

// Delete a food by id
async function deleteFood(id) {
    try {
        await prisma.food.delete({ where: { FoodID: parseInt(id) } });
        return true;
    } catch (err) {
        if (err.code === 'P2025') return false;
        throw err;
    }
}

// Create a new food
async function createFood({ name, svgLink, kCal = 0, preferences = [], dietaryRestrictions = [], hasNoRestrictions = false, profileId }) {
    // Validate required fields
    if (!profileId) {
        throw new Error('profileId is required');
    }

    // Validate kCal is not negative
    if (kCal < 0) {
        throw new Error('kCal cannot be less than 0');
    }

    // Handle dietary restrictions with "For Everyone" logic:
    // - If hasNoRestrictions is true OR dietaryRestrictions is empty, set to [0] (For Everyone)
    // - If dietaryRestrictions contains 0 and other restrictions, remove 0 (keep only specific restrictions)
    // - If dietaryRestrictions contains only specific restrictions, keep them as is
    let finalRestrictions = [];
    
    if (hasNoRestrictions || dietaryRestrictions.length === 0) {
        // No restrictions specified or explicitly marked as no restrictions -> For Everyone
        finalRestrictions = [0];
    } else {
        const hasForEveryone = dietaryRestrictions.includes(0);
        const otherRestrictions = dietaryRestrictions.filter(id => id !== 0);
        
        if (hasForEveryone && otherRestrictions.length > 0) {
            // Has "For Everyone" plus other restrictions -> remove "For Everyone"
            finalRestrictions = otherRestrictions;
        } else if (hasForEveryone && otherRestrictions.length === 0) {
            // Only "For Everyone" -> keep it
            finalRestrictions = [0];
        } else {
            // Only specific restrictions -> keep them
            finalRestrictions = dietaryRestrictions;
        }
    }

    // Validate that all preference IDs exist
    if (preferences.length > 0) {
        const existingPreferences = await prisma.preference.findMany({
            where: { PreferenceID: { in: preferences } }
        });
        if (existingPreferences.length !== preferences.length) {
            const foundIds = existingPreferences.map(p => p.PreferenceID);
            const missingIds = preferences.filter(id => !foundIds.includes(id));
            throw new Error(`Invalid preference IDs: ${missingIds.join(', ')}`);
        }
    }

    // Validate that all dietary restriction IDs exist
    if (finalRestrictions.length > 0) {
        const existingRestrictions = await prisma.dietaryRestriction.findMany({
            where: { DietaryRestrictionID: { in: finalRestrictions } }
        });
        if (existingRestrictions.length !== finalRestrictions.length) {
            const foundIds = existingRestrictions.map(r => r.DietaryRestrictionID);
            const missingIds = finalRestrictions.filter(id => !foundIds.includes(id));
            throw new Error(`Invalid dietary restriction IDs: ${missingIds.join(', ')}`);
        }
    }

    return prisma.food.create({
        data: {
            name,
            svgLink,
            kCal,
            profileId,
            preferences: preferences.length ? { connect: preferences.map(id => ({ PreferenceID: id })) } : undefined,
            dietaryRestrictions: finalRestrictions.length ? { connect: finalRestrictions.map(id => ({ DietaryRestrictionID: id })) } : undefined
        },
        include: { dietaryRestrictions: true, preferences: true, profile: true }
    });
}

// Update a food by id
async function updateFood(id, { name, svgLink, kCal, preferences = [], dietaryRestrictions = [] }) {
    const foodId = parseInt(id);
    if (isNaN(foodId)) {
        throw new Error(`Invalid FoodID: ${id}`);
    }

    // Validate kCal is not negative if provided
    if (kCal !== undefined && kCal < 0) {
        throw new Error('kCal cannot be less than 0');
    }

    // Handle "For Everyone" restriction logic:
    // - If dietaryRestrictions is empty, set to [0] (For Everyone)
    // - If dietaryRestrictions contains 0 and other restrictions, remove 0 (keep only specific restrictions)
    // - If dietaryRestrictions contains only [0], keep it as [0]
    // - If dietaryRestrictions contains other restrictions but not 0, keep them as is
    let finalRestrictions = [...dietaryRestrictions];
    
    const hasForEveryone = finalRestrictions.includes(0);
    const otherRestrictions = finalRestrictions.filter(id => id !== 0);
    
    if (finalRestrictions.length === 0) {
        // Empty array means "For Everyone"
        finalRestrictions = [0];
    } else if (hasForEveryone && otherRestrictions.length > 0) {
        // Has "For Everyone" plus other restrictions -> remove "For Everyone"
        finalRestrictions = otherRestrictions;
    } else if (hasForEveryone && otherRestrictions.length === 0) {
        // Only "For Everyone" -> keep it
        finalRestrictions = [0];
    }
    // else: no "For Everyone", only specific restrictions -> keep as is

    return prisma.food.update({
        where: { FoodID: foodId },
        data: {
            name,
            svgLink,
            ...(kCal !== undefined && { kCal }),
            preferences: { set: preferences.map(pid => ({ PreferenceID: pid })) },
            dietaryRestrictions: { set: finalRestrictions.map(rid => ({ DietaryRestrictionID: rid })) }
        },
        include: { dietaryRestrictions: true, preferences: true, profile: true }
    });
}