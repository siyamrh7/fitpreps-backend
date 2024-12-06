// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authenticateJWT = require('../middleware/authMiddleware');

router.post('/create', authenticateJWT, orderController.createOrder);
router.get('/', authenticateJWT, orderController.getAllOrders);

module.exports = router;