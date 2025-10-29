// controllers/categoryMetadataController.js
const { getDB } = require('../config/db');

// Get all category metadata
exports.getAllCategoryMetadata = async (req, res) => {
  try {
    const metadataCollection = getDB().collection('category_metadata');
    const metadata = await metadataCollection.find({}).toArray();
    
    // Convert array to object format for easy frontend consumption
    const metadataObject = {};
    metadata.forEach(item => {
      metadataObject[item.category] = {
        title: item.title,
        description: item.description,
        content: item.content || ''
      };
    });
    
    res.status(200).json(metadataObject);
  } catch (error) {
    console.error('Error fetching category metadata:', error);
    res.status(500).json({ message: 'Error fetching category metadata', error: error.message });
  }
};

// Get metadata for a specific category
exports.getCategoryMetadata = async (req, res) => {
  try {
    const { category } = req.params;
    const metadataCollection = getDB().collection('category_metadata');
    
    const metadata = await metadataCollection.findOne({ category });
    
    if (!metadata) {
      return res.status(404).json({ message: 'Metadata not found for this category' });
    }
    
    res.status(200).json({
      category: metadata.category,
      title: metadata.title,
      description: metadata.description,
      content: metadata.content || ''
    });
  } catch (error) {
    console.error('Error fetching category metadata:', error);
    res.status(500).json({ message: 'Error fetching category metadata', error: error.message });
  }
};

// Create or update category metadata
exports.upsertCategoryMetadata = async (req, res) => {
  try {
    const { category, title, description, content } = req.body;
    
    // Validate input
    if (!category || !title || !description) {
      return res.status(400).json({ 
        message: 'Missing required fields', 
        required: ['category', 'title', 'description'] 
      });
    }
    
    const metadataCollection = getDB().collection('category_metadata');
    
    // Use upsert to create or update
    const result = await metadataCollection.updateOne(
      { category },
      { 
        $set: { 
          category,
          title, 
          description,
          content: content || '',
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    
    // Fetch the updated/created document
    const metadata = await metadataCollection.findOne({ category });
    
    res.status(200).json({ 
      message: result.upsertedCount > 0 ? 'Metadata created successfully' : 'Metadata updated successfully',
      metadata: {
        category: metadata.category,
        title: metadata.title,
        description: metadata.description,
        content: metadata.content || ''
      }
    });
  } catch (error) {
    console.error('Error upserting category metadata:', error);
    res.status(500).json({ message: 'Error saving category metadata', error: error.message });
  }
};

// Update category metadata
exports.updateCategoryMetadata = async (req, res) => {
  try {
    const { category } = req.params;
    const { title, description, content } = req.body;
    
    const metadataCollection = getDB().collection('category_metadata');
    
    // Check if metadata exists
    const existingMetadata = await metadataCollection.findOne({ category });
    if (!existingMetadata) {
      return res.status(404).json({ message: 'Metadata not found for this category' });
    }
    
    // Prepare update object
    const updateData = {
      updatedAt: new Date()
    };
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (content !== undefined) updateData.content = content;
    
    // Update the metadata
    const result = await metadataCollection.updateOne(
      { category },
      { $set: updateData }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: 'No changes made to the metadata' });
    }
    
    // Fetch the updated document
    const updatedMetadata = await metadataCollection.findOne({ category });
    
    res.status(200).json({ 
      message: 'Metadata updated successfully',
      metadata: {
        category: updatedMetadata.category,
        title: updatedMetadata.title,
        description: updatedMetadata.description,
        content: updatedMetadata.content || ''
      }
    });
  } catch (error) {
    console.error('Error updating category metadata:', error);
    res.status(500).json({ message: 'Error updating category metadata', error: error.message });
  }
};

// Delete category metadata
exports.deleteCategoryMetadata = async (req, res) => {
  try {
    const { category } = req.params;
    const metadataCollection = getDB().collection('category_metadata');
    
    const result = await metadataCollection.deleteOne({ category });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Metadata not found for this category' });
    }
    
    res.status(200).json({ 
      message: 'Metadata deleted successfully',
      category 
    });
  } catch (error) {
    console.error('Error deleting category metadata:', error);
    res.status(500).json({ message: 'Error deleting category metadata', error: error.message });
  }
};

// Batch update/insert multiple categories
exports.batchUpsertCategoryMetadata = async (req, res) => {
  try {
    const { categories } = req.body;
    
    // Validate input
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ 
        message: 'Invalid input', 
        expected: 'Array of categories with category, title, and description fields' 
      });
    }
    
    const metadataCollection = getDB().collection('category_metadata');
    const operations = [];
    
    // Prepare bulk operations
    categories.forEach(item => {
      if (item.category && item.title && item.description) {
        operations.push({
          updateOne: {
            filter: { category: item.category },
            update: {
              $set: {
                category: item.category,
                title: item.title,
                description: item.description,
                content: item.content || '',
                updatedAt: new Date()
              },
              $setOnInsert: {
                createdAt: new Date()
              }
            },
            upsert: true
          }
        });
      }
    });
    
    if (operations.length === 0) {
      return res.status(400).json({ 
        message: 'No valid categories to process',
        required: 'Each category must have category, title, and description fields'
      });
    }
    
    // Execute bulk write
    const result = await metadataCollection.bulkWrite(operations);
    
    res.status(200).json({ 
      message: 'Batch operation completed successfully',
      inserted: result.upsertedCount,
      modified: result.modifiedCount,
      total: operations.length
    });
  } catch (error) {
    console.error('Error in batch upsert:', error);
    res.status(500).json({ message: 'Error in batch operation', error: error.message });
  }
};

