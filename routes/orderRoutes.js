// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authenticateJWT = require('../middleware/authMiddleware');
const updateCouponOnOrder = require('../middleware/couponMiddleware');

router.post('/create',updateCouponOnOrder, orderController.createOrder);
router.get('/checkpayment/:transactionId', orderController.checkPayment);
router.delete('/orders', orderController.deleteOrders);
router.put('/status', orderController.updateOrderStatus);

router.get('/',  orderController.getAllOrders);
router.get('/order/:id',  orderController.getOrderById);

router.get('/order', authenticateJWT, orderController.getOrder);
router.get('/analytics',  orderController.getAnalytics);
router.get('/getshipping', orderController.getShippingMethods);

module.exports = router;
