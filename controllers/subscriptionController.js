const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');
const { createMollieClient } = require('@mollie/api-client');
const mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
const cron = require('node-cron');
const { DateTime } = require('luxon');

// Configure the cron job to run at 1 AM every day
cron.schedule("0 1 * * *", processSubscriptions);
function calculateNextDate(dateString, frequency) {
  const date = new Date(dateString);
  
  if (frequency === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else {
    // Default to monthly
    date.setMonth(date.getMonth() + 1);
  }
  
  return date.toISOString().split('T')[0];
}

function calculateNextDateOfBilling(dateString, frequency) {
  const date = DateTime.fromISO(dateString, { zone: 'Europe/Amsterdam' });

  if (frequency === 'daily') {
    return date.plus({ days: 1 }).toISODate();

  } else if (frequency === 'weekly') {
    // Move to the *next* Monday (skip this week's Monday if today is Monday)
    const currentWeekday = date.weekday; // 1 = Monday
    const daysToAdd = 8 - currentWeekday; // e.g., if Monday (1), then add 7
    return date.plus({ days: daysToAdd }).toISODate();

  } else if (frequency === 'monthly') {
    // Just add 30 days
    return date.plus({ days: 30 }).toISODate();
  }

  // fallback
  return date.toISODate();
}
function calculateNextMondayOfBilling(dateString, frequency) {
  const date = DateTime.fromISO(dateString, { zone: 'Europe/Amsterdam' });

  if (frequency === 'daily') {
    return date.plus({ days: 1 }).toISODate();

  } else if (frequency === 'weekly') {
    // weekday: 1 = Monday, 7 = Sunday
    const daysToAdd = (8 - date.weekday) % 7 || 7; // ensures next Monday
    return date.plus({ days: daysToAdd }).toISODate();

  } else if (frequency === 'monthly') {
    return date.plus({ days: 30 }).toISODate();
  }

  return date.toISODate();
}
/**
 * Main function to process all subscription-related tasks
 */
async function processSubscriptions() {
  try {
    const today = new Date().toISOString().split("T")[0];
    console.log(`Processing subscriptions for date: ${today}`);
    
    // Process deliveries first
    await processPointDeliveries(today);
    
    // Then process payments
    await processSubscriptionPayments(today);
  } catch (error) {
    console.error(`Error in subscription processing: ${error.message}`);
  }
}

/**
 * Process point deliveries for active subscriptions
 */
async function processPointDeliveries(date) {
  const db = getDB();
  
  // Get all subscriptions that should deliver points today
  const subscriptions = await db
    .collection("subscriptions")
    .find({ deliveryDate: date, status: "active" })
    .toArray();
  
  console.log(`Found ${subscriptions.length} subscriptions for point delivery today`);
  
  for (const sub of subscriptions) {
    try {
      // Calculate points to add (subscription points minus points already used)
      const pointsToAdd = parseInt(sub.pointsPerCycle) - parseInt(sub.pointsUsed || 0);
      const userId = sub.userId;
      
      // Update user points
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { points: pointsToAdd } }
      );
      
      // Create order record

      await getDB().collection("orders").insertOne({
        user_id: userId,
        subscriptionId: sub._id,
        items: sub.items,
        pointsUsed: parseInt(sub.pointsUsed),
        metadata: {...sub.data,_delivery_date:date,_payment_method_title : "Subscription",_delivery_company:"trunkrs"}, // Convert the paymentData.data,
        deliveryDate: date,
        createdAt: new Date().toISOString(),
        status: 'subscription',
        total:(parseFloat(sub.pointsUsed)/10).toFixed(2).toString()
      });
   
      // Reset points used counter for new cycle
      // await db.collection("subscriptions").updateOne(
      //   { _id: sub._id },
      //   { 
      //     $set: { pointsUsed: 0 },
      //     $push: { 
      //       deliveryHistory: {
      //         date: new Date(),
      //         pointsDelivered: pointsToAdd
      //       } 
      //     }
      //   }
      // );
      
      // Calculate next delivery date based on frequency
      const nextDeliveryDate = calculateNextDate(date, sub.frequency);
      
      // Update subscription with next delivery date
      // TESTING CHANGE START
      await db.collection("subscriptions").updateOne(
        { _id: sub._id },
        { $set: { deliveryDate: nextDeliveryDate } }
      );
      // TESTING CHANGE END
      
      console.log(`Order created and points added for subscription userId: ${sub.userId}`);
    } catch (error) {
      console.error(`Error processing point delivery for subscription ${sub._id}: ${error.message}`);
      
      // Log error to database for tracking
      await db.collection("errors").insertOne({
        type: "pointDeliveryError",
        subscriptionId: sub._id,
        userId: sub.userId,
        error: error.message,
        timestamp: new Date()
      });
    }
  }
}

/**
 * Process payments for active subscriptions
 */
async function processSubscriptionPayments(date) {
  const db = getDB();
  
  // Get all subscriptions that should be charged today
  const subscriptions = await db
    .collection("subscriptions")
    .find({ nextPaymentDate: date, status: "active" })
    .toArray();
  
  console.log(`Found ${subscriptions.length} subscriptions for payment today`);
  
  for (const sub of subscriptions) {
    try {
      // Create a payment through Mollie
      const payment = await mollieClient.payments.create({
        amount: {
          currency: "EUR",
          value: sub.amountPerCycle.toFixed(2),
        },
        description: `Subscription Payment - ${sub._id}`,
        customerId: sub.mollieCustomerId,
        sequenceType: "recurring",
        webhookUrl: `${process.env.BACKEND_URL}/api/subscription/payment-webhook`,
        metadata: {
          subscriptionId: sub._id.toString(),
          userId: sub.userId.toString(),
          type: 'recurring-subscription-payment'
        }
      });
      
      // Update subscription with payment information
      await db.collection("subscriptions").updateOne(
        { _id: sub._id },
        { 
          $set: { 
            currentPaymentId: payment.id,
            lastPaymentAttemptDate: new Date()
          },
          $push: { 
            paymentHistory: {
              paymentId: payment.id,
              amount: parseFloat(sub.amountPerCycle),
              date: new Date(),
              status: payment.status
            } 
          }
        }
      );
      
      console.log(`Payment created for subscription ${sub._id}: ${payment.id}`);
    } catch (error) {
      console.error(`Error processing payment for subscription ${sub._id}: ${error.message}`);
      
      // Update subscription status if payment fails multiple times
      const sub = await db.collection("subscriptions").findOne({ _id: sub._id });
      const failedPayments = (sub.paymentHistory || [])
        .filter(p => p.status === 'failed')
        .filter(p => {
          const paymentDate = new Date(p.date);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return paymentDate > thirtyDaysAgo;
        });
        
      // If 3+ failed payments in last 30 days, deactivate subscription
      if (failedPayments.length >= 3) {
        await db.collection("subscriptions").updateOne(
          { _id: sub._id },
          { $set: { status: "payment-failed" } }
        );
        
        console.log(`Subscription ${sub._id} marked as payment-failed due to multiple failed attempts`);
      }
      
      // Log error to database
      await db.collection("errors").insertOne({
        type: "paymentProcessingError",
        subscriptionId: sub._id,
        userId: sub.userId,
        error: error.message,
        timestamp: new Date()
      });
    }
  }
}

/**
 * Calculate the next date based on frequency
 */


// function calculateNextDate(dateString, frequency) {
//   const date = new Date(dateString);

//   if (frequency === 'hourly') {
//     date.setHours(date.getHours() + 1);
//   } else if (frequency === 'daily') {
//     date.setDate(date.getDate() + 1);
//   } else if (frequency === 'weekly') {
//     date.setDate(date.getDate() + 7);
//   } else {
//     // Default to monthly
//     date.setMonth(date.getMonth() + 1);
//   }

//   return date.toISOString().split('.')[0]; // Returns date with time (up to seconds)
// }

/**
 * Purchase points and start subscription
 */
exports.purchasePoints = async (req, res) => {
  try {
    const { userId, totalPoints, frequency, amount, data ,startDate} = req.body;
    
    if (!userId || !totalPoints || !frequency || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Validate inputs
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }
    
    if (isNaN(parseInt(totalPoints)) || parseInt(totalPoints) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid points amount'
      });
    }
    
    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid frequency'
      });
    }
    
    // Get user details
    const user = await getDB().collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Create a Mollie customer if doesn't exist
    let mollieCustomerId = user.mollieCustomerId;
    if (!mollieCustomerId) {
      const customer = await mollieClient.customers.create({
        name: `${user.metadata?.first_name || 'Customer'} ${user.metadata?.last_name || ''}`.trim(),
        email: user.email
      });
      mollieCustomerId = customer.id;
      
      // Save Mollie customer ID to user
      await getDB().collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { mollieCustomerId: mollieCustomerId } }
      );
    }
    
    // Check if user already has an active subscription
    const existingSubscription = await getDB().collection('subscriptions').findOne({ 
      userId: new ObjectId(userId),
      paymentStatus: 'paid' 
    });
    
    let paymentMetadata = {
      userId: userId,
      pointsToAdd: totalPoints,
      frequency: frequency,
      type: 'points-subscription-setup'
    };
    
    if (existingSubscription) {
      paymentMetadata.existingSubscriptionId = existingSubscription._id.toString();
      paymentMetadata.isModification = true;
    }
    
    // Create a first payment that will also set up the mandate for future payments
    const payment = await mollieClient.payments.create({
      customerId: mollieCustomerId,
      amount: {
        currency: 'EUR',
        value: amount.toString()
      },
      description: `Purchase ${totalPoints} points and ${existingSubscription ? 'modify' : 'start'} subscription`,
      redirectUrl: `${process.env.FRONTEND_URI}/subscriptions/payment-success?id=${userId}`,
      webhookUrl: `${process.env.BACKEND_URL}/api/subscription/first-payment-webhook`,
      sequenceType: existingSubscription ? 'recurring' : 'first', // First or recurring based on existing subscription
      metadata: paymentMetadata
    });
    
    const today = new Date();
    
    // Create subscription or update existing one
    if (existingSubscription) {
      await getDB().collection('users').updateOne(
        {_id: new ObjectId(userId)},
        {
          $set: {
          currentPaymentId: payment.id,
        }}
      )
      await getDB().collection('subscriptions').updateOne(
        { _id: existingSubscription._id },
        { 
          $set: {
            pointsPerCycle: parseInt(totalPoints),
            amountPerCycle: parseFloat(amount),
            frequency: frequency,
            paymentStatus: payment.status,
            updatedAt: today,
            currentPaymentId: payment.id,
            data: data || existingSubscription.data,
            nextPaymentDate: calculateNextDateOfBilling(startDate, frequency),
            lastPaymentDate: today.toISOString().split('T')[0],
          },
          $push: {
            paymentHistory: {
              paymentId: payment.id,
              amount: parseFloat(amount),
              date: today,
              status: payment.status,
              type: 'modification'
            }
          }
        }
      );
      
      return res.json({
        success: true,
        checkoutUrl: `${process.env.FRONTEND_URI}/subscriptions/payment-success?id=${userId}&paymentStatus=${payment.status}`,
      });
    } else {
      // Calculate the initial delivery date and next payment date
      // const startDate = new Date();
      // const deliveryDate = calculateNextDate(startDate.toISOString().split('T')[0], frequency);
      // const nextPaymentDate = calculateNextDate(startDate.toISOString().split('T')[0], frequency);
      const nextPaymentDate = calculateNextDateOfBilling(startDate, frequency);

      await getDB().collection('subscriptions').insertOne({
        userId: new ObjectId(userId),
        mollieCustomerId: mollieCustomerId,
        pointsPerCycle: parseInt(totalPoints),
        pointsUsed: 0,
        amountPerCycle: parseFloat(amount),
        frequency: frequency,
        status: 'inactive',
        paymentStatus: "pending",
        createdAt: today,
        updatedAt: today,
        startDate: startDate,
        // deliveryDate: deliveryDate,
        //TESTING START
        nextPaymentDate: nextPaymentDate,
        //  nextPaymentDate: today.toISOString().split('T')[0],

        //TESTING END
        lastPaymentDate: today.toISOString().split('T')[0],
        currentPaymentId: payment.id,
        data: data || {},
        paymentHistory: [{
          paymentId: payment.id,
          amount: parseFloat(amount),
          date: today,
          status: payment.status,
          type: 'initial'
        }],
        deliveryHistory: []
      });
      return res.json({
        success: true,
        checkoutUrl: payment.getCheckoutUrl()
      });
    }
    
    // Return checkout URL to frontend
    
  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create payment'
    });
  }
};

/**
 * Handle webhook for first payment
 */
exports.firstPaymentWebhook = async (req, res) => {
  try {
    const paymentId = req.body.id;
    
    if (!paymentId) {
      console.error('No payment ID provided in webhook');
      return res.status(200).send('Webhook received but no payment ID');
    }
    
    const payment = await mollieClient.payments.get(paymentId);
    
    if (!payment.metadata) {
      console.error('No metadata found in payment', paymentId);
      return res.status(200).send('Webhook processed');
    }
    
    const { userId, pointsToAdd, frequency, type, existingSubscriptionId, isModification } = payment.metadata;
    const db = getDB();
    
    if (payment.status == 'paid') {
      if (isModification && existingSubscriptionId) {
        // This is a modification to an existing subscription
        await db.collection('subscriptions').updateOne(
          { _id: new ObjectId(existingSubscriptionId) },
          { 
            $set: { 
              paymentStatus: 'paid',
              updatedAt: new Date()
            }
          }
        );
        
        // Add the new points to the user's account
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $inc: { points: parseInt(pointsToAdd) } }
        );
        
        console.log(`Subscription ${existingSubscriptionId} modified and ${pointsToAdd} points added to user ${userId}`);
      } 
      else if (type === 'points-subscription-setup') {
        // Find the subscription
        const subscription = await db.collection('subscriptions').findOne({ 
          currentPaymentId: paymentId 
        });
        
        if (!subscription) {
          console.error(`No subscription found for payment ${paymentId}`);
          return res.status(200).send('Webhook processed - no subscription found');
        }
        
        // Update subscription status
        await db.collection('subscriptions').updateOne(
          { _id: subscription._id },
          { 
            $set: { 
              paymentStatus: 'paid',
              updatedAt: new Date()
            },
            $push: {
              paymentHistory: {
                paymentId: paymentId,
                status: 'paid',
                date: new Date(),
                amount: subscription.amountPerCycle,
                type: 'initial-payment-confirmation'
              }
            }
          }
        );
        
        // Add points to user account
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { 
            $inc: { points: parseInt(pointsToAdd) },
            $set: { 
              subscriptionFrequency: frequency,
              currentPaymentId: paymentId 
            }
          }
        );
        
        console.log(`Initial payment confirmed: Added ${pointsToAdd} points to user ${userId}`);
      }
    } 
    else if (payment.status === 'failed' || payment.status === 'canceled' || payment.status === 'expired') {
      // Handle failed payment
      await db.collection('subscriptions').updateOne(
        { currentPaymentId: paymentId },
        { 
          $set: { 
            paymentStatus: payment.status,
            updatedAt: new Date() 
          },
          $push: {
            paymentHistory: {
              paymentId: paymentId,
              status: payment.status,
              date: new Date(),
              type: 'payment-failure'
            }
          }
        }
      );
      
      console.log(`Payment ${paymentId} marked as ${payment.status}`);
    }
    
    return res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).send('Webhook processing failed');
  }
};

/**
 * Handle webhooks for recurring payments
 */
exports.paymentWebhook = async (req, res) => {
  try {
    const paymentId = req.body.id;
    
    if (!paymentId) {
      console.error('No payment ID provided in webhook');
      return res.status(200).send('Webhook received but no payment ID');
    }
    
    const payment = await mollieClient.payments.get(paymentId);
    const db = getDB();
    
    // Find the subscription for this payment
    const subscription = await db.collection('subscriptions').findOne({ 
      currentPaymentId: paymentId 
    });
    
    if (!subscription) {
      console.error(`No subscription found for payment ${paymentId}`);
      return res.status(200).send('Webhook processed - no subscription found');
    }
    
    // Update payment status in subscription
    await db.collection('subscriptions').updateOne(
      { _id: subscription._id },
      { 
        $set: { 
          paymentStatus: payment.status,
          updatedAt: new Date()
        },
        $push: {
          paymentHistory: {
            paymentId: paymentId,
            status: payment.status,
            date: new Date(),
            amount: subscription.amountPerCycle,
            type: 'recurring-payment-update'
          }
        }
      }
    );
    
    if (payment.status === 'paid') {
      // Calculate next payment date based on frequency
      
      const nextPaymentDate = calculateNextDate(
        subscription.nextPaymentDate || new Date().toISOString().split('T')[0],
        subscription.frequency
      );
     
      // Update next payment date in subscription 
      //TESTING CHANGE START
      await db.collection('subscriptions').updateOne(
        { _id: subscription._id },
        { $set: { nextPaymentDate: nextPaymentDate } }
      );
      //TESTING CHANGE END
      await db.collection('users').updateOne(
        { _id: new ObjectId(subscription.userId) },
        { $inc: { points: parseInt(subscription.pointsPerCycle) } }
      );
      
      console.log(`Payment ${paymentId} confirmed for subscription ${subscription._id}; next payment scheduled for ${nextPaymentDate}`);
    } 
    else if (payment.status === 'failed' || payment.status === 'canceled' || payment.status === 'expired') {
      // Check if this is the third failed payment
      const failedPayments = subscription.paymentHistory
        .filter(p => p.status === 'failed' || p.status === 'canceled' || p.status === 'expired')
        .filter(p => {
          const paymentDate = new Date(p.date);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return paymentDate > thirtyDaysAgo;
        });
      
      if (failedPayments.length >= 3) {
        // Suspend subscription after three failed payments
        await db.collection('subscriptions').updateOne(
          { _id: subscription._id },
          { $set: { status: 'payment-failed' } }
        );
        
        console.log(`Subscription ${subscription._id} marked as payment-failed due to multiple failed attempts`);
      } else {
        // Retry payment in 3 days
        const retryDate = new Date();
        retryDate.setDate(retryDate.getDate() + 1);
        
        await db.collection('subscriptions').updateOne(
          { _id: subscription._id },
          { $set: { nextPaymentDate: retryDate.toISOString().split('T')[0] } }
        );
        
        console.log(`Payment ${paymentId} failed for subscription ${subscription._id}; retry scheduled for ${retryDate.toISOString().split('T')[0]}`);
      }
    }
    
    return res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Error processing payment webhook:', error);
    return res.status(500).send('Webhook processing failed');
  }
};

/**
 * Check payment status
 */
exports.paymentCheck = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    
    const user = await getDB().collection('users').findOne({ _id: new ObjectId(id) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    if (!user.currentPaymentId) {
      return res.status(404).json({
        success: false,
        error: 'No payment found for this user'
      });
    }
    
    try {
      const payment = await mollieClient.payments.get(user.currentPaymentId);
      
      if (payment.status === 'paid') {
        // Get active subscription for this user
        const subscription = await getDB().collection('subscriptions').findOne({
          userId: new ObjectId(id),
          status: { $in: ['active', 'inactive'] },
          paymentStatus: 'paid'
        });
        
        return res.json({ 
          success: true, 
          user,
          payment: {
            status: payment.status,
            amount: payment.amount,
            method: payment.method
          },
          subscription: subscription ? {
            id: subscription._id,
            status: subscription.status,
            pointsPerCycle: subscription.pointsPerCycle,
            frequency: subscription.frequency,
            startDate: subscription.startDate
          } : null
        });
      } else {
        return res.json({ 
          success: false,
          paymentStatus: payment.status
        });
      }
    } catch (error) {
      console.error(`Error getting payment: ${error.message}`);
      return res.status(400).json({
        success: false,
        error: 'Could not retrieve payment information'
      });
    }
  } catch (error) {
    console.error('Error checking payment:', error);
    return res.status(500).json({
      success: false,
      error: 'Payment checking failed'
    });
  }
};

/**
 * Start a subscription
 */
exports.startSubscription = async (req, res) => {
  try {
    const { pointsUsed, userId, items, startDate } = req.body;
    
    if (!userId || !ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    
    if (!pointsUsed || isNaN(parseInt(pointsUsed)) || parseInt(pointsUsed) < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid points amount'
      });
    }
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Items must be an array'
      });
    }
    
    if (!startDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date is required'
      });
    }
    
    // Check if user has sufficient points
    const user = await getDB().collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    if (user.points < pointsUsed) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient points'
      });
    }
    
    const paymentData = await getDB().collection('subscriptions').findOne({ 
      userId: new ObjectId(userId), 
      paymentStatus: "paid",
      status: { $in: ['active', 'inactive'] }
    });
    
    if (!paymentData) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }
    
    // Deduct points from user account
    const deductUserPoints = await getDB().collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { points: -parseInt(pointsUsed) } }
    );
    
    if (deductUserPoints.modifiedCount > 0) {
      // Calculate delivery and payment dates
      const parsedStartDate = new Date(startDate);
      
      // Calculate the next delivery date based on the interval
      let deliveryDate;
      if (paymentData.frequency === 'daily') {
        deliveryDate = new Date(parsedStartDate.setDate(parsedStartDate.getDate() + 1));
      } else if (paymentData.frequency === 'weekly') {
        deliveryDate = new Date(parsedStartDate.setDate(parsedStartDate.getDate() + 7));
      } else {
        deliveryDate = new Date(parsedStartDate.setMonth(parsedStartDate.getMonth() + 1));
      }
      
      // Format the date for database
      const formattedDeliveryDate = deliveryDate.toISOString().split('T')[0];
      
      // Update subscription with start date, points used, and set status to active
      await getDB().collection('subscriptions').updateOne(
        {
          _id: paymentData._id
        },
        { 
          $set: { 
            startDate,
            //TESTING CHANGE START
            deliveryDate: formattedDeliveryDate,
            //  deliveryDate: startDate,

            //TESTING CHANGE END
            status: 'active',
            items,
            pointsUsed: parseInt(pointsUsed)
          },
          $push: {
            activity: {
              type: 'subscription_started',
              pointsUsed: parseInt(pointsUsed),
              date: new Date(),
              items: items
            }
          }
        }
      );
      
      // Create initial order
      await getDB().collection("orders").insertOne({
        user_id: userId,
        subscriptionId: paymentData._id,
        items: items,
        pointsUsed: parseInt(pointsUsed),
        metadata: {...paymentData.data,_delivery_date:startDate,_payment_method_title : "Subscription",_delivery_company:"trunkrs"}, // Convert the paymentData.data,
        deliveryDate: startDate,
        createdAt: new Date().toISOString(),
        status: 'subscription',
        total:parseFloat(pointsUsed/10).toString()
      });
      
      return res.status(200).json({
        success: true,
        message: 'Subscription Started Successfully',
        subscription: {
          id: paymentData._id,
          status: 'active',
          startDate: startDate,
          nextDelivery: formattedDeliveryDate
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Failed to deduct points'
      });
    }
  } catch (error) {
    console.error('Error starting subscription:', error);
    return res.status(500).json({
      success: false,
      error: 'Subscription starting failed'
    });
  }
};

exports.getUserSubscriptionData = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId || !ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    
    // Find subscription
    const subscription = await getDB().collection('subscriptions').findOne({
      userId: new ObjectId(userId),
      paymentStatus: 'paid',
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Paid subscription not found'
      });
    }
    return res.status(200).json({
      success: true,
      subscription
    });
  } catch (error) {
    console.error('Error getting user subscription data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user subscription data'
    });
  }
}
/**
 * Modify an existing subscription
 */
exports.updateSubscriptionData = async (req, res) => {
  try {
    const {subscriptionId,data} = req.body;
    
    if (!subscriptionId || !ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID'
      });
    }
    
    
    
    // Update subscription data
    const updatedSubscription = await getDB().collection('subscriptions').updateOne(
      { _id: new ObjectId(subscriptionId) },
      { $set: { data } }
    );
    const updatedSubscriptionData = await getDB().collection('subscriptions').findOne({ _id: new ObjectId(subscriptionId) });
    return res.status(200).json({
      success: true,
      subscription: updatedSubscriptionData
    });
  } catch (error) {
    
  }
}


//Admin
exports.updateSubscriptionStatus = async (req, res) => {
  try {
    const { subscriptionIds, status } = req.body.data; // Array of order IDs and the new status from the request body
    // Validate that subscriptionIds is an array and not empty
    if (!Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
      return res.status(400).json({ message: 'Order IDs are required and must be an array' });
    }

    // Validate that status is a string and not empty
    if (typeof status !== 'string' || status.trim() === '') {
      return res.status(400).json({ message: 'Status is required and must be a valid string' });
    }

    // Ensure all IDs are valid ObjectIds
    const invalidIds = subscriptionIds.filter(id => !ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ message: 'Invalid order ID(s): ' + invalidIds.join(', ') });
    }

    const subscriptionsCollection = getDB().collection('subscriptions');

    // Update the status of the subscriptions by their IDs
    const result = await subscriptionsCollection.updateMany(
      { _id: { $in: subscriptionIds.map(id => new ObjectId(id)) } }, // Convert string IDs to ObjectId
      { $set: { status: status } } // Set the new status
    );

    // If no subscriptions were updated, return a message
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'No subscriptions found to update' });
    }

    res.status(200).json({ message: `${result.modifiedCount} subscriptions status updated successfully` });

  } catch (error) {
    console.error('Error updating subscriptions status:', error);
    res.status(500).json({ message: 'Error updating subscriptions status', error: error.message });
  }
};
exports.deleteSubscriptions = async (req, res) => {
  try {
    const { subscriptionIds } = req.body; // Array of order IDs from the request body

    // Validate that subscriptionIds is an array and not empty
    if (!Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
      return res.status(400).json({ message: 'Order IDs are required and must be an array' });
    }

    // Ensure all IDs are valid ObjectIds
    const invalidIds = subscriptionIds.filter(id => !ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ message: 'Invalid order ID(s): ' + invalidIds.join(', ') });
    }

    const subscriptionsCollection = getDB().collection('subscriptions');

    // Delete the subscriptions by their IDs
    const result = await subscriptionsCollection.deleteMany({
      _id: { $in: subscriptionIds.map(id => new ObjectId(id)) } // Convert string IDs to ObjectId
    });

    // If no subscriptions were deleted, return a message
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No subscriptions found to delete' });
    }

    res.status(200).json({ message: `${result.deletedCount} subscriptions deleted successfully` });

  } catch (error) {
    console.error('Error deleting subscriptions:', error);
    res.status(500).json({ message: 'Error deleting subscriptions', error: error.message });
  }
};

/**
 * Resume a paused subscription user
 */
exports.resumeSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    
    if (!subscriptionId || !ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID'
      });
    }
    // Find subscription
    const subscription = await getDB().collection('subscriptions').findOne({
      _id: new ObjectId(subscriptionId),
      status: 'paused'
    });
    
    if (!subscription) {
      console.log('subscription id not found', subscription)
      return res.status(404).json({
        success: false,
        error: 'Paused subscription not found'
      });
    }
    
    // Calculate new delivery and payment dates
    const today = new Date();
    const deliveryDate = calculateNextDate(today.toISOString().split('T')[0], subscription.frequency);
    const todayISO = today.toISOString().split('T')[0]; // 'YYYY-MM-DD'

    let paymentDate;
    
    if (subscription.nextPaymentDate <= todayISO) {
      paymentDate = subscription.nextPaymentDate;
    } else {
      paymentDate = calculateNextDateOfBilling(todayISO, subscription.frequency);
    }
    
    // Update subscription status
    await getDB().collection('subscriptions').updateOne(
      { _id: new ObjectId(subscriptionId) },
      { 
        $set: { 
          status: 'inactive',
          deliveryDate: deliveryDate,
          nextPaymentDate: paymentDate,
          resumedAt: new Date()
        },
        $push: {
          activity: {
            type: 'subscription_resumed',
            date: new Date(),
            newDeliveryDate: deliveryDate,
            newPaymentDate: paymentDate
          }
        }
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Subscription resumed successfully',
      nextDelivery: deliveryDate,
      nextPayment: paymentDate
    });
  } catch (error) {
    console.error('Error resuming subscription:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resume subscription'
    });
  }
};

exports.pauseSubscription = async (req, res) => {
  try {
    const { subscriptionId, resumeDate, reason } = req.body;
    
    if (!subscriptionId || !ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID'
      });
    }
    
    // Find subscription
    const subscription = await getDB().collection('subscriptions').findOne({
      _id: new ObjectId(subscriptionId),
      status: 'active'
    });
    
    if (!subscription) {
      console.log('subscription not found')
      return res.status(404).json({
        success: false,
        error: 'Active subscription not found'
      });
    }
    
    // Update subscription status
    await getDB().collection('subscriptions').updateOne(
      { _id: new ObjectId(subscriptionId) },
      { 
        $set: { 
          status: 'paused',
          pausedAt: new Date(),   
          scheduledResumeDate: resumeDate || null,
          pauseReason: reason || 'User requested pause'
        },
        $push: {
          activity: {
            type: 'subscription_paused',
            date: new Date(),
            reason: reason || 'User requested pause',
            resumeDate: resumeDate || null
          }
        }
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Subscription paused successfully'
    });
  } catch (error) {
    console.error('Error pausing subscription:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to pause subscription'
    });
  }
}; 

exports.modifySubscription = async (req, res) => {
  try {
    const { subscriptionId, pointsUsed, items } = req.body;
    
    if (!subscriptionId || !ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID'
      });
    }
    
    if (!pointsUsed || isNaN(parseInt(pointsUsed)) || parseInt(pointsUsed) < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid points amount'
      });
    }
    
    // Find subscription
    const subscription = await getDB().collection('subscriptions').findOne({
      _id: new ObjectId(subscriptionId),
      status: 'active'
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Active subscription not found'
      });
    }
    
    // Check if user has sufficient points
    const user = await getDB().collection('users').findOne({ _id: subscription.userId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    if (user.points < pointsUsed) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient points'
      });
    }
    
    // Deduct points from user account
    const deductUserPoints = await getDB().collection('users').updateOne(
      { _id: subscription.userId },
      { $inc: { points: -parseInt(pointsUsed) } }
    );
    
    if (deductUserPoints.modifiedCount > 0) {
      // Update subscription with points used and new items
      await getDB().collection('subscriptions').updateOne(
        { _id: new ObjectId(subscriptionId) },
        { 
          $set: { 
            items: items || subscription.items,
            pointsUsed: parseInt(pointsUsed) + (subscription.pointsUsed || 0)
          },
          $push: {
            activity: {
              type: 'subscription_modified',
              pointsUsed: parseInt(pointsUsed),
              date: new Date(),
              items: items
            }
          }
        }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Subscription modified successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Failed to deduct points'
      });
    }
  } catch (error) {
    console.error('Error modifying subscription:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to modify subscription'
    });
  }
};

/**
 * Cancel a subscription
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId, reason } = req.body;
    
    if (!subscriptionId || !ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID'
      });
    }
    
    // Find subscription
    const subscription = await getDB().collection('subscriptions').findOne({
      _id: new ObjectId(subscriptionId),
      status: 'active'
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Active subscription not found'
      });
    }
    
    // Update subscription status
    await getDB().collection('subscriptions').updateOne(
      { _id: new ObjectId(subscriptionId) },
      { 
        $set: { 
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: reason || 'User requested cancellation'
        },
        $push: {
          activity: {
            type: 'subscription_cancelled',
            date: new Date(),
            reason: reason || 'User requested cancellation'
          }
        }
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
};

/**
 * Get user subscriptions
 */
exports.getUserSubscriptions = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId || !ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    
    // Get all subscriptions for the user
    const subscriptions = await getDB().collection('subscriptions')
      .find({ 
        userId: new ObjectId(userId)
      })
      .sort({ createdAt: -1 })
      .toArray();
    
    // Get recent orders for active subscriptions
    const activeSubscriptionIds = subscriptions
      .filter(sub => sub.status === 'active')
      .map(sub => sub._id);
    
    let recentOrders = [];
    if (activeSubscriptionIds.length > 0) {
      recentOrders = await getDB().collection('subOrders')
        .find({ 
          subscriptionId: { $in: activeSubscriptionIds } 
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
    }
    
    return res.json({
      success: true,
      subscriptions: subscriptions.map(sub => ({
        id: sub._id,
        status: sub.status,
        pointsPerCycle: sub.pointsPerCycle,
        pointsUsed: sub.pointsUsed || 0,
        frequency: sub.frequency,
        amountPerCycle: sub.amountPerCycle,
        startDate: sub.startDate,
        nextDelivery: sub.deliveryDate,
        nextPayment: sub.nextPaymentDate,
        items: sub.items,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt
      })),
      recentOrders: recentOrders.map(order => ({
        id: order._id,
        subscriptionId: order.subscriptionId,
        items: order.items,
        pointsUsed: order.pointsUsed || 0,
        pointsAdded: order.pointsAdded || 0,
        createdAt: order.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting user subscriptions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscriptions'
    });
  }
};

/**
 * Get subscription details
 */
exports.getSubscriptionDetails = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    if (!subscriptionId || !ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID'
      });
    }
    
    // Get subscription details
    const subscription = await getDB().collection('subscriptions').findOne({
      _id: new ObjectId(subscriptionId)
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }
    
    // Get orders for this subscription
    const orders = await getDB().collection('subOrders')
      .find({ subscriptionId: new ObjectId(subscriptionId) })
      .sort({ createdAt: -1 })
      .toArray();
    
    // Get user details
    const user = await getDB().collection('users').findOne({
      _id: subscription.userId
    });
    
    return res.json({
      success: true,
      subscription: {
        id: subscription._id,
        status: subscription.status,
        pointsPerCycle: subscription.pointsPerCycle,
        pointsUsed: subscription.pointsUsed || 0,
        frequency: subscription.frequency,
        amountPerCycle: subscription.amountPerCycle,
        startDate: subscription.startDate,
        nextDelivery: subscription.deliveryDate,
        nextPayment: subscription.nextPaymentDate,
        items: subscription.items,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        paymentStatus: subscription.paymentStatus,
        paymentHistory: subscription.paymentHistory,
        deliveryHistory: subscription.deliveryHistory,
        activity: subscription.activity
      },
      orders: orders.map(order => ({
        id: order._id,
        items: order.items,
        pointsUsed: order.pointsUsed || 0,
        pointsAdded: order.pointsAdded || 0,
        createdAt: order.createdAt,
        type: order.type || 'regular'
      })),
      user: user ? {
        id: user._id,
        email: user.email,
        name: user.metadata?.first_name 
          ? `${user.metadata.first_name} ${user.metadata.last_name || ''}`
          : 'Customer',
        points: user.points
      } : null
    });
  } catch (error) {
    console.error('Error getting subscription details:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription details'
    });
  }
};

/**
 * Dashboard stats for admin
 */
exports.getSubscriptionStats = async (req, res) => {
  try {
    const db = getDB();
    
    // Count total active subscriptions
    const activeCount = await db.collection('subscriptions').countDocuments({
      status: 'active'
    });
    
    // Count total cancelled subscriptions
    const cancelledCount = await db.collection('subscriptions').countDocuments({
      status: 'cancelled'
    });
    
    // Count total failed payment subscriptions
    const failedCount = await db.collection('subscriptions').countDocuments({
      status: 'payment-failed'
    });
    
    // Calculate total recurring revenue
    const activeSubscriptions = await db.collection('subscriptions')
      .find({ status: 'active' })
      .toArray();
    
    const monthlyRevenue = activeSubscriptions.reduce((total, sub) => {
      // Convert weekly to monthly equivalent
      if (sub.frequency === 'weekly') {
        return total + (sub.amountPerCycle * 4.33);
      } 
      // Convert daily to monthly equivalent
      else if (sub.frequency === 'daily') {
        return total + (sub.amountPerCycle * 30.42);
      }
      // Monthly subscriptions
      return total + sub.amountPerCycle;
    }, 0);
    
    // Get recent payments
    const recentPayments = await db.collection('subscriptions')
      .aggregate([
        { $match: { status: 'active' } },
        { $unwind: '$paymentHistory' },
        { $sort: { 'paymentHistory.date': -1 } },
        { $limit: 10 },
        { $project: {
          userId: 1,
          paymentId: '$paymentHistory.paymentId',
          amount: '$paymentHistory.amount',
          status: '$paymentHistory.status',
          date: '$paymentHistory.date'
        }}
      ])
      .toArray();
    
    return res.json({
      success: true,
      stats: {
        activeSubscriptions: activeCount,
        cancelledSubscriptions: cancelledCount,
        failedSubscriptions: failedCount,
        monthlyRecurringRevenue: monthlyRevenue.toFixed(2),
        recentPayments: recentPayments
      }
    });
  } catch (error) {
    console.error('Error getting subscription stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription statistics'
    });
  }
};

/**
 * Update next charge date (admin functionality)
 */
exports.updateNextChargeDate = async (req, res) => {
  try {
    const { subscriptionId, nextChargeDate } = req.body;
    
    if (!subscriptionId || !ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID'
      });
    }
    
    if (!nextChargeDate) {
      return res.status(400).json({
        success: false,
        error: 'Next charge date is required'
      });
    }
    
    // Validate date format
    if (isNaN(Date.parse(nextChargeDate))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }
    
    // Update subscription
    await getDB().collection('subscriptions').updateOne(
      { _id: new ObjectId(subscriptionId) },
      { 
        $set: { 
          nextPaymentDate: new Date(nextChargeDate).toISOString().split('T')[0],
          updatedAt: new Date()
        },
        $push: {
          activity: {
            type: 'admin_date_change',
            date: new Date(),
            field: 'nextPaymentDate',
            newValue: new Date(nextChargeDate).toISOString().split('T')[0],
            adminId: req.user ? req.user.id : 'system'
          }
        }
      }
    );
    
    return res.json({
      success: true,
      message: 'Next charge date updated successfully'
    });
  } catch (error) {
    console.error('Error updating next charge date:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update next charge date'
    });
  }
};

/**
 * Update subscription amount (admin functionality)
 */
exports.updateSubscriptionAmount = async (req, res) => {
  try {
    const { subscriptionId, newAmount } = req.body;
    
    if (!subscriptionId || !ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID'
      });
    }
    
    if (!newAmount || isNaN(parseFloat(newAmount)) || parseFloat(newAmount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }
    
    // Update subscription
    await getDB().collection('subscriptions').updateOne(
      { _id: new ObjectId(subscriptionId) },
      { 
        $set: { 
          amountPerCycle: parseFloat(newAmount),
          updatedAt: new Date()
        },
        $push: {
          activity: {
            type: 'admin_amount_change',
            date: new Date(),
            field: 'amountPerCycle',
            oldValue: null, // Should ideally fetch old value first
            newValue: parseFloat(newAmount),
            adminId: req.user ? req.user.id : 'system'
          }
        }
      }
    );
    
    return res.json({
      success: true,
      message: 'Subscription amount updated successfully'
    });
  } catch (error) {
    console.error('Error updating subscription amount:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update subscription amount'
    });
  }
};

/**
 * Pause a subscription (temporary pause)
 */

/**
 * Get subscriptions with query filters
 */
exports.getSubscriptions = async (req, res) => {
  try {
    const {
      userId,
      status,
      frequency,
      startDate,
      endDate,
      limit = 50,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = -1
    } = req.query;

    // Prepare filter object
    const filter = {};

    // Add filters based on query parameters
    if (userId) {
      filter.userId = new ObjectId(userId);
    }

    if (status) {
      if (Array.isArray(status)) {
        filter.status = { $in: status };
      } else {
        filter.status = status;
      }
    }

    if (frequency) {
      filter.frequency = frequency;
    }

    // Date range filters
    if (startDate || endDate) {
      filter.createdAt = {};
      
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count for pagination
    const totalCount = await getDB().collection('subscriptions').countDocuments(filter);
    
    // Get subscriptions with filtering, sorting, and pagination
    const subscriptions = await getDB().collection('subscriptions')
      .find(filter)
      .sort({ [sortBy]: parseInt(sortOrder) })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    
    // Get the related orders for these subscriptions
    const subscriptionIds = subscriptions.map(sub => sub._id);
    const orders = await getDB().collection('orders')
      .find({ subscriptionId: { $in: subscriptionIds } })
      .sort({ createdAt: -1 })
      .toArray();
    
    // Map orders to their respective subscriptions
    const subscriptionOrders = {};
    orders.forEach(order => {
      const subId = order.subscriptionId.toString();
      if (!subscriptionOrders[subId]) {
        subscriptionOrders[subId] = [];
      }
      subscriptionOrders[subId].push(order);
    });
    
    // Format the response
    const formattedSubscriptions = subscriptions.map(sub => ({
      id: sub._id,
      userId: sub.userId,
      status: sub.status,
      pointsPerCycle: sub.pointsPerCycle,
      pointsUsed: sub.pointsUsed || 0,
      frequency: sub.frequency,
      amountPerCycle: sub.amountPerCycle,
      startDate: sub.startDate,
      nextDelivery: sub.deliveryDate,
      nextPayment: sub.nextPaymentDate,
      items: sub.items || [],
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      paymentStatus: sub.paymentStatus,
      orders: subscriptionOrders[sub._id.toString()] || [],
      activity: sub.activity || []
    }));
    
    return res.json({
      success: true,
      subscriptions: subscriptions,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error retrieving subscriptions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscriptions'
    });
  }
};

/**
 * Get admin dashboard data for subscriptions
 */
exports.getSubscriptionDashboard = async (req, res) => {
  try {
    const db = getDB();
    
    // Get counts by status
    const statusCounts = await db.collection('subscriptions').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    
    // Format status counts
    const counts = {};
    statusCounts.forEach(item => {
      counts[item._id] = item.count;
    });
    
    // Calculate total MRR (Monthly Recurring Revenue)
    const activeSubscriptions = await db.collection('subscriptions')
      .find({ status: 'active' })
      .toArray();
    
    const mrr = activeSubscriptions.reduce((total, sub) => {
      let monthlyValue = sub.amountPerCycle;
      
      // Convert to monthly equivalent based on frequency
      if (sub.frequency === 'weekly') {
        monthlyValue = sub.amountPerCycle * 4.33; // weeks in a month
      } else if (sub.frequency === 'daily') {
        monthlyValue = sub.amountPerCycle * 30.42; // days in a month
      }
      
      return total + monthlyValue;
    }, 0);
    
    // Get recent subscriptions
    const recentSubscriptions = await db.collection('subscriptions')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    
    // Get subscription growth over time (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyGrowth = await db.collection('subscriptions').aggregate([
      { 
        $match: { 
          createdAt: { $gte: sixMonthsAgo } 
        } 
      },
      {
        $group: {
          _id: { 
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]).toArray();
    
    return res.json({
      success: true,
      dashboard: {
        counts: {
          total: Object.values(counts).reduce((a, b) => a + b, 0),
          active: counts.active || 0,
          paused: counts.paused || 0,
          cancelled: counts.cancelled || 0,
          paymentFailed: counts['payment-failed'] || 0
        },
        mrr: mrr.toFixed(2),
        recentSubscriptions: recentSubscriptions.map(sub => ({
          id: sub._id,
          userId: sub.userId,
          status: sub.status,
          amount: sub.amountPerCycle,
          frequency: sub.frequency,
          createdAt: sub.createdAt
        })),
        growth: monthlyGrowth.map(item => ({
          year: item._id.year,
          month: item._id.month,
          count: item.count
        }))
      }
    });
  } catch (error) {
    console.error('Error retrieving subscription dashboard:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription dashboard'
    });
  }
};

exports.getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID'
      });
    }
    
    const subscription = await getDB().collection('subscriptions').findOne({ _id: new ObjectId(id) });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }
    
    return res.json({
      success: true,
      subscription: subscription
    });
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription'
    });
  }
};