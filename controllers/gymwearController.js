// controllers/gymwearController.js
const { getDB } = require('../config/db');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require("mongodb");

// Create a new gymwear product
exports.createGymwear = async (req, res) => {
  try {
    const gymwearCollection = getDB().collection('gymwear');
    const data = JSON.parse(req.body.data);

    // Get the highest gymwearId in the collection
    const highestGymwear = await gymwearCollection.find().sort({ gymwearId: -1 }).limit(1).toArray();
    const newGymwearId = highestGymwear.length > 0 ? highestGymwear[0].gymwearId + 1 : 1;

    // Insert the gymwear with the new unique gymwearId
    const result = await gymwearCollection.insertOne({ 
      ...data, 
      files: req.files ? req.files.map(file => ({ url: file.filename })) : [],
      thumbnail: { url: "" },
      gymwearId: newGymwearId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Retrieve the created gymwear by its ID
    const createdGymwear = await gymwearCollection.findOne({ _id: result.insertedId });

    res.status(200).json({ message: 'Gymwear created successfully', gymwear: createdGymwear });
  } catch (error) {
    console.error('Error creating gymwear:', error);
    res.status(400).json({ message: 'Error creating gymwear', error });
  }
};

// Update an existing gymwear product
exports.updateGymwear = async (req, res) => {
  try {
    const gymwearCollection = getDB().collection('gymwear');
    const gymwearId = req.params.id;
    const data = JSON.parse(req.body.data);

    // Get the list of deleted files from the frontend
    const deletedFiles = req.body.deletedFiles ? JSON.parse(req.body.deletedFiles) : [];
    
    // Check if the gymwear exists
    const existingGymwear = await gymwearCollection.findOne({ _id: new ObjectId(gymwearId) });
    if (!existingGymwear) {
      return res.status(404).json({ message: 'Gymwear not found' });
    }

    let filesToUpdate = existingGymwear.files || [];

    if (deletedFiles.length > 0) {
      // Delete files from filesystem
      const deletedFileNames = existingGymwear.files.filter(file =>
        deletedFiles.some(deletedFile => deletedFile.includes(file.url))
      );
      deletedFileNames.forEach(file => {
        const filePath = path.join(__dirname, '../uploads', file.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
   
      // Remove deleted files from the array
      filesToUpdate = filesToUpdate.filter(file => {
        const fileName = file.url;
        return !deletedFiles.some(deletedFile => deletedFile.includes(fileName));
      });
    }

    // Prepare new files (if any)
    let fileUrls = [];
    if (req.files && req.files.length > 0) {
      fileUrls = req.files.map(file => ({
        url: file.filename,
      }));
    }

    // Merge new files with existing ones
    filesToUpdate = [...filesToUpdate, ...fileUrls];

    // Prepare update object
    const updatedGymwear = {
      ...existingGymwear,
      ...data,
      files: filesToUpdate,
      updatedAt: new Date()
    };

    // Merge metadata fields
    if (data.metadata) {
      updatedGymwear.metadata = {
        ...existingGymwear.metadata,
        ...data.metadata,
      };
    }

    // Perform the update operation
    const result = await gymwearCollection.updateOne(
      { _id: new ObjectId(gymwearId) },
      { $set: updatedGymwear }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: 'No changes made to the gymwear' });
    }

    // Retrieve the updated gymwear
    const updatedGymwearData = await gymwearCollection.findOne({ _id: new ObjectId(gymwearId) });

    res.status(200).json({ message: 'Gymwear updated successfully', gymwear: updatedGymwearData });
  } catch (error) {
    console.error('Error updating gymwear:', error);
    res.status(400).json({ message: 'Error updating gymwear', error });
  }
};

// Get all gymwear products
exports.getAllGymwear = async (req, res) => {
  try {
    const gymwearCollection = getDB().collection('gymwear');

    // Retrieve the category filter from the request query
    const category = req.query.category;
    const status = req.query.status || 'publish';

    // Define the filter
    let filter;
    if (status === 'admin') {
      // Admin case: Return all gymwear items regardless of status
      filter = {};
    } else {
      // Public case: Only return published items
      filter = { status: status };
    }
    
    if (category && category !== 'all') {
      filter.category = category;
    }

    // Define the projection to return only the required fields
    const projection = {
      name: 1,
      description: 1,
      gymwearId: 1,
      status: 1,
      category: 1,
      color: 1,
      sizes: 1,
      thumbnail: 1,
      files: 1,
      createdAt: 1,
      updatedAt: 1,
      metadata: {
        price: 1,
        stock: 1,
        total_sales: 1,
        cost_price: 1,
        meta_title: 1,
        meta_description: 1,
        image_alt_tag: 1,
        material: 1,
        care_instructions: 1,
        fit_type: 1,
        length: 1
      },
    };

    // Fetch gymwear with filter and projection
    const gymwear = await gymwearCollection.find(filter, { projection }).toArray();

    res.status(200).json(gymwear);
  } catch (error) {
    console.error('Error fetching gymwear:', error);
    res.status(400).json({ message: 'Error fetching gymwear', error });
  }
};

// Get a single gymwear product by name/slug
exports.getSingleGymwear = async (req, res) => {
  try {
    const { productName } = req.params;
    const gymwearCollection = getDB().collection('gymwear');

    // First try to find by product_slug directly
    let gymwear = await gymwearCollection.findOne({
      "product_slug": productName,
      "status": "publish"
    });

    // If no gymwear found by slug, try name matching
    if (!gymwear) {
      // Create regexPattern to handle hyphens, spaces, and en-dashes
      const regexPattern1 = new RegExp(
        "^" + productName
          .replace(/-/g, "[-\\s–]*") + "$", // Match hyphens, spaces, or en-dashes
        "i" // Case-insensitive
      );
      
      // Create more flexible regex pattern
      const regexPattern2 = new RegExp(productName.replace(/-/g, '.*'), 'i');
      
      // Try searching using regexPattern1
      gymwear = await gymwearCollection.findOne({
        "name": regexPattern1,
        "status": "publish"
      });
      
      if (!gymwear) {
        // If no gymwear found, try searching using regexPattern2
        gymwear = await gymwearCollection.findOne({
          "name": regexPattern2,
          "status": "publish"
        });
      }
    }
    
    if (!gymwear) {
      return res.status(404).json({ message: 'Gymwear not found' });
    }
    
    res.status(200).json(gymwear);
    
  } catch (error) {
    console.error('Error fetching gymwear:', error);
    res.status(500).json({ message: 'Error fetching gymwear', error });
  }
};

// Get a single gymwear product by ID
exports.getSingleGymwearById = async (req, res) => {
  try {
    const { id } = req.params;
    const gymwearCollection = getDB().collection('gymwear');

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid gymwear ID' });
    }

    // Fetch gymwear by ObjectId
    const gymwear = await gymwearCollection.findOne({ _id: new ObjectId(id) });

    if (!gymwear) {
      return res.status(404).json({ message: 'Gymwear not found' });
    }

    res.status(200).json(gymwear);

  } catch (error) {
    console.error('Error fetching gymwear:', error);
    res.status(500).json({ message: 'Error fetching gymwear', error });
  }
};

// Delete a gymwear product by ID
exports.deleteGymwearById = async (req, res) => {
  try {
    const gymwearCollection = getDB().collection('gymwear');
    const gymwearId = req.params.id;

    // Convert the ID string to ObjectId for MongoDB query
    const gymwear = await gymwearCollection.findOne({ _id: new ObjectId(gymwearId) });

    if (!gymwear) {
      return res.status(404).json({ message: 'Gymwear not found' });
    }

    // Delete the gymwear document from the database
    const result = await gymwearCollection.deleteOne({ _id: new ObjectId(gymwearId) });

    if (result.deletedCount === 1) {
      // Delete associated files
      if (gymwear.files && gymwear.files.length > 0) {
        gymwear.files.forEach(file => {
          const filePath = path.join(__dirname, '../uploads', file.url);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      }
      
      if (gymwear.thumbnail && gymwear.thumbnail.url) {
        const imagePath = path.join(__dirname, '../uploads', gymwear.thumbnail.url);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      res.status(200).json({ message: 'Gymwear deleted successfully', gymwear: gymwear });
    } else {
      res.status(404).json({ message: 'Gymwear not found' });
    }
  } catch (error) {
    console.error('Error deleting gymwear:', error);
    res.status(400).json({ message: 'Error deleting gymwear', error });
  }
};
