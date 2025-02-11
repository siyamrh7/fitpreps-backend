// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateJWT = require('../middleware/authMiddleware');
const authenticateAdmin = require('../middleware/authAdminMiddleware');
router.post('/create', authenticateJWT, userController.createUser);
router.get('/', userController.getAllUsers);
router.get('/user',authenticateJWT, userController.getUser);
router.put('/user',authenticateJWT, userController.updateAddress);
router.put('/point',authenticateJWT, userController.updatePoint);
router.delete('/user/:userId',authenticateAdmin, userController.deleteUser);
router.put('/user/:userId',authenticateAdmin, userController.updateUser);

module.exports = router;
