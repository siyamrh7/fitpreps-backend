const authenticateJWT = require('./authMiddleware'); // Assuming you want to use the existing authenticateJWT
const { getDB } = require('../config/db');

const unserialize = (data) => {
    // Regular expression to match the serialized array
    const regex = /a:(\d+):\{(.*?)\}/;
    const match = data.match(regex);

    if (!match) return {};

    const entries = match[2]
        .split(';')
        .filter((entry) => entry.trim() !== '')
        .map((entry) => {
            const [key, value] = entry.split(':').map((str) => str.replace(/"/g, '').trim());
            return [key, value === 'b:1' ? true : false]; // Convert 'b:1' to boolean true and 'b:0' to false
        });

    return Object.fromEntries(entries);
};
const isSerialized = (str) => {
    // Check if the string is non-empty and looks like a serialized PHP string
    return typeof str === 'string' && (str.startsWith('a:') || str.startsWith('O:') || str.startsWith('s:'));
};
const authenticateAdmin = async (req, res, next) => {
    try {
        // First, authenticate the JWT token
        authenticateJWT(req, res, async () => {
            const userId = req.user._id; // Assuming req.user contains the user _id

            // Fetch the user's capabilities from the wp_usermeta table
            const usersCollection = getDB().collection('users'); // Use your actual users meta collection
            const userMeta = await usersCollection.findOne({ _id: userId });

            if (!userMeta) {
                return res.status(404).json({ message: 'User not found or no role assigned' });
            }
            var capabilities=null
            if (isSerialized(userMeta.metadata.wp_capabilities)){

                const capabilities1 = unserialize(userMeta.metadata.wp_capabilities);
                capabilities=capabilities1
            }
                // Unserialize the capabilities field to convert it to an object

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
