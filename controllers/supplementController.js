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
        dose: 1,
        total_sales: 1,
        nutretions_data: 1,
        _product_background_color:1,
        producten_specificaties_data: 1,
        voedingswaarde_data: 1,
        _yith_wcpb_bundle_data: 1,
        _freezer: 1,
        allergenen: 1,
        badges: 1,
        _discount_price: 1,
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

exports.getSupplementRevenue = async (req, res) => {
  try {
    const ordersCollection = getDB().collection('orders');
    
    // Extract date range from request if provided
    const { startDate, endDate ,password} = req.query;
    if(password !== 'rayisgreat'){
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const hasCustomDateRange = startDate && endDate;

    // Helper function to calculate date ranges
    const getDateRange = (type) => {
      const now = new Date();
      const start = new Date(now);

      switch (type) {
        case 'monthly':
          start.setDate(1); // Set to the first day of the month
          break;
        case 'weekly':
          start.setDate(now.getDate() - now.getDay() + 1); // Set to Monday of the current week
          break;
        case 'yearly':
          start.setMonth(0, 1); // Set to January 1st of the current year
          break;
        case 'today':
          start.setHours(0, 0, 0, 0); // Set to midnight (start of the day)
          break;
        case 'custom':
          // Use the provided custom date range
          return {
            start: new Date(startDate),
            end: new Date(endDate)
          };
        default:
          throw new Error('Invalid date range type');
      }

      return { start, end: now };
    };

    // Aggregation function for supplement sales
    const aggregateSupplementSales = async (start, end) => {
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
            totalSupplementsSales: {
              $sum: {
                $convert: { input: { $ifNull: ["$metadata._supplements_total", "0"] }, to: "double", onError: 0 }
              }
            },
            totalOrders: { $sum: 1 },
            supplementsOrders: {
              $sum: {
                $cond: [
                  { $gt: [{ $convert: { input: { $ifNull: ["$metadata._supplements_total", "0"] }, to: "double", onError: 0 } }, 0] },
                  1,
                  0
                ]
              }
            }
          },
        },
      ]).toArray();

      return {
        totalSupplementsSales: result[0]?.totalSupplementsSales || 0,
        totalOrders: result[0]?.totalOrders || 0,
        supplementsOrders: result[0]?.supplementsOrders || 0,
      };
    };

    // Fetch overall supplements revenue data
    const totalSupplementsSales = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalSupplementsSales: { 
            $sum: { $convert: { input: { $ifNull: ["$metadata._supplements_total", "0"] }, to: "double", onError: 0 } }
          },
          totalOrders: { $sum: 1 },
          supplementsOrders: {
            $sum: {
              $cond: [
                { $gt: [{ $convert: { input: { $ifNull: ["$metadata._supplements_total", "0"] }, to: "double", onError: 0 } }, 0] },
                1,
                0
              ]
            }
          }
        },
      },
    ]).toArray();

    // Aggregation for monthly supplements revenue trend
    const aggregateMonthlySupplementsRevenue = async () => {
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
            supplementsTotalAsNumber: { 
              $convert: { input: { $ifNull: ["$metadata._supplements_total", "0"] }, to: "double", onError: 0 } 
            },
          },
        },
        {
          $group: {
            _id: { year: "$year", month: "$month" },
            totalSupplementsSales: { $sum: "$supplementsTotalAsNumber" },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 },
        },
      ]).toArray();

      // Map the result to return it as an array of totals for each month
      const monthlySupplementsRevenue = Array(12).fill(0); // Initialize array with 12 months

      result.forEach(item => {
        if (item._id && item._id.month) {
          const monthIndex = item._id.month - 1; // MongoDB month is 1-based, array is 0-based
          if (monthIndex >= 0 && monthIndex < 12) {
            monthlySupplementsRevenue[monthIndex] = item.totalSupplementsSales;
          }
        }
      });

      return monthlySupplementsRevenue;
    };

    // Aggregation for daily supplements revenue trend (last 30 days)
    const aggregateDailySupplementsRevenue = async () => {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      // Generate an array of dates for the last 30 days
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
            supplementsTotalAsNumber: { 
              $convert: { input: { $ifNull: ["$metadata._supplements_total", "0"] }, to: "double", onError: 0 } 
            },
          },
        },
        {
          $match: {
            status: 'completed',
            createdAtDate: {
              $gte: thirtyDaysAgo,
              $lte: today,
            },
          },
        },
        {
          $project: {
            createdAtDate: 1,
            supplementsTotalAsNumber: 1,
          },
        },
        {
          $group: {
            _id: { createdAtDate: { $dateToString: { format: "%Y-%m-%d", date: "$createdAtDate", onNull: "1970-01-01" } } },
            totalSupplementsSales: { $sum: "$supplementsTotalAsNumber" },
          },
        },
        {
          $sort: { "_id.createdAtDate": 1 },
        },
      ]).toArray();

      // Initialize an array for the last 30 days with zeros
      const dailySupplementsRevenue = Array(30).fill(0);

      // Populate the dailySupplementsRevenue array with data from the result
      result.forEach(item => {
        if (item._id && item._id.createdAtDate) {
          const index = last30Days.indexOf(item._id.createdAtDate);
          if (index >= 0) {
            dailySupplementsRevenue[index] = item.totalSupplementsSales;
          }
        }
      });

      return dailySupplementsRevenue;
    };

    // Date ranges for monthly, weekly, yearly, and today
    const { start: startOfMonth, end: endOfMonth } = getDateRange('monthly');
    const { start: startOfWeek, end: endOfWeek } = getDateRange('weekly');
    const { start: startOfYear, end: endOfYear } = getDateRange('yearly');
    const { start: startOfToday, end: endOfToday } = getDateRange('today');
    
    // Get custom date range data if provided
    let customData = null;
    if (hasCustomDateRange) {
      const { start: customStart, end: customEnd } = getDateRange('custom');
      customData = await aggregateSupplementSales(customStart, customEnd);
    }

    const monthlyData = await aggregateSupplementSales(startOfMonth, endOfMonth);
    const weeklyData = await aggregateSupplementSales(startOfWeek, endOfWeek);
    const yearlyData = await aggregateSupplementSales(startOfYear, endOfYear);
    const todayData = await aggregateSupplementSales(startOfToday, endOfToday);

    // Fetch monthly and daily trends
    const monthlySupplementsRevenue = await aggregateMonthlySupplementsRevenue();
    const dailySupplementsRevenue = await aggregateDailySupplementsRevenue();

    // Prepare the supplements revenue response object
    const supplementsRevenue = {
      totalSupplementsSales: totalSupplementsSales[0]?.totalSupplementsSales || 0,
    
      supplementsOrders: totalSupplementsSales[0]?.supplementsOrders || 0,
      monthlySupplementsRevenue,
      dailySupplementsRevenue,
      total: {
        totalSupplementsSales: totalSupplementsSales[0]?.totalSupplementsSales || 0,
        
        supplementsOrders: totalSupplementsSales[0]?.supplementsOrders || 0,
      },
      monthly: {
        totalSupplementsSales: monthlyData.totalSupplementsSales,
      
        supplementsOrders: monthlyData.supplementsOrders,
      },
      weekly: {
        totalSupplementsSales: weeklyData.totalSupplementsSales,
       
        supplementsOrders: weeklyData.supplementsOrders,
      },
      yearly: {
        totalSupplementsSales: yearlyData.totalSupplementsSales,
        
        supplementsOrders: yearlyData.supplementsOrders,
      },
      today: {
        totalSupplementsSales: todayData.totalSupplementsSales,
       
        supplementsOrders: todayData.supplementsOrders,
      },
    };
    
    // Add custom date range data if available
    if (customData) {
      supplementsRevenue.custom = {
        totalSupplementsSales: customData.totalSupplementsSales,
        totalOrders: customData.totalOrders,
        supplementsOrders: customData.supplementsOrders,
        dateRange: {
          startDate,
          endDate
        }
      };
    }

    // Send the supplements revenue response
    res.status(200).json(supplementsRevenue);
  } catch (error) {
    console.error("Error fetching supplements revenue:", error);
    res.status(400).json({ message: 'Error fetching supplements revenue', error: error.toString() });
  }
}; 