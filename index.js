// app.js
require('dotenv').config(); // Load environment variables
const express = require('express');
const bodyParser = require('body-parser');
const compression = require("compression");
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const supplementRoutes = require('./routes/supplementRoutes');
const orderRoutes = require('./routes/orderRoutes');
const authRoutes = require('./routes/authRoutes');
const couponRoutes = require('./routes/couponRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const blogRoutes = require('./routes/blogRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const gymwearRoutes = require('./routes/gymwearRoutes');

const uploadSingle = require('./middleware/uploadMiddleware'); // Import the Multer middleware
const { contactController } = require('./controllers/contactController');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(compression());
// For form-urlencoded data (what Mollie typically sends)
app.use(express.urlencoded({ extended: true }));

// For JSON data
app.use(bodyParser.json());
app.set('trust proxy', true);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.post("/send-email", uploadSingle, contactController)

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/supplements', supplementRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/gymwear', gymwearRoutes);

app.use('/api/track-event', trackingRoutes);
app.use("/webhook/sendcloud", webhookRoutes);
// Email Sending Route with File Upload
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
