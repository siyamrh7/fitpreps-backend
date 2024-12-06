// controllers/userController.js
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb'); // Import ObjectId to handle MongoDB IDs


exports.createUser = async (req, res) => {
  try {
    const usersCollection = getDB().collection('users');
    await usersCollection.insertOne(req.body);  // Save the full body as-is
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error creating user', error });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const usersCollection = getDB().collection('users');
    const users = await usersCollection.find().limit(20).toArray();
    res.status(200).json(users);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching users', error });
  }
};

exports.getUser = async (req, res) => {
  try {
    const {userId}=req.user
    const usersCollection = getDB().collection('users');

    // Find a user by ID
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching user by ID', error });
  }
};
