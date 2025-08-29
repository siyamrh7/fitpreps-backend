// routes/gymwearRoutes.js
const express = require('express');
const router = express.Router();
const gymwearController = require('../controllers/gymwearController');
const authenticateJWT = require('../middleware/authMiddleware');
const uploadMultiple = require('../middleware/uploadMultiple'); // Import the Multer middleware

// Create a new gymwear product
router.post('/create', uploadMultiple, gymwearController.createGymwear);

// Get gymwear revenue analytics
router.get('/revenue/analytics', gymwearController.getGymwearRevenue);

// Get a single gymwear product by name/slug
router.get('/:productName', gymwearController.getSingleGymwear);

// Get a single gymwear product by ID
router.get('/single/:id', gymwearController.getSingleGymwearById);

// Get all gymwear products
router.get('/', gymwearController.getAllGymwear);

// Update a gymwear product
router.put('/:id', uploadMultiple, gymwearController.updateGymwear);

// Delete a gymwear product
router.delete('/:id', gymwearController.deleteGymwearById);

module.exports = router;
