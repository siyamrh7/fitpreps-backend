require('dotenv').config();
const Bull = require('bull');
const { orderEmailController, contactEmailController, orderEmailController2, requestPasswordResetController, newAccountEmailController,
  subscriptionWelcomeController,
  subscriptionConfirmationController,
  weeklyMealReminderController,
  sundayMealReminderController,
  monthlyRenewalReminderController,
  subscriptionCancelledController,
  subscriptionPausedController,
  subscriptionAdjustedController,
  universalReminderController,
  universalReminderController2,
  weeklySubscriptionStartedController,
  monthlySubscriptionStartedController,
  orderConfirmationEmailControllerWeekly
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
    if (emailType == "order-confirmation-weekly") {
      await orderConfirmationEmailControllerWeekly(mailOptions);
    }
    if (emailType == "order-confirmation-monthly") {
      await orderConfirmationEmailControllerMonthly(mailOptions);
    }
    if (emailType == "sub-confirmation") {
      // await subscriptionWelcomeController(mailOptions);
      // await subscriptionConfirmationController(mailOptions);
      // await universalReminderController(mailOptions);
      // await universalReminderController2(mailOptions);
      // await subscriptionPausedController(mailOptions);
      // await subscriptionCancelledController(mailOptions);

    }
    if (emailType == "sub-cancel") {

      await subscriptionCancelledController(mailOptions);
    }
    if (emailType == "sub-pause") {

      await subscriptionPausedController(mailOptions);
    }
    if (emailType == "sub-reminder") {
      await universalReminderController(mailOptions);
    }
    if (emailType == "sub-reminder-monthly") {
      await universalReminderController2(mailOptions);
    }

  } catch (error) {
    console.error(`Error sending email for order #${orderData._id}:`, error);
  }
});

// Export the queue
module.exports = emailQueue;
