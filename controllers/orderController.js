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
        { userId: req.query.userId },
        { user_id: req.user.userId },
      ],
    }).sort({ createdAt: -1 }).toArray();

    res.status(200).json(orders);


  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(400).json({ message: 'Error fetching orders', error });
  }
};



// Function to get total sales, total taxes, etc.
exports.getAnalytics = async (req, res) => {
  try {
    const ordersCollection = getDB().collection('orders');

    // Aggregation for Total Sales
    const totalSales = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },  // Match only completed orders
      {
        $group: {
          _id: null,
          totalSales: {
            $sum: { $toDouble: "$total" }  // Convert the total (string) to a number for summing
          }
        }
      }
    ]).toArray();

    // Aggregation for Total Taxes (including shipping tax and order tax)
    const totalTaxes = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },  // Match only completed orders
      {
        $group: {
          _id: null,
          totalTaxes: {
            $sum: {
              $add: [
                { $toDouble: "$metadata._order_tax" },  // Convert _order_tax (string) to a number
                { $toDouble: "$metadata._order_shipping_tax" }  // Convert _order_shipping_tax (string) to a number
              ]
            }
          }
        }
      }
    ]).toArray();
    // Aggregation for Total Taxes (including shipping tax and order tax)
    const totalProductTaxes = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },  // Match only completed orders
      {
        $group: {
          _id: null,
          totalProductTaxes: {
            $sum: { $toDouble: "$metadata._order_tax" },  // Convert _order_tax (string) to a number
              
            
          }
        }
      }
    ]).toArray();
      // Aggregation for Total Taxes (including shipping tax and order tax)
      const totalShippingTaxes = await ordersCollection.aggregate([
        { $match: { status: 'completed' } },  // Match only completed orders
        {
          $group: {
            _id: null,
            totalShippingTaxes: {
              $sum: { $toDouble: "$metadata._order_shipping_tax" },  // Convert _order_tax (string) to a number
                
              
            }
          }
        }
      ]).toArray();
    // Aggregation for Total Discounts (considering cart discount)
    const totalDiscounts = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },  // Match only completed orders
      {
        $group: {
          _id: null,
          totalDiscounts: {
            $sum: { $toDouble: "$metadata._cart_discount" }  // Convert _cart_discount (string) to a number
          }
        }
      }
    ]).toArray();


    // Prepare the analytics response object
    const analytics = {
      totalSales: totalSales[0]?.totalSales || 0,
      totalTaxes: totalTaxes[0]?.totalTaxes || 0,
      totalProductTaxes: totalProductTaxes[0]?.totalProductTaxes || 0,
      totalShippingTaxes: totalShippingTaxes[0]?.totalShippingTaxes || 0,
      totalDiscounts: totalDiscounts[0]?.totalDiscounts || 0,
    };

    // Send the analytics response
    res.status(200).json(analytics);

  } catch (error) {
    res.status(400).json({ message: 'Error fetching analytics', error });
  }
};