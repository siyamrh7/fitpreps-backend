const multer = require('multer');
const path = require('path');

// Set storage engine for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads'); // Set the destination folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.floor(Math.random() * 10000) + path.extname(file.originalname)); // Set the file name with timestamp
  }
});

// File filter to allow images and videos
const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi/;
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = fileTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb('Error: Only image and video files are allowed!');
  }
};

// Initialize Multer middleware with storage configuration
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Limit file size to 50MB
  fileFilter: fileFilter
});

// Middleware to handle multiple file uploads
const uploadMultiple = upload.array('files', 10); // Accept up to 10 files

module.exports = uploadMultiple;
