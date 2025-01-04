const authenticateJWT = require('./authMiddleware'); // Assuming you want to use the existing authenticateJWT
const { getDB } = require('../config/db');
const ObjectId = require('mongodb').ObjectId;
const {unserialize} =require('php-serialize')

const isSerialized = (str) => {
    // Check if the string is non-empty and looks like a serialized PHP string
    return typeof str === 'string' && (str.startsWith('a:') || str.startsWith('O:') || str.startsWith('s:'));
};
const authenticateAdmin = async (req, res, next) => {
    try {
        // First, authenticate the JWT token
        authenticateJWT(req, res, async () => {
            const userId = req.user.userId; // Assuming req.user contains the user _id
            // Fetch the user's capabilities from the wp_usermeta table
            const usersCollection = getDB().collection('users'); // Use your actual users meta collection
            const userMeta = await usersCollection.findOne({ _id: new ObjectId(userId) });

            if (!userMeta) {
                return res.status(404).json({ message: 'User not found or no role assigned' });
            }
            var capabilities=null
            if (isSerialized(userMeta.metadata.wp_capabilities)){

                const capabilities1 = unserialize(userMeta.metadata.wp_capabilities);
                capabilities=capabilities1
            }
            // Check if the user has the 'administrator' role in wp_capabilities
            if (capabilities && capabilities.administrator) {
                next(); // Allow access if the user is an admin
            } else {
                return res.status(403).json({ message: 'Access Denied: Admins only' });
            }
        });
    } catch (error) {
        console.error("Error in authenticateAdmin:", error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = authenticateAdmin;
