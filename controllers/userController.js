// controllers/userController.js
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb'); // Import ObjectId to handle MongoDB IDs


exports.createUser = async (req, res) => {
  try {
    const usersCollection = getDB().collection('users');
    await usersCollection.insertOne(req.body);  // Save the full body as-is
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error creating user', error });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const usersCollection = getDB().collection('users');
    const users = await usersCollection.find().limit(20).toArray();
    res.status(200).json(users);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching users', error });
  }
};

exports.getUser = async (req, res) => {
  try {
    const { userId } = req.user
    const usersCollection = getDB().collection('users');

    // Find a user by ID
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching user by ID', error });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const {
      billing_email,
      billing_first_name,
      billing_last_name,
      billing_country,
      billing_address_1,
      billing_address_2,
      billing_city,
      billing_state,
      billing_postcode,
      billing_phone,
      billing_company,
      billing_company_kvk,
      billing_company_vat,
      shipping_email,
      shipping_first_name,
      shipping_last_name,
      shipping_country,
      shipping_address_1,
      shipping_address_2,
      shipping_city,
      shipping_state,
      shipping_postcode,
      shipping_phone,
      shipping_company,
      shipping_company_kvk,
      shipping_company_vat,
    } = req.body;



    const { userId } = req.user
    // Get the MongoDB collection
    const usersCollection = getDB().collection('users');

    // Check if the user exists
    const existingUser = await usersCollection.findOne({ _id: new ObjectId(userId) });
  

    // Update the user's billing address
    const updateData = {
      'metadata._billing_email': billing_email || existingUser.metadata._billing_email,
      'metadata._billing_first_name': billing_first_name || existingUser.metadata._billing_first_name,
      'metadata._billing_last_name': billing_last_name || existingUser.metadata._billing_last_name,
      'metadata._billing_country': billing_country || existingUser.metadata._billing_country,
      'metadata._billing_address_1': billing_address_1 || existingUser.metadata._billing_address_1,
      'metadata._billing_address_2': billing_address_2 || existingUser.metadata._billing_address_2,
      'metadata._billing_city': billing_city || existingUser.metadata._billing_city,
      'metadata._billing_state': billing_state || existingUser.metadata._billing_state,
      'metadata._billing_postcode': billing_postcode || existingUser.metadata._billing_postcode,
      'metadata._billing_phone': billing_phone || existingUser.metadata._billing_phone,
      'metadata._billing_company': billing_company || existingUser.metadata._billing_company,
      'metadata._billing_company_kvk': billing_company_kvk || existingUser.metadata._billing_company_kvk,
      'metadata._billing_company_vat': billing_company_vat || existingUser.metadata._billing_company_vat,
      'metadata._shipping_email': shipping_email || existingUser.metadata._shipping_email,
      'metadata._shipping_first_name': shipping_first_name || existingUser.metadata._shipping_first_name,
      'metadata._shipping_last_name': shipping_last_name || existingUser.metadata._shipping_last_name,
      'metadata._shipping_country': shipping_country || existingUser.metadata._shipping_country,
      'metadata._shipping_address_1': shipping_address_1 || existingUser.metadata._shipping_address_1,
      'metadata._shipping_address_2': shipping_address_2 || existingUser.metadata._shipping_address_2,
      'metadata._shipping_city': shipping_city || existingUser.metadata._shipping_city,
      'metadata._shipping_state': shipping_state || existingUser.metadata._shipping_state,
      'metadata._shipping_postcode': shipping_postcode || existingUser.metadata._shipping_postcode,
      'metadata._shipping_phone': shipping_phone || existingUser.metadata._shipping_phone,
      'metadata._shipping_company': shipping_company || existingUser.metadata._shipping_company,
      'metadata._shipping_company_kvk': shipping_company_kvk || existingUser.metadata._shipping_company_kvk,
      'metadata._shipping_company_vat': shipping_company_vat || existingUser.metadata._shipping_company_vat,

    };

    const updateResult = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({ message: 'No changes were made' });
    }
    const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) });

    res.status(200).json({ message: 'Address updated successfully',user:updatedUser });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Error updating address', error });
  }
};

exports.updatePoint = async (req, res) => {
  try {
    const { point } = req.body; // Extract 'point' from the request body
    const { userId } = req.user; // Extract 'userId' from authenticated user context

    if (typeof point !== 'number') {
      return res.status(400).json({ message: 'Invalid point value. It must be a number.' });
    }

    // Get the MongoDB collection
    const usersCollection = getDB().collection('users');

    // Check if the user exists
    const existingUser = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Increment or decrement the 'point' field
    const updateResult = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { point: point } } // Add the point value (can be positive or negative)
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({ message: 'No changes were made' });
    }

    // Fetch the updated user
    const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) });

    res.status(200).json({ message: 'Point updated successfully', user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating point', error });
  }
};
