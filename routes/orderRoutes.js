// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authenticateJWT = require('../middleware/authMiddleware');

router.post('/create', authenticateJWT, orderController.createOrder);
router.get('/checkpayment/:transactionId', orderController.checkPayment);

router.get('/',  orderController.getAllOrders);
router.get('/order', authenticateJWT, orderController.getOrder);
router.get('/analytics',  orderController.getAnalytics);
router.get('/getshipping', orderController.getShippingMethods);

module.exports = router;
