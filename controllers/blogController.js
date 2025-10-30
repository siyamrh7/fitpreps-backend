const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb')
exports.getBlogs = async (req, res) => {
    try {
      // Get the page and limit from the query parameters, set default values if not provided
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
  
      // If no page or limit is provided, fetch all blogs
      if (!req.query.page && !req.query.limit) {
        const blogs = await getDB()
          .collection('blogs')
          .find()
          .sort({ createdAt: -1 })  // Assuming you have a `createdAt` field
          .toArray();
  
        return res.json({
          blogs,
          pagination: {
            total: blogs.length,
            page: 1,
            limit: blogs.length,
            totalPages: 1,
          },
        });
      }
  
      // Calculate the skip value to paginate
      const skip = (page - 1) * limit;
  
      // Fetch the blogs from the database with sorting by creation date (newest first)
      const blogs = await getDB()
        .collection('blogs')
        .find()
        .sort({ createdAt: -1 })  // Assuming you have a `createdAt` field
        .skip(skip)
        .limit(limit)
        .toArray();
  
      // Get the total count of blogs for pagination info
      const totalBlogs = await getDB().collection('blogs').countDocuments();
  
      // Send the response with blogs and pagination data
      res.json({
        blogs,
        pagination: {
          total: totalBlogs,
          page,
          limit,
          totalPages: Math.ceil(totalBlogs / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch blogs' });
    }
  };
  
exports.createBlog = async (req, res) => {
  try {
    const newBlog = req.body;
    
    // Add image filename only if a file was uploaded
    if (req.file) {
      newBlog.image = req.file.filename;
    }
    
    // Add createdAt timestamp
    newBlog.createdAt = new Date();
    
    const result = await getDB().collection('blogs').insertOne(newBlog);
    res.status(201).json(result);
  } catch (error) {
    
    res.status(500).json({ error: 'Failed to create blog',message:error.message });
  }
};


exports.updateBlog = async (req, res) => {
    try {
      const { id } = req.params;
      const updatedBlog = req.body;
      delete updatedBlog._id;

      // Check if a new image file is uploaded
      if (req.file) {
        updatedBlog.image = req.file.filename; // Update image field
      }
  
      // Update blog in the database
      await getDB().collection("blogs").updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedBlog }
      );
  
      res.json({ message: "Blog updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update blog",message:error.message });
    }
  };
exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    await getDB().collection('blogs').deleteOne({ _id: new ObjectId(id) });
    res.json({ message: 'Blog deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete blog' });
  }
};
exports.getSingleBlog = async (req, res) => {
  try {
    const { blogTitle } = req.params; // Assuming you pass the blog title as a parameter in the URL
    const blogsCollection = getDB().collection('blogs');

    // Input from the URL
    // Normalize the input by replacing spaces/hyphens and trimming
    
    // Create regexPattern1 to handle hyphens, spaces, and en-dashes
    const regexPattern1 = new RegExp(
      "^" + blogTitle
        .replace(/-/g, "[-\\s–]*") + "$", // Match hyphens, spaces, or en-dashes
      "i" // Case-insensitive
    );
    
    // Create regexPattern2 to allow hyphens to match any character in between words (more flexible)
    const regexPattern2 = new RegExp(blogTitle.replace(/-/g, '.*'), 'i'); // Replace hyphens with '.*' and make case-insensitive
    
    // First, try searching using regexPattern1
    let blog = await blogsCollection.findOne({
      "title": regexPattern1,
    });
    
    if (!blog) {
      // If no blog found, try searching using regexPattern2
      blog = await blogsCollection.findOne({
        "title": regexPattern2,
        
      });
    }
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }
    
    res.status(200).json(blog); // Send the found blog as a response
    
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({ message: 'Error fetching blog', error });
  }
};
