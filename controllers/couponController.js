const { getDB } = require('../config/db');
const {ObjectId} =require('mongodb')
// Create a new coupon
exports.createCoupon = async (req, res) => {
  try {
    const couponsCollection = getDB().collection('coupons');
    const newCoupon = req.body; // Expected to include fields like `code`, `discount`, `expiryDate`, etc.
    await couponsCollection.insertOne(newCoupon);
    res.status(201).json({ message: 'Coupon created successfully', coupon: newCoupon });
  } catch (error) {
    res.status(400).json({ message: 'Error creating coupon', error });
  }
};

// Get all coupons
exports.getAllCoupons = async (req, res) => {
  try {
    const couponsCollection = getDB().collection('coupons');
    const coupons = await couponsCollection.find({status:"publish"}).sort({ createdAt: -1 }).toArray(); // Fetch all coupons
    res.status(200).json( coupons );
  } catch (error) {
    res.status(400).json({ message: 'Error fetching coupons', error });
  }
};

// Get a single coupon by code
exports.getCouponByCode = async (req, res) => {
  try {
    const couponsCollection = getDB().collection('coupons');
    const { code } = req.params;
    const coupon = await couponsCollection.findOne({ code });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.status(200).json({ coupon });
  } catch (error) {
    res.status(400).json({ message: 'Error fetching coupon', error });
  }
};
exports.getCouponById = async (req, res) => {
  try {
    const couponsCollection = getDB().collection('coupons');
    const { id } = req.params;

    // Convert the id to ObjectId
    const coupon = await couponsCollection.findOne({ _id: new ObjectId(id) });

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.status(200).json(coupon);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching coupon', error });
  }
};
// Update a coupon by code
exports.updateCoupon = async (req, res) => {
  try {
    const couponsCollection = getDB().collection('coupons');
    const { id } = req.params; // Get the coupon ID from the URL
    let updates = { ...req.body }; // Copy req.body to avoid mutating the original data

    // Remove _id from the updates object if it exists
    delete updates._id;

    // Convert the id into MongoDB ObjectId
    const result = await couponsCollection.updateOne(
      { _id: new ObjectId(id) }, // Query the coupon by ObjectId
      { $set: updates } // Apply the update using $set
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.status(200).json({ message: 'Coupon updated successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error updating coupon', error });
  }
};


// Delete a coupon by code
exports.deleteCoupon = async (req, res) => {
  try {
    const couponsCollection = getDB().collection('coupons');
    const { id } = req.params;

    // Convert the id to ObjectId
    const result = await couponsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.status(200).json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting coupon', error });
  }
};
// Validate a coupon by code (e.g., check expiry or usage limits)
exports.validateCoupon = async (req, res) => {
  try {
    const couponsCollection = getDB().collection('coupons');
    const { code } = req.params;
    const coupon = await couponsCollection.findOne({ code });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    const now = new Date();
    if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
      return res.status(400).json({ message: 'Coupon has expired' });
    }

    if (coupon.usageLimit !=="0"){     
        if( parseInt(coupon.usageCount) >= parseInt(coupon.usageLimit)) {
          return res.status(400).json({ message: 'Coupon usage limit reached' });
        }
    }

    res.status(200).json({ message: 'Coupon is applied', coupon });
  } catch (error) {
    res.status(400).json({ message: 'Error validating coupon', error });
  }
};

// Apply coupon to an order
exports.applyCoupon = async (req, res) => {
    const { orderId, couponCode } = req.body;
  
    if (!orderId || !couponCode) {
      return res.status(400).json({ message: 'Order ID and coupon code are required' });
    }
  
    try {
      const ordersCollection = getDB().collection('orders');
      const couponsCollection = getDB().collection('coupons');
  
      // Check if the coupon exists and is valid
      const coupon = await couponsCollection.findOne({ code: couponCode });
  
      if (!coupon) {
        return res.status(404).json({ message: 'Coupon not found' });
      }
  
      // You can add more checks here, e.g., coupon expiration date, usage limits, etc.
      if (coupon.status !== 'active') {
        return res.status(400).json({ message: 'Coupon is not active' });
      }
  
      // Fetch the order
      const order = await ordersCollection.findOne({ _id: orderId });
  
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      // Calculate the discount (this could be a percentage or a fixed amount)
      let discount = 0;
      if (coupon.type === 'percentage') {
        discount = (order.total * coupon.amount) / 100; // Assuming 'amount' is a percentage
      } else if (coupon.type === 'fixed') {
        discount = coupon.amount; // Assuming 'amount' is a fixed discount value
      }
  
      // Update the order with the applied coupon and discount
      const updatedOrder = await ordersCollection.updateOne(
        { _id: orderId },
        { $set: { coupon: couponCode, discountApplied: discount, total: order.total - discount } }
      );
  
      res.status(200).json({ message: 'Coupon applied successfully', updatedOrder });
    } catch (error) {
      console.error('Error applying coupon:', error);
      res.status(500).json({ message: 'Error applying coupon', error });
    }
  };