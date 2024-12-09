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

    // Query to fetch the 50 most recent orders
    const orders = await ordersCollection
      .find()
      .sort({ createdAt: -1 }) // Sort by createdAt in descending order (most recent first)
      .limit(100) // Limit the results to 50
      .toArray();

    res.status(200).json(orders);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching orders', error });
  }
};


exports.getOrder = async (req, res) => {
  try {
    const { userId: userTokenId } = req.user; // From the token
    const queryUserId = req.query.userId; // Optional query parameter
    const ordersCollection = getDB().collection('orders');

    // Build the query conditions

    // Match `user_id` (ObjectId from token or query)
    // if (userTokenId) {
    //   const orders = await ordersCollection
    //     .find({ user_id: userTokenId })
    //     .sort({ createdAt: -1 })
    //     .toArray();
    //     if (orders && orders.length !== 0) {
    //       return res.status(200).json(orders);
    //     }
        
    //   }
    //   if (!orders || orders.length === 0) {
    //     if (queryUserId) {
    //       const orders = await ordersCollection
    //         .find({ userId: queryUserId })
    //         .sort({ createdAt: -1 })
    //         .toArray();

    //       return res.status(200).json(orders);
    //     }
    //   }

    const orders = await ordersCollection.find({
      $or: [
        { userId: req.query.userId},
        { user_id: req.user.userId },
      ],
    }).sort({ createdAt: -1 }).toArray();

    res.status(200).json(orders);


  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(400).json({ message: 'Error fetching orders', error });
  }
};