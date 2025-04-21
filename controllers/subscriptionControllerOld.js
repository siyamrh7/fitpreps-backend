const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb'); // Import new ObjectId to handle MongoDB IDs
const { createMollieClient } = require('@mollie/api-client');
const mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
const cron = require('node-cron');
// Step 1: Initial points purchase remains the same (one-time payment)

// Step 2: When creating a subscription, set up a Mollie recurring subscription

cron.schedule("* * * * *", async () => {
  const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD
console.log(today)
  // Get all subscriptions that should be charged today
  // const subscriptions = await db.getActiveSubscriptions(today);
  const subscriptions = await getDB()
    .collection("subscriptions")
    .find({ deliveryDate: today, status: "active" })
    .toArray();

  subscriptions.forEach(async (sub) => {
    try {
      const pointsToAdd = parseInt(sub.pointsPerCycle) - parseInt(sub.pointsUsed);
      const userId = sub.userId;

      await getDB().collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { points: parseInt(pointsToAdd) } }
      );
      await getDB().collection("subOrders").insertOne({
        userId: new ObjectId(userId),
        items: sub.items,
        data: sub.data
      })
      console.log(`Order created for subscription userId: ${sub.userId}`);




    } catch (error) {
      console.error(`Error creating order: ${error.message}`);
    }
  });
  const subscriptions2 = await getDB()
    .collection("subscriptions")
    .find({ nextPaymentDate: today, status: "active" })
    .toArray();
  subscriptions2.forEach(async (sub2) => {
    const payment = await mollieClient.payments.create({
      amount: {
        currency: "EUR",
        value: sub2.amountPerCycle.toFixed(2),
      },
      description: "Subscription Payment",
      customerId: sub2.mollieCustomerId,
      sequenceType: "recurring", // Recurring payment
      // method, // Use stored method from mandate
      // webhookUrl: "https://2e9d-137-59-155-130.ngrok-free.app/api/subscription/subscription-webhook",
    });
    console.log(payment)
  })
});

exports.purchasePoints = async (req, res) => {
  try {
    const { userId, totalPoints, frequency, amount, data } = req.body;


    // Get user details
    const user = await getDB().collection('users').findOne({ _id: new ObjectId(userId) });

    // Create a Mollie customer if doesn't exist
    let mollieCustomerId = user.mollieCustomerId;
    if (!mollieCustomerId) {
      const customer = await mollieClient.customers.create({
        name: user.metadata.first_name + ' ' + user.metadata.last_name,
        email: user.email
      });
      mollieCustomerId = customer.id;
      // Save Mollie customer ID to user
      await getDB().collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { mollieCustomerId: mollieCustomerId } }
      );
    }
    // Create a first payment that will also set up the mandate for future payments
    const payment = await mollieClient.payments.create({
      customerId: mollieCustomerId,
      amount: {
        currency: 'EUR',
        value: amount
      },
      description: `Purchase ${totalPoints} points and start subscription`,
      redirectUrl: `${process.env.FRONTEND_URI}/subscriptions/payment-success?id=${userId}`,
      webhookUrl: `https://9e2f-137-59-155-130.ngrok-free.app/api/subscription/first-payment-webhook`,
      sequenceType: 'first', // This is crucial for setting up the mandate
      metadata: {
        userId: userId,
        pointsToAdd: totalPoints,
        frequency: frequency,
        setupSubscription: true,
        type: 'points-subscription-setup'
      }
    });

    // Save payment information to MongoDB
    // await getDB().collection('payments').insertOne({
    //   userId: userId,
    //   molliePaymentId: payment.id,
    //   mollieCustomerId: mollieCustomerId,
    //   amount: amount,
    //   pointsToAdd: totalPoints,
    //   frequency: frequency,
    //   setupSubscription: true,
    //   status: 'pending',
    //   createdAt: new Date()
    // });
    await getDB().collection('subscriptions').insertOne({
      userId: new ObjectId(userId),
      mollieCustomerId: mollieCustomerId,
      pointsPerCycle: parseInt(totalPoints),
      amountPerCycle: parseFloat(amount),
      frequency: frequency,
      status: 'inactive',
      paymentStatus: "pending",
      createdAt: new Date(),
      lastPaymentDate: new Date().toISOString().split('T')[0],
      currentPaymentId: payment.id,
      data: data,
      paymentHistory: [{
        paymentId: payment.id,
        amount: parseFloat(amount),
        date: new Date(),
        status: payment.status
      }]
    });
    // Return checkout URL to frontend

    return res.json({
      success: true,
      checkoutUrl: payment.getCheckoutUrl()
    });
    // }else{
    //  return res.status(400).json({ 
    //     success: false, 
    //   });
    // }


  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment'
    });
  }
}
exports.firstPaymentWebhook = async (req, res) => {
  try {


    const paymentId = req.body.id;

    const payment = await mollieClient.payments.get(paymentId);

    if (!payment.metadata) {
      console.error('No metadata found in payment', paymentId);
      return res.status(200).send('Webhook processed');
    }

    const { userId, pointsToAdd, frequency, type } = payment.metadata;

    // Update payment status in database
    await getDB().collection('subscriptions').updateOne(
      { currentPaymentId: paymentId },
      { $set: { paymentStatus: payment.status, updatedAt: new Date() } }
    );

    if (payment.status === 'paid' && type === 'points-subscription-setup') {
      // Add points to user account
      await getDB().collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { points: parseInt(pointsToAdd) }, $set: { frequency: frequency, currentPaymentId: paymentId } }
      );

     
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Webhook processing failed');
  }
}
exports.paymentCheck = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getDB().collection('users').findOne({ _id: new ObjectId(id) });
    // const paymentData=await getDB().collection('subscriptions').findOne({currentPaymentId:user.currentPaymentId});
    const payment = await mollieClient.payments.get(user.currentPaymentId);
    if (payment.status === 'paid') {
      return res.json({ success: true, user });
    } else {
      return res.json({ success: false });
    }


  } catch (error) {
    console.error('Error checking payment:', error);
    res.status(500).send('Payment Checking Failed');
  }
}
exports.startSubscription = async (req, res) => {
  try {
    const { pointsUsed, userId, items, startDate } = req.body;
    const paymentData = await getDB().collection('subscriptions').findOne({ userId: new ObjectId(userId), paymentStatus: "paid" });

    const deductUserPoints = await getDB().collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { points: -pointsUsed } }
    )

    if (deductUserPoints.modifiedCount > 0) {
      const interval = paymentData.frequency === 'weekly' ? '1 week' : '1 month';
      // const interval = '1 minute'; // This is for testing only!
      const parsedStartDate = new Date(startDate);

      // Calculate the new startDate based on the interval
      let newStartDate;
      if (interval === '1 week') {
        // Add 1 week to the startDate
        newStartDate = new Date(parsedStartDate.setDate(parsedStartDate.getDate() + 7));
      } else {
        // Add 1 month to the startDate
        newStartDate = new Date(parsedStartDate.setMonth(parsedStartDate.getMonth() + 1));
      }

      // Format the date in ISO 8601 format for Mollie
      const formattedStartDate = newStartDate.toISOString().split('T')[0];

     
      await getDB().collection('subscriptions').updateOne({
        userId: new ObjectId(userId),
        paymentStatus: "paid"
      },
        { $set: { startDate, nextPaymentDate: formattedStartDate, status: 'active', items } }
      )
    
      return res.status(200).send('Subscription Started Successfully');
    } else {
      return res.status(400).send('Subscription Starting Failed');
    }
  } catch (error) {
    console.error('Error starting subscription:', error);
    res.status(500).send('Subscription Starting Failed');
  }
}

// exports.startSubscription = async (req, res) => {
//   try {
//     const { mollieCustomerId, pointsUsed, userId, items, startDate } = req.body;

//     const paymentData = await getDB().collection('subscriptions').findOne({ userId });

//     const deductUserPoints = await getDB().collection('users').updateOne(
//       { _id: new ObjectId(userId) },
//       { $inc: { points: -pointsUsed } }
//     );

//     if (deductUserPoints.modifiedCount > 0) {
//       const interval = paymentData.frequency === 'weekly' ? '1 week' : '1 month';
//       const parsedStartDate = new Date(startDate);

//       // Calculate the next payment date based on the interval
//       let nextPaymentDate;
//       if (interval === '1 week') {
//         nextPaymentDate = new Date(parsedStartDate);
//         nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);
//       } else {
//         nextPaymentDate = new Date(parsedStartDate);
//         nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
//       }

//       // Format the date in ISO 8601 format
//       const formattedNextPaymentDate = nextPaymentDate.toISOString().split('T')[0];



//       // Store payment information for future reference
//       await getDB().collection('manual_subscriptions').insertOne({
//         userId: new ObjectId(userId),
//         mollieCustomerId: mollieCustomerId,
//         pointsPerCycle: parseInt(paymentData.pointsToAdd),
//         amountPerCycle: parseFloat(paymentData.amount),
//         frequency: paymentData.frequency,
//         status: 'active',
//         createdAt: new Date(),
//         deliveryDate: startDate,
//         items: items,
//         pointsUsed: pointsUsed,
//         startDate: startDate,
//         nextPaymentDate: formattedNextPaymentDate,
//         lastPaymentDate: new Date().toISOString().split('T')[0],
//         currentPaymentId: payment.id,
//         paymentHistory: [{
//           paymentId: payment.id,
//           amount: parseFloat(paymentData.amount),
//           date: new Date(),
//           status: payment.status
//         }]
//       });

//       return res.status(200).json({
//         message: 'Immediate payment created successfully',
//         paymentUrl: payment.getCheckoutUrl(),
//         paymentId: payment.id
//       });
//     } else {
//       return res.status(400).send('Failed to create payment');
//     }
//   } catch (error) {
//     console.error('Error creating immediate payment:', error);
//     res.status(500).send('Payment creation failed');
//   }
// };



exports.recuiringPointsWebhook = async (req, res) => {
  try {
    // Mollie sends either a payment ID or a subscription ID
    const id = req.body.id;
    console.log("requiringPointsWebhook", id);
    if (id.startsWith('tr_')) {
      // It's a payment update
      const payment = await mollieClient.payments.get(id);

      if (payment.metadata && payment.metadata.type === 'recurring-points-purchase') {
        const userId = payment.metadata.userId;
        const pointsToAdd = parseInt(payment.metadata.pointsToAdd);

        // // Record payment
        // await getDB().collection('pointsPayments').insertOne({
        //   userId: new ObjectId(userId),
        //   molliePaymentId: id,
        //   amount: parseFloat(payment.amount.value),
        //   pointsToAdd: pointsToAdd,
        //   status: payment.status,
        //   createdAt: new Date()
        // });

        // // If payment successful, add points to user
        // if (payment.status === 'paid') {
        //   await getDB().collection('users').updateOne(
        //     { _id: new ObjectId(userId) },
        //     { $inc: { points: pointsToAdd } }
        //   );
        // }
      }
    } else if (id.startsWith('sub_')) {
      // It's a subscription update
      const subscriptionId = id;
      const customerId = req.body.customerId;

      // if (!customerId) {
      //   console.error('No customerId provided for subscription', subscriptionId);
      //   return res.status(200).send('Webhook processed');
      // }

      // const subscription = await mollieClient.customers_subscriptions.get(
      //   subscriptionId, 
      //   { customerId: customerId }
      // );

      // // Update subscription status in our database
      // await getDB().collection('pointSubscriptions').updateOne(
      //   { mollieSubscriptionId: subscriptionId },
      //   { 
      //     $set: { 
      //       mollieStatus: subscription.status,
      //       status: subscription.status,
      //       updatedAt: new Date()
      //     } 
      //   }
      // );
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Error processing recurring points webhook:', error);
    res.status(500).send('Webhook processing failed');
  }
}


// subscriptionController.js

// Trigger an immediate payment for a subscription
exports.triggerImmediatePayment = async (req, res) => {
  try {
    const { customerId } = req.query;

    // // First, retrieve the subscription to get its details
    // const subscription = await mollieClient.customers_subscriptions.get(subscriptionId, { customerId });

    // // Create a payment using all the subscription's original settings
    // const payment = await mollieClient.payments.create({
    //   customerId: customerId,
    //   mandateId: subscription.mandateId,
    //   amount: subscription.amount,
    //   description: subscription.description,
    //   sequenceType: 'recurring',
    //   method: "creditcard",

    //   metadata: subscription.metadata,
    //   webhookUrl: subscription.webhookUrl  // Use the original webhook URL
    // });
    const payment = await mollieClient.payments.create({
      amount: {
        currency: "EUR",
        value: "100.00",
      },
      description: "Manual Subscription Payment",
      customerId: customerId,
      sequenceType: "recurring", // Recurring payment
      // method, // Use stored method from mandate
      webhookUrl: "https://2e9d-137-59-155-130.ngrok-free.app/api/subscription/subscription-webhook",
    });
    res.status(201).json({
      message: 'Subscription payment triggered successfully',
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      description: payment.description
    });
  } catch (error) {
    console.error('Error triggering subscription payment:', error.message);
    res.status(500).json({ error: error.message });
  }
};



exports.getSubsctionData = async (req, res) => {
  try {
    const { customerId, subscriptionId } = req.query;

    const subscription = await mollieClient.customers_subscriptions.get(subscriptionId, { customerId });

    res.json({
      id: subscription.id,
      customerId: subscription.customerId,
      status: subscription.status,
      amount: subscription.amount,
      times: subscription.times,
      timesRemaining: subscription.timesRemaining,
      interval: subscription.interval,
      startDate: subscription.startDate,
      nextPaymentDate: subscription.nextPaymentDate,
      description: subscription.description,
      createdAt: subscription.createdAt,
      mandateId: subscription.mandateId,
      webhookUrl: subscription.webhookUrl,
      metadata: subscription.metadata,

    });
  } catch (error) {
    console.error('Error fetching subscription:', error.message);
    res.status(500).json({ error: error.message });
  }
}
// exports.modifySubscription = async (req, res) => {
//   try {
//     const { subscriptionId, pointsUsed, items } = req.body;
    
//     if (!subscriptionId || !ObjectId.isValid(subscriptionId)) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid subscription ID'
//       });
//     }
    
//     if (!pointsUsed || isNaN(parseInt(pointsUsed)) || parseInt(pointsUsed) < 0) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid points amount'
//       });
//     }
    
//     // Find subscription
//     const subscription = await getDB().collection('subscriptions').findOne({
//       _id: new ObjectId(subscriptionId),
//       status: 'active'
//     });
    
//     if (!subscription) {
//       return res.status(404).json({
//         success: false,
//         error: 'Active subscription not found'
//       });
//     }
    
//     // Check if user has sufficient points
//     const user = await getDB().collection('users').findOne({ _id: subscription.userId });
    
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         error: 'User not found'
//       });
//     }
    
//     if (user.points < pointsUsed) {
//       return res.status(400).json({
//         success: false,
//         error: 'Insufficient points'
//       });
//     }
    
//     // Deduct points from user account
//     const deductUserPoints = await getDB().collection('users').updateOne(
//       { _id: subscription.userId },
//       { $inc: { points: -parseInt(pointsUsed) } }
//     );
    
//     if (deductUserPoints.modifiedCount > 0) {
//       // Update subscription with points used and new items
//       await getDB().collection('subscriptions').updateOne(
//         { _id: new ObjectId(subscriptionId) },
//         { 
//           $set: { 
//             items: items || subscription.items,
//             pointsUsed: parseInt(pointsUsed) + (subscription.pointsUsed || 0)
//           },
//           $push: {
//             activity: {
//               type: 'subscription_modified',
//               pointsUsed: parseInt(pointsUsed),
//               date: new Date(),
//               items: items
//             }
//           }
//         }
//       );
      
//       return res.status(200).json({
//         success: true,
//         message: 'Subscription modified successfully'
//       });
//     } else {
//       return res.status(400).json({
//         success: false,
//         error: 'Failed to deduct points'
//       });
//     }
//   } catch (error) {
//     console.error('Error modifying subscription:', error);
//     return res.status(500).json({
//       success: false,
//       error: 'Failed to modify subscription'
//     });
//   }
// };

/**
 * Get user subscriptions
 */
// exports.getUserSubscriptions = async (req, res) => {
//   try {
//     const { userId } = req.params;
    
//     if (!userId || !ObjectId.isValid(userId)) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid user ID'
//       });
//     }
    
//     // Get all subscriptions for the user
//     const subscriptions = await getDB().collection('subscriptions')
//       .find({ 
//         userId: new ObjectId(userId)
//       })
//       .sort({ createdAt: -1 })
//       .toArray();
    
//     // Get recent orders for active subscriptions
//     const activeSubscriptionIds = subscriptions
//       .filter(sub => sub.status === 'active')
//       .map(sub => sub._id);
    
//     let recentOrders = [];
//     if (activeSubscriptionIds.length > 0) {
//       recentOrders = await getDB().collection('subOrders')
//         .find({ 
//           subscriptionId: { $in: activeSubscriptionIds } 
//         })
//         .sort({ createdAt: -1 })
//         .limit(10)
//         .toArray();
//     }
    
//     return res.json({
//       success: true,
//       subscriptions: subscriptions.map(sub => ({
//         id: sub._id,
//         status: sub.status,
//         pointsPerCycle: sub.pointsPerCycle,
//         pointsUsed: sub.pointsUsed || 0,
//         frequency: sub.frequency,
//         amountPerCycle: sub.amountPerCycle,
//         startDate: sub.startDate,
//         nextDelivery: sub.deliveryDate,
//         nextPayment: sub.nextPaymentDate,
//         items: sub.items,
//         createdAt: sub.createdAt,
//         updatedAt: sub.updatedAt
//       })),
//       recentOrders: recentOrders.map(order => ({
//         id: order._id,
//         subscriptionId: order.subscriptionId,
//         items: order.items,
//         pointsUsed: order.pointsUsed || 0,
//         pointsAdded: order.pointsAdded || 0,
//         createdAt: order.createdAt
//       }))
//     });
//   } catch (error) {
//     console.error('Error getting user subscriptions:', error);
//     return res.status(500).json({
//       success: false,
//       error: 'Failed to retrieve subscriptions'
//     });
//   }
// };

/**
 * Get subscription details
 */


/**
 * Dashboard stats for admin
 */
// exports.getSubscriptionStats = async (req, res) => {
//   try {
//     const db = getDB();
    
//     // Count total active subscriptions
//     const activeCount = await db.collection('subscriptions').countDocuments({
//       status: 'active'
//     });
    
//     // Count total cancelled subscriptions
//     const cancelledCount = await db.collection('subscriptions').countDocuments({
//       status: 'cancelled'
//     });
    
//     // Count total failed payment subscriptions
//     const failedCount = await db.collection('subscriptions').countDocuments({
//       status: 'payment-failed'
//     });
    
//     // Calculate total recurring revenue
//     const activeSubscriptions = await db.collection('subscriptions')
//       .find({ status: 'active' })
//       .toArray();
    
//     const monthlyRevenue = activeSubscriptions.reduce((total, sub) => {
//       // Convert weekly to monthly equivalent
//       if (sub.frequency === 'weekly') {
//         return total + (sub.amountPerCycle * 4.33);
//       } 
//       // Convert daily to monthly equivalent
//       else if (sub.frequency === 'daily') {
//         return total + (sub.amountPerCycle * 30.42);
//       }
//       // Monthly subscriptions
//       return total + sub.amountPerCycle;
//     }, 0);
    
//     // Get recent payments
//     const recentPayments = await db.collection('subscriptions')
//       .aggregate([
//         { $match: { status: 'active' } },
//         { $unwind: '$paymentHistory' },
//         { $sort: { 'paymentHistory.date': -1 } },
//         { $limit: 10 },
//         { $project: {
//           userId: 1,
//           paymentId: '$paymentHistory.paymentId',
//           amount: '$paymentHistory.amount',
//           status: '$paymentHistory.status',
//           date: '$paymentHistory.date'
//         }}
//       ])
//       .toArray();
    
//     return res.json({
//       success: true,
//       stats: {
//         activeSubscriptions: activeCount,
//         cancelledSubscriptions: cancelledCount,
//         failedSubscriptions: failedCount,
//         monthlyRecurringRevenue: monthlyRevenue.toFixed(2),
//         recentPayments: recentPayments
//       }
//     });
//   } catch (error) {
//     console.error('Error getting subscription stats:', error);
//     return res.status(500).json({
//       success: false,
//       error: 'Failed to retrieve subscription statistics'
//     });
//   }
// };

/**
 * Update next charge date (admin functionality)
 */
// exports.updateNextChargeDate = async (req, res) => {
//   try {
//     const { subscriptionId, nextChargeDate } = req.body;
    
//     if (!subscriptionId || !ObjectId.isValid(subscriptionId)) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid subscription ID'
//       });
//     }
    
//     if (!nextChargeDate) {
//       return res.status(400).json({
//         success: false,
//         error: 'Next charge date is required'
//       });
//     }
    
//     // Validate date format
//     if (isNaN(Date.parse(nextChargeDate))) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid date format'
//       });
//     }
    
//     // Update subscription
//     await getDB().collection('subscriptions').updateOne(
//       { _id: new ObjectId(subscriptionId) },
//       { 
//         $set: { 
//           nextPaymentDate: new Date(nextChargeDate).toISOString().split('T')[0],
//           updatedAt: new Date()
//         },
//         $push: {
//           activity: {
//             type: 'admin_date_change',
//             date: new Date(),
//             field: 'nextPaymentDate',
//             newValue: new Date(nextChargeDate).toISOString().split('T')[0],
//             adminId: req.user ? req.user.id : 'system'
//           }
//         }
//       }
//     );
    
//     return res.json({
//       success: true,
//       message: 'Next charge date updated successfully'
//     });
//   } catch (error) {
//     console.error('Error updating next charge date:', error);
//     return res.status(500).json({
//       success: false,
//       error: 'Failed to update next charge date'
//     });
//   }
// };

/**
 * Update subscription amount (admin functionality)
 */
// exports.updateSubscriptionAmount = async (req, res) => {
//   try {
//     const { subscriptionId, newAmount } = req.body;
    
//     if (!subscriptionId || !ObjectId.isValid(subscriptionId)) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid subscription ID'
//       });
//     }
    
//     if (!newAmount || isNaN(parseFloat(newAmount)) || parseFloat(newAmount) <= 0) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid amount'
//       });
//     }
    
//     // Update subscription
//     await getDB().collection('subscriptions').updateOne(
//       { _id: new ObjectId(subscriptionId) },
//       { 
//         $set: { 
//           amountPerCycle: parseFloat(newAmount),
//           updatedAt: new Date()
//         },
//         $push: {
//           activity: {
//             type: 'admin_amount_change',
//             date: new Date(),
//             field: 'amountPerCycle',
//             oldValue: null, // Should ideally fetch old value first
//             newValue: parseFloat(newAmount),
//             adminId: req.user ? req.user.id : 'system'
//           }
//         }
//       }
//     );
    
//     return res.json({
//       success: true,
//       message: 'Subscription amount updated successfully'
//     });
//   } catch (error) {
//     console.error('Error updating subscription amount:', error);
//     return res.status(500).json({
//       success: false,
//       error: 'Failed to update subscription amount'
//     });
//   }
// };

/**
 * Pause a subscription (temporary pause)
 */

/**
 * Get subscriptions with query filters
 */

/**
 * Get admin dashboard data for subscriptions
 */
// exports.getSubscriptionDashboard = async (req, res) => {
//   try {
//     const db = getDB();
    
//     // Get counts by status
//     const statusCounts = await db.collection('subscriptions').aggregate([
//       { $group: { _id: '$status', count: { $sum: 1 } } }
//     ]).toArray();
    
//     // Format status counts
//     const counts = {};
//     statusCounts.forEach(item => {
//       counts[item._id] = item.count;
//     });
    
//     // Calculate total MRR (Monthly Recurring Revenue)
//     const activeSubscriptions = await db.collection('subscriptions')
//       .find({ status: 'active' })
//       .toArray();
    
//     const mrr = activeSubscriptions.reduce((total, sub) => {
//       let monthlyValue = sub.amountPerCycle;
      
//       // Convert to monthly equivalent based on frequency
//       if (sub.frequency === 'weekly') {
//         monthlyValue = sub.amountPerCycle * 4.33; // weeks in a month
//       } else if (sub.frequency === 'daily') {
//         monthlyValue = sub.amountPerCycle * 30.42; // days in a month
//       }
      
//       return total + monthlyValue;
//     }, 0);
    
//     // Get recent subscriptions
//     const recentSubscriptions = await db.collection('subscriptions')
//       .find({})
//       .sort({ createdAt: -1 })
//       .limit(10)
//       .toArray();
    
//     // Get subscription growth over time (last 6 months)
//     const sixMonthsAgo = new Date();
//     sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
//     const monthlyGrowth = await db.collection('subscriptions').aggregate([
//       { 
//         $match: { 
//           createdAt: { $gte: sixMonthsAgo } 
//         } 
//       },
//       {
//         $group: {
//           _id: { 
//             year: { $year: "$createdAt" },
//             month: { $month: "$createdAt" }
//           },
//           count: { $sum: 1 }
//         }
//       },
//       { $sort: { "_id.year": 1, "_id.month": 1 } }
//     ]).toArray();
    
//     return res.json({
//       success: true,
//       dashboard: {
//         counts: {
//           total: Object.values(counts).reduce((a, b) => a + b, 0),
//           active: counts.active || 0,
//           paused: counts.paused || 0,
//           cancelled: counts.cancelled || 0,
//           paymentFailed: counts['payment-failed'] || 0
//         },
//         mrr: mrr.toFixed(2),
//         recentSubscriptions: recentSubscriptions.map(sub => ({
//           id: sub._id,
//           userId: sub.userId,
//           status: sub.status,
//           amount: sub.amountPerCycle,
//           frequency: sub.frequency,
//           createdAt: sub.createdAt
//         })),
//         growth: monthlyGrowth.map(item => ({
//           year: item._id.year,
//           month: item._id.month,
//           count: item.count
//         }))
//       }
//     });
//   } catch (error) {
//     console.error('Error retrieving subscription dashboard:', error);
//     return res.status(500).json({
//       success: false,
//       error: 'Failed to retrieve subscription dashboard'
//     });
//   }
// };

// Helper function to find price based on total points

