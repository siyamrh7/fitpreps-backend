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
      product_slug: 1,
      sizes: 1,
      thumbnail: 1,
      files: 1,
      createdAt: 1,
      updatedAt: 1,
      metadata: {
        _price: 1,
        _stock: 1,
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

// Get gymwear revenue analytics
exports.getGymwearRevenue = async (req, res) => {
  try {
    const ordersCollection = getDB().collection('orders');

    const { startDate, endDate, password } = req.query;
    if (password !== 'rayisgreat') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const hasCustomDateRange = startDate && endDate;

    const getDateRange = (type) => {
      const now = new Date();
      const start = new Date(now);

      switch (type) {
        case 'monthly':
          start.setDate(1);
          break;
        case 'weekly':
          start.setDate(now.getDate() - now.getDay() + 1);
          break;
        case 'yearly':
          start.setMonth(0, 1);
          break;
        case 'today':
          start.setHours(0, 0, 0, 0);
          break;
        case 'custom':
          return {
            start: new Date(startDate),
            end: new Date(endDate)
          };
        default:
          throw new Error('Invalid date range type');
      }

      return { start, end: now };
    };

    const aggregateGymwearSales = async (start, end) => {
      const result = await ordersCollection.aggregate([
        {
          $addFields: {
            createdAtDate: {
              $cond: {
                if: { $eq: [{ $type: "$createdAt" }, "string"] },
                then: { $dateFromString: { dateString: "$createdAt", onError: new Date(0) } },
                else: "$createdAt"
              }
            },
          },
        },
        {
          $match: {
            status: 'completed',
            createdAtDate: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            totalGymwearSales: {
              $sum: {
                $convert: { input: { $ifNull: ["$metadata._gymwear_total", "0"] }, to: "double", onError: 0 }
              }
            },
            totalOrders: { $sum: 1 },
            gymwearOrders: {
              $sum: {
                $cond: [
                  { $gt: [{ $convert: { input: { $ifNull: ["$metadata._gymwear_total", "0"] }, to: "double", onError: 0 } }, 0] },
                  1,
                  0
                ]
              }
            }
          },
        },
      ]).toArray();

      return {
        totalGymwearSales: result[0]?.totalGymwearSales || 0,
        totalOrders: result[0]?.totalOrders || 0,
        gymwearOrders: result[0]?.gymwearOrders || 0,
      };
    };

    const totalGymwearSalesAgg = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalGymwearSales: {
            $sum: { $convert: { input: { $ifNull: ["$metadata._gymwear_total", "0"] }, to: "double", onError: 0 } }
          },
          totalOrders: { $sum: 1 },
          gymwearOrders: {
            $sum: {
              $cond: [
                { $gt: [{ $convert: { input: { $ifNull: ["$metadata._gymwear_total", "0"] }, to: "double", onError: 0 } }, 0] },
                1,
                0
              ]
            }
          }
        },
      },
    ]).toArray();

    const aggregateMonthlyGymwearRevenue = async () => {
      const result = await ordersCollection.aggregate([
        {
          $match: { status: 'completed' },
        },
        {
          $project: {
            createdAtDate: {
              $cond: {
                if: { $eq: [{ $type: "$createdAt" }, "string"] },
                then: { $dateFromString: { dateString: "$createdAt", onError: new Date(0) } },
                else: "$createdAt"
              }
            },
            year: {
              $year: {
                $cond: {
                  if: { $eq: [{ $type: "$createdAt" }, "string"] },
                  then: { $dateFromString: { dateString: "$createdAt", onError: new Date(0) } },
                  else: "$createdAt"
                }
              }
            },
            month: {
              $month: {
                $cond: {
                  if: { $eq: [{ $type: "$createdAt" }, "string"] },
                  then: { $dateFromString: { dateString: "$createdAt", onError: new Date(0) } },
                  else: "$createdAt"
                }
              }
            },
            gymwearTotalAsNumber: {
              $convert: { input: { $ifNull: ["$metadata._gymwear_total", "0"] }, to: "double", onError: 0 }
            },
          },
        },
        {
          $group: {
            _id: { year: "$year", month: "$month" },
            totalGymwearSales: { $sum: "$gymwearTotalAsNumber" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]).toArray();

      const monthlyGymwearRevenue = Array(12).fill(0);
      result.forEach(item => {
        if (item._id && item._id.month) {
          const monthIndex = item._id.month - 1;
          if (monthIndex >= 0 && monthIndex < 12) {
            monthlyGymwearRevenue[monthIndex] = item.totalGymwearSales;
          }
        }
      });
      return monthlyGymwearRevenue;
    };

    const aggregateDailyGymwearRevenue = async () => {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const last30Days = [];
      for (let i = 0; i < 30; i++) {
        const day = new Date(thirtyDaysAgo);
        day.setDate(thirtyDaysAgo.getDate() + i);
        last30Days.push(day.toISOString().split('T')[0]);
      }

      const result = await ordersCollection.aggregate([
        {
          $addFields: {
            createdAtDate: {
              $cond: {
                if: { $eq: [{ $type: "$createdAt" }, "string"] },
                then: { $dateFromString: { dateString: "$createdAt", onError: new Date(0) } },
                else: "$createdAt"
              }
            },
            gymwearTotalAsNumber: {
              $convert: { input: { $ifNull: ["$metadata._gymwear_total", "0"] }, to: "double", onError: 0 }
            },
          },
        },
        {
          $match: {
            status: 'completed',
            createdAtDate: { $gte: thirtyDaysAgo, $lte: today },
          },
        },
        { $project: { createdAtDate: 1, gymwearTotalAsNumber: 1 } },
        {
          $group: {
            _id: { createdAtDate: { $dateToString: { format: "%Y-%m-%d", date: "$createdAtDate", onNull: "1970-01-01" } } },
            totalGymwearSales: { $sum: "$gymwearTotalAsNumber" },
          },
        },
        { $sort: { "_id.createdAtDate": 1 } },
      ]).toArray();

      const dailyGymwearRevenue = Array(30).fill(0);
      result.forEach(item => {
        if (item._id && item._id.createdAtDate) {
          const index = last30Days.indexOf(item._id.createdAtDate);
          if (index >= 0) {
            dailyGymwearRevenue[index] = item.totalGymwearSales;
          }
        }
      });

      return dailyGymwearRevenue;
    };

    const { start: startOfMonth, end: endOfMonth } = getDateRange('monthly');
    const { start: startOfWeek, end: endOfWeek } = getDateRange('weekly');
    const { start: startOfYear, end: endOfYear } = getDateRange('yearly');
    const { start: startOfToday, end: endOfToday } = getDateRange('today');

    let customData = null;
    if (hasCustomDateRange) {
      const { start: customStart, end: customEnd } = getDateRange('custom');
      customData = await aggregateGymwearSales(customStart, customEnd);
    }

    const monthlyData = await aggregateGymwearSales(startOfMonth, endOfMonth);
    const weeklyData = await aggregateGymwearSales(startOfWeek, endOfWeek);
    const yearlyData = await aggregateGymwearSales(startOfYear, endOfYear);
    const todayData = await aggregateGymwearSales(startOfToday, endOfToday);

    const monthlyGymwearRevenue = await aggregateMonthlyGymwearRevenue();
    const dailyGymwearRevenue = await aggregateDailyGymwearRevenue();

    const gymwearRevenue = {
      totalGymwearSales: totalGymwearSalesAgg[0]?.totalGymwearSales || 0,
      gymwearOrders: totalGymwearSalesAgg[0]?.gymwearOrders || 0,
      monthlyGymwearRevenue,
      dailyGymwearRevenue,
      total: {
        totalGymwearSales: totalGymwearSalesAgg[0]?.totalGymwearSales || 0,
        gymwearOrders: totalGymwearSalesAgg[0]?.gymwearOrders || 0,
      },
      monthly: {
        totalGymwearSales: monthlyData.totalGymwearSales,
        gymwearOrders: monthlyData.gymwearOrders,
      },
      weekly: {
        totalGymwearSales: weeklyData.totalGymwearSales,
        gymwearOrders: weeklyData.gymwearOrders,
      },
      yearly: {
        totalGymwearSales: yearlyData.totalGymwearSales,
        gymwearOrders: yearlyData.gymwearOrders,
      },
      today: {
        totalGymwearSales: todayData.totalGymwearSales,
        gymwearOrders: todayData.gymwearOrders,
      },
    };

    if (customData) {
      gymwearRevenue.custom = {
        totalGymwearSales: customData.totalGymwearSales,
        totalOrders: customData.totalOrders,
        gymwearOrders: customData.gymwearOrders,
        dateRange: { startDate, endDate }
      };
    }

    res.status(200).json(gymwearRevenue);
  } catch (error) {
    console.error('Error fetching gymwear revenue:', error);
    res.status(400).json({ message: 'Error fetching gymwear revenue', error: error.toString() });
  }
};
