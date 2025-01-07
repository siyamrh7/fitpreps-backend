const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb')
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
// exports.getAllCoupons = async (req, res) => {
//   try {
//     const couponsCollection = getDB().collection('coupons');
//     const coupons = await couponsCollection.find({status:"publish"}).sort({ createdAt: -1 }).toArray(); // Fetch all coupons
//     res.status(200).json( coupons );
//   } catch (error) {
//     res.status(400).json({ message: 'Error fetching coupons', error });
//   }
// };
// exports.getAllCoupons = async (req, res) => {
//   try {
//     const couponsCollection = getDB().collection("coupons");

//     // Fetch all published coupons
//     const coupons = await couponsCollection
//       .find({ status: "publish" })
//       .sort({ createdAt: -1 })
//       .toArray();

//     const now = new Date();

//     // Helper function to calculate total discount and usage count for a specific time range
//     const calculateSummary = (logs, startDate) => {
//       const filteredLogs = logs.filter((log) => {
//         const usageDate = new Date(log.usageDate);
//         return usageDate >= startDate && usageDate <= now;
//       });

//       const totalDiscount = filteredLogs.reduce(
//         (total, log) => total + parseFloat(log.discountAmount || 0),
//         0
//       );

//       return {
//         totalDiscount,
//         totalUsage: filteredLogs.length,
//       };
//     };

//     // Time ranges
//     const last30Days = new Date(now);
//     last30Days.setDate(last30Days.getDate() - 30);

//     const last7Days = new Date(now);
//     last7Days.setDate(last7Days.getDate() - 7);

//     const last24Hours = new Date(now);
//     last24Hours.setHours(last24Hours.getHours() - 24);

//     // Map coupons with their usage summary
//     const couponsWithUsageSummary = coupons.map((coupon) => {
//       const usageLogs = coupon.usageLogs || []; // Ensure usageLogs exist

//       const last30DaysSummary = calculateSummary(usageLogs, last30Days);
//       const last7DaysSummary = calculateSummary(usageLogs, last7Days);
//       const last24HoursSummary = calculateSummary(usageLogs, last24Hours);

//       return {
//         ...coupon,
//         totalDiscountLast30Days: last30DaysSummary.totalDiscount,
//         totalUsageLast30Days: last30DaysSummary.totalUsage,
//         totalDiscountLast7Days: last7DaysSummary.totalDiscount,
//         totalUsageLast7Days: last7DaysSummary.totalUsage,
//         totalDiscountLast24Hours: last24HoursSummary.totalDiscount,
//         totalUsageLast24Hours: last24HoursSummary.totalUsage,
//       };
//     });

//     res.status(200).json(couponsWithUsageSummary);
//   } catch (error) {
//     res.status(400).json({ message: "Error fetching coupons", error });
//   }
// };
// exports.getAllCoupons = async (req, res) => {
//   try {
//     const { startDate, endDate } = req.query;

//     const couponsCollection = getDB().collection("coupons");

//     // Fetch all published coupons
//     const coupons = await couponsCollection
//       .find({ status: "publish" })
//       .toArray();

//     const filteredCoupons = coupons.map((coupon) => {
//       if (startDate && endDate) {
//         const start = new Date(startDate);
//         const end = new Date(endDate);

//         // Validate date range
//         if (isNaN(start.getTime()) || isNaN(end.getTime())) {
//           throw new Error("Invalid date range provided.");
//         }

//         // Filter usageLogs by date range
//         const filteredLogs = (coupon.usageLogs || []).filter((log) => {
//           const usageDate = new Date(log.usageDate);
//           return usageDate >= start && usageDate <= end;
//         });

//         // Calculate totals for the filtered logs
//         const totalDiscount = filteredLogs.reduce(
//           (sum, log) => sum + parseFloat(log.discountAmount || 0),
//           0
//         );

//         return {
//           ...coupon,
//           totalDiscount,
//           totalUsage: filteredLogs.length,
//         };
//       }

//       // Return overall data if no date range is provided
//       return {
//         ...coupon,
//         totalUsage: coupon.usageCount || 0, // Use stored usage count
//       };
//     });

//     res.status(200).json(filteredCoupons);
//   } catch (error) {
//     res.status(400).json({
//       message: "Error fetching coupons",
//       error: error.message,
//     });
//   }
// };
exports.getAllCoupons = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const couponsCollection = getDB().collection("coupons");

    // Fetch all published coupons
    const coupons = await couponsCollection
      .find({ status: "publish" })
      .toArray();

    const filteredCoupons = coupons.map((coupon) => {
      let totalDiscount = coupon.totalDiscount || 0;
      let totalUsage = coupon.usageCount || 0;

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Validate date range
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new Error("Invalid date range provided.");
        }

        // Filter usageLogs by date range
        const filteredLogs = (coupon.usageLogs || []).filter((log) => {
          const usageDate = new Date(log.usageDate);
          return usageDate >= start && usageDate <= end;
        });

        // Calculate totals for the filtered logs
        totalDiscount = filteredLogs.reduce(
          (sum, log) => sum + parseFloat(log.discountAmount || 0),
          0
        );
        totalUsage = filteredLogs.length;
      }

      // Construct the response without the usageLogs array
      const { usageLogs, ...rest } = coupon;
      return {
        ...rest,
        totalDiscount,
        totalUsage,
      };
    });

    res.status(200).json(filteredCoupons);
  } catch (error) {
    res.status(400).json({
      message: "Error fetching coupons",
      error: error.message,
    });
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

    if (coupon.usageLimit !== "0") {
      if (parseInt(coupon.usageCount) >= parseInt(coupon.usageLimit)) {
        return res.status(400).json({ message: 'Coupon usage limit reached' });
      }
    }
    // Check if the user has reached their usage limit for this coupon
    if (coupon.usageLimitPerUser !== "0") {
        if (req.query.userId) {
        const userUsageCount = (coupon.usageLogs || []).filter(
          (log) => log.customerId === req.query.userId
        ).length;
  
        if (userUsageCount >= parseInt(coupon.usageLimitPerUser)) {
          return res
            .status(400)
            .json({ message: "You reached your usage limit for this coupon" });
        }
      }else{
        return res
        .status(400)
        .json({ message: "You need to be logged in to use this coupon" });
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