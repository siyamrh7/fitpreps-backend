// routes/couponRoutes.js
const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const authenticateAdmin = require('../middleware/authAdminMiddleware');
const authenticateJWT = require('../middleware/authMiddleware');

// Create a new coupon
router.post('/create', authenticateAdmin, couponController.createCoupon);

// Get all coupons
router.get('/', authenticateAdmin, couponController.getAllCoupons);

// Get a single coupon by code
router.get('/coupon/:code', authenticateAdmin, couponController.getCouponByCode);

// Update a coupon by code
router.put('/update/:code', authenticateAdmin, couponController.updateCoupon);

// Delete a coupon by code
router.delete('/delete/:code', authenticateAdmin, couponController.deleteCoupon);

// Validate a coupon by code
router.get('/validate/:code',authenticateJWT, couponController.validateCoupon);

module.exports = router;
