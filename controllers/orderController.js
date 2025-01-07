// controllers/orderController.js
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb'); // Import ObjectId to handle MongoDB IDs
const moment = require('moment'); // Import Moment.js to handle dates
const { unserialize } = require('php-serialize');
// Import Pay.nl SDK
var Paynl = require('paynl-sdk');
const { orderEmailController } = require('./contactController');

// Configure Pay.nl with your credentials
Paynl.Config.setApiToken(process.env.PAY_NL_API_TOKEN);   // Replace with your API token
Paynl.Config.setServiceId(process.env.PAY_NL_SERVICE_ID);   // Replace with your service ID
// HTML template

// Create order API route
exports.createOrder = async (req, res) => {
  try {
    const { total } = req.body;


    // Step 2: Create an Order in the Database
    const ordersCollection = getDB().collection('orders');

    const results = await ordersCollection.insertOne(req.body);
    // if(total == 0 ){
    //   await ordersCollection.updateOne(
    //     { _id: results.insertedId },
    //     {
    //       $set: {
    //         'metadata.transactionId': null, // Adds or updates the transactionId in metadata
    //         status: 'processing',  // Updates status to 'pending' (or awaiting_payment)
    //         'metadata._customer_ip_address': req.ip,
    //         updatedAt: new Date(), // Updates the updatedAt field with the current timestamp
    //       },
    //     }
    //   );
    //   return res.status(200).json({
    //     message: 'Order created successfully',
    //     paymentUrl:`${process.env.FRONTEND_URI}/profile?tab=1`,

    //   });
    // }
    // Step 3: Process Payment via Pay.nl (if paymentMethod is Pay.nl)
    const paymentData = {
      amount: total || 1,               // Amount to charge (in Euros)
      returnUrl: `${process.env.FRONTEND_URI}/payment-success/`,  // Redirect after successful payment
      cancelUrl: `${process.env.FRONTEND_URI}/payment-success/`,  // Redirect if payment is canceled
      ipAddress: req.ip,                 // User's IP address
      enduser: {
        emailAddress: req.body.metadata._billing_email,
      },
    };

    // Start the payment transaction using Pay.nl SDK
    Paynl.Transaction.start(paymentData)
      .subscribe(
        async function (result) {
          // Successfully started payment
          const paymentUrl = result.paymentURL;
          const transactionId = result.transactionId;
          // Update the order with payment URL and transactionId
          await ordersCollection.updateOne(
            { _id: results.insertedId },
            {
              $set: {
                'metadata.transactionId': transactionId, // Adds or updates the transactionId in metadata
                status: 'pending',  // Updates status to 'pending' (or awaiting_payment)
                'metadata._customer_ip_address': req.ip,
              },
            }
          );


          // Send the payment URL back to the client for completion
          return res.status(200).json({
            message: 'Order created successfully, proceed to payment',
            paymentUrl,
            transactionId,
          });
        },
        async function (error) {
          // If there was an error in the payment creation process
          console.error('Error initiating payment:', error);
          // Update the order status and send error response
          return res.status(201).json({ message: 'Payment Failed', error });

        }
      );

    // If the payment is not through Pay.nl, assume another payment method

  } catch (error) {
    res.status(400).json({ message: 'Error creating order', error: error.message });
  }

};
exports.checkPayment = async (req, res) => {
  const { transactionId } = req.params;

  try {
    const username = process.env.SENDCLOUD_API_USERNAME;
    const password = process.env.SENDCLOUD_API_PASSWORD;
    const ordersCollection = getDB().collection('orders');
    const orderData = await ordersCollection.findOne({ 'metadata.transactionId': transactionId });
    // Encode the credentials in base64
    const base64Credentials = btoa(`${username}:${password}`);
    // Extract parameters from the request if needed
    const parcelData = {
      parcel: {
        name: orderData.metadata._shipping_first_name + " " + orderData.metadata._shipping_last_name,
        address: orderData.metadata._shipping_address_1,
        city: orderData.metadata._shipping_city.slice(0, 28),
        postal_code: orderData.metadata._shipping_postcode,
        telephone: orderData.metadata._shipping_phone,
        request_label: false,
        email: orderData.metadata._shipping_email,
        data: {},
        country: orderData.metadata._shipping_country,
        shipment: {
          id: orderData.metadata.deliveryMethod
        },
        weight: orderData.totalWeight || 1.000,
        order_number: orderData._id,
        total_order_value_currency: "EUR",
        total_order_value: orderData.total,
        house_number: orderData.metadata._shipping_address_2,
        parcel_items: orderData.items.map((item) => {
          return {
            description: item.order_item_name,
            quantity: item.meta?._qty,
            value: item.meta?._line_total / item.meta?._qty,
            weight: item.meta?._weight,
            product_id: item.meta?._id,
            item_id: item.meta?._id,
            sku: item.meta?._id
          };
        })
      }
    }

    const url = 'https://panel.sendcloud.sc/api/v2/parcels';
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${base64Credentials}`
      },
      body: JSON.stringify(parcelData)
    };

    // Fetch transaction status from Pay.nl
    Paynl.Transaction.get(transactionId).subscribe(
      async (result) => {
        let paymentStatus = 'pending';
        let paymentMethod = 'UNKNOWN';

        // Determine the payment status
        if (result.isPaid()) {
          paymentStatus = 'processing';
          // Fetch data from SendCloud API
          // const response = await fetch(url, options);
          setImmediate(() =>
            orderEmailController(orderData,"bedankt voor je bestelling!","We hebben je bestelling ontvangen! Je ontvangt van ons een e-mail met Track & Trace code wanneer wij jouw pakket naar de vervoerder hebben verzonden.")
          );
         
          // // Handle response
          // if (!response.ok) {
          //   // Log and handle HTTP errors
          //   const errorText = await response.text();
          //   console.log(errorText)
          // }
          // await response.json();
        } else if (result.isCanceled()) {
          paymentStatus = 'cancelled';
          setImmediate(() =>
            orderEmailController(orderData,"Order Failed! Payment is cancelled!","Your order is failed due to your payment cancellation. Here is your order summary! Please try again.")
          );
          console.log('Transaction is canceled');
        } else if (result.isBeingVerified()) {
          paymentStatus = 'on-hold';
          setImmediate(() =>
            orderEmailController(orderData,"You payment in on hold!","Your order is failed due to your payment. Here is your order summary! Please try again.")
          );
          console.log('Transaction is being verified');
        }
   
        // Get payment method name if available
        paymentMethod = result.paymentDetails?.paymentProfileName || 'UNKNOWN';

        // Update the order in your database
        await ordersCollection.updateOne(
          { 'metadata.transactionId': transactionId }, // Match transactionId
          {
            $set: {
              status: paymentStatus,
              'metadata._payment_method_title': paymentMethod,
            },
          }
        );
        if (result.isPaid()) {


          const productsCollection = getDB().collection('products');

          // Build bulk operations
          const bulkOperations = orderData.items.flatMap((item) => {
            const productName = item.order_item_name; // Name of the product
            const quantityToReduce = item.meta._qty; // Quantity to decrement for this item

            // Check if the item is a bundle
            if (item.meta._asnp_wepb_items) {
              // Parse `_asnp_wepb_items` to get product IDs and quantities
              const bundleComponents = item.meta._asnp_wepb_items.split(',').map((component) => {
                const [productId, quantity] = component.split(':').map(Number);
                return { productId, quantity: quantity * 1 };
              });

              // Create operations for each bundle component
              return bundleComponents.map((component) => ({
                updateOne: {
                  filter: {
                    productId: component.productId, // Filter by product ID
                    $expr: { $gte: [{ $toInt: "$metadata._stock" }, component.quantity] }, // Ensure sufficient stock
                  },
                  update: [
                    {
                      $set: {
                        "metadata._stock": {
                          $toString: {
                            $subtract: [{ $toInt: "$metadata._stock" }, component.quantity],
                          },
                        },
                        "metadata.total_sales": {
                          $toString: {
                            $add: [{ $toInt: "$metadata.total_sales" }, component.quantity],
                          },
                        },

                      },
                    },
                  ],
                },
              }));
            } else if (item.meta._cartstamp) {
              const cartstamp = Object.values(unserialize(item.meta._cartstamp));
              // Create operations for each product in the _cartstamp
              return cartstamp.map((product) => ({
                updateOne: {
                  filter: {
                    productId: parseInt(product.product_id), // Filter by product ID
                    $expr: { $gte: [{ $toInt: "$metadata._stock" }, parseInt(product.bp_min_qty)] }, // Ensure sufficient stock
                  },
                  update: [
                    {
                      $set: {
                        "metadata._stock": {
                          $toString: {
                            $subtract: [{ $toInt: "$metadata._stock" }, parseInt(product.bp_min_qty) * quantityToReduce],
                          },
                        },
                        "metadata.total_sales": {
                          $toString: {
                            $add: [{ $toInt: "$metadata.total_sales" }, parseInt(product.bp_min_qty) * quantityToReduce],
                          },
                        },
                      },
                    },
                  ],
                },
              }));
            } else {
              // If it's a single product
              return {
                updateOne: {
                  filter: {
                    name: productName,
                    $expr: { $gte: [{ $toInt: "$metadata._stock" }, quantityToReduce] }, // Ensure sufficient stock
                  },
                  update: [
                    {
                      $set: {
                        "metadata._stock": {
                          $toString: {
                            $subtract: [{ $toInt: "$metadata._stock" }, quantityToReduce],
                          },
                        },
                        "metadata.total_sales": {
                          $toString: {
                            $add: [{ $toInt: "$metadata.total_sales" }, quantityToReduce],
                          },
                        },
                      },
                    },
                  ],
                },
              };
            }
          });
          const usersCollection = getDB().collection('users');
          const user = await usersCollection.findOne({ _id: new ObjectId(orderData.user_id) });
          if(user){
            // Add points to user account
            
            const updatedMoneySpent = (parseFloat(user.metadata._money_spent)|| 0) + parseFloat(orderData.total);
            await usersCollection.updateOne(
              { _id: new ObjectId(orderData.user_id) },
              { $set: { "metadata._money_spent": updatedMoneySpent.toString() } }
            );
          }
          //update coupons and redeem points
          const { discountsData} = orderData.metadata; // Assuming couponCode and userId are sent in the request body
          const couponCode = discountsData?.code;
          const redeemPoints = discountsData?.redeemPoints;
          if (couponCode) {
            const couponsCollection = getDB().collection('coupons');
            const coupon = await couponsCollection.findOne({ code: couponCode, status: 'publish' });
            if (coupon) {
              // Update coupon usage count
              const updatedUsageCount = (parseInt(coupon.usageCount) || 0) + 1;
              await couponsCollection.updateOne(
                { _id:new ObjectId(coupon._id) },
                { $set: { usageCount: updatedUsageCount } }
              );
              //update coupon totalDiscounts
              var updatedTotalDiscounts = parseFloat(coupon.totalDiscount) + (parseFloat(orderData.metadata._cart_discount) || 0) ;
             
              await couponsCollection.updateOne(
                { _id:new ObjectId(coupon._id) },
                { $set: { totalDiscount: parseFloat(updatedTotalDiscounts).toFixed(2) } }
              );
              //update coupons users
              await couponsCollection.updateOne(
                { _id: new ObjectId(coupon._id) }, // Find the coupon by ID
                { 
                  $push: { 
                    usageLogs: { 
                      orderId: orderData._id, // Get the orderId from the request body
                      customerId: orderData.user_id,   // Use the userId from the authenticated user
                      discountAmount: orderData.metadata._cart_discount, // Amount from the coupon
                      usageDate: new Date()     // Current date and time
                    }
                  } 
                }
              );
             
            }
          }
          if(user){
               // Deduct points from user account
               const updatedPoints = parseInt(user.metadata.woocommerce_reward_points) + parseInt(orderData.total) - redeemPoints;
               await usersCollection.updateOne(
                 { _id: new ObjectId(orderData.user_id) },
                 { $set: { "metadata.woocommerce_reward_points": parseInt(updatedPoints).toString() } }
               );
           
           
          }
          //update stock action
          const results = await productsCollection.bulkWrite(bulkOperations);



          // Fetch data from SendCloud API
          const response = await fetch(url, options);

          // Handle response
          if (!response.ok) {
            // Log and handle HTTP errors
            const errorText = await response.text();
            console.log(errorText)
          }
          await response.json();
        }
        // Send response
        res.status(200).json({
          message: 'Payment status updated successfully',
          transactionId: transactionId,
          status: paymentStatus,
          result,
          paymentMethod: paymentMethod,
        });
      },
      (error) => {
        console.error('Error fetching transaction:', error);
        res.status(400).json({ message: 'Error fetching transaction status', error });
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};










// exports.getAllOrders = async (req, res) => {
//   try {
//     const ordersCollection = getDB().collection("orders");

//     // Extract query parameters
//     const {
//       page = 1,
//       limit = 20,
//       status = "",
//       deliveryDateFilter = "",
//       deliveryDate = "" // Specific delivery date from the date picker
//     } = req.query;

//     // Convert page and limit to integers
//     const pageNumber = parseInt(page, 10);
//     const pageSize = parseInt(limit, 10);

//     // Build the query object for filtering
//     const query = {};

//     if (status) {
//       query.status = status; // Add status filter if provided
//     }


//     if (deliveryDateFilter) {
//       const today = moment().startOf('day');
//       let filterDateRange;

//       switch (deliveryDateFilter) {
//         case 'today':
//           filterDateRange = {
//             $gte: today.format('YYYY-MM-DD'),
//             $lt: today.add(1, 'day').format('YYYY-MM-DD') // Today range
//           };
//           break;
//         case 'next-day':
//           filterDateRange = {
//             $gte: today.add(1, 'day').format('YYYY-MM-DD'),
//             $lt: today.add(1, 'day').add(1, 'day').format('YYYY-MM-DD') // Next day range
//           };
//           break;
//         case 'next-three-days':
//           filterDateRange = {
//             $gte: today.add(1, 'day').format('YYYY-MM-DD'),
//             $lt: today.add(4, 'days').format('YYYY-MM-DD') // Next 3 days range
//           };
//           break;
//         case 'this-week':
//           filterDateRange = {
//             $gte: today.add(1, 'day').format('YYYY-MM-DD'),
//             $lt: today.add(1, 'week').format('YYYY-MM-DD') // Next week range
//           };
//           break;
//         default:
//           filterDateRange = {};
//       }

//       // Update the query to include the date range filter
//       query["metadata._delivery_date"] = filterDateRange;
//     }

//     // Filter by specific delivery date if provided
//     if (deliveryDate) {
//       const specificDate = moment(deliveryDate, 'YYYY-MM-DD').startOf('day');
//       const nextDay = specificDate.clone().add(1, 'day');

//       // Update query to filter by specific delivery date
//       query["metadata._delivery_date"] = {
//         $gte: specificDate.toISOString(), // Start of the day
//         $lt: nextDay.toISOString() // End of the day
//       };
//     }

//     // Fetch total count of orders matching the query
//     const totalOrders = await ordersCollection.countDocuments(query);

//     // Fetch paginated and filtered orders
//     const orders = await ordersCollection
//       .find(query)
//       .sort({ createdAt: -1 }) // Sort by createdAt descending
//       .skip((pageNumber - 1) * pageSize) // Skip documents for pagination
//       .limit(pageSize) // Limit the number of documents per page
//       .toArray();

//     // Return paginated results and metadata
//     res.status(200).json({
//       orders,
//       currentPage: pageNumber,
//       totalPages: Math.ceil(totalOrders / pageSize),
//       totalOrders,
//     });
//   } catch (error) {
//     console.error("Error fetching orders:", error);
//     res.status(400).json({ message: "Error fetching orders", error });
//   }
// };

exports.getAllOrders = async (req, res) => {
  try {
    const ordersCollection = getDB().collection("orders");

    // Extract query parameters
    const {
      page = 1,
      limit = 20,
      status = "",
      deliveryDateFilter = "",
      deliveryDate = "", // Specific delivery date from the date picker
      searchQuery = "" // Search by name or phone
    } = req.query;

    // Convert page and limit to integers
    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);

    // Build the query object for filtering
    const query = {};

    if (status) {
      query.status = status; // Add status filter if provided
    }

    if (deliveryDateFilter) {
      const today = moment().startOf("day");
      let filterDateRange;

      switch (deliveryDateFilter) {
        case "today":
          filterDateRange = {
            $gte: today.format("YYYY-MM-DD"),
            $lt: today.add(1, "day").format("YYYY-MM-DD"), // Today range
          };
          break;
        case "next-day":
          filterDateRange = {
            $gte: today.add(1, "day").format("YYYY-MM-DD"),
            $lt: today.add(1, "day").add(1, "day").format("YYYY-MM-DD"), // Next day range
          };
          break;
        case "next-three-days":
          filterDateRange = {
            $gte: today.add(1, "day").format("YYYY-MM-DD"),
            $lt: today.add(4, "days").format("YYYY-MM-DD"), // Next 3 days range
          };
          break;
        case "this-week":
          filterDateRange = {
            $gte: today.add(1, "day").format("YYYY-MM-DD"),
            $lt: today.add(1, "week").format("YYYY-MM-DD"), // Next week range
          };
          break;
        default:
          filterDateRange = {};
      }

      // Update the query to include the date range filter
      query["metadata._delivery_date"] = filterDateRange;
    }

    // Filter by specific delivery date if provided
    if (deliveryDate) {
      const specificDate = moment(deliveryDate, "YYYY-MM-DD").startOf("day");
      const nextDay = specificDate.clone().add(1, "day");

      // Update query to filter by specific delivery date
      query["metadata._delivery_date"] = {
        $gte: specificDate.toISOString(), // Start of the day
        $lt: nextDay.toISOString(), // End of the day
      };
    }

    // Filter by search query for name or phone
    if (searchQuery) {
      const regex = new RegExp(searchQuery, "i"); // Case-insensitive regex for search
      query.$or = [
        { "metadata._shipping_first_name": regex },
        { "metadata._shipping_last_name": regex },
        { "metadata._shipping_phone": regex },
      ];
    }

    // Fetch total count of orders matching the query
    const totalOrders = await ordersCollection.countDocuments(query);

    // Fetch paginated and filtered orders
    const orders = await ordersCollection
      .find(query)
      .sort({ createdAt: -1 }) // Sort by createdAt descending
      .skip((pageNumber - 1) * pageSize) // Skip documents for pagination
      .limit(pageSize) // Limit the number of documents per page
      .toArray();

    // Return paginated results and metadata
    res.status(200).json({
      orders,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalOrders / pageSize),
      totalOrders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(400).json({ message: "Error fetching orders", error });
  }
};


exports.getOrder = async (req, res) => {
  try {
    // const { userId: userTokenId } = req.user; // From the token
    // const queryUserId = req.query.userId; // Optional query parameter
    const ordersCollection = getDB().collection('orders');


    const orders = await ordersCollection.find({
      $or: [
        { userId: req.query.userId },
        { user_id: req.user.userId },
      ],
    }).sort({ createdAt: -1 }).toArray();

    res.status(200).json(orders);


  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(400).json({ message: 'Error fetching orders', error });
  }
};
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params; // Extract order ID from request parameters

    // Validate that the ID is a valid ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const ordersCollection = getDB().collection('orders');

    // Find the order by its ID
    const order = await ordersCollection.findOne({ _id: new ObjectId(id) });

    // If no order is found, return a 404 error
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Return the found order
    res.status(200).json({ message: 'Order retrieved successfully', order });

  } catch (error) {
    console.error('Error retrieving order:', error);
    res.status(500).json({ message: 'Error retrieving order', error: error.message });
  }
};
// Controller to delete multiple orders by their IDs
exports.deleteOrders = async (req, res) => {
  try {
    const { orderIds } = req.body; // Array of order IDs from the request body

    // Validate that orderIds is an array and not empty
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'Order IDs are required and must be an array' });
    }

    // Ensure all IDs are valid ObjectIds
    const invalidIds = orderIds.filter(id => !ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ message: 'Invalid order ID(s): ' + invalidIds.join(', ') });
    }

    const ordersCollection = getDB().collection('orders');

    // Delete the orders by their IDs
    const result = await ordersCollection.deleteMany({
      _id: { $in: orderIds.map(id => new ObjectId(id)) } // Convert string IDs to ObjectId
    });

    // If no orders were deleted, return a message
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No orders found to delete' });
    }

    res.status(200).json({ message: `${result.deletedCount} orders deleted successfully` });

  } catch (error) {
    console.error('Error deleting orders:', error);
    res.status(500).json({ message: 'Error deleting orders', error: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderIds, status } = req.body.data; // Array of order IDs and the new status from the request body
    // Validate that orderIds is an array and not empty
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'Order IDs are required and must be an array' });
    }

    // Validate that status is a string and not empty
    if (typeof status !== 'string' || status.trim() === '') {
      return res.status(400).json({ message: 'Status is required and must be a valid string' });
    }

    // Ensure all IDs are valid ObjectIds
    const invalidIds = orderIds.filter(id => !ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ message: 'Invalid order ID(s): ' + invalidIds.join(', ') });
    }

    const ordersCollection = getDB().collection('orders');

    // Update the status of the orders by their IDs
    const result = await ordersCollection.updateMany(
      { _id: { $in: orderIds.map(id => new ObjectId(id)) } }, // Convert string IDs to ObjectId
      { $set: { status: status } } // Set the new status
    );

    // If no orders were updated, return a message
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'No orders found to update' });
    }

    res.status(200).json({ message: `${result.modifiedCount} orders status updated successfully` });

  } catch (error) {
    console.error('Error updating orders status:', error);
    res.status(500).json({ message: 'Error updating orders status', error: error.message });
  }
};




exports.getAnalytics = async (req, res) => {
  try {
    const ordersCollection = getDB().collection('orders');

    // Helper function to calculate date ranges
    const getDateRange = (days) => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - days);
      return { start, end };
    };
    const aggregateMonthlyOrders = async () => {
      const result = await ordersCollection.aggregate([
        {
          $match: { status: 'completed' }, // Match only completed orders
        },
        {
          $project: {
            createdAtDate: { $dateFromString: { dateString: "$createdAt" } }, // Convert string to Date
            year: { $year: { $dateFromString: { dateString: "$createdAt" } } }, // Extract year
            month: { $month: { $dateFromString: { dateString: "$createdAt" } } }, // Extract month
            totalAsNumber: { $toDouble: "$total" }, // Convert total to a number
          },
        },
        {
          $group: {
            _id: { year: "$year", month: "$month" },
            totalOrders: { $sum: "$totalAsNumber" }, // Sum the numeric `total` field
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 }, // Sort by year and month
        },
      ]).toArray();
    
      // Map the result to return it as an array of totals for each month
      const monthlyOrders = Array(12).fill(0); // Initialize array with 12 months
    
      result.forEach(item => {
        const monthIndex = item._id.month - 1; // MongoDB month is 1-based, array is 0-based
        monthlyOrders[monthIndex] = item.totalOrders;
      });
    
      return monthlyOrders;
    };
    
    
   
    const aggregateDailyOrders = async () => {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30); // Calculate the date for 30 days ago
    
      // Generate an array of dates for the last 30 days
      const last30Days = [];
      for (let i = 0; i < 30; i++) {
        const day = new Date(thirtyDaysAgo);
        day.setDate(thirtyDaysAgo.getDate() + i); // Get each date in the last 30 days
        last30Days.push(day.toISOString().split('T')[0]); // Store date in YYYY-MM-DD format
      }
    
      const result = await ordersCollection.aggregate([
        {
          $addFields: {
            createdAtDate: { $toDate: "$createdAt" }, // Convert string to Date
            totalAsNumber: { $toDouble: "$total" }, // Convert the total value (string) to a number
          },
        },
        {
          $match: {
            status: 'completed', // Match only completed orders
            createdAtDate: {
              $gte: thirtyDaysAgo, // Orders created in the last 30 days
              $lte: today, // Orders up until today
            },
          },
        },
        {
          $project: {
            createdAtDate: 1, // Keep the created date field
            totalAsNumber: 1, // Keep the converted total field
          },
        },
        {
          $group: {
            _id: { createdAtDate: { $dateToString: { format: "%Y-%m-%d", date: "$createdAtDate" } } }, // Group by date (YYYY-MM-DD)
            totalOrders: { $sum: "$totalAsNumber" }, // Sum the total value (numeric)
          },
        },
        {
          $sort: { "_id.createdAtDate": 1 }, // Sort by date
        },
      ]).toArray();
    
      // Initialize an array for the last 30 days with zeros
      const dailyOrders = Array(30).fill(0);
    
      // Populate the dailyOrders array with data from the result
      result.forEach(item => {
        // Find the index corresponding to the date in the last30Days array
        const index = last30Days.indexOf(item._id.createdAtDate);
    
        // If the date is found in the last 30 days, update the corresponding index in the dailyOrders array
        if (index >= 0) {
          dailyOrders[index] = item.totalOrders;
        }
      });
    
      return dailyOrders;
    };
    
    
    const aggregateLast24HoursOrders = async () => {
      // Get the current date and calculate the start time for the last 24 hours
      const now = new Date();
      const startTime = new Date(now);
      startTime.setHours(now.getHours() - 24); // 24 hours ago
    
      const result = await ordersCollection.aggregate([
        {
          $addFields: {
            createdAtDate: { $toDate: "$createdAt" }, // Convert string to Date
            totalAsNumber: { $toDouble: "$total" }, // Convert total value to a number
          },
        },
        {
          $match: {
            createdAtDate: {
              $gte: startTime, // Start time of the last 24 hours
              $lt: now, // Current time (exclusive)
            },
          },
        },
        {
          $project: {
            hour: { $hour: "$createdAtDate" }, // Extract the hour
            day: { $dayOfYear: "$createdAtDate" }, // Extract the day of the year
            year: { $year: "$createdAtDate" }, // Extract the year
            totalAsNumber: 1, // Keep the total value (numeric)
          },
        },
        {
          $group: {
            _id: { year: "$year", day: "$day", hour: "$hour" }, // Group by year, day, and hour
            totalValue: { $sum: "$totalAsNumber" }, // Sum the total values for each hour
          },
        },
        {
          $project: {
            totalValue: { $toInt: "$totalValue" }, // Convert the total value to integer
          },
        },
        {
          $sort: { "_id.year": 1, "_id.day": 1, "_id.hour": 1 }, // Sort by year, day, and hour
        },
      ]).toArray();
    
      // Prepare the last 24 hours array with zeros
      const hourlyOrders = Array(24).fill(0);
    
      // Populate the hourlyOrders array with data from the result
      result.forEach(item => {
        const orderDate = new Date(item._id.year, 0); // Start of the year
        orderDate.setDate(item._id.day); // Add the day of the year
        orderDate.setHours(item._id.hour); // Add the hour
    
        const diffInHours = Math.floor((now - orderDate) / (1000 * 60 * 60)); // Difference in hours from now
    
        if (diffInHours >= 0 && diffInHours < 24) {
          const hourIndex = 23 - diffInHours; // Map to the last 24 hours
          hourlyOrders[hourIndex] = item.totalValue; // Set the total value for that hour
        }
      });
    
      return hourlyOrders;
    };
    
    
   
    // Aggregation function for sales and orders
    const aggregateMetrics = async (start, end) => {
      const metrics = await ordersCollection.aggregate([
        {
          $addFields: {
            createdAtDate: { $dateFromString: { dateString: "$createdAt" } }, // Convert string to Date
          },
        },
        {
          $match: {
            status: 'completed',
            createdAtDate: { $gte: start, $lte: end }, // Compare the converted Date field
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: { $toDouble: "$total" } },
            totalOrders: { $sum: 1 },
            totalTaxes: {
              $sum: {
                $add: [
                  { $toDouble: "$metadata._order_tax" },
                  { $toDouble: "$metadata._order_shipping_tax" },
                ],
              },
            },
            totalProductTaxes: { $sum: { $toDouble: "$metadata._order_tax" } },
            totalShippingTaxes: { $sum: { $toDouble: "$metadata._order_shipping_tax" } },
            totalDiscounts: { $sum: { $toDouble: "$metadata._cart_discount" } },
          },
        },
      ]).toArray();

      const processingOrders = await ordersCollection.countDocuments({
        status: 'processing',
        createdAt: { $gte: start.toISOString(), $lte: end.toISOString() }, // Ensure correct comparison
      });

      const cancelledOrders = await ordersCollection.countDocuments({
        status: 'cancelled',
        createdAt: { $gte: start.toISOString(), $lte: end.toISOString() }, // Ensure correct comparison
      });
      return {
        totalSales: metrics[0]?.totalSales || 0,
        totalOrders: metrics[0]?.totalOrders || 0,
        totalTaxes: metrics[0]?.totalTaxes || 0,
        totalProductTaxes: metrics[0]?.totalProductTaxes || 0,
        totalShippingTaxes: metrics[0]?.totalShippingTaxes || 0,
        totalDiscounts: metrics[0]?.totalDiscounts || 0,
        processingOrders: processingOrders || 0,
        cancelledOrders: cancelledOrders || 0,
      };
    };

    // Fetching global analytics data
    const totalSales = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $toDouble: "$total" } },
        },
      },
    ]).toArray();

    const totalTaxes = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalTaxes: {
            $sum: {
              $add: [
                { $toDouble: "$metadata._order_tax" },
                { $toDouble: "$metadata._order_shipping_tax" },
              ],
            },
          },
        },
      },
    ]).toArray();

    const totalDiscounts = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalDiscounts: { $sum: { $toDouble: "$metadata._cart_discount" } },
        },
      },
    ]).toArray();

    const totalProductTaxes = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalProductTaxes: { $sum: { $toDouble: "$metadata._order_tax" } },
        },
      },
    ]).toArray();

    const totalShippingTaxes = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalShippingTaxes: { $sum: { $toDouble: "$metadata._order_shipping_tax" } },
        },
      },
    ]).toArray();

    // Aggregation for Total Orders
    const totalOrders = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },
      { $count: "totalOrders" },
    ]).toArray();

    // Aggregation for Processing Orders
    const processingOrders = await ordersCollection.aggregate([
      { $match: { status: 'processing' } },
      { $count: "processingOrders" },
    ]).toArray();


    // Date ranges for monthly, weekly, and today
    const { start: startOfMonth, end: endOfMonth } = getDateRange(30);
    const { start: startOfWeek, end: endOfWeek } = getDateRange(7);
    const { start: startOfToday, end: endOfToday } = getDateRange(1);

    const monthlyData = await aggregateMetrics(startOfMonth, endOfMonth);
    const weeklyData = await aggregateMetrics(startOfWeek, endOfWeek);
    const todayData = await aggregateMetrics(startOfToday, endOfToday);
    const monthlyOrders = await aggregateMonthlyOrders();
    const dailyOrders = await aggregateDailyOrders();
    const hourlyOrders = await aggregateLast24HoursOrders();
    // Prepare the analytics response object
    const analytics = {
      totalSales: totalSales[0]?.totalSales || 0,
      totalTaxes: totalTaxes[0]?.totalTaxes || 0,
      totalDiscounts: totalDiscounts[0]?.totalDiscounts || 0,
      totalProductTaxes: totalProductTaxes[0]?.totalProductTaxes || 0,
      totalShippingTaxes: totalShippingTaxes[0]?.totalShippingTaxes || 0,
      totalOrders: totalOrders[0]?.totalOrders || 0,
      processingOrders: processingOrders[0]?.processingOrders || 0, // Total processing orders
      monthlyOrders,
      dailyOrders,
      hourlyOrders,
      total:{
        totalSales: totalSales[0]?.totalSales || 0,
        completedOrders: totalOrders[0]?.totalOrders || 0,
        totalProductTaxes: totalProductTaxes[0]?.totalProductTaxes || 0,
        totalShippingTaxes: totalShippingTaxes[0]?.totalShippingTaxes || 0,
        processingOrders: processingOrders[0]?.processingOrders || 0,
      },
      monthly: {
        totalSales: monthlyData.totalSales,
        completedOrders: monthlyData.totalOrders,
        totalTaxes: monthlyData.totalTaxes,
        totalProductTaxes: monthlyData.totalProductTaxes,
        totalShippingTaxes: monthlyData.totalShippingTaxes,
        totalDiscounts: monthlyData.totalDiscounts,
        processingOrders: monthlyData.processingOrders,
        cancelledOrders: monthlyData.cancelledOrders,
      },
      weekly: {
        totalSales: weeklyData.totalSales,
        completedOrders: weeklyData.totalOrders,
        totalTaxes: weeklyData.totalTaxes,
        totalProductTaxes: weeklyData.totalProductTaxes,
        totalShippingTaxes: weeklyData.totalShippingTaxes,
        totalDiscounts: weeklyData.totalDiscounts,
        processingOrders: weeklyData.processingOrders,
        cancelledOrders: weeklyData.cancelledOrders,
      },
      today: {
        totalSales: todayData.totalSales,
        completedOrders: todayData.totalOrders,
        totalTaxes: todayData.totalTaxes,
        totalProductTaxes: todayData.totalProductTaxes,
        totalShippingTaxes: todayData.totalShippingTaxes,
        totalDiscounts: todayData.totalDiscounts,
        processingOrders: todayData.processingOrders,
        cancelledOrders: todayData.cancelledOrders,
      },
    };

    // Send the analytics response
    res.status(200).json(analytics);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching analytics', error });
  }
};

exports.getShippingMethods = async (req, res) => {
  try {
    const username = process.env.SENDCLOUD_API_USERNAME;
    const password = process.env.SENDCLOUD_API_PASSWORD;

    // Encode the credentials in base64
    const base64Credentials = btoa(`${username}:${password}`);
    // Extract parameters from the request if needed
    const { toCountry = 'NL' } = req.query; // Default to 'NE' if no `to_country` is provided

    const url = `https://panel.sendcloud.sc/api/v2/shipping_methods?to_country=${toCountry}`;
    const options = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${base64Credentials}`,
      },
    };

    // Fetch data from SendCloud API
    const response = await fetch(url, options);

    // Handle response
    if (!response.ok) {
      // Log and handle HTTP errors
      const errorText = await response.text();
      throw new Error(`Error fetching shipping methods: ${errorText}`);
    }

    const data = await response.json();

    // Respond with the shipping methods data
    res.status(200).json(data);

  } catch (error) {
    console.error('Error fetching shipping methods:', error.message);

    // Respond with an error
    res.status(400).json({ message: 'Error fetching shipping methods', error: error.message });
  }
};