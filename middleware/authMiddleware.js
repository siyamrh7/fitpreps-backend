// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const authenticateJWT = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) {
    return res.status(403).json({ message: 'Access Denied' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Error verifying JWT:', err);
      return res.status(403).json({ message: 'Invalid Token' });
    }
    req.user = user;
    next();
  });
};

module.exports = authenticateJWT;
