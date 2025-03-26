const { getDB } = require('../config/db');
const {  ObjectId } = require('mongodb'); // Import new ObjectId to handle MongoDB IDs
const { createMollieClient } = require('@mollie/api-client');
const mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
const cron = require('node-cron');
// Step 1: Initial points purchase remains the same (one-time payment)

// Step 2: When creating a subscription, set up a Mollie recurring subscription

cron.schedule("0 0 * * *", async () => {
  const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD

  // Get all subscriptions that should be charged today
  // const subscriptions = await db.getActiveSubscriptions(today);
  const subscriptions = await getDB()
  .collection("subscriptions")
  .find({ deliveryDate: today, status: "active" })
  .toArray();

  subscriptions.forEach(async (sub) => {
      try {
        const pointsToAdd = parseInt(sub.pointsPerCycle)-parseInt(sub.pointsUsed);
        const userId = sub.userId;

        await getDB().collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $inc: { points: parseInt(pointsToAdd) } } 
        );
          await createOrder(sub.customerId, sub.items); // Create order
          console.log(`Order created for subscription: ${sub.id}`);
      } catch (error) {
          console.error(`Error creating order: ${error.message}`);
      }
  });
});

exports.purchasePoints = async (req, res) => {
  try {
    const { userId, totalPoints, frequency ,amount} = req.body;
    
    // Calculate amount based on points
    const pointRate = 0.1; // Example: €0.10 per point
    // const amount = totalPoints * pointRate;

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
        value: amount.toFixed(2)
      },
      description: `Purchase ${totalPoints} points and start subscription`,
      redirectUrl: `${process.env.FRONTEND_URI}/subscriptions/payment-success?id=${userId}`,
      webhookUrl: `https://2e9d-137-59-155-130.ngrok-free.app/api/subscription/first-payment-webhook`,
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
      paymentStatus:"pending",
      createdAt: new Date(),
      lastPaymentDate: new Date().toISOString().split('T')[0],
      currentPaymentId: payment.id,
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
  console.log("firstPaymentWebhook", paymentId);
  
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
        { $inc: { points: parseInt(pointsToAdd) }, $set: { frequency: frequency,currentPaymentId:paymentId} } 
      );

      // If subscription setup is requested, create recurring subscription
      // if (setupSubscription === true || setupSubscription === 'true') {
      //   const interval = frequency === 'weekly' ? '1 week' : '1 month';
      //   // const interval = '1 minute'; // This is for testing only!

      //   // Create a subscription through Mollie API
      //   const subscription = await mollieClient.customers_subscriptions.create({
      //     customerId: payment.customerId,
      //     amount: {
      //       currency: 'EUR',
      //       value: payment.amount.value
      //     },
      //     interval: interval,
      //     description: `Automatic ${pointsToAdd} points (${frequency})`,
      //     webhookUrl: `https://1440-137-59-155-130.ngrok-free.app/api/subscription/subscription-webhook`,
      //     metadata: {
      //       userId: userId,
      //       pointsToAdd: pointsToAdd,
      //       type: 'recurring-points-purchase'
      //     }
      //   });
        
      //   // Save subscription information
      //   await getDB().collection('pointSubscriptions').insertOne({
      //     userId: new ObjectId(userId),
      //     mollieCustomerId: payment.customerId,
      //     mollieSubscriptionId: subscription.id,
      //     pointsPerCycle: parseInt(pointsToAdd),
      //     amountPerCycle: parseFloat(payment.amount.value),
      //     frequency: frequency,
      //     status: 'active',
      //     createdAt: new Date()
      //   });
      // }
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Webhook processing failed');
  }
}
exports.paymentCheck= async (req, res) => {
 try {
  const {id}=req.params;
  const user=await getDB().collection('users').findOne({ _id: new ObjectId(id) });
  // const paymentData=await getDB().collection('subscriptions').findOne({currentPaymentId:user.currentPaymentId});
  const payment= await mollieClient.payments.get(user.currentPaymentId);  
  if (payment.status === 'paid') {
   return res.json({ success: true,user });
  }else{
    return res.json({ success: false });
  }

  
 } catch (error) {
  console.error('Error checking payment:', error);
    res.status(500).send('Payment Checking Failed');
 }
}
// exports.startSubscription = async (req, res) => {
//   try {
//     const {mollieCustomerId,pointsUsed,userId,items,startDate}=req.body;
//        const paymentData=await getDB().collection('payments').findOne({userId});
    
//       const deductUserPoints = await getDB().collection('users').updateOne(
//         { _id: new ObjectId(userId) },
//         { $inc: { points: -pointsUsed } }
//       )
//      if (deductUserPoints.modifiedCount > 0) {
//         const interval = paymentData.frequency === 'weekly' ? '1 week' : '1 month';
//         // const interval = '1 minute'; // This is for testing only!
//         const parsedStartDate = new Date(startDate);

//         // Calculate the new startDate based on the interval
//         let newStartDate;
//         if (interval === '1 week') {
//           // Add 1 week to the startDate
//           newStartDate = new Date(parsedStartDate.setDate(parsedStartDate.getDate() + 7));
//         } else {
//           // Add 1 month to the startDate
//           newStartDate = new Date(parsedStartDate.setMonth(parsedStartDate.getMonth() + 1));
//         }
        
//         // Format the date in ISO 8601 format for Mollie
//         const formattedStartDate = newStartDate.toISOString().split('T')[0];
        
//         // Create a subscription through Mollie API
//         const subscription = await mollieClient.customers_subscriptions.create({
//           customerId: mollieCustomerId,
//           amount: {
//             currency: 'EUR',
//             value: paymentData.amount.toFixed(2)
//           },
//           interval: interval,
//           description: `Automatic ${paymentData.pointsToAdd} points (${paymentData.frequency})`,

//           startDate: formattedStartDate,
//           webhookUrl: `https://2e9d-137-59-155-130.ngrok-free.app/api/subscription/subscription-webhook`,
//           metadata: {
//             userId: userId,
//             pointsToAdd: paymentData.pointsToAdd,
//             type: 'recurring-points-purchase'
//           }
//         });
        
//         // Save subscription information
//         await getDB().collection('subscriptions').insertOne({
//           userId: new ObjectId(userId),
//           mollieCustomerId: mollieCustomerId,
//           mollieSubscriptionId: subscription.id,
//           pointsPerCycle: parseInt(paymentData.pointsToAdd),
//           amountPerCycle: parseFloat(paymentData.amount),
//           frequency: paymentData.frequency,
//           status: 'active',
//           createdAt: new Date(),
//           deliveryDate:startDate,
//           items:items,
//           pointsUsed:pointsUsed,
//           startDate:startDate,
//           nextPaymentDate:formattedStartDate
//         });
//         return res.status(200).send('Subscription Started Successfully');
//       }else{
//         return res.status(400).send('Subscription Starting Failed');
//       }
//   } catch (error) {
//     console.error('Error starting subscription:', error);
//     res.status(500).send('Subscription Starting Failed');
//   }
// }

exports.startSubscription = async (req, res) => {
  try {
    const { mollieCustomerId, pointsUsed, userId, items, startDate } = req.body;
    
    const paymentData = await getDB().collection('subscriptions').findOne({ userId });
        
    const deductUserPoints = await getDB().collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { points: -pointsUsed } }
    );
    
    if (deductUserPoints.modifiedCount > 0) {
      const interval = paymentData.frequency === 'weekly' ? '1 week' : '1 month';
      const parsedStartDate = new Date(startDate);
      
      // Calculate the next payment date based on the interval
      let nextPaymentDate;
      if (interval === '1 week') {
        nextPaymentDate = new Date(parsedStartDate);
        nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);
      } else {
        nextPaymentDate = new Date(parsedStartDate);
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      }
      
      // Format the date in ISO 8601 format
      const formattedNextPaymentDate = nextPaymentDate.toISOString().split('T')[0];
      

      
      // Store payment information for future reference
      await getDB().collection('manual_subscriptions').insertOne({
        userId: new ObjectId(userId),
        mollieCustomerId: mollieCustomerId,
        pointsPerCycle: parseInt(paymentData.pointsToAdd),
        amountPerCycle: parseFloat(paymentData.amount),
        frequency: paymentData.frequency,
        status: 'active',
        createdAt: new Date(),
        deliveryDate: startDate,
        items: items,
        pointsUsed: pointsUsed,
        startDate: startDate,
        nextPaymentDate: formattedNextPaymentDate,
        lastPaymentDate: new Date().toISOString().split('T')[0],
        currentPaymentId: payment.id,
        paymentHistory: [{
          paymentId: payment.id,
          amount: parseFloat(paymentData.amount),
          date: new Date(),
          status: payment.status
        }]
      });
      
      return res.status(200).json({
        message: 'Immediate payment created successfully',
        paymentUrl: payment.getCheckoutUrl(),
        paymentId: payment.id
      });
    } else {
      return res.status(400).send('Failed to create payment');
    }
  } catch (error) {
    console.error('Error creating immediate payment:', error);
    res.status(500).send('Payment creation failed');
  }
};



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
exports.triggerImmediatePayment =  async (req, res) => {
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



exports.getSubsctionData=async (req, res) => {
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