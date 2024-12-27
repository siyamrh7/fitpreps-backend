const multer = require('multer');
const path = require('path');

// Set storage engine for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads'); // Set the destination folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Set the file name with timestamp
  }
});

// Initialize Multer middleware with storage configuration
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif|webp/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb('Error: Only image files (JPEG, PNG, GIF) are allowed!');
    }
  }
});

// Middleware to handle file upload (single file named 'image')
const uploadSingle = upload.single('image');

module.exports = uploadSingle;
