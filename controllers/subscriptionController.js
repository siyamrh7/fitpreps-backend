const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');
const { createMollieClient } = require('@mollie/api-client');
const mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
const cron = require('node-cron');
const { DateTime } = require('luxon');
const emailQueue = require('../controllers/emailQueue');
const { trackStartedSubscription, trackPlacedRecurringSubscriptionOrder ,trackCancelledSubscription, trackSubscriptionPlacedOrder} = require('./subscriptionEventsController');

const nonFrozenContract =110753
const frozenContract = 97220
// Helper function for btoa (base64 encoding) in Node.js
function btoa(string) {
  return Buffer.from(string).toString('base64');
}
const plans = {
  weekly: {
      starter: { price: 64.95 + 6.95, originalPrice: 64.95 + 6.95, points: 650, bonus: 60 },
      balance: { price: 124.95, originalPrice: 124.95, points: 1250, bonus: 120 },
      elite: { price: 249.95, originalPrice: 249.95, points: 2500, bonus: 250 },
  },
  monthly: {
      starter: { price: 124.95, originalPrice: 124.95, points: 1250, bonus: 120 },
      balance: { price: 249.95, originalPrice: 249.95, points: 2500, bonus: 250 },
      elite: { price: 499.95, originalPrice: 499.95, points: 5000, bonus: 500 },
  },
};
function findPriceByPoints(totalPoints, frequency) {
    // Default to weekly if frequency not specified
    frequency = frequency || 'weekly';
    
    if (!plans[frequency]) {
        throw new Error('Invalid frequency');
    }

    const frequencyPlans = plans[frequency];
    
    // Find matching plan based on total points (points + bonus)
    for (const [tier, plan] of Object.entries(frequencyPlans)) {
        if ((plan.points + plan.bonus) === totalPoints) {
            return parseFloat(plan.price);
        }
    }
    
    throw new Error('No matching plan found for the given points');
}



function calculateNextDate(dateString, frequency) {
  const date = DateTime.fromISO(dateString, { zone: 'Europe/Amsterdam' });
  
  if (frequency === 'daily') {
    return date.plus({ days: 1 }).toISODate();
  } else if (frequency === 'weekly') {
    return date.plus({ days: 7 }).toISODate();
  } else {
    // Default to monthly
    return date.plus({ months: 1 }).toISODate();
  }
}

function calculateNextDateOfBillingMonday(dateString, frequency) {
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
function calculateNextDateOfBilling(dateString, frequency) {
  const date = DateTime.fromISO(dateString, { zone: 'Europe/Amsterdam' });

  if (frequency === 'daily') {
    return date.plus({ days: 1 }).toISODate();

  } else if (frequency === 'weekly') {
    // Always return the upcoming Monday
    // If today is Sunday (7), add 1 day to get to Monday
    // If today is Monday (1), add 7 days to get to next Monday
    // For any other day, calculate days until next Monday
    const currentWeekday = date.weekday; // 1 = Monday, 7 = Sunday
    
    let daysToAdd;
    if (currentWeekday === 7) { // Sunday
      daysToAdd = 1; // This Monday
    } else if (currentWeekday === 1) { // Monday
      daysToAdd = 7; // Next Monday
    } else {
      // For Tuesday (2) through Saturday (6), calculate days until next Monday
      daysToAdd = 8 - currentWeekday;
    }
    
    return date.plus({ days: daysToAdd }).toISODate();

  } else if (frequency === 'monthly') {
    // Just add 30 days
    return date.plus({ days: 30 }).toISODate();
  }

  // fallback
  return date.toISODate();
}
// Configure the cron job to run at 5 AM every day
cron.schedule("0 5 * * *", processSubscriptions,{
  timezone: "Europe/Amsterdam"
});
/**
 * Main function to process all subscription-related tasks
 */

async function processSubscriptions() {
  try {
    const today = DateTime.now().setZone('Europe/Amsterdam').toISODate();
    console.log(`Processing subscriptions for date: ${today}`);
    
    // Process payments first
    await processSubscriptionPayments(today);
    
    // Then process deliveries
    await processPointDeliveries(today);
    //Process Reminders
    await processMonthlyReminders(today);
  } catch (error) {
    console.error(`Error in subscription processing: ${error.message}`);
  }
}
async function processMonthlyReminders(today){
  try {
    const db = getDB();
    const subscriptions = await db.collection('subscriptions')
      .find({ 
        status: { $in: ['active', 'inactive'] },
        mealSelected:false,
        frequency:"monthly",
        paymentStatus:"paid",
      })
      .toArray();
      const emailSummary ={
        to: "info@fitpreps.nl",
        emailStats: {
          "Monthly Friday Meal Reminder": subscriptions.length,
          
        }
      }
      const emailSummary2 ={
        to: "siyamrh7@gmail.com",
        emailStats: {
          "Monthly Meal Reminder": subscriptions.length,
          
        }
      }
      await emailQueue.add({ emailType: "sub-daily-summary-owner", mailOptions: emailSummary }, {
        attempts: 3, // Retry up to 3 times in case of failure
        backoff: 5000, // Retry with a delay of 5 seconds
      });
      await emailQueue.add({ emailType: "sub-daily-summary-owner", mailOptions: emailSummary2 }, {
        attempts: 3, // Retry up to 3 times in case of failure
        backoff: 5000, // Retry with a delay of 5 seconds
      });
    for (const subscription of subscriptions) {

      //check if the subscription.lastPlanEndDate is 7 days after today
      const lastPlanEndDate = DateTime.fromISO(subscription.lastPlanEndDate, { zone: 'Europe/Amsterdam' });
      const sevenDaysAfter = lastPlanEndDate.plus({ days: 7 });

      if (sevenDaysAfter.toISODate() === today) {
        //send reminder email
        await emailQueue.add({ emailType: "sub-monthly-reminder-first", mailOptions: { to: subscription.data._billing_email,
          
          name:subscription.data._billing_first_name+" "+subscription.data._billing_last_name  } }, {
            attempts: 3, // Retry up to 3 times in case of failure
            backoff: 10000, // Retry with a delay of 5 seconds
          }
        );
      }
      //check if the subscription.nextPaymentDate is 7 days before today
      const nextPaymentDate = DateTime.fromISO(subscription.nextPaymentDate, { zone: 'Europe/Amsterdam' });
      const sevenDaysBefore = nextPaymentDate.minus({ days: 7 });

      if (sevenDaysBefore.toISODate() === today) {
        //send reminder email
        await emailQueue.add({ emailType: "sub-monthly-reminder-second", mailOptions: { to: subscription.data._billing_email,
          
          name:subscription.data._billing_first_name+" "+subscription.data._billing_last_name,lastDeliveryDate:subscription.nextPaymentDate  } }, {
            attempts: 3, // Retry up to 3 times in case of failure
            backoff: 10000, // Retry with a delay of 5 seconds
          }
        );
      }
      //check if the subscription.nextPaymentDate is 1 day before today
      const oneDayBefore = nextPaymentDate.minus({ days: 1 });

      if (oneDayBefore.toISODate() === today) {
        //send reminder email
        await emailQueue.add({ emailType: "sub-monthly-reminder-last", mailOptions: { to: subscription.data._billing_email,
          
          name:subscription.data._billing_first_name+" "+subscription.data._billing_last_name  } }, {
            attempts: 3, // Retry up to 3 times in case of failure
            backoff: 10000, // Retry with a delay of 5 seconds
          }
        );
      }


    }
  } catch (error) {
    console.error(`Error in monthly reminders processing: ${error.message}`);
  }
}
cron.schedule('0 9 * * 0', async () => {
  // Sunday reminder email
  try {
    const db = getDB();
    
    // Get all active subscriptions
    const subscriptions = await db.collection('subscriptions')
      .find({ 
        status: { $in: ['active', 'inactive'] },
        mealSelected:false,
        frequency:"weekly",
        paymentStatus:"paid",
      })
      .toArray();
    
      const emailSummary ={
        to: "info@fitpreps.nl",
        emailStats: {
          "Weekly Sunday Meal Reminder": subscriptions.length,
          
        }
      }
      const emailSummary2 ={
        to: "siyamrh7@gmail.com",
        emailStats: {
          "Weekly Sunday Meal Reminder": subscriptions.length,
          
        }
      }
      await emailQueue.add({ emailType: "sub-daily-summary-owner", mailOptions: emailSummary }, {
        attempts: 3, // Retry up to 3 times in case of failure
        backoff: 5000, // Retry with a delay of 5 seconds
      });
      await emailQueue.add({ emailType: "sub-daily-summary-owner", mailOptions: emailSummary2 }, {
        attempts: 3, // Retry up to 3 times in case of failure
        backoff: 5000, // Retry with a delay of 5 seconds
      });    
    for (const subscription of subscriptions) {
      setImmediate(async () =>
        await emailQueue.add(
          { emailType: "sub-sunday-reminder", mailOptions: { to: subscription.data._billing_email,
            
            name:subscription.data._billing_first_name+" "+subscription.data._billing_last_name  } },

          {
            attempts: 3, // Retry up to 3 times in case of failure
            backoff: 10000, // Retry with a delay of 5 seconds
          }
        )
      );
          
        
  
    }
  } catch (error) {
    console.error('Error processing Sunday reminder emails:', error);
  }
},{
  timezone: "Europe/Amsterdam"
});

cron.schedule('0 9 * * 5', async () => {
  // Friday reminder email 
  try {
    const db = getDB();
    
    // Get all active subscriptions
    const subscriptions = await db.collection('subscriptions')
      .find({ 
        status: { $in: ['active', 'inactive'] },
        mealSelected:false,
        frequency:"weekly",
        paymentStatus:"paid",
        
      })
      .toArray();
    
    const emailSummary ={
      to: "info@fitpreps.nl",
      emailStats: {
        "Weekly Friday Meal Reminder": subscriptions.length,
        
      }
    }
    const emailSummary2 ={
      to: "siyamrh7@gmail.com",
      emailStats: {
        "Weekly Friday Meal Reminder": subscriptions.length,
        
      }
    }
    await emailQueue.add({ emailType: "sub-daily-summary-owner", mailOptions: emailSummary }, {
      attempts: 3, // Retry up to 3 times in case of failure
      backoff: 5000, // Retry with a delay of 5 seconds
    });
    await emailQueue.add({ emailType: "sub-daily-summary-owner", mailOptions: emailSummary2 }, {
      attempts: 3, // Retry up to 3 times in case of failure
      backoff: 5000, // Retry with a delay of 5 seconds
    });
    for (const subscription of subscriptions) {
      
      
        setImmediate(async () =>
          await emailQueue.add(
            { emailType: "sub-friday-reminder", mailOptions: { to: subscription.data._billing_email,
              
              name:subscription.data._billing_first_name+" "+subscription.data._billing_last_name  } },
  
            {
              attempts: 3, // Retry up to 3 times in case of failure
              backoff: 10000, // Retry with a delay of 5 seconds
            }
          )
        );
    }
  } catch (error) {
    console.error('Error processing Friday reminder emails:', error);
  }
},{
  timezone: "Europe/Amsterdam"
});


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
      // Calculate points to add (subscription points minus points already used
      const userId = sub.userId;
      
      // Update user points
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { points: -parseInt(sub.pointsUsed) } }
      );
      const totalPrice=parseFloat(sub.pointsUsed/10)- (findPriceByPoints(sub.pointsPerCycle, sub.frequency).toFixed(2) < 100 ? 6.95 : 0.00)
      // Create order record
      const orderResult = await getDB().collection("orders").insertOne({
        user_id: userId,
        subscriptionId: sub._id,
        items: sub.items,
        pointsUsed: parseInt(sub.pointsUsed),
        metadata: {...sub.data,_delivery_date:date,_payment_method_title : "Subscription",_delivery_company:"trunkrs",
          _order_total:parseFloat(sub.pointsUsed/10).toFixed(2),
          _order_shipping:findPriceByPoints(sub.pointsPerCycle, sub.frequency).toFixed(2) < 100 ? "5.74" : "0.00",
          _order_shipping_tax:findPriceByPoints(sub.pointsPerCycle, sub.frequency).toFixed(2) < 100 ? "1.21" : "0.00",
          _order_tax: (totalPrice - (totalPrice / (1 + 0.09))).toFixed(2)
        }, // Convert the paymentData.data,
        deliveryDate: date,
        createdAt: DateTime.now().setZone('Europe/Amsterdam').toISO(),
        status: 'subscription',
        total:(parseFloat(sub.pointsUsed)/10).toFixed(2).toString()
      });
      
      // Send to SendCloud
      try {
        const username = process.env.SENDCLOUD_API_USERNAME;
        const password = process.env.SENDCLOUD_API_PASSWORD;
        
        // Encode the credentials in base64
        const base64Credentials = btoa(`${username}:${password}`);
        
        const orderData = await getDB().collection("orders").findOne({ _id: orderResult.insertedId });
        await trackPlacedRecurringSubscriptionOrder(orderData);
        await trackSubscriptionPlacedOrder(orderData);
        // Prepare parcel data for SendCloud
        const parcelData = {
          parcel: {
            name: orderData.metadata._shipping_first_name + " " + orderData.metadata._shipping_last_name,
            address: orderData.metadata._shipping_address_1 + " " + orderData.metadata._shipping_address_2,
            city: orderData.metadata._shipping_city ? orderData.metadata._shipping_city.slice(0, 28) : "",
            postal_code: orderData.metadata._shipping_postcode,
            telephone: orderData.metadata._shipping_phone,
            request_label: false,
            email: orderData.metadata._shipping_email,
            data: {},
            country: orderData.metadata._shipping_country,
            shipment: {
              id: 2801  // Default delivery method if not specified
            },
            contract:frozenContract,
            weight: 1.000,
            order_number: orderData._id.toString(),
            total_order_value_currency: "EUR",
            total_order_value: orderData.total,
            house_number: orderData.metadata._shipping_address_2,
            parcel_items: orderData.items.map((item) => {
              return {
                description: item.order_item_name,
                quantity: item.meta?._qty || 1,
                value: parseFloat((item.meta?._line_total || 0) / (item.meta?._qty || 1)).toFixed(2),
                weight: item.meta?._weight || 1,
                product_id: item.meta?._id || '',
                item_id: item.meta?._id || '',
                sku: item.meta?._id || ''
              };
            })
          }
        };
        
        const url = 'https://panel.sendcloud.sc/api/v2/parcels';
        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Basic ${base64Credentials}`
          },
          body: JSON.stringify(parcelData)
        };
        
        // Send to SendCloud API
        const response = await fetch(url, options);
        
        // Log response
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SendCloud API error for subscription ${sub._id}: ${errorText}`);
          
          // Log error to database
          await db.collection("errors").insertOne({
            type: "sendCloudError",
            subscriptionId: sub._id,
            userId: sub.userId,
            orderId: orderResult.insertedId,
            error: errorText,
            timestamp: DateTime.now().setZone('Europe/Amsterdam').toISO()
          });
        } else {
          const sendCloudResponse = await response.json();
          console.log(`SendCloud parcel created for subscription order: ${orderResult.insertedId}`);
          
          // Update order with SendCloud tracking info
          await getDB().collection("orders").updateOne(
            { _id: orderResult.insertedId },
            { 
              $set: { 
                sendcloud_parcel_id: sendCloudResponse.parcel.id,
                tracking_number: sendCloudResponse.parcel.tracking_number || null,
                tracking_url: sendCloudResponse.parcel.tracking_url || null
              }
            }
          );
        }
      } catch (sendCloudError) {
        console.error(`SendCloud integration error for subscription ${sub._id}: ${sendCloudError.message}`);
        
        // Log error to database
        await db.collection("errors").insertOne({
          type: "sendCloudIntegrationError",
          subscriptionId: sub._id,
          userId: sub.userId,
          orderId: orderResult.insertedId,
          error: sendCloudError.message,
          timestamp: DateTime.now().setZone('Europe/Amsterdam').toISO()
        });
      }
   
      // Calculate next delivery date based on frequency
      const nextDeliveryDate = calculateNextDate(date, sub.frequency);
      
      // Update subscription with next delivery date
      await db.collection("subscriptions").updateOne(
        { _id: sub._id },
        { $set: { deliveryDate: nextDeliveryDate } }
      );
      
      if(sub.pendingCancellationConfirmed){
        await db.collection('subscriptions').updateOne(
          { _id: sub._id },
          { $set: { status: 'cancelled' } }
        );
        await trackCancelledSubscription(sub);
      }
      console.log(`Order created and points added for subscription userId: ${sub.userId}`);
    } catch (error) {
      console.error(`Error processing point delivery for subscription ${sub._id}: ${error.message}`);
      
      // Log error to database for tracking
      await db.collection("errors").insertOne({
        type: "pointDeliveryError",
        subscriptionId: sub._id,
        userId: sub.userId,
        error: error.message,
        timestamp: DateTime.now().setZone('Europe/Amsterdam').toISO()
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
    .find({ nextPaymentDate: date,  status: { $in: ['active', 'inactive'] }, paymentStatus:'paid'    })
    .toArray();
  
  console.log(`Found ${subscriptions.length} subscriptions for payment today`);
  
  for (const sub of subscriptions) {
    try {
      if (sub.pendingCancellationConfirmed) {
        if (sub.recurringStatus === 'paid' || sub.recurringStatus === 'pending') {
          continue; // skip this one, go to the next
        }
      }
      // Create a payment through Mollie
      const payment = await mollieClient.payments.create({
        amount: {
          currency: "EUR",
          // value: sub.amountPerCycle.toFixed(2),
          value: findPriceByPoints(sub.pointsPerCycle, sub.frequency).toFixed(2),
        },
        description: `Subscription Payment - ${sub._id}`,
        customerId: sub.mollieCustomerId,
        sequenceType: "recurring",
        webhookUrl: `${process.env.API_BASE_URL}/api/subscription/payment-webhook`,
        metadata: {
          subscriptionId: sub._id.toString(),
          userId: sub.userId.toString(),
          type: 'recurring-subscription-payment'
        }
      });
   
      const now = DateTime.now().setZone('Europe/Amsterdam');
      
      // Update subscription with payment information
      await db.collection("subscriptions").updateOne(
        { _id: sub._id },
        { 
          $set: { 
            currentPaymentId: payment.id,
            lastPaymentAttemptDate: now.toJSDate(),
            updatedAt: now.toJSDate(),
            paymentStatus:"paid"
          },
          $push: { 
            paymentHistory: {
              paymentId: payment.id,
              amount: findPriceByPoints(sub.pointsPerCycle, sub.frequency).toFixed(2),
              date: now.toJSDate(),
              status: payment.status,
              type: 'recurring-payment'
            } 
          }
        }
      );
      if (sub.recurringStatus === 'failed' || sub.recurringStatus === 'canceled' || sub.recurringStatus === 'expired') {
        continue; // skip this one, go to the next
      }
         const nextPaymentDate = calculateNextDate(
        sub.nextPaymentDate || now.toISODate(),
        sub.frequency
      );
      
        await db.collection('subscriptions').updateOne(
          { _id: sub._id },
          { $set: { nextPaymentDate: nextPaymentDate, mealSelected:false, lastPlanEndDate:sub.planEndDate, planEndDate:calculateNextDate(sub.planEndDate, sub.frequency) } }
        );
      
      // Update next payment date in sub 
     
      
      await db.collection('users').updateOne(
        { _id: new ObjectId(sub.userId) },
        { $inc: { points: parseInt(sub.pointsPerCycle) } }
      );

      if(sub.pendingCancellation){
        await db.collection('subscriptions').updateOne(
          { _id: sub._id },
          { $set: { pendingCancellationConfirmed: true } }
        );
      }
      setImmediate(async () =>
        await emailQueue.add(
          { emailType: sub.frequency == "weekly" ? "sub-renewal-weekly" : "sub-renewal-monthly", mailOptions: { to: sub.data._billing_email,
            
            name:sub.data._billing_first_name+" "+sub.data._billing_last_name  } },

          {
            attempts: 3, // Retry up to 3 times in case of failure
            backoff: 5000, // Retry with a delay of 5 seconds
          }
        )
      );
      
      console.log(`Payment created for sub ${sub._id}: ${payment.id}`);
    } catch (error) {
      console.error(`Error processing payment for subscription ${sub._id}: ${error.message}`);
      
      // Update subscription status if payment fails multiple times
      const subscription = await db.collection("subscriptions").findOne({ _id: sub._id });
      const failedPayments = (subscription.paymentHistory || [])
        .filter(p => p.status === 'failed')
        .filter(p => {
          const paymentDate = DateTime.fromJSDate(p.date).setZone('Europe/Amsterdam');
          const thirtyDaysAgo = DateTime.now().setZone('Europe/Amsterdam').minus({ days: sub.frequency === 'weekly' ? 7 : 30 });
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
        timestamp: DateTime.now().setZone('Europe/Amsterdam').toISO()
      });
    }
  }
}
// setTimeout(async() =>{await processSubscriptionPayments(DateTime.now().setZone('Europe/Amsterdam').toISODate())},4000)
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
    const { userId, totalPoints, frequency, amount, data ,startDate,type} = req.body;
    
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
    
    // Create a first payment that will also set up the mandate for future payment
    const payment = await mollieClient.payments.create({
      customerId: mollieCustomerId,
      amount: {
        currency: 'EUR',
        value: amount.toString()
      },
      description: `Purchase ${totalPoints} points and ${existingSubscription ? 'modify' : 'start'} subscription`,
      redirectUrl: `${process.env.FRONTEND_URI}/subscriptions/payment-success?id=${userId}`,
      webhookUrl: existingSubscription ? `${process.env.API_BASE_URL}/api/subscription/payment-webhook` : `${process.env.API_BASE_URL}/api/subscription/first-payment-webhook`,
      sequenceType: existingSubscription ? 'recurring' : 'first', // First or recurring based on existing subscription
      metadata: paymentMetadata,
      
    });
    
    const now = DateTime.now().setZone('Europe/Amsterdam');
    
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
            type:type || null,
            // paymentStatus: payment.status,
            updatedAt: now.toJSDate(),
            currentPaymentId: payment.id,
            data: data || existingSubscription.data,
            nextPaymentDate: calculateNextDate(existingSubscription.nextPaymentDate, frequency),
            lastPaymentDate: now.toISODate(),
            // deliveryDate: null,
            mealSelected:false,
            lastPlanEndDate:existingSubscription.planEndDate,
            planEndDate:calculateNextDate(existingSubscription.planEndDate, frequency),
          },
          $push: {
            paymentHistory: {
              paymentId: payment.id,
              amount: parseFloat(amount),
              date: now.toJSDate(),
              status: payment.status,
              type: 'modification'
            }
          }
        }
      );
   
      
      // Add the new points to the user's account
      await getDB().collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { points: parseInt(totalPoints) } }
      );
   
      return res.json({
        success: true,
        checkoutUrl: `${process.env.FRONTEND_URI}/subscriptions/payment-success?paymentStatus=paid`,
      });
    } else {
      // Calculate the initial delivery date and next payment date
      const nextPaymentDate = calculateNextDateOfBilling(startDate, frequency);

      await getDB().collection('subscriptions').insertOne({
        userId: new ObjectId(userId),
        mollieCustomerId: mollieCustomerId,
        pointsPerCycle: parseInt(totalPoints),
        pointsUsed: 0,
        type:type || null,
        amountPerCycle: parseFloat(amount),
        frequency: frequency,
        status: 'inactive',
        paymentStatus: "pending",
        createdAt: now.toJSDate(),
        updatedAt: now.toJSDate(),
        startDate: startDate,
        mealSelected:false,
        deliveryDate: null,
        nextPaymentDate: frequency === "weekly" ? startDate : nextPaymentDate,
        lastPaymentDate: now.toISODate(),
        currentPaymentId: payment.id,
        lastPlanEndDate:startDate,
        planEndDate:nextPaymentDate,
        data: data || {},
        paymentHistory: [{
          paymentId: payment.id,
          amount: parseFloat(amount),
          date: now.toJSDate(),
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
    const now = DateTime.now().setZone('Europe/Amsterdam');
    
    if (payment.status == 'paid') {
      if (isModification && existingSubscriptionId) {
        // This is a modification to an existing subscription
        console.log(`Subscription ${existingSubscriptionId} modified and ${pointsToAdd} points added to user ${userId}`);
      } 
      else if (type === 'points-subscription-setup') {
     
        // Find the subscription
        const subscription = await db.collection('subscriptions').findOne({ 
          currentPaymentId: paymentId 
        });
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { 
            $inc: { points: parseInt(pointsToAdd) },
            $set: { 
              subscriptionFrequency: frequency,
              currentPaymentId: paymentId,
              subscriptionId: subscription._id 
            }
          }
        );
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
              updatedAt: now.toJSDate()      
            },
            $push: {
              paymentHistory: {
                paymentId: paymentId,
                status: 'paid',
                date: now.toJSDate(),
                amount: subscription.amountPerCycle,
                type: 'initial-payment-confirmation'
              }
            }
          }
        );
        
        // Add points to user account
     
        setImmediate(async () =>
          await emailQueue.add(
            { emailType: subscription.frequency == "weekly" ? "sub-welcome-weekly" : "sub-welcome-monthly", mailOptions: { to: subscription.data._billing_email,profile:process.env.FRONTEND_URI+"/profile",
              
              name:subscription.data._billing_first_name+" "+subscription.data._billing_last_name  } },

            {
              attempts: 3, // Retry up to 3 times in case of failure
              backoff: 5000, // Retry with a delay of 5 seconds
            }
          )
        );
        const subscriptionData = {
          customer: {
            name: subscription.data._billing_first_name+" "+subscription.data._billing_last_name,
            email: subscription.data._billing_email,
            phone: subscription.data._billing_phone
          },
          plan: subscription.frequency == "weekly" ? "Wekelijks Abonnement" : "Maandelijks Abonnement",
          startDate: subscription.startDate,
          total: subscription.amountPerCycle,
         
        };
        setImmediate(async () => {
          await emailQueue.add(
            { emailType: "sub-welcome-owner", mailOptions: subscriptionData },
            {
              attempts: 3, // Retry up to 3 times in case of failure
              backoff: 5000, // Retry with a delay of 5 seconds
            }
          );
        });
        await trackStartedSubscription(subscription);
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
            updatedAt: now.toJSDate() 
          },
          $push: {
            paymentHistory: {
              paymentId: paymentId,
              status: payment.status,
              date: now.toJSDate(),
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
          
          updatedAt: new Date(),
          recurringStatus:payment.status
        },
        $push: {
          paymentHistory: {
            paymentId: paymentId,
            status: payment.status,
            date: new Date(),
            amount: findPriceByPoints(subscription.pointsPerCycle, subscription.frequency).toFixed(2),
            type: 'recurring-payment-update'
          }
        }
      }
    );
    
    if (payment.status === 'paid') {
      // Calculate next payment date based on frequency
      
      // const nextPaymentDate = calculateNextDate(
      //   subscription.nextPaymentDate || new Date().toISOString().split('T')[0],
      //   subscription.frequency
      // );
     
      // // Update next payment date in subscription 
      // //TESTING CHANGE START
      // await db.collection('subscriptions').updateOne(
      //   { _id: subscription._id },
      //   { $set: { nextPaymentDate: nextPaymentDate ,mealSelected:false,  lastPlanEndDate:subscription.nextPaymentDate,planEndDate:nextPaymentDate        } }
      // );
      // //TESTING CHANGE END
      // await db.collection('users').updateOne(
      //   { _id: new ObjectId(subscription.userId) },
      //   { $inc: { points: parseInt(subscription.pointsPerCycle) } }
      // );
      // if(subscription.pendingCancellation){
      //   await db.collection('subscriptions').updateOne(
      //     { _id: subscription._id },
      //     { $set: { pendingCancellationConfirmed: true } } 
      //   );
      // }
      if (subscription.recurringStatus === 'failed' || subscription.recurringStatus === 'canceled' || subscription.recurringStatus === 'expired') {
        await db.collection('subscriptions').updateOne(
          { _id: subscription._id },
          { $set: { nextPaymentDate: subscription.frequency === 'weekly' ? subscription.lastPlanEndDate : subscription.planEndDate } }
        );
      }
    } 
    else if (payment.status === 'failed' || payment.status === 'canceled' || payment.status === 'expired') {
        // Log error to database
        await db.collection("errors").insertOne({
          type: "paymentProcessingError",
          subscriptionId: subscription._id,
          userId: subscription.userId,
          error:payment.status,
          timestamp: DateTime.now().setZone('Europe/Amsterdam').toISO()
        });
      
      // Check if this is the third failed payment
      const failedPayments = subscription.paymentHistory
        .filter(p => p.status === 'failed' || p.status === 'canceled' || p.status === 'expired')
        .filter(p => {
          const paymentDate = DateTime.fromJSDate(p.date).setZone('Europe/Amsterdam');
          const thirtyDaysAgo = DateTime.now().setZone('Europe/Amsterdam').minus({ days: subscription.frequency === 'monthly' ? 30 : 7 });
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
        // Retry payment in 1 day
        const now = DateTime.now().setZone('Europe/Amsterdam');
        const retryDate = now.plus({ days: 2 });
        
        await db.collection('subscriptions').updateOne(
          { _id: subscription._id },
          { $set: { nextPaymentDate: retryDate.toISODate() } }
        );
        const mailOptions = {
          customerName: subscription.data._billing_first_name+" "+subscription.data._billing_last_name,
          customerEmail: subscription.data._billing_email,
          subscriptionId: subscription._id,
          amount: findPriceByPoints(subscription.pointsPerCycle, subscription.frequency).toFixed(2),
          paymentDate: DateTime.now().setZone('Europe/Amsterdam').toISO(),
          errorMessage: 'Insufficient funds Retry payment on '+ retryDate.toISODate(),
          plan: subscription.frequency == "weekly" ? "Wekelijks Abonnement" : "Maandelijks Abonnement"
        }
        setImmediate(async () => {
          await emailQueue.add(
            { emailType: "sub-payment-failure", mailOptions: mailOptions},
            {
              attempts: 3, // Retry up to 3 times in case of failure
              backoff: 5000, // Retry with a delay of 5 seconds
            }
          );
        });
        console.log(`Payment ${paymentId} failed for subscription ${subscription._id}; retry scheduled for ${retryDate.toISODate()}`);
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
          subscription: subscription 
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
      const date = DateTime.fromISO(startDate, { zone: 'Europe/Amsterdam' });
      
      // Calculate the next delivery date based on the interval
      let deliveryDate;
      if (paymentData.frequency === 'daily') {
        deliveryDate = date.plus({ days: 1 });
      } else if (paymentData.frequency === 'weekly') {
        deliveryDate = date.plus({ days: 7 });
      } else {
        deliveryDate = date.plus({ months: 1 });
      }
      
      // Format the date for database
      const formattedDeliveryDate = deliveryDate.toISODate();
      
      // Update subscription with start date, points used, and set status to active
      await getDB().collection('subscriptions').updateOne(
        {
          _id: paymentData._id
        },
        { 
          $set: { 
            deliveryDate: paymentData.frequency === "weekly" ? formattedDeliveryDate : calculateNextDate(paymentData.nextPaymentDate, paymentData.frequency),
            mealSelected: true,
            status: 'active',
            items,
            pointsUsed: parseInt(pointsUsed)
          },
          $push: {
            activity: {
              type: 'subscription_started',
              pointsUsed: parseInt(pointsUsed),
              date: DateTime.now().setZone('Europe/Amsterdam').toJSDate(),
              items: items,
              deliveryDate: startDate
            }
          }
        }
      );
     
      const totalPrice=parseFloat(pointsUsed/10)- (findPriceByPoints(paymentData.pointsPerCycle, paymentData.frequency).toFixed(2) < 100 ? 6.95 : 0.00) 
      // Create initial order
      const orderResult = await getDB().collection("orders").insertOne({
        user_id: userId,
        subscriptionId: paymentData._id,
        items: items,
        pointsUsed: parseInt(pointsUsed),
        metadata: {...paymentData.data,_delivery_date:startDate,_payment_method_title : "Subscription",_delivery_company:"trunkrs",_order_total:parseFloat(pointsUsed/10).toFixed(2),
          _order_shipping:findPriceByPoints(paymentData.pointsPerCycle, paymentData.frequency).toFixed(2) < 100 ? "5.74" : "0.00",
          _order_shipping_tax:findPriceByPoints(paymentData.pointsPerCycle, paymentData.frequency).toFixed(2) < 100 ? "1.21" : "0.00",
          _order_tax: (totalPrice - (totalPrice / (1 + 0.09))).toFixed(2)
        }, // Convert the paymentData.data,
        deliveryDate: startDate,
        createdAt: DateTime.now().setZone('Europe/Amsterdam').toISO(),
        status: 'subscription',
        total:parseFloat(pointsUsed/10).toFixed(2)
      });
      try {
        const username = process.env.SENDCLOUD_API_USERNAME;
        const password = process.env.SENDCLOUD_API_PASSWORD;
        
        // Encode the credentials in base64
        const base64Credentials = btoa(`${username}:${password}`);
        
        const orderData = await getDB().collection("orders").findOne({ _id: orderResult.insertedId });
        await trackPlacedRecurringSubscriptionOrder(orderData);
        await trackSubscriptionPlacedOrder(orderData);
        // Prepare parcel data for SendCloud
        const parcelData = {
          parcel: {
            name: orderData.metadata._shipping_first_name + " " + orderData.metadata._shipping_last_name,
            address: orderData.metadata._shipping_address_1 + " " + orderData.metadata._shipping_address_2,
            city: orderData.metadata._shipping_city ? orderData.metadata._shipping_city.slice(0, 28) : "",
            postal_code: orderData.metadata._shipping_postcode,
            telephone: orderData.metadata._shipping_phone,
            request_label: false,
            email: orderData.metadata._shipping_email,
            data: {},
            country: orderData.metadata._shipping_country,
            shipment: {
              id: 2801  // Default delivery method if not specified
            },
            contract:frozenContract,
            weight: 1.000,
            order_number: orderData._id.toString(),
            total_order_value_currency: "EUR",
            total_order_value: orderData.total,
            house_number: orderData.metadata._shipping_address_2,
            parcel_items: orderData.items.map((item) => {
              return {
                description: item.order_item_name,
                quantity: item.meta?._qty || 1,
                value: parseFloat((item.meta?._line_total || 0) / (item.meta?._qty || 1)).toFixed(2),
                weight: item.meta?._weight || 1,
                product_id: item.meta?._id || '',
                item_id: item.meta?._id || '',
                sku: item.meta?._id || ''
              };
            })
          }
        };
        
        const url = 'https://panel.sendcloud.sc/api/v2/parcels';
        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Basic ${base64Credentials}`
          },
          body: JSON.stringify(parcelData)
        };
        
        // Send to SendCloud API
        const response = await fetch(url, options);
        
        // Log response
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SendCloud API error for subscription ${paymentData._id}: ${errorText}`);
          
          // Log error to database
          await getDB().collection("errors").insertOne({
            type: "sendCloudError",
            subscriptionId: paymentData._id,
            userId: userId,
            orderId: orderResult.insertedId,
            error: errorText,
            timestamp: DateTime.now().setZone('Europe/Amsterdam').toISO()
          });
        } else {
          const sendCloudResponse = await response.json();
          console.log(`SendCloud parcel created for subscription order: ${orderResult.insertedId}`);
          
          // Update order with SendCloud tracking info
          await getDB().collection("orders").updateOne(
            { _id: orderResult.insertedId },
            { 
              $set: { 
                sendcloud_parcel_id: sendCloudResponse.parcel.id,
                tracking_number: sendCloudResponse.parcel.tracking_number || null,
                tracking_url: sendCloudResponse.parcel.tracking_url || null
              }
            }
          );
        }
      } catch (sendCloudError) {
        console.error(`SendCloud integration error for subscription ${paymentData._id}: ${sendCloudError.message}`);
        
        // Log error to database
        await getDB().collection("errors").insertOne({
          type: "sendCloudIntegrationError",
          subscriptionId: paymentData._id,
          userId: userId,
          orderId: orderResult.insertedId,
          error: sendCloudError.message,
          timestamp: DateTime.now().setZone('Europe/Amsterdam').toISO()
        });
      }
      setImmediate(async () =>
        await emailQueue.add(
          { emailType: paymentData.frequency == "weekly" ? "sub-confirmation-weekly" : "sub-confirmation-monthly", mailOptions: { to: paymentData.data._billing_email,deliveryDate:startDate,
            
            name:paymentData.data._billing_first_name+" "+paymentData.data._billing_last_name  } },

          {
            attempts: 3, // Retry up to 3 times in case of failure
            backoff: 5000, // Retry with a delay of 5 seconds
          }
        )
      );
      if(paymentData.pendingCancellationConfirmed){
        await getDB().collection('subscriptions').updateOne(
          { _id: paymentData._id },
          { $set: { status: 'cancelled' } }
        );
        await trackCancelledSubscription(paymentData);
      }
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
    
    // Add cancellation information if applicable
    const responseData = {
      ...subscription
    };
    
    return res.status(200).json({
      success: true,
      subscription: responseData
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
    const { subscriptionId, resumeDate } = req.body;
    
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
    let paymentMetadata = {
      userId: subscription.userId.toString(),
      pointsToAdd: subscription.pointsPerCycle,
      frequency: subscription.frequency,
      type: 'points-subscription-setup'
    };
    
    if (subscription) {
      paymentMetadata.existingSubscriptionId = subscription._id.toString();
      paymentMetadata.isModification = true;
    }
    const userId = subscription.userId.toString();
    // Create a first payment that will also set up the mandate for future payments
    const payment = await mollieClient.payments.create({
      customerId: subscription.mollieCustomerId,
      amount: {
        currency: 'EUR',
        value: findPriceByPoints(subscription.pointsPerCycle, subscription.frequency).toFixed(2)
      },
      description: `Purchase ${subscription.pointsPerCycle} points and ${subscription ? 'modify' : 'start'} subscription`,
      // redirectUrl: `${process.env.FRONTEND_URI}/subscriptions/payment-success?id=${userId}`,
      webhookUrl: `${process.env.API_BASE_URL}/api/subscription/payment-webhook`,
      sequenceType: 'recurring',
      metadata: paymentMetadata
    });
    
    const now = DateTime.now().setZone('Europe/Amsterdam');
    const resumeDateFormatted = resumeDate ? resumeDate : now.toISODate();
    
    // Update existing subscription
    if (subscription) {
      await getDB().collection('users').updateOne(
        {_id: new ObjectId(userId)},
        {
          $set: {
            currentPaymentId: payment.id,
          }
        }
      );
      
      await getDB().collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { points: parseInt(subscription.pointsPerCycle) } }
      );
      
      const nextPaymentDate = calculateNextDateOfBilling(resumeDateFormatted, subscription.frequency);

      await getDB().collection('subscriptions').updateOne(
        { _id: new ObjectId(subscription._id) },
        { 
          $set: {
            status: 'active',
            paymentStatus: 'paid',
            updatedAt: now.toJSDate(),
            currentPaymentId: payment.id,
            data: subscription.data,
            nextPaymentDate: subscription.frequency === "weekly" ? resumeDateFormatted : nextPaymentDate,
            lastPaymentDate: now.toISODate(),
            deliveryDate: null,
            planEndDate: nextPaymentDate,
            lastPlanEndDate: resumeDateFormatted,
            mealSelected: false,
          },
          $push: {
            paymentHistory: {
              paymentId: payment.id,
              amount: parseFloat(findPriceByPoints(subscription.pointsPerCycle, subscription.frequency)),
              date: now.toJSDate(),
              status: payment.status,
              type: 'resume'
            },
            activity: {
              type: 'subscription_resumed',
              date: now.toJSDate()
            }
          }
        }
      );
      
      return res.json({
        success: true,
        checkoutUrl: `${process.env.FRONTEND_URI}/subscriptions/payment-success?paymentStatus=paid`,
      });
    }
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
    
    const now = DateTime.now().setZone('Europe/Amsterdam');
    
    // Update subscription status
    await getDB().collection('subscriptions').updateOne(
      { _id: new ObjectId(subscriptionId) },
      { 
        $set: { 
          status: 'paused',
          pausedAt: now.toJSDate(),   
          scheduledResumeDate: resumeDate || null,
          pauseReason: reason || 'User requested pause',
          
        },
        $push: {
          activity: {
            type: 'subscription_paused',
            date: now.toJSDate(),
            reason: reason || 'User requested pause',
            resumeDate: resumeDate || null
          }
        }
      }
    );
    setImmediate(async () =>
      await emailQueue.add(
        { emailType: "sub-pause", mailOptions: { to: subscription.data._billing_email, ResumeLink: process.env.FRONTEND_URI+"/profile",
          
          name: subscription.data._billing_first_name+" "+subscription.data._billing_last_name  } },

        {
          attempts: 3, // Retry up to 3 times in case of failure
          backoff: 5000, // Retry with a delay of 5 seconds
        }
      )
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
    
    const now = DateTime.now().setZone('Europe/Amsterdam');
    
    // Instead of cancelling immediately, mark it for cancellation after next payment date
    await getDB().collection('subscriptions').updateOne(
      { _id: new ObjectId(subscriptionId) },
      { 
        $set: { 
          status: 'active', // Keep it active
          pendingCancellation: true, // Add a flag to indicate pending cancellation
          scheduledCancellationDate: subscription.nextPaymentDate,
          cancellationRequested: now.toJSDate(),
          cancelReason: reason || 'User requested cancellation',
          
        },
        $push: {
          activity: {
            type: 'subscription_cancellation_scheduled',
            date: now.toJSDate(),
            scheduledDate: subscription.nextPaymentDate,
            reason: reason || 'User requested cancellation'
          }
        }
      }
    );
    setImmediate(async () =>
      await emailQueue.add(
        { emailType: subscription.frequency == "weekly" ? "sub-cancel-weekly" : "sub-cancel-monthly", mailOptions: { to: subscription.data._billing_email,
          
          name: subscription.data._billing_first_name+" "+subscription.data._billing_last_name  } },

        {
          attempts: 3, // Retry up to 3 times in case of failure
          backoff: 5000, // Retry with a delay of 5 seconds
        }
      )
    );
    return res.status(200).json({
      success: true,
      message: 'Subscription scheduled for cancellation after next payment date',
      scheduledCancellationDate: subscription.nextPaymentDate
    });
  } catch (error) {
    console.error('Error scheduling subscription cancellation:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to schedule subscription cancellation'
    });
  }
};
exports.getSubscriptions = async (req, res) => {
  try {
    const {
      userId,
      status,
      frequency,
      startDate,
      searchTerm,
      endDate,
      pendingCancellation,
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
    if (searchTerm) {
      const regex = new RegExp(searchTerm, 'i');
      const isFullId = /^[0-9a-fA-F]{24}$/.test(searchTerm); // Check if it's a full ObjectId
      
     
        filter.$or= [
          {   "data._billing_first_name": regex },
          { "data._billing_last_name": regex },
          { "data._billing_email": regex },
        ]
      
      
      if (isFullId) {
        // If the search term is a full ObjectId, search directly
        filter.$or.push({ _id: new ObjectId(searchTerm) });
      } else {
        // Convert `_id` to a string inside MongoDB and search
        filter.$or.push({
          $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: searchTerm, options: "i" } }
        });
      }
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
    
    // Add filter for pending cancellation if provided
    if (pendingCancellation !== undefined) {
      filter.pendingCancellation = pendingCancellation === 'true';
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
    
    // Format the response with additional cancellation information
    return res.json({
      success: true,
      subscriptions: subscriptions.map(sub => ({
        ...sub
      })),
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
    
    // Add cancellation information if applicable
    const responseData = {
      ...subscription
    };
    
    return res.json({
      success: true,
      subscription: responseData
    });
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription'
    });
  }
};

/* 
 * Manually charge a subscription from admin panel
 */
exports.manualChargeSubscription = async (req, res) => {
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
      paymentStatus:"paid"
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }
    
    try {
      // Create a payment through Mollie
      const payment = await mollieClient.payments.create({
        amount: {
          currency: "EUR",
          value: findPriceByPoints(subscription.pointsPerCycle, subscription.frequency).toFixed(2),
        },
        description: `Manual Subscription Payment - ${subscription._id}`,
        customerId: subscription.mollieCustomerId,
        sequenceType: "recurring",
        webhookUrl: `${process.env.API_BASE_URL}/api/subscription/payment-webhook`,
        metadata: {
          subscriptionId: subscription._id.toString(),
          userId: subscription.userId.toString(),
          type: 'manual-subscription-payment'
        }
      });
      
      const now = DateTime.now().setZone('Europe/Amsterdam');
      
      // Update subscription with payment information
      await getDB().collection("subscriptions").updateOne(
        { _id: subscription._id },
        { 
          $set: { 
            currentPaymentId: payment.id,
            lastPaymentAttemptDate: now.toJSDate(),
            updatedAt: now.toJSDate(),
            
          },
          $push: { 
            paymentHistory: {
              paymentId: payment.id,
              amount: findPriceByPoints(subscription.pointsPerCycle, subscription.frequency).toFixed(2),
              date: now.toJSDate(),
              status: payment.status,
              type: 'manual-payment'
            },
            activity: {
              type: 'manual_payment_initiated',
              date: now.toJSDate(),
              adminInitiated: true,
              paymentId: payment.id
            }
          }
        }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Manual payment initiated successfully',
        paymentId: payment.id,
        amount: findPriceByPoints(subscription.pointsPerCycle, subscription.frequency).toFixed(2)
      });
      
    } catch (error) {
      console.error(`Error processing manual payment for subscription ${subscription._id}: ${error.message}`);
      
      // Log error to database
      await getDB().collection("errors").insertOne({
        type: "manualPaymentProcessingError",
        subscriptionId: subscription._id,
        userId: subscription.userId,
        error: error.message,
        timestamp: DateTime.now().setZone('Europe/Amsterdam').toISO()
      });
      
      return res.status(500).json({
        success: false,
        error: `Failed to process payment: ${error.message}`
      });
    }
    
  } catch (error) {
    console.error('Error initiating manual payment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to initiate manual payment'
    });
  }
};

