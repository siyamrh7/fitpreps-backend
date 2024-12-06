// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateJWT = require('../middleware/authMiddleware');

router.post('/create', authenticateJWT, userController.createUser);
router.get('/', userController.getAllUsers);
router.get('/user',authenticateJWT, userController.getUser);

module.exports = router;
