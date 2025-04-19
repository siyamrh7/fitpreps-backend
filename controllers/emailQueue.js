require('dotenv').config();
const Bull = require('bull');
const { orderEmailController, contactEmailController, orderEmailController2,requestPasswordResetController, newAccountEmailController,
  subscriptionWelcomeController,
  subscriptionConfirmationController,
  weeklyMealReminderController,
  sundayMealReminderController,
  monthlyRenewalReminderController,
  subscriptionCancelledController,
  subscriptionPausedController,
  subscriptionAdjustedController
 } = require('./emailController');

// Initialize the email queue
const emailQueue = new Bull('emailQueue', {
  redis: { host: '127.0.0.1', port: 6379 },
});

// Email processing logic
emailQueue.process(10,async (job) => {
  const { orderData, title, description ,emailType,mailOptions,user,password} = job.data;

  try {
    if(emailType=="order"){
      await orderEmailController(orderData,title,description);
    }
    if(emailType=="orderOwner"){
      await orderEmailController2(orderData,title,description);
    }
    if(emailType=="contact"){
      await contactEmailController(mailOptions);
    }
    if(emailType=="reset-password"){
      await requestPasswordResetController(mailOptions);
    }
    if(emailType=="new-account"){
      await newAccountEmailController(user,password);
    }
    //subscription emails
    if(emailType=="sub-welcome"){
      await subscriptionWelcomeController(mailOptions);
    }
    if(emailType=="sub-confirmation"){
      await subscriptionConfirmationController(mailOptions);
      // await weeklyMealReminderController(mailOptions);
      // await sundayMealReminderController(mailOptions);
    }
    if(emailType=="sub-cancel"){

      await subscriptionCancelledController(mailOptions);
    }
    if(emailType=="sub-pause"){

      await subscriptionPausedController(mailOptions);
    }
  
  } catch (error) {
    console.error(`Error sending email for order #${orderData._id}:`, error);
  }
});

// Export the queue
module.exports = emailQueue;
