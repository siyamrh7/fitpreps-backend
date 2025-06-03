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

// Payment webhooks
router.post('/first-payment-webhook', subscriptionController.firstPaymentWebhook);
router.post('/payment-webhook', subscriptionController.paymentWebhook);

// User subscription routes
router.get('/user/:userId', subscriptionController.getUserSubscriptionData);
router.post('/update-subscription-data', authenticateJWT, subscriptionController.updateSubscriptionData);
// router.get('/user-subscriptions/:userId', subscriptionController.getUserSubscriptions);
// router.get('/details/:subscriptionId', subscriptionController.getSubscriptionDetails);

// Admin routes
router.put('/status', authenticateAdmin, subscriptionController.updateSubscriptionStatus);
router.delete('/', authenticateAdmin, subscriptionController.deleteSubscriptions);

router.get('/', authenticateAdmin, subscriptionController.getSubscriptions);
router.get('/:id', authenticateAdmin, subscriptionController.getSubscriptionById);

// router.get('/dashboard', authenticateAdmin, subscriptionController.getSubscriptionDashboard);
// router.get('/stats', authenticateAdmin, subscriptionController.getSubscriptionStats);

// Subscription management
// router.post('/modify', authenticateJWT, subscriptionController.modifySubscription);
router.post('/cancel', subscriptionController.cancelSubscription);
router.post('/pause', authenticateJWT, subscriptionController.pauseSubscription);
router.post('/resume', subscriptionController.resumeSubscription);
 
// Admin management
// router.post('/update-charge-date', authenticateAdmin, subscriptionController.updateNextChargeDate);
// router.post('/update-amount', authenticateAdmin, subscriptionController.updateSubscriptionAmount);
router.put('/manual-charge', authenticateAdmin, subscriptionController.manualChargeSubscription);

module.exports = router;
