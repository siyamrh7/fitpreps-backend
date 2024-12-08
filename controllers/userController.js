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
      'metadata.billing_email': billing_email || existingUser.metadata.billing_email,
      'metadata.billing_first_name': billing_first_name || existingUser.metadata.billing_first_name,
      'metadata.billing_last_name': billing_last_name || existingUser.metadata.billing_last_name,
      'metadata.billing_country': billing_country || existingUser.metadata.billing_country,
      'metadata.billing_address_1': billing_address_1 || existingUser.metadata.billing_address_1,
      'metadata.billing_address_2': billing_address_2 || existingUser.metadata.billing_address_2,
      'metadata.billing_city': billing_city || existingUser.metadata.billing_city,
      'metadata.billing_state': billing_state || existingUser.metadata.billing_state,
      'metadata.billing_postcode': billing_postcode || existingUser.metadata.billing_postcode,
      'metadata.billing_phone': billing_phone || existingUser.metadata.billing_phone,
      'metadata.billing_company': billing_company || existingUser.metadata.billing_company,
      'metadata.billing_company_kvk': billing_company_kvk || existingUser.metadata.billing_company_kvk,
      'metadata.billing_company_vat': billing_company_vat || existingUser.metadata.billing_company_vat,
      'metadata.shipping_email': shipping_email || existingUser.metadata.shipping_email,
      'metadata.shipping_first_name': shipping_first_name || existingUser.metadata.shipping_first_name,
      'metadata.shipping_last_name': shipping_last_name || existingUser.metadata.shipping_last_name,
      'metadata.shipping_country': shipping_country || existingUser.metadata.shipping_country,
      'metadata.shipping_address_1': shipping_address_1 || existingUser.metadata.shipping_address_1,
      'metadata.shipping_address_2': shipping_address_2 || existingUser.metadata.shipping_address_2,
      'metadata.shipping_city': shipping_city || existingUser.metadata.shipping_city,
      'metadata.shipping_state': shipping_state || existingUser.metadata.shipping_state,
      'metadata.shipping_postcode': shipping_postcode || existingUser.metadata.shipping_postcode,
      'metadata.shipping_phone': shipping_phone || existingUser.metadata.shipping_phone,
      'metadata.shipping_company': shipping_company || existingUser.metadata.shipping_company,
      'metadata.shipping_company_kvk': shipping_company_kvk || existingUser.metadata.shipping_company_kvk,
      'metadata.shipping_company_vat': shipping_company_vat || existingUser.metadata.shipping_company_vat,

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
