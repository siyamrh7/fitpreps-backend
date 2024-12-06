// controllers/orderController.js
const { getDB } = require('../config/db');

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
