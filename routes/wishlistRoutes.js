const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const authenticateJWT = require('../middleware/authMiddleware');

// Add an item to the wishlist
router.post('/add', authenticateJWT, wishlistController.addToWishlist);

// Get the wishlist for a specific user
router.get('/:userId', authenticateJWT, wishlistController.getWishlist);

// Update an item in the wishlist
router.put('/update', authenticateJWT, wishlistController.updateWishlistItem);

// Remove an item from the wishlist
router.delete('/remove', authenticateJWT, wishlistController.removeFromWishlist);

// Clear the entire wishlist
router.delete('/clear', authenticateJWT, wishlistController.clearWishlist);

module.exports = router;
