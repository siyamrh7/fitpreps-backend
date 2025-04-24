require('dotenv').config();
const Bull = require('bull');
const { orderEmailController, contactEmailController, orderEmailController2, requestPasswordResetController, newAccountEmailController,

  subscriptionPausedController,
  sundayMealReminderController,
  weeklySubscriptionStartedController,
  monthlySubscriptionStartedController,
  orderConfirmationEmailControllerWeekly,
  orderConfirmationEmailControllerMonthly,
  subscriptionWeeklyCancelledController,
  subscriptionMonthlyCancelledController,
  newSubscriptionNotificationController,
  weeklyRenewalNotificationController,
  monthlyRenewalNotificationController,
  fridayMealReminderController,
  monthlyMealReminderControllerFirst,
  monthlyMealReminderControllerSecond,
  monthlyMealReminderControllerLast,
  dailyEmailSummaryControllerOwner
} = require('./emailController');

// Initialize the email queue
const emailQueue = new Bull('emailQueue', {
  redis: { host: '127.0.0.1', port: 6379 },
});

// Email processing logic
emailQueue.process(10, async (job) => {
  const { orderData, title, description, emailType, mailOptions, user, password } = job.data;

  try {
    if (emailType == "order") {
      await orderEmailController(orderData, title, description);
    }
    if (emailType == "orderOwner") {
      await orderEmailController2(orderData, title, description);
    }
    if (emailType == "contact") {
      await contactEmailController(mailOptions);
    }
    if (emailType == "reset-password") {
      await requestPasswordResetController(mailOptions);
    }
    if (emailType == "new-account") {
      await newAccountEmailController(user, password);
    }
    //subscription emails
    if (emailType == "sub-welcome-weekly") {
      await weeklySubscriptionStartedController(mailOptions);
    }
    if (emailType == "sub-welcome-monthly") {
      await monthlySubscriptionStartedController(mailOptions);
    }
    if (emailType == "sub-welcome-owner") {
      await newSubscriptionNotificationController(mailOptions);
    }
    if (emailType == "sub-confirmation-weekly") {
      await orderConfirmationEmailControllerWeekly(mailOptions);
    }
    if (emailType == "sub-confirmation-monthly") {
      await orderConfirmationEmailControllerMonthly(mailOptions);
    }

    if (emailType == "sub-cancel-weekly") {

      await subscriptionWeeklyCancelledController(mailOptions);
    }
    if (emailType == "sub-cancel-monthly") {
      await subscriptionMonthlyCancelledController(mailOptions);
    }
    if (emailType == "sub-pause") {
      await subscriptionPausedController(mailOptions);
    }
   if(emailType == "sub-renewal-weekly"){
    await weeklyRenewalNotificationController(mailOptions);
   }
   if(emailType == "sub-renewal-monthly"){
    await monthlyRenewalNotificationController(mailOptions);
   }
   if(emailType == "sub-friday-reminder"){
    await fridayMealReminderController(mailOptions);
   }
   if(emailType == "sub-sunday-reminder"){
    await sundayMealReminderController(mailOptions);
   }
  
   if(emailType == "sub-monthly-reminder-first"){
    await monthlyMealReminderControllerFirst(mailOptions);
   }
   if(emailType == "sub-monthly-reminder-second"){
    await monthlyMealReminderControllerSecond(mailOptions);
   }
   if(emailType == "sub-monthly-reminder-last"){
    await monthlyMealReminderControllerLast(mailOptions);
   }
   if(emailType == "sub-daily-summary-owner"){
    await dailyEmailSummaryControllerOwner(mailOptions);
   }


  } catch (error) {
    console.error(`Error sending email for order #${orderData._id}:`, error);
  }
});

// Export the queue
module.exports = emailQueue;
