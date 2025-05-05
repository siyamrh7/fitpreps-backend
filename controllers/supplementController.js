const { getDB } = require('../config/db');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require("mongodb")

exports.createSupplement = async (req, res) => {
  try {
    const supplementsCollection = getDB().collection('supplements');
    const data = JSON.parse(req.body.data);

    // Get the highest supplementId in the collection
    const highestSupplement = await supplementsCollection.find().sort({ supplementId: -1 }).limit(1).toArray();
    const newSupplementId = highestSupplement.length > 0 ? highestSupplement[0].supplementId + 1 : 1; // Default to 1 if no supplements exist

    // Insert the supplement with the new unique supplementId
    const result = await supplementsCollection.insertOne({ 
      ...data, 
      files: req.files.map(file => ({ url: file.filename })), // Store multiple file URLs
      thumbnail: { url: "" },
      supplementId: newSupplementId 
    });
    
    // Retrieve the created supplement by its ID
    const createdSupplement = await supplementsCollection.findOne({ _id: result.insertedId });

    res.status(200).json({ message: 'Supplement created successfully', supplement: createdSupplement });
  } catch (error) {
    res.status(400).json({ message: 'Error creating supplement', error });
  }
}

exports.updateSupplement = async (req, res) => {
  try {
    const supplementsCollection = getDB().collection('supplements');
    const supplementId = req.params.id; // Get the supplement ID from the request parameters
    const data = JSON.parse(req.body.data); // Parse the incoming data

    // Get the list of deleted files from the frontend
    const deletedFiles = req.body.deletedFiles ? JSON.parse(req.body.deletedFiles) : [];
    
    // Check if the supplement exists
    const existingSupplement = await supplementsCollection.findOne({ _id: new ObjectId(supplementId) });
    if (!existingSupplement) {
      return res.status(404).json({ message: 'Supplement not found' });
    }

    let filesToUpdate = existingSupplement.files || [];

    if (deletedFiles.length > 0) {
      // Log the structure of existing files and deleted files to check if they match
      const deletedFileNames = existingSupplement.files.filter(file =>
      {
        return deletedFiles.some(deletedFile => deletedFile.includes(file.url));
      }
      );
      deletedFileNames.forEach(file => {
        const filePath = path.join(__dirname, '../uploads', file.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
   
    
      // If filesToUpdate contains objects with a 'url' field, which is just a filename
      filesToUpdate = filesToUpdate.filter(file => {
        // Extract filename from the full URL in deletedFiles
        const fileName = file.url; // This is just '1742873832508.png' in filesToUpdate
        return !deletedFiles.some(deletedFile => deletedFile.includes(fileName)); // Check if filename exists in deletedFiles
      });
    
    }
    

    // Prepare new files (if any)
    let fileUrls = [];
    if (req.files && req.files.length > 0) {
      fileUrls = req.files.map(file => ({
        url: file.filename, // Save the filename for each new file
      }));
    }

    // Merge new files with existing ones
    filesToUpdate = [...filesToUpdate, ...fileUrls];

    // Prepare update object, preserving existing fields (including metadata)
    const updatedSupplement = {
      ...existingSupplement, // Start by copying all existing fields
      ...data, // Override with the new fields from data (only provided fields will be replaced)
      files: filesToUpdate, // Updated list of files (with deleted files removed)
    };

    // Merge metadata fields to ensure they remain intact if not updated
    if (data.metadata) {
      updatedSupplement.metadata = {
        ...existingSupplement.metadata, // Preserve existing metadata fields
        ...data.metadata, // Only update the metadata fields passed in the request
      };
    }

    // Perform the update operation
    const result = await supplementsCollection.updateOne(
      { _id: new ObjectId(supplementId) },
      { $set: updatedSupplement }
    );

    // Check if the update was successful
    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: 'No changes made to the supplement' });
    }

    // Retrieve the updated supplement
    const updatedSupplementData = await supplementsCollection.findOne({ _id: new ObjectId(supplementId) });

    res.status(200).json({ message: 'Supplement updated successfully', supplement: updatedSupplementData });
  } catch (error) {
    console.error('Error updating supplement:', error);
    res.status(400).json({ message: 'Error updating supplement', error });
  }
};


exports.getAllSupplements = async (req, res) => {
  try {
    const supplementsCollection = getDB().collection('supplements');

    // Retrieve the category filter from the request query
    const category = req.query.category;

    // Define the filter
    const filter = category && category !== 'Alle' 
      ? { status: "publish", categories: category } 
      : { status: "publish" };

    // Define the projection to return only the required fields
    const projection = {
      name: 1,
      description: 1,
      supplementId: 1,
      status: 1,
      categories: 1,
      thumbnail: 1,
      files: 1,
      eiwitten: 1,
      createdAt: 1,
      
      metadata: {
        _price: 1,
        _stock: 1,
        total_sales: 1,
        nutretions_data: 1,
        _product_background_color:1,
        producten_specificaties_data: 1,
        voedingswaarde_data: 1,
        _yith_wcpb_bundle_data: 1,
        _freezer: 1,
        allergenen: 1,
        badges: 1
      },
    };

    // Fetch supplements with filter and projection
    const supplements = await supplementsCollection.find(filter, { projection }).toArray();

    res.status(200).json(supplements);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching supplements', error });
  }
};

exports.getSingleSupplement = async (req, res) => {
  try {
    const { supplementName } = req.params; // Assuming you pass the ID as a parameter in the URL
    const supplementsCollection = getDB().collection('supplements');

    // Input from the URL
    // Normalize the input by replacing spaces/hyphens and trimming
    
    // Create regexPattern1 to handle hyphens, spaces, and en-dashes
    const regexPattern1 = new RegExp(
      "^" + supplementName
        .replace(/-/g, "[-\\s–]*") + "$", // Match hyphens, spaces, or en-dashes
      "i" // Case-insensitive
    );
    
    // Create regexPattern2 to allow hyphens to match any character in between words (more flexible)
    const regexPattern2 = new RegExp(supplementName.replace(/-/g, '.*'), 'i'); // Replace hyphens with '.*' and make case-insensitive
    
    // First, try searching using regexPattern1
    let supplement = await supplementsCollection.findOne({
      "name": regexPattern1,
      "status": "publish"
    });
    
    if (!supplement) {
      // If no supplement found, try searching using regexPattern2
      supplement = await supplementsCollection.findOne({
        "name": regexPattern2,
        "status": "publish"
      });
    }
    
    if (!supplement) {
      return res.status(404).json({ message: 'Supplement not found' });
    }
    
    res.status(200).json(supplement); // Send the found supplement as a response
    
  } catch (error) {
    console.error('Error fetching supplement:', error);
    res.status(500).json({ message: 'Error fetching supplement', error });
  }
};

exports.getSingleSupplementById = async (req, res) => {
  try {
    const { id } = req.params; // Assuming the ObjectId is passed as a parameter in the URL
    const supplementsCollection = getDB().collection('supplements');

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid supplement ID' });
    }

    // Fetch supplement by ObjectId
    const supplement = await supplementsCollection.findOne({ _id: new ObjectId(id)});

    if (!supplement) {
      return res.status(404).json({ message: 'Supplement not found' });
    }

    res.status(200).json(supplement); // Send the found supplement as a response

  } catch (error) {
    console.error('Error fetching supplement:', error);
    res.status(500).json({ message: 'Error fetching supplement', error });
  }
};

exports.deleteSupplementById = async (req, res) => {
  try {
    const supplementsCollection = getDB().collection('supplements');
    const supplementId = req.params.id;

    // Convert the ID string to ObjectId for MongoDB query
    const supplement = await supplementsCollection.findOne({ _id: new ObjectId(supplementId) });

    if (!supplement) {
      return res.status(404).json({ message: 'Supplement not found' });
    }

    // Delete the supplement document from the database
    const result = await supplementsCollection.deleteOne({ _id: new ObjectId(supplementId) });

    if (result.deletedCount === 1) {
      if(supplement.files && supplement.files.length > 0){

      supplement.files.forEach(file => {
        const filePath = path.join(__dirname, '../uploads', file.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });}
      if(supplement.thumbnail && supplement.thumbnail.url){
        
        // Path to the image file
        const imagePath = path.join(__dirname, '../uploads', supplement.thumbnail.url );
  
        // Delete the image file from the uploads folder
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

        res.status(200).json({ message: 'Supplement deleted successfully', supplement: supplement });
      
    } else {
      res.status(404).json({ message: 'Supplement not found' });
    }
  } catch (error) {
    console.log(error)
    res.status(400).json({ message: 'Error deleting supplement', error });
  }
}; 