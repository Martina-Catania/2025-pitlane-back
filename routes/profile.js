const express = require('express');
const router = express.Router();
const { updateCalorieGoal, getCalorieProgress } = require('../controllers/profilesLib');
const BadgesLibrary = require('../controllers/badgesLib');

const profilesController = require('../controllers/profilesLib');
const authenticateJWT = require('./auth');

// GET /profile - get all profiles (protegido)
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const profiles = await profilesController.getAllProfiles();
    // Mapear para devolver solo los campos requeridos
    const result = profiles.map(({ id, username, role }) => ({ id, username, role }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /profile/:id - get profile by id (protegido)
router.get('/:id', authenticateJWT, async (req, res) => {
 
  try {
    const profile = await profilesController.getProfileById(req.params.id, req.user?.email);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    
    // Check and award badges retroactively on first profile access
    try {
      console.log(`Profile accessed for user: ${req.params.id} - Running retroactive badge check`);
      const retroactiveResult = await BadgesLibrary.checkRetroactiveBadges(req.params.id);
      console.log('Retroactive badge result:', retroactiveResult);
    } catch (badgeError) {
      console.error('Error in retroactive badge check:', badgeError);
      // Don't fail profile request if badge check fails
    }
    
    // Devolver solo los campos requeridos
    const { id, username, role } = profile;
    res.json({ id, username, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /profile/:id/full - get profile by id with preferences and dietary restrictions (protegido)
router.get('/:id/full', authenticateJWT, async (req, res) => {
  try {
    const profile = await profilesController.getProfileById(req.params.id, req.user?.email);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    // Devolver todos los campos incluyendo relaciones
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /profile/:id/username - update username (protegido)
router.patch('/:id/username', authenticateJWT, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });
    const updated = await profilesController.updateProfileUsername(req.params.id, username);
    // Devolver solo los campos requeridos
    const { id, username: uname, role } = updated;
    res.json({ id, username: uname, role });
  } catch (err) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Profile with this username already exists' });
    } else if (err.code === 'P2025') {
      res.status(404).json({ error: 'Profile not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PATCH /profile/:id/role - update role (protegido)
router.patch('/:id/role', authenticateJWT, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'Role is required' });
    const updated = await profilesController.updateProfileRole(req.params.id, role);
    // Devolver solo los campos requeridos
    const { id, username, role: newRole } = updated;
    res.json({ id, username, role: newRole });

  } catch (err) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Profile not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PATCH /profile/:id - update profile (protegido)
router.patch('/:id', authenticateJWT, async (req, res) => {
  try {
    const { username } = req.body;
    
    // Validate input
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Trim whitespace
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      return res.status(400).json({ error: 'Username cannot be empty' });
    }
    
    const updated = await profilesController.updateProfileUsername(req.params.id, trimmedUsername);
    
    // Devolver solo los campos requeridos
    const { id, username: uname, role } = updated;
    res.json({ id, username: uname, role });
  } catch (err) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Profile with this username already exists' });
    } else if (err.code === 'P2025') {
      res.status(404).json({ error: 'Profile not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST /profile/:id/preferences - add preferences to a profile (protegido)
router.post('/:id/preferences', authenticateJWT, async (req, res) => {
  try {
    const { preferences } = req.body;
    if (!preferences || !Array.isArray(preferences) || preferences.length === 0) {
      return res.status(400).json({ error: 'Preferences array is required' });
    }
    
    const updated = await profilesController.addPreferencesToProfile(req.params.id, preferences);
    const { id, username, role } = updated;
    res.json({ id, username, role });
  } catch (err) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Profile not found' });
    } else if (err.code === 'P2002') {
      res.status(409).json({ error: 'One or more preferences do not exist' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /profile/:id/preferences - remove preferences from a profile (protegido)
router.delete('/:id/preferences', authenticateJWT, async (req, res) => {
  try {
    const { preferences } = req.body;
    if (!preferences || !Array.isArray(preferences) || preferences.length === 0) {
      return res.status(400).json({ error: 'Preferences array is required' });
    }
    
    const updated = await profilesController.removePreferencesFromProfile(req.params.id, preferences);
    const { id, username, role } = updated;
    res.json({ id, username, role });
  } catch (err) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Profile not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PUT /profile/:id/preferences - set all preferences for a profile (protegido)
router.put('/:id/preferences', authenticateJWT, async (req, res) => {
  try {
    const { preferences } = req.body;
    if (!preferences || !Array.isArray(preferences)) {
      return res.status(400).json({ error: 'Preferences array is required' });
    }
    
    const updated = await profilesController.setProfilePreferences(req.params.id, preferences);
    const { id, username, role } = updated;
    res.json({ id, username, role });
  } catch (err) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Profile not found' });
    } else if (err.code === 'P2002') {
      res.status(409).json({ error: 'One or more preferences do not exist' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST /profile/:id/dietary-restrictions - add dietary restrictions to a profile (protegido)
router.post('/:id/dietary-restrictions', authenticateJWT, async (req, res) => {
  try {
    const { dietaryRestrictions } = req.body;
    if (!dietaryRestrictions || !Array.isArray(dietaryRestrictions) || dietaryRestrictions.length === 0) {
      return res.status(400).json({ error: 'Dietary restrictions array is required' });
    }
    
    const updated = await profilesController.addDietaryRestrictionsToProfile(req.params.id, dietaryRestrictions);
    const { id, username, role } = updated;
    res.json({ id, username, role });
  } catch (err) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Profile not found' });
    } else if (err.code === 'P2002') {
      res.status(409).json({ error: 'One or more dietary restrictions do not exist' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /profile/:id/dietary-restrictions - remove dietary restrictions from a profile (protegido)
router.delete('/:id/dietary-restrictions', authenticateJWT, async (req, res) => {
  try {
    const { dietaryRestrictions } = req.body;
    if (!dietaryRestrictions || !Array.isArray(dietaryRestrictions) || dietaryRestrictions.length === 0) {
      return res.status(400).json({ error: 'Dietary restrictions array is required' });
    }
    
    const updated = await profilesController.removeDietaryRestrictionsFromProfile(req.params.id, dietaryRestrictions);
    const { id, username, role } = updated;
    res.json({ id, username, role });
  } catch (err) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Profile not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PUT /profile/:id/dietary-restrictions - set all dietary restrictions for a profile (protegido)
router.put('/:id/dietary-restrictions', authenticateJWT, async (req, res) => {
  try {
    const { dietaryRestrictions } = req.body;
    if (!dietaryRestrictions || !Array.isArray(dietaryRestrictions)) {
      return res.status(400).json({ error: 'Dietary restrictions array is required' });
    }
    
    const updated = await profilesController.setProfileDietaryRestrictions(req.params.id, dietaryRestrictions);
    const { id, username, role } = updated;
    res.json({ id, username, role });
  } catch (err) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Profile not found' });
    } else if (err.code === 'P2002') {
      res.status(409).json({ error: 'One or more dietary restrictions do not exist' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PUT /profile/:id/preferences-and-restrictions - set both preferences and dietary restrictions for a profile (protegido)
router.put('/:id/preferences-and-restrictions', authenticateJWT, async (req, res) => {
  try {
    const { preferences = [], dietaryRestrictions = [] } = req.body;
    
    if (!Array.isArray(preferences) || !Array.isArray(dietaryRestrictions)) {
      return res.status(400).json({ error: 'Preferences and dietaryRestrictions must be arrays' });
    }
    
    const updated = await profilesController.setProfilePreferencesAndRestrictions(
      req.params.id, 
      preferences, 
      dietaryRestrictions
    );
    
    const { id, username, role } = updated;
    res.json({ id, username, role });

  } catch (err) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Profile not found' });
    } else if (err.code === 'P2002') {
      res.status(409).json({ error: 'One or more preferences or dietary restrictions do not exist' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /profile/:id - delete a profile by id (protegido)
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const deleted = await profilesController.deleteProfile(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Profile not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /profile - create a new profile (protegido)
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const { id, username, preferences, dietaryRestrictions } = req.body;
    const profile = await profilesController.createProfile({ id, username, preferences, dietaryRestrictions });
    // Devolver solo los campos requeridos
    const { id: pid, username: uname, role } = profile;
    res.status(201).json({ id: pid, username: uname, role });
  } catch (err) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Profile with this username already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Ruta para actualizar el objetivo de calorías
router.put('/:id/calorie-goal', authenticateJWT, async (req, res) => {
  const { calorieGoal } = req.body;
  const userId = req.params.id;

  if (!calorieGoal) {
    return res.status(400).json({ error: 'Missing calorieGoal' });
  }

  try {
    const updatedProfile = await updateCalorieGoal(userId, calorieGoal);
    res.json(updatedProfile);
  } catch (error) {
    console.error('Error updating calorie goal:', error);
    res.status(500).json({ error: 'Failed to update calorie goal', details: error.message });
  }
});

// Ruta para obtener el progreso de calorías
router.get('/:id/calorie-progress', authenticateJWT, async (req, res) => {
  const { date } = req.query;
  const userId = req.params.id;

  try {
    const progress = await getCalorieProgress(userId, date ? new Date(date) : new Date());
    res.json(progress);
  } catch (error) {
    console.error('Error fetching calorie progress:', error);
    res.status(500).json({ error: 'Failed to fetch calorie progress', details: error.message });
  }
});

// Ruta para obtener las insignias del usuario
router.get('/:id/badges', authenticateJWT, async (req, res) => {
  try {
    const userId = req.params.id;
    const result = await BadgesLibrary.getUserBadges(userId);
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ error: 'Failed to fetch user badges', details: error.message });
  }
});

// Ruta para obtener estadísticas de insignias del usuario
router.get('/:id/badge-stats', authenticateJWT, async (req, res) => {
  try {
    const userId = req.params.id;
    const result = await BadgesLibrary.getUserBadgeStats(userId);
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error fetching badge statistics:', error);
    res.status(500).json({ error: 'Failed to fetch badge statistics', details: error.message });
  }
});

// Ruta para establecer el badge principal del usuario
router.put('/:id/primary-badge', authenticateJWT, async (req, res) => {
  try {
    const userId = req.params.id;
    const { badgeId } = req.body;

    // Verificar que el usuario tenga el badge que quiere establecer como principal
    if (badgeId) {
      const userBadges = await BadgesLibrary.getUserBadges(userId);
      const hasBadge = userBadges.success && userBadges.data.some(badge => badge.BadgeID === badgeId);
      
      if (!hasBadge) {
        return res.status(400).json({ error: 'User does not have this badge' });
      }
    }

    // Actualizar el badge principal
    const result = await profilesController.updatePrimaryBadge(userId, badgeId);
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error updating primary badge:', error);
    res.status(500).json({ error: 'Failed to update primary badge', details: error.message });
  }
});

// Ruta para obtener el badge principal del usuario
router.get('/:id/primary-badge', authenticateJWT, async (req, res) => {
  try {
    const userId = req.params.id;
    const result = await profilesController.getPrimaryBadge(userId);
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error fetching primary badge:', error);
    res.status(500).json({ error: 'Failed to fetch primary badge', details: error.message });
  }
});

module.exports = router;