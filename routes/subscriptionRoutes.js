// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authenticateJWT = require('../middleware/authMiddleware');
const authenticateAdmin = require('../middleware/authAdminMiddleware');

// Route to create a one-time payment to purchase points
router.post('/purchase-points', subscriptionController.purchasePoints);
router.get('/payment-check/:id', subscriptionController.paymentCheck);
router.post('/start-subscription', subscriptionController.startSubscription);

router.post('/first-payment-webhook', subscriptionController.firstPaymentWebhook);
router.post('/subscription-webhook', subscriptionController.recuiringPointsWebhook);


router.get('/get-subscription-data', subscriptionController.getSubsctionData);
router.get('/trigger-subscription', subscriptionController.triggerImmediatePayment);


module.exports = router;
