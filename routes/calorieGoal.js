const express = require('express');
const router = express.Router();
const { updateCalorieGoal } = require('../controllers/profilesLib');
const authenticateToken = require('../helpers/authenticateToken');

// PUT /profile/calorie-goal - Actualizar meta de calorías
router.put('/calorie-goal', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const { calorieGoal } = req.body;

        // Validación básica
        if (!calorieGoal || typeof calorieGoal !== 'number') {
            return res.status(400).json({
                error: 'Objetivo de calorías requerido',
                message: 'Por favor proporciona un objetivo válido'
            });
        }

        // Rango razonable para evitar valores extremos
        if (calorieGoal < 800 || calorieGoal > 5000) {
            return res.status(400).json({
                error: 'Objetivo fuera del rango permitido',
                message: 'El objetivo debe estar entre 800 y 5000 calorías'
            });
        }

        const updatedProfile = await updateCalorieGoal(userId, calorieGoal);
        
        res.json({
            message: 'Objetivo actualizado exitosamente',
            profile: {
                id: updatedProfile.id,
                username: updatedProfile.username,
                calorieGoal: updatedProfile.calorie_goal
            }
        });
    } catch (error) {
        console.error('Error updating calorie goal:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            message: 'No se pudo actualizar el objetivo'
        });
    }
});

module.exports = router;