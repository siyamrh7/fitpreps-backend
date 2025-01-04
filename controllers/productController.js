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
    const result = await productsCollection.insertOne({ ...data, thumbnail: { url: req.file.filename }, productId: newProductId });

    // Retrieve the created product by its ID
    const createdProduct = await productsCollection.findOne({ _id: result.insertedId });

    res.status(200).json({ message: 'Product created successfully', product: createdProduct });
  } catch (error) {
    res.status(400).json({ message: 'Error creating product', error });
  }
}
exports.updateProduct = async (req, res) => {
  try {
    const productsCollection = getDB().collection('products');
    const productId = req.params.id; // Get the product ID from the request parameters
    const data = JSON.parse(req.body.data); // Parse the incoming data

    // Check if the product exists
    const existingProduct = await productsCollection.findOne({ _id: new ObjectId(productId) });
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Prepare update object, preserving existing fields (including metadata)
    const updatedProduct = {
      ...existingProduct, // Start by copying all existing fields
      ...data, // Override with the new fields from data (only provided fields will be replaced)
      ...(req.file && { thumbnail: { url: req.file.filename } }), // Update thumbnail if a new file is provided
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


// exports.getAllProducts = async (req, res) => {
//   try {
//     const productsCollection = getDB().collection('products');

//     const products = await productsCollection.find({ status: "publish" }).toArray();
//     res.status(200).json(products);
//   } catch (error) {
//     res.status(400).json({ message: 'Error fetching products', error });
//   }
// };
exports.getAllProducts = async (req, res) => {
  try {
    const productsCollection = getDB().collection('products');

    // Retrieve the category filter from the request query
    const category = req.query.category;

    // Define the filter
    const filter = category && category !== 'All' 
      ? { status: "publish", categories: category } 
      : { status: "publish" };

    // Define the projection to return only the required fields
    const projection = {
      name: 1,
      description: 1,
      productId: 1,
      status: 1,
      categories: 1,
      thumbnail: 1,
      metadata: {
        _price: 1,
        _stock: 1,
        total_sales: 1,
        nutretions_data: 1,
        producten_specificaties_data: 1,
        voedingswaarde_data: 1,
        _yith_wcpb_bundle_data: 1,
      },
    };

    // Fetch products with filter and projection
    const products = await productsCollection.find(filter, { projection }).toArray();

    res.status(200).json(products);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching products', error });
  }
};


exports.getSingleProduct = async (req, res) => {
  try {
    const { productName } = req.params; // Assuming you pass the ID as a parameter in the URL
    const productsCollection = getDB().collection('products');
    // Input from the URL

    // Normalize the input by replacing spaces/hyphens and trimming

    // Create a regex to match the normalized name

    const regexPattern = new RegExp(productName.replace(/-/g, '.*'), 'i'); // Replace hyphens with '.*' and make case-insensitive

    // Convert productId to ObjectId for querying
    const product = await productsCollection.findOne({
      "name": regexPattern, // Case-insensitive and more flexible
      "status": "publish"
    })


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
      // Path to the image file
      const imagePath = path.join(__dirname, '..', 'uploads', product.thumbnail.url);

      // Delete the image file from the uploads folder
      fs.unlink(imagePath, async (err) => {
        if (err) {
          console.error(`Error deleting image file: ${err.message}`);
          return res.status(500).json({ message: 'Error deleting image file', error: err });
        }

        res.status(200).json({ message: 'Product deleted successfully', product:product });
      });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Error deleting product', error });
  }
};