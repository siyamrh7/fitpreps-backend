// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authenticateJWT = require('../middleware/authMiddleware');
const uploadSingle = require('../middleware/uploadMiddleware'); // Import the Multer middleware
const uploadMultiple = require('../middleware/uploadMultiple'); // Import the Multer middleware
router.post('/create', uploadMultiple, productController.createProduct);
router.get('/:productName', productController.getSingleProduct);
router.get('/single/:id', productController.getSingleProductById)

router.get('/', productController.getAllProducts);
router.delete('/:id', productController.deleteProductById);
router.put('/:id', uploadMultiple, productController.updateProduct);

module.exports = router;
