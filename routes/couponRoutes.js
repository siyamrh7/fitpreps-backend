// routes/couponRoutes.js
const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const authenticateAdmin = require('../middleware/authAdminMiddleware');
const authenticateJWT = require('../middleware/authMiddleware');

// Create a new coupon
router.post('/create', couponController.createCoupon);

// Get all coupons
router.get('/', couponController.getAllCoupons);
router.get('/:id', couponController.getCouponById);

// Get a single coupon by code
router.get('/coupon/:code', authenticateAdmin, couponController.getCouponByCode);

// Update a coupon by code
router.put('/:id', couponController.updateCoupon);

// Delete a coupon by code
router.delete('/:id', couponController.deleteCoupon);

// Validate a coupon by code
router.get('/validate/:code', couponController.validateCoupon);

module.exports = router;
