// controllers/productController.js
const { getDB } = require('../config/db');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require("mongodb")
// exports.createProduct = async (req, res) => {
//   try {
//     const productsCollection = getDB().collection('products');
//     const data = JSON.parse(req.body.data);

//     // Insert the product into the database
//     const result = await productsCollection.insertOne({ ...data, thumbnail: { url: req.file.filename } });

//     // Retrieve the created product by its ID
//     const createdProduct = await productsCollection.findOne({ _id: result.insertedId });

//     res.status(200).json({ message: 'Product created successfully', product: createdProduct });
//   } catch (error) {
//     res.status(400).json({ message: 'Error creating product', error });
//   }
// };
exports.createProduct = async (req, res) => {
  try {
    const productsCollection = getDB().collection('products');
    const data = JSON.parse(req.body.data);

    // Get the highest productId in the collection
    const highestProduct = await productsCollection.find().sort({ productId: -1 }).limit(1).toArray();
    const newProductId = highestProduct.length > 0 ? highestProduct[0].productId + 1 : 1; // Default to 1 if no products exist

    // Insert the product with the new unique productId
    // const result = await productsCollection.insertOne({ ...data, thumbnail: { url: req.file.filename }, productId: newProductId });
    const result = await productsCollection.insertOne({ 
      ...data, 
      files: req.files.map(file => ({ url: file.filename })), // Store multiple file URLs
      thumbnail: { url: "" },
      productId: newProductId 
    });
    
    // Retrieve the created product by its ID
    const createdProduct = await productsCollection.findOne({ _id: result.insertedId });

    res.status(200).json({ message: 'Product created successfully', product: createdProduct });
  } catch (error) {
    res.status(400).json({ message: 'Error creating product', error });
  }
}
// exports.updateProduct = async (req, res) => {
//   try {
//     const productsCollection = getDB().collection('products');
//     const productId = req.params.id; // Get the product ID from the request parameters
//     const data = JSON.parse(req.body.data); // Parse the incoming data

//     // Check if the product exists
//     const existingProduct = await productsCollection.findOne({ _id: new ObjectId(productId) });
//     if (!existingProduct) {
//       return res.status(404).json({ message: 'Product not found' });
//     }

//     // Prepare update object, preserving existing fields (including metadata)
//     // const updatedProduct = {
//     //   ...existingProduct, // Start by copying all existing fields
//     //   ...data, // Override with the new fields from data (only provided fields will be replaced)
//     //   ...(req.file && { thumbnail: { url: req.file.filename } }), // Update thumbnail if a new file is provided
//     // };
//     let fileUrls = [];
//     if (req.files && req.files.length > 0) {
//       fileUrls = req.files.map(file => ({
//         url: file.filename, // Save the filename for each file
//       }));
//     }

//     // Prepare update object, preserving existing fields (including metadata)
//     const updatedProduct = {
//       ...existingProduct, // Start by copying all existing fields
//       ...data, // Override with the new fields from data (only provided fields will be replaced)
//       ...(fileUrls.length > 0 && { files: fileUrls }), // Update 'files' with new file URLs if available
//     };

//     // Merge metadata fields to ensure they remain intact if not updated
//     if (data.metadata) {
//       updatedProduct.metadata = {
//         ...existingProduct.metadata, // Preserve existing metadata fields
//         ...data.metadata, // Only update the metadata fields passed in the request
//       };
//     }

//     // Perform the update operation
//     const result = await productsCollection.updateOne(
//       { _id: new ObjectId(productId) },
//       { $set: updatedProduct }
//     );

//     // Check if the update was successful
//     if (result.modifiedCount === 0) {
//       return res.status(400).json({ message: 'No changes made to the product' });
//     }

//     // Retrieve the updated product
//     const updatedProductData = await productsCollection.findOne({ _id: new ObjectId(productId) });

//     res.status(200).json({ message: 'Product updated successfully', product: updatedProductData });
//   } catch (error) {
//     console.error('Error updating product:', error);
//     res.status(400).json({ message: 'Error updating product', error });
//   }
// };


// exports.getAllProducts = async (req, res) => {
//   try {
//     const productsCollection = getDB().collection('products');

//     const products = await productsCollection.find({ status: "publish" }).toArray();
//     res.status(200).json(products);
//   } catch (error) {
//     res.status(400).json({ message: 'Error fetching products', error });
//   }
// };

exports.updateProduct = async (req, res) => {
  try {
    const productsCollection = getDB().collection('products');
    const productId = req.params.id; // Get the product ID from the request parameters
    const data = JSON.parse(req.body.data); // Parse the incoming data

    // Get the list of deleted files from the frontend
    const deletedFiles = req.body.deletedFiles ? JSON.parse(req.body.deletedFiles) : [];
    
    // Check if the product exists
    const existingProduct = await productsCollection.findOne({ _id: new ObjectId(productId) });
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let filesToUpdate = existingProduct.files || [];

    if (deletedFiles.length > 0) {
      // Log the structure of existing files and deleted files to check if they match
      const deletedFileNames = existingProduct.files.filter(file =>
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
    const updatedProduct = {
      ...existingProduct, // Start by copying all existing fields
      ...data, // Override with the new fields from data (only provided fields will be replaced)
      files: filesToUpdate, // Updated list of files (with deleted files removed)
    };

    // Merge metadata fields to ensure they remain intact if not updated
    if (data.metadata) {
      updatedProduct.metadata = {
        ...existingProduct.metadata, // Preserve existing metadata fields
        ...data.metadata, // Only update the metadata fields passed in the request
      };
    }

    // Perform the update operation
    const result = await productsCollection.updateOne(
      { _id: new ObjectId(productId) },
      { $set: updatedProduct }
    );

    // Check if the update was successful
    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: 'No changes made to the product' });
    }

    // Retrieve the updated product
    const updatedProductData = await productsCollection.findOne({ _id: new ObjectId(productId) });

    res.status(200).json({ message: 'Product updated successfully', product: updatedProductData });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(400).json({ message: 'Error updating product', error });
  }
};


exports.getAllProducts = async (req, res) => {
  try {
    const productsCollection = getDB().collection('products');

    // Retrieve the category filter from the request query
    const category = req.query.category;

    // Define the filter
    let filter;
    if (category === 'admin') {
      // Admin case: Return all products with status "publish"
      filter = { status: "publish" };
    } else if (category === 'Smakelijke') {
      // Special case: When "Smakelijke" is selected, return products from both Smakelijke categories
      filter = { 
        status: "publish", 
        categories: { 
          $in: ["Smakelijke maaltijden", "Smakelijke pakketten"] 
        } 
      };
    } else if (category && category !== 'Alle') {
      // When specific category is selected
      filter = { status: "publish", categories: category };
    } else {
      // When "Alle" is selected or no category is provided, exclude specific categories
      filter = { 
        status: "publish", 
        categories: { 
          $nin: ["Smakelijke maaltijden", "Smakelijke pakketten"] 
        } 
      };
    }

    // Define the projection to return only the required fields
    const projection = {
      name: 1,
      description: 1,
      productId: 1,
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
        badges: 1,
        cost_price: 1,
        weight_options: 1,
        
      },
    };

    // Fetch products with filter and projection
    const products = await productsCollection.find(filter, { projection }).toArray();

    res.status(200).json(products);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching products', error });
  }
};


// exports.getSingleProduct = async (req, res) => {
//   try {
//     const { productName } = req.params; // Assuming you pass the ID as a parameter in the URL
//     const productsCollection = getDB().collection('products');
//     // Input from the URL

//     // Normalize the input by replacing spaces/hyphens and trimming

//     // Create a regex to match the normalized name

//     const regexPattern = new RegExp(productName.replace(/-/g, '.*'), 'i'); // Replace hyphens with '.*' and make case-insensitive

//     // Convert productId to ObjectId for querying
//     const product = await productsCollection.findOne({
//       "name": regexPattern, // Case-insensitive and more flexible
//       "status": "publish"
//     })


//     if (!product) {
//       return res.status(404).json({ message: 'Product not found' });
//     }

//     res.status(200).json(product); // Send the found product as a response
//   } catch (error) {
//     console.error('Error fetching product:', error);
//     res.status(500).json({ message: 'Error fetching product', error });
//   }
// };
exports.getSingleProduct = async (req, res) => {
  try {
    const { productName } = req.params; // Assuming you pass the ID as a parameter in the URL
    const productsCollection = getDB().collection('products');

    // First try to find by product_slug directly
    let product = await productsCollection.findOne({
      "product_slug": productName,
      "status": "publish"
    });

    // If no product found by slug, continue with existing search methods
    if (!product) {
    // Create regexPattern1 to handle hyphens, spaces, and en-dashes
    const regexPattern1 = new RegExp(
      "^" + productName
        .replace(/-/g, "[-\\s–]*") + "$", // Match hyphens, spaces, or en-dashes
      "i" // Case-insensitive
    );
    
    // Create regexPattern2 to allow hyphens to match any character in between words (more flexible)
    const regexPattern2 = new RegExp(productName.replace(/-/g, '.*'), 'i'); // Replace hyphens with '.*' and make case-insensitive
    
      // Try searching using regexPattern1
      product = await productsCollection.findOne({
      "name": regexPattern1,
      "status": "publish"
    });
    
    if (!product) {
      // If no product found, try searching using regexPattern2
      product = await productsCollection.findOne({
        "name": regexPattern2,
        "status": "publish"
      });
      }
    }
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json(product); // Send the found product as a response
    
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Error fetching product', error });
  }
};
exports.getSingleProductById = async (req, res) => {
  try {
    const { id } = req.params; // Assuming the ObjectId is passed as a parameter in the URL
    const productsCollection = getDB().collection('products');

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    // Fetch product by ObjectId
    const product = await productsCollection.findOne({ _id: new ObjectId(id)});

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json(product); // Send the found product as a response

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Error fetching product', error });
  }
};

exports.deleteProductById = async (req, res) => {
  try {
    const productsCollection = getDB().collection('products');
    const productId = req.params.id;

    // Convert the ID string to ObjectId for MongoDB query
    const product = await productsCollection.findOne({ _id: new ObjectId(productId) });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Delete the product document from the database
    const result = await productsCollection.deleteOne({ _id: new ObjectId(productId) });

    if (result.deletedCount === 1) {
      if(product.files && product.files.length > 0){

      product.files.forEach(file => {
        const filePath = path.join(__dirname, '../uploads', file.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });}
      if(product.thumbnail && product.thumbnail.url){
        
        // Path to the image file
        const imagePath = path.join(__dirname, '../uploads', product.thumbnail.url );
  
        // Delete the image file from the uploads folder
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

        res.status(200).json({ message: 'Product deleted successfully', product:product });
      
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.log(error)
    res.status(400).json({ message: 'Error deleting product', error });
  }
};