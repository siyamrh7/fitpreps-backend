const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/db');
var hasher = require('wordpress-hash-node');
const { unserialize } = require('php-serialize');
const crypto = require('crypto');
const emailQueue = require('./emailQueue');
const addUserToKlaviyo = require('./klaviyoController');
const { ObjectId } = require('mongodb');
// Controller to handle user registration
exports.register = async (req, res) => {
  try {
    const { metadata, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Get the MongoDB collection
    const usersCollection = getDB().collection('users');

    // Check if the user already exists
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the password
    var hashedPassword = hasher.HashPassword(password);
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const user = { email, registeredAt: new Date().toISOString(), password: hashedPassword, metadata: { first_name: metadata.first_name, last_name: metadata.last_name, woocommerce_reward_points: "50" } };
    if (user) {
      setImmediate(async () =>
        await emailQueue.add(
          { emailType: "new-account", user: user, password: password },
          {
            attempts: 3, // Retry up to 3 times in case of failure
            backoff: 5000, // Retry with a delay of 5 seconds
          }
        )
      );
      await addUserToKlaviyo(email, metadata.first_name, metadata.last_name);

    }
    // Insert the user into the database
    await usersCollection.insertOne(user);

    res.status(201).json({ message: 'User registered successfully, Login Now' });
  } catch (error) {
    res.status(400).json({ message: 'Error registering user', error });
  }
};

// Controller to handle user login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get the MongoDB collection
    const usersCollection = getDB().collection('users');

    // Check if the user exists
    const user = await usersCollection.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Compare the provided password with the hashed password
    var isMatch = hasher.CheckPassword(password, user.password); //This will return true;

    // const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Password is incorrect' });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ message: 'Login successful', token, user });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error });
  }
};
exports.adminlogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get the MongoDB collection
    const usersCollection = getDB().collection('users');

    // Check if the user exists
    const user = await usersCollection.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (!user) {
      return res.status(404).json({
        "error": {
          "code": 400,
          "message": "EMAIL_NOT_FOUND",
          "errors": [
            {
              "message": "EMAIL_NOT_FOUND",
              "domain": "global",
              "reason": "invalid"
            }
          ]
        }
      });
    }

    // Compare the provided password with the hashed password
    var isMatch = hasher.CheckPassword(password, user.password); //This will return true;

    // const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        "error": {
          "code": 400,
          "message": "INVALID_PASSWORD",
          "errors": [
            {
              "message": "INVALID_PASSWORD",
              "domain": "global",
              "reason": "invalid"
            }
          ]
        }
      });
    }

    const capabilities = unserialize(user.metadata.wp_capabilities);

    // Check if the user has the 'administrator' role in wp_capabilities
    if (capabilities && capabilities.administrator) {
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

      res.status(200).json({
        "kind": "identitytoolkit#VerifyPasswordResponse",
        "localId": "qmt6dRyipIad8UCc0QpMV2MENSy1",
        "email": user.email,
        "displayName": user.metadata.first_name,
        "idToken": token,
        "registered": true,
        "refreshToken": "AMf-vBxg9g79mKx6dQ-Y79lKuEbE4F5DwJ0y3w7Cs9Cjbm6B3WuNXQoDFVSpaq-yfWOAPJTEx5ijr2nCUgTDtxuCtU5BZJzfOoza-B8OREwGLnfiS-wFSUUUWkSpNO4NmkaI_6BbAynfc-pBqhL1UQNA8fdZJAmFhCRjzks7hks_t40NVdPc7vG1bZjG2NPLDjyn0bOm4y8qebTqJTBM3CpFZA7tTxK4Gw",
        "expiresIn": "86400"
      });
    } else {
      return res.status(400).json({
        "error": {
          "code": 400,
          "message": "You dont have admin access!",
          "errors": [
            {
              "message": "You dont have admin access!",
              "domain": "global",
              "reason": "invalid"
            }
          ]
        }
      });
    }
    // Generate a JWT token

  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error });
  }
};


exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const usersCollection = getDB().collection('users');
    const user = await usersCollection.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store token hash and expiration in the database
    const resetExpires = Date.now() + 3600000; // 1 hour
    await usersCollection.updateOne({ _id: user._id }, { $set: { resetToken: resetTokenHash, resetExpires } });



    const resetLink = `${process.env.FRONTEND_URI}/mijn-account/lost-password?token=${resetToken}`;
    var html = `<div style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; padding: 0; margin: 0;">
        <tr>
            <td align="center" style="background-color: #ffffff; padding: 40px;">
                <table width="600px" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    <!-- Header Section -->
                    <tr>
                        <td style="background-color: #ff6600; padding: 20px; text-align: center;">
                            <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Je wachtwoord resetten</h1>
                        </td>
                    </tr>
                    
                    <!-- Content Section -->
                    <tr>
                        <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                            <p style="margin: 0 0 15px 0;">Hey <strong>${user.metadata.first_name}</strong>, iemand heeft een nieuw wachtwoord aangevraagd voor het volgende account op Fitpreps:</p>
                            <p style="margin: 0 0 15px 0;"><strong>Gebruikersnaam:</strong> ${user.metadata.first_name}</p>
                            <p style="margin: 0;">Als je deze wachtwoord reset niet aangevraagd hebt, kan je deze mail negeren en verwijderen.</p>
                        </td>
                    </tr>
                    
                    <!-- Button Section -->
                    <tr>
                        <td align="center" style="padding: 20px;">
                            <a href="${resetLink}" style="display: inline-block; background-color: #ff9900; color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 16px; font-weight: bold; border-radius: 5px;">Wachtwoord resetten</a>
                        </td>
                    </tr>
                    
                    <!-- Footer Section -->
                    <tr>
                        <td align="center" style="background-color: #ff6600; padding: 20px; color: #ffffff; font-size: 14px; line-height: 1.6;">
                            <p style="margin: 0;">Volg ons op</p>
                            <p style="margin: 10px 0;">
                                <a href="https://www.facebook.com/FitPrepsOfficial" style="text-decoration: none; color: #ffffff; margin-right: 10px;">
                                    <img src="https://cdn-icons-png.flaticon.com/512/1384/1384005.png" alt="Facebook" style="width: 24px; height: 24px; vertical-align: middle;">
                                </a>
                                <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="text-decoration: none; color: #ffffff;">
                                    <img src="https://cdn-icons-png.flaticon.com/512/1384/1384015.png" alt="Instagram" style="width: 24px; height: 24px; vertical-align: middle;">
                                </a>
                            </p>
                            <p style="margin: 10px 0;">Deze email is verzonden door: <a href="mailto:info@fitpreps.nl" style="text-decoration: underline; color: #ffffff;">info@fitpreps.nl</a></p>
                            <p style="margin: 10px 0;">Stuur voor vragen een e-mail naar: <a href="mailto:info@fitpreps.nl" style="text-decoration: underline; color: #ffffff;">info@fitpreps.nl</a></p>
                            <p style="margin: 0;">
                                <a href="https://fitpreps.nl/privacy-policy" style="text-decoration: underline; color: #ffffff; margin-right: 10px;">Privacy policy</a> 
                                <a href="https://fitpreps.nl/klantenservice" style="text-decoration: underline; color: #ffffff;">Klantenservice</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</div>`


    const mailOptions = {
      subject: 'Aanvraag wachtwoord reset Fit Preps',
      //This "from" is optional if you want to send from group email. For this you need to give permissions in that group to send emails from it.
      from: {
        emailAddress: {
          address: 'bestellingen@fitpreps.nl',
        },
      },
      toRecipients: [
        {
          emailAddress: {
            address: email,
          },
        },
      ],
      body: {
        content: html,
        contentType: 'html',
      },
      replyTo: [{
        emailAddress: {
          address: 'info@fitpreps.nl',
        }
      }],

    };
    setImmediate(async () =>
      await emailQueue.add(
        { emailType: "reset-password", mailOptions },
        {
          attempts: 3, // Retry up to 3 times in case of failure
          backoff: 5000, // Retry with a delay of 5 seconds
        }
      )
    );
    res.status(200).json({ message: 'Password reset link sent to your email' });
  } catch (error) {
    res.status(500).json({ message: 'Error processing request', error });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const usersCollection = getDB().collection('users');

    const user = await usersCollection.findOne({
      resetToken: resetTokenHash,
      resetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Hash the new password
    const hashedPassword = hasher.HashPassword(password);

    // Update the user's password and clear the reset fields
    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword }, $unset: { resetToken: '', resetExpires: '' } }
    );

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password', error });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId; // This comes from the auth middleware
   
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const usersCollection = getDB().collection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = hasher.CheckPassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash the new password
    const hashedPassword = hasher.HashPassword(newPassword);

    // Update the password
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: hashedPassword } }
    );

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password', error });
  }
};
