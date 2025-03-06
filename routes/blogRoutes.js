const express = require('express');
const { getBlogs, createBlog, updateBlog, deleteBlog, getSingleBlog } = require('../controllers/blogController');
const uploadSingle = require('../middleware/uploadMiddleware'); // Import the Multer middleware

const router = express.Router();

router.get('/', getBlogs);
router.get('/:blogTitle', getSingleBlog);

router.post('/',uploadSingle, createBlog);
router.put('/:id',uploadSingle, updateBlog);
router.delete('/:id', deleteBlog);

module.exports = router;
