const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/db');
var hasher = require('wordpress-hash-node');

// Controller to handle user registration
exports.register = async (req, res) => {
  try {
    const { metadata, email, password } = req.body;
    if(!email || !password){
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    // Get the MongoDB collection
    const usersCollection = getDB().collection('users');

    // Check if the user already exists
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the password
    var hashedPassword = hasher.HashPassword(password);
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const user = { email,registeredAt: new Date().toISOString(), password: hashedPassword ,metadata:{first_name:metadata.first_name,last_name:metadata.last_name,woocommerce_reward_points:"50"} };

    // Insert the user into the database
    await usersCollection.insertOne(user);

    res.status(201).json({ message: 'User registered successfully, Login Now' });
  } catch (error) {
    res.status(400).json({ message: 'Error registering user', error });
  }
};

// Controller to handle user login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get the MongoDB collection
    const usersCollection = getDB().collection('users');

    // Check if the user exists
    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare the provided password with the hashed password
    var isMatch = hasher.CheckPassword(password, user.password); //This will return true;

    // const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({ message: 'Login successful', token ,user});
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error });
  }
};
