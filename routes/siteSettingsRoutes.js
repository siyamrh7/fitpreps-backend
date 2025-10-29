// routes/siteSettingsRoutes.js
const express = require('express');
const router = express.Router();
const siteSettingsController = require('../controllers/siteSettingsController');
const authenticateAdmin = require('../middleware/authAdminMiddleware');

// Public routes (for frontend to fetch settings)
router.get('/', siteSettingsController.getAllSettings);

// Protected routes (admin only)
router.put('/', authenticateAdmin, siteSettingsController.updateSettings);

module.exports = router;

