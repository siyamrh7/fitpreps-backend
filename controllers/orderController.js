// controllers/orderController.js
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb'); // Import ObjectId to handle MongoDB IDs
exports.createOrder = async (req, res) => {
  try {
    const ordersCollection = getDB().collection('orders');
    await ordersCollection.insertOne(req.body);  // Save the full body as-is
    res.status(201).json({ message: 'Order created successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error creating order', error });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const ordersCollection = getDB().collection('orders');
    const orders = await ordersCollection.find().toArray();
    res.status(200).json(orders);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching orders', error });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const { userId } = req.user
    const ordersCollection = getDB().collection('orders');

    // Find a user by ID
    // const user = await ordersCollection.findOne({ user_id: new ObjectId(userId) || userId:userId });
    const orders = await ordersCollection.find({
      $or: [
        { userId: req.query.userId},
        { user_id: ObjectId.isValid(userId) ? new ObjectId(userId) : userId },
      ],
    }).toArray();

    res.status(200).json(orders);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching user by ID', error });
  }
};