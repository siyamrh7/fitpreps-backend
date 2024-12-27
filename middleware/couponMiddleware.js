const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

const updateCouponOnOrder = async (req, res, next) => {
  try {
    const { discountsData} = req.body.metadata; // Assuming couponCode and userId are sent in the request body
    const couponCode = discountsData?.code;
    const redeemPoints = discountsData?.redeemPoints;
    if (!couponCode) {
      return next(); // Skip if no coupon is provided
    }

    const db = getDB();
    const couponsCollection = db.collection('coupons');

    // Fetch the coupon
    const coupon = await couponsCollection.findOne({ code: couponCode, status: 'publish' });

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found or inactive' });
    }

    // Check usage limits
    // if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
    //   return res.status(400).json({ error: 'Coupon usage limit reached' });
    // }

    // if (coupon.usageLimitPerUser > 0) {
    //   const ordersCollection = db.collection('orders'); // Assuming an orders collection tracks coupon usage
    //   const userUsageCount = await ordersCollection.countDocuments({ userId, couponCode });
    //   if (userUsageCount >= coupon.usageLimitPerUser) {
    //     return res.status(400).json({ error: 'User usage limit for this coupon reached' });
    //   }
    // }

    if(redeemPoints>0){
        const usersCollection = db.collection('users');
        const user = await usersCollection.findOne({ _id:new ObjectId(req.body.user_id) });

           // Deduct points from user account
      const updatedPoints = parseInt(user.metadata.woocommerce_reward_points) - redeemPoints;
      await usersCollection.updateOne(
        { _id: new ObjectId(req.body.user_id) },
        { $set: { "metadata.woocommerce_reward_points": updatedPoints.toString() } }
      );
    }
    // Update coupon usage count
    const updatedUsageCount = (parseInt(coupon.usageCount) || 0) + 1;
    await couponsCollection.updateOne(
      { _id:new ObjectId(coupon._id) },
      { $set: { usageCount: updatedUsageCount } }
    );

    // Proceed to the next middleware or route
    next();
  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = updateCouponOnOrder;
