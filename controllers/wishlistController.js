const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');

// Create or add an item to the wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const usersCollection = getDB().collection('users');
    const { userId, item } = req.body;

    if (!userId || !item) {
      return res.status(400).json({ message: 'User ID and item are required' });
    }

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid User ID format' });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add item to the wishlist
    if (user.wishlist) {
      // Check if the item already exists in the wishlist
      const itemExists = user.wishlist.items.some(existingItem => existingItem._id === item._id);
      if (!itemExists) {
        await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $addToSet: { 'wishlist.items': item } }
        );
        res.status(201).json({ message: 'Item added to wishlist successfully' });
      } else {
        res.status(400).json({ message: 'Item already exists in wishlist' });
      }
    } else {
      // If no wishlist exists, create one
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { wishlist: { items: [item] } } }
      );
      res.status(201).json({ message: 'Wishlist created and item added successfully' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Error adding item to wishlist', error });
  }
};

// Retrieve wishlist for a specific user
exports.getWishlist = async (req, res) => {
  try {
    const usersCollection = getDB().collection('users');
    const { userId } = req.params;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid User ID format' });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user || !user.wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    res.status(200).json({ wishlist: user.wishlist });
  } catch (error) {
    res.status(400).json({ message: 'Error retrieving wishlist', error });
  }
};

// Update an item in the wishlist
exports.updateWishlistItem = async (req, res) => {
  try {
    const usersCollection = getDB().collection('users');
    const { userId, oldItem, newItem } = req.body;

    if (!userId || !oldItem || !newItem) {
      return res.status(400).json({ message: 'User ID, old item, and new item are required' });
    }

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid User ID format' });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user || !user.wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    // Find the index of the old item
    const itemIndex = user.wishlist.items.findIndex(item => item._id === oldItem._id);
    if (itemIndex !== -1) {
      // Update the item
      user.wishlist.items[itemIndex] = newItem;

      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { 'wishlist.items': user.wishlist.items } }
      );

      res.status(200).json({ message: 'Wishlist item updated successfully' });
    } else {
      res.status(404).json({ message: 'Item not found in wishlist' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Error updating wishlist item', error });
  }
};

// Delete an item from the wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const usersCollection = getDB().collection('users');
    const { userId, item } = req.body;

    if (!userId || !item) {
      return res.status(400).json({ message: 'User ID and item are required' });
    }

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid User ID format' });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user || !user.wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    // Remove item from the wishlist
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { 'wishlist.items': item } }
    );

    res.status(200).json({ message: 'Item removed from wishlist successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error removing item from wishlist', error });
  }
};

// Clear the entire wishlist
exports.clearWishlist = async (req, res) => {
  try {
    const usersCollection = getDB().collection('users');
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid User ID format' });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user || !user.wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    // Clear the wishlist
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { 'wishlist.items': [] } }
    );

    res.status(200).json({ message: 'Wishlist cleared successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error clearing wishlist', error });
  }
};
