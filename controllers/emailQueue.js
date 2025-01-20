require('dotenv').config();
const Bull = require('bull');
const nodemailer = require('nodemailer');
const { orderEmailController, contactEmailController, orderEmailController2,requestPasswordResetController, newAccountEmailController } = require('./emailController');

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
  
  } catch (error) {
    console.error(`Error sending email for order #${orderData._id}:`, error);
  }
});

// Export the queue
module.exports = emailQueue;
