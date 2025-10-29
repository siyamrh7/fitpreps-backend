// routes/categoryMetadataRoutes.js
const express = require('express');
const router = express.Router();
const categoryMetadataController = require('../controllers/categoryMetadataController');
const authenticateAdmin = require('../middleware/authAdminMiddleware');

// Public routes (for frontend to fetch metadata)
router.get('/', categoryMetadataController.getAllCategoryMetadata);
router.get('/:category', categoryMetadataController.getCategoryMetadata);

// Protected routes (admin only)
router.post('/', authenticateAdmin, categoryMetadataController.upsertCategoryMetadata);
router.put('/:category', authenticateAdmin, categoryMetadataController.updateCategoryMetadata);
router.delete('/:category', authenticateAdmin, categoryMetadataController.deleteCategoryMetadata);
router.post('/batch', authenticateAdmin, categoryMetadataController.batchUpsertCategoryMetadata);

module.exports = router;

