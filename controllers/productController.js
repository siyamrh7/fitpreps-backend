// controllers/productController.js
const { getDB } = require('../config/db');
const { ObjectId } = require("mongodb")
exports.createProduct = async (req, res) => {
  try {
    const productsCollection = getDB().collection('products');
    await productsCollection.insertOne(req.body);  // Save the full body as-is
    res.status(201).json({ message: 'Product created successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error creating product', error });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const productsCollection = getDB().collection('products');
   
    const products = await productsCollection.find({ status: "publish" }).toArray();
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
    });
    

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json(product); // Send the found product as a response
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Error fetching product', error });
  }
};
