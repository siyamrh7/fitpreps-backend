// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authenticateJWT = require('../middleware/authMiddleware');

router.post('/create', authenticateJWT, productController.createProduct);
router.get('/:productName', productController.getSingleProduct);
router.get('/', productController.getAllProducts);

module.exports = router;
