// routes/supplementRoutes.js
const express = require('express');
const router = express.Router();
const supplementController = require('../controllers/supplementController');
const authenticateJWT = require('../middleware/authMiddleware');
const uploadSingle = require('../middleware/uploadMiddleware'); // Import the Multer middleware
const uploadMultiple = require('../middleware/uploadMultiple'); // Import the Multer middleware

router.post('/create', uploadMultiple, supplementController.createSupplement);
router.get('/revenue/analytics', supplementController.getSupplementRevenue);
router.get('/single/:id', supplementController.getSingleSupplementById)
router.get('/:supplementName', supplementController.getSingleSupplement);

router.get('/', supplementController.getAllSupplements);
router.delete('/:id', supplementController.deleteSupplementById);
router.put('/:id', uploadMultiple, supplementController.updateSupplement);

module.exports = router; 