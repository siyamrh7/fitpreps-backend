// controllers/orderController.js
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb'); // Import ObjectId to handle MongoDB IDs
const moment = require('moment'); // Import Moment.js to handle dates
const { unserialize } = require('php-serialize');
// Import Pay.nl SDK
var Paynl = require('paynl-sdk');
const emailQueue = require('./emailQueue');
const addUserToKlaviyo = require('./klaviyoController');

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

    // Add user to Klaviyo
    await addUserToKlaviyo(req.body.metadata._billing_email, req.body.metadata._billing_first_name, req.body.metadata._billing_last_name, req.body.metadata._billing_phone, req.body.metadata._billing_city, req.body.metadata._billing_country);

    if (total == 0) {

      const username = process.env.SENDCLOUD_API_USERNAME;
      const password = process.env.SENDCLOUD_API_PASSWORD;

      const orderData = await ordersCollection.findOne({ _id: results.insertedId });
      // Encode the credentials in base64
      const base64Credentials = btoa(`${username}:${password}`);
      // Extract parameters from the request if needed
      const parcelData = {
        parcel: {
          name: orderData.metadata._shipping_first_name + " " + orderData.metadata._shipping_last_name,
          address: orderData.metadata._shipping_address_1 + " " + orderData.metadata._shipping_address_2,
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
          weight: 1.000,
          order_number: orderData._id,
          total_order_value_currency: "EUR",
          total_order_value: orderData.total,
          house_number: orderData.metadata._shipping_address_2,
          parcel_items: orderData.items.map((item) => {
            return {
              description: item.order_item_name,
              quantity: item.meta?._qty,
              value: parseFloat(item.meta?._line_total / item.meta?._qty).toFixed(2),
              weight: item.meta?._weight || 1,
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
      // Fetch data from SendCloud API
      const response = await fetch(url, options);
      // Handle response
      if (!response.ok) {
        // Log and handle HTTP errors
        const errorText = await response.text();
        console.log(errorText)
      }
      await ordersCollection.updateOne(
        { _id: results.insertedId },
        {
          $set: {
            'metadata.transactionId': "No Transaction", // Adds or updates the transactionId in metadata
            status: 'processing',  // Updates status to 'pending' (or awaiting_payment)
            'metadata._customer_ip_address': req.body.ipAddress,
            updatedAt: new Date(), // Updates the updatedAt field with the current timestamp
          },
        }
      );

      setImmediate(async () => {

        await emailQueue.add(
          { orderData, title: "bedankt voor je bestelling!", description: "We hebben je bestelling ontvangen! Je ontvangt van ons een e-mail met Track & Trace code wanneer wij jouw pakket naar de vervoerder hebben verzonden.", emailType: "order" },
          {
            attempts: 3, // Retry up to 3 times in case of failure
            backoff: 5000, // Retry with a delay of 5 seconds
          }
        )
        await emailQueue.add(
          { orderData, title: `${orderData.metadata._billing_first_name} ${orderData.metadata._billing_last_name} placed a order #..${orderData._id.toString().slice(-5)} value ${orderData.total} on Fitpreps`, description: `${orderData.metadata._billing_first_name} placed a new order delivery at ${orderData.metadata._delivery_date}`, emailType: "orderOwner" },
          {
            attempts: 3, // Retry up to 3 times in case of failure
            backoff: 5000, // Retry with a delay of 5 seconds
          }
        )
      }
      );



      // Update the order in your database
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
      if (user) {
        // Add points to user account

        const updatedMoneySpent = (parseFloat(user.metadata._money_spent) || 0) + parseFloat(orderData.total);
        await usersCollection.updateOne(
          { _id: new ObjectId(orderData.user_id) },
          { $set: { "metadata._money_spent": updatedMoneySpent.toString() } }
        );
      }
      //update coupons and redeem points
      const { discountsData } = orderData.metadata; // Assuming couponCode and userId are sent in the request body
      const couponCode = discountsData?.code;
      const redeemPoints = discountsData?.redeemPoints;
      if (couponCode) {
        const couponsCollection = getDB().collection('coupons');
        const coupon = await couponsCollection.findOne({ code: { $regex: new RegExp(`^${couponCode}$`, 'i') }, status: 'publish' });
        if (coupon) {
          // Update coupon usage count
          const updatedUsageCount = (parseInt(coupon.usageCount) || 0) + 1;
          await couponsCollection.updateOne(
            { _id: new ObjectId(coupon._id) },
            { $set: { usageCount: updatedUsageCount } }
          );
          //update coupon totalDiscounts
          var updatedTotalDiscounts = parseFloat(coupon.totalDiscount) + (parseFloat(orderData.metadata._cart_discount) || 0);

          await couponsCollection.updateOne(
            { _id: new ObjectId(coupon._id) },
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
      if (user) {
        // Deduct points from user account
        const updatedPoints = parseInt(user.metadata.woocommerce_reward_points) + parseInt(orderData.total) - redeemPoints;
        await usersCollection.updateOne(
          { _id: new ObjectId(orderData.user_id) },
          { $set: { "metadata.woocommerce_reward_points": parseInt(updatedPoints).toString() } }
        );


      }
      //update stock action
      const modifiedProducts = await productsCollection.bulkWrite(bulkOperations);
      console.log(modifiedProducts);




      return res.status(200).json({
        message: 'Order created successfully',
        paymentUrl: `${process.env.FRONTEND_URI}/payment-success?coupon=true`,

      });
    }
    // Step 3: Process Payment via Pay.nl (if paymentMethod is Pay.nl)
    const ip = req.body.ipAddress || req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || '127.0.0.1';




    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAY_NL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: { value: total * 100, currency: 'EUR' },
        paymentMethod: { input: { countryCode: req.body.metadata._billing_country }, id: null },
        integration: { test: false },
        optimize: { shippingAddress: true, billingAddress: true },
        customer: {
          company: {
            name: req.body.metadata._billing_company,
            country: req.body.metadata._billing_country,
            cocNumber: req.body.metadata._billing_company_kvk,
            vatNumber: req.body.metadata._billing_company_vat
          },
          email: req.body.metadata._billing_email,
          firstName: req.body.metadata._billing_first_name,
          lastName: req.body.metadata._billing_last_name,
          phone: req.body.metadata._billing_phone,
          ipAddress: req.body.ipAddress || ip
        },
        order: {
          deliveryAddress: {
            firstName: req.body.metadata._shipping_first_name,
            lastName: req.body.metadata._shipping_last_name,
            streetNumberExtension: req.body.metadata._shipping_address_2,
            zipCode: req.body.metadata._shipping_postcode,
            city: req.body.metadata._shipping_city,
            country: req.body.metadata._shipping_country,
            street: req.body.metadata._shipping_address_1,
            streetNumber: req.body.metadata._shipping_address_2,
            region: req.body.metadata._shipping_country
          },
          invoiceAddress: {
            firstName: req.body.metadata._billing_first_name,
            lastName: req.body.metadata._billing_last_name,
            streetNumberExtension: req.body.metadata._billing_address_2,
            zipCode: req.body.metadata._billing_postcode,
            city: req.body.metadata._billing_city,
            country: req.body.metadata._billing_country,
            street: req.body.metadata._billing_address_1,
            streetNumber: req.body.metadata._billing_address_2,
            region: req.body.metadata._billing_country
          },
          countryCode: req.body.metadata._billing_country,
          invoiceDate: new Date(),
          deliveryDate: new Date(req.body.metadata._delivery_date),
          products: req.body.items.map((item) => {
            return {
              id: item.meta?._id,
              description: item.order_item_name,
              price: { value: (parseFloat(item.meta?._line_total) / parseInt(item.meta?._qty) * 100).toFixed(2), currency: 'EUR' },
              quantity: item.meta?._qty,
              type: "ARTICLE",
              vatPercentage: 9
            }
          })

        },
        serviceId: process.env.PAY_NL_SERVICE_ID,
        description: `Order: #..${results.insertedId.toString().slice(-5)}`,
        returnUrl: `${process.env.FRONTEND_URI}/payment-success/`,
        exchangeUrl: `https://back.fitpreps.nl/api/orders/paynl`
      })
    };

    const response = await fetch('https://connect.pay.nl/v1/orders', options);

    const data = await response.json();
    if (data) {


      // Successfully started payment
      const paymentUrl = data.links.redirect;
      const transactionId = data.orderId;
      // Update the order with payment URL and transactionId
      await ordersCollection.updateOne(
        { _id: results.insertedId },
        {
          $set: {
            'metadata.transactionId': transactionId, // Adds or updates the transactionId in metadata
            status: 'cancelled',  // Updates status to 'pending' (or awaiting_payment)
            'metadata._customer_ip_address': ip,
          },
        }
      )
      res.json({ paymentUrl, message: 'Order created successfully, proceed to payment', transactionId });
    } else {
      res.status(400).json({ message: 'Error creating order', error: error.message });
    }
    // If the payment is not through Pay.nl, assume another payment method

  } catch (error) {
    console.log(error)
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
        address: orderData.metadata._shipping_address_1 + " " + orderData.metadata._shipping_address_2,
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
        weight: 1.000,
        order_number: orderData._id,
        total_order_value_currency: "EUR",
        total_order_value: orderData.total,
        house_number: orderData.metadata._shipping_address_2,
        parcel_items: orderData.items.map((item) => {
          return {
            description: item.order_item_name,
            quantity: item.meta?._qty,
            value: parseFloat(item.meta?._line_total / item.meta?._qty).toFixed(2),
            weight: item.meta?._weight || 1,
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
        let paymentStatus = orderData.status;
        let paymentMethod = 'UNKNOWN';

        // Determine the payment status
        if (result.isPaid() && orderData.status == "cancelled") {
          paymentStatus = 'processing';
          // Fetch data from SendCloud API
          // const response = await fetch(url, options);


          // // Handle response
          // if (!response.ok) {
          //   // Log and handle HTTP errors
          //   const errorText = await response.text();
          //   console.log(errorText)
          // }
          // await response.json();
        } else if (result.isCanceled()) {
          paymentStatus = 'cancelled';
          // setImmediate(async () => {

          //   await emailQueue.add(
          //     { orderData, title: "Order Failed! Payment is cancelled!", description: "Your order is failed due to your payment cancellation. Here is your order summary! Please try again.", emailType: "order" },
          //     {
          //       attempts: 3, // Retry up to 3 times in case of failure
          //       backoff: 5000, // Retry with a delay of 5 seconds
          //     }
          //   ),
          //     await emailQueue.add(
          //       { orderData, title: `${orderData.metadata._billing_first_name} has cancelled order #..${orderData._id.toString().slice(-5)} on Fitpreps`, description: `${orderData.metadata._billing_first_name} placed a new order`, emailType: "orderOwner" },
          //       {
          //         attempts: 3, // Retry up to 3 times in case of failure
          //         backoff: 5000, // Retry with a delay of 5 seconds
          //       }
          //     )

          // }
          // );
          console.log('Transaction is canceled');
        } else if (result.isAuthorized() && orderData.status == "cancelled") {
          paymentStatus = 'processing';
          const options = {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${process.env.PAY_NL_API_TOKEN}`,
              'Content-Type': 'application/json',
            },

          };

           await fetch(`https://connect.pay.nl/v1/orders/${transactionId}/capture`, options);
        } else if (result.isBeingVerified()) {
          paymentStatus = 'cancelled';

          // setImmediate(async () =>
          //   // orderEmailController(orderData, "You payment in on hold!", "Your order is failed due to your payment. Here is your order summary! Please try again.")
          //   await emailQueue.add(
          //     { orderData, title: "You payment in on hold!", description: "Your order is failed due to your payment. Here is your order summary! Please try again.", emailType: "order" },
          //     {
          //       attempts: 3, // Retry up to 3 times in case of failure
          //       backoff: 5000, // Retry with a delay of 5 seconds
          //     }
          //   )
          // );

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


        if (result.isPaid()  && orderData.status == "cancelled") {

          setImmediate(async () => {

            await emailQueue.add(
              { orderData, title: "bedankt voor je bestelling!", description: "We hebben je bestelling ontvangen! Je ontvangt van ons een e-mail met Track & Trace code wanneer wij jouw pakket naar de vervoerder hebben verzonden.", emailType: "order" },
              {
                attempts: 3, // Retry up to 3 times in case of failure
                backoff: 5000, // Retry with a delay of 5 seconds
              }
            )
            await emailQueue.add(
              { orderData, title: `${orderData.metadata._billing_first_name} ${orderData.metadata._billing_last_name} placed a order #..${orderData._id.toString().slice(-5)} value ${orderData.total} with ${result.paymentDetails?.paymentProfileName || 'UNKNOWN'} on Fitpreps`, description: `${orderData.metadata._billing_first_name} placed a new order delivery at ${orderData.metadata._delivery_date}`, emailType: "orderOwner" },
              {
                attempts: 3, // Retry up to 3 times in case of failure
                backoff: 5000, // Retry with a delay of 5 seconds
              }
            )
          }
          );
          // Fetch data from SendCloud API
          const response = await fetch(url, options);

          // Handle response
          if (!response.ok) {
            // Log and handle HTTP errors
            const errorText = await response.text();
            console.log(errorText)
          }

          // Update the order in your database
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
          if (user) {
            // Add points to user account

            const updatedMoneySpent = (parseFloat(user.metadata._money_spent) || 0) + parseFloat(orderData.total);
            await usersCollection.updateOne(
              { _id: new ObjectId(orderData.user_id) },
              { $set: { "metadata._money_spent": updatedMoneySpent.toString() } }
            );
          }
          //update coupons and redeem points
          const { discountsData } = orderData.metadata; // Assuming couponCode and userId are sent in the request body
          const couponCode = discountsData?.code;
          const redeemPoints = discountsData?.redeemPoints;
          if (couponCode) {
            const couponsCollection = getDB().collection('coupons');
            const coupon = await couponsCollection.findOne({ code: { $regex: new RegExp(`^${couponCode}$`, 'i') }, status: 'publish' });
            if (coupon) {
              // Update coupon usage count
              const updatedUsageCount = (parseInt(coupon.usageCount) || 0) + 1;
              await couponsCollection.updateOne(
                { _id: new ObjectId(coupon._id) },
                { $set: { usageCount: updatedUsageCount } }
              );
              //update coupon totalDiscounts
              var updatedTotalDiscounts = parseFloat(coupon.totalDiscount) + (parseFloat(orderData.metadata._cart_discount) || 0);

              await couponsCollection.updateOne(
                { _id: new ObjectId(coupon._id) },
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
          if (user) {
            // Deduct points from user account
            const updatedPoints = parseInt(user.metadata.woocommerce_reward_points) + parseInt(orderData.total) - redeemPoints;
            await usersCollection.updateOne(
              { _id: new ObjectId(orderData.user_id) },
              { $set: { "metadata.woocommerce_reward_points": parseInt(updatedPoints).toString() } }
            );


          }
          //update stock action
          await productsCollection.bulkWrite(bulkOperations);




        }

        // Send response
        res.status(200).json({
          message: 'Payment status updated successfully',
          transactionId: transactionId,
          status: paymentStatus,
          result,
          paymentMethod: paymentMethod,
          orderData
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





// exports.getPaynlStatus = async (req, res) => {
//   // const options = {
//   //   method: 'PATCH',
//   //   headers: {
//   //     'Authorization': `Bearer ${process.env.PAY_NL_API_TOKEN}`,
//   //     'Content-Type': 'application/json',
//   //   },

//   // };

//   // const response = await fetch(`https://connect.pay.nl/v1/orders/${req.params.id}/capture`, options);
//   const options = {
//     method: 'GET',
//     headers: {
//       'Authorization': `Bearer ${process.env.PAY_NL_API_TOKEN}`,
//       'Content-Type': 'application/json',
//     },

//   };

//   const response = await fetch(`https://connect.pay.nl/v1/orders/${req.params.id}/status`, options);

//   const data = await response.json();
//   console.log(data)
//   res.json(data)
// }
// async function captureOldKlarnaPayments(transactionIds) {
//   for (const transactionId of transactionIds) {

//     try {
//       const options = {
//         method: 'PATCH',
//         headers: {
//           'Authorization': `Bearer ${process.env.PAY_NL_API_TOKEN}`,
//           'Content-Type': 'application/json',
//         },

//       };
//       //All orders after createdAt:  "2025-02-15T11:36:05.188Z"
//       const response = await fetch(`https://connect.pay.nl/v1/orders/${transactionId}/capture`, options);
//       console.log(`Captured Klarna Payment: ${transactionId}`, response.data);
//     } catch (error) {
//       console.error(`Error capturing payment ${transactionId}:`, error.response?.data || error.message);
//     }
//   }
// }
// exports.getPaynlStatus = async (req, res) => {

//   const ordersCollection = getDB().collection('orders');
//   const dateString = "2025-02-15T11:36:05.188Z"; // String comparison

//   const orders = await ordersCollection.find({
//     createdAt: { $gt: dateString },
//     'metadata._payment_method_title': "Klarna"
//   }, { projection: { _id: 1, createdAt: 1, metadata: { transactionId: 1 } } }).toArray();
//   // captureOldKlarnaPayments(orders.map(order => order.metadata.transactionId))
//   console.log(orders.length);

//   res.json(orders)
// }
// async function captureKlarnaPayment(transactionId) {
//   try {
//       const options = {
//           method: "PATCH",
//           headers: {
//               Authorization: `Bearer ${process.env.PAY_NL_API_TOKEN}`,
//               "Content-Type": "application/json",
//           },
//       };

//       const response = await fetch(`https://connect.pay.nl/v1/orders/${transactionId}/capture`, options);
//       const data = await response.json();

//       if (!response.ok) {
//           throw new Error(`Failed to capture ${transactionId}: ${data.message || response.statusText}`);
//       }

//       console.log(`Captured Klarna Payment: ${transactionId}`, data);
//       return { transactionId, success: true, data };
//   } catch (error) {
//       console.error(`Error capturing payment ${transactionId}:`, error.message);
//       return { transactionId, success: false, error: error.message };
//   }
// }

// async function captureOldKlarnaPayments(transactionIds, limit = 10, delayMs = 500) {
//   const results = [];

//   for (let i = 0; i < transactionIds.length; i += limit) {
//       const batch = transactionIds.slice(i, i + limit); // Get a batch of transactions
//       console.log(`Processing batch: ${batch.length} orders`);

//       const batchResults = await Promise.all(batch.map(captureKlarnaPayment));
//       results.push(...batchResults);

//       // Optional: Add a short delay to avoid rate limits
//       console.log(`Waiting ${delayMs}ms before next batch...`);
//       await new Promise(resolve => setTimeout(resolve, delayMs));
//   }

//   console.log("Batch processing completed.");
//   return results;
// }

// // Fetch Klarna orders from DB and capture payments
// exports.getPaynlStatus = async (req, res) => {
//   const ordersCollection = getDB().collection("orders");
//   const dateString = "2025-02-15T11:36:05.188Z"; // Orders created after this date

//   const orders = await ordersCollection
//       .find(
//           {
//               createdAt: { $gt: dateString },
//               "metadata._payment_method_title": "payment_method.klarna.name",
//           },
//           { projection: { _id: 1, createdAt: 1, "metadata.transactionId": 1 } }
//       )
//       .toArray();

//   const transactionIds = orders.map(order => order.metadata.transactionId);

//   console.log(`Total Klarna orders found: ${transactionIds.length}`);

//   if (transactionIds.length > 0) {
//       await captureOldKlarnaPayments(transactionIds, 10, 1100); // Capture in batche
//   }

//   res.json({ totalOrders: orders.length, capturedOrders: transactionIds.length ,orders});
// };

// exports.getPaynlStatus = async (req, res) => {
//   const ordersCollection = getDB().collection("orders");
//   const dateString = "2025-02-15T11:36:05.188Z"; // Orders created after this date

//   const orders = await ordersCollection
//       .find(
//           {
//               createdAt: { $gt: dateString },

//           },
//           { projection: { _id: 1, createdAt: 1, "metadata._payment_method_title": 1 } }
//       )
//       .toArray();

//   const methods = orders.map(order => order.metadata._payment_method_title);

//   console.log(`Total Klarna orders found: ${methods.length}`);



//   res.json({ totalOrders: orders.length, capturedOrders: methods.length ,orders});
// };
// exports.getPaynlStatus = async (req, res) => {
//   const ordersCollection = getDB().collection("orders");
//   const dateString = "2025-02-15T11:36:05.188Z"; // Convert to Date object

//   // Fetch orders in the date range
//   const orders = await ordersCollection
//       .find(
//           { createdAt: { $gt: dateString } },
//           { projection: { "metadata._payment_method_title": 1 } }
//       )
//       .toArray();

//   // Extract payment method titles and get unique value
//   const methods = [...new Set(orders.map(order => order.metadata?._payment_method_title).filter(Boolean))];

//   console.log(`Unique Payment Methods Found:`, methods);

//   res.json({ totalOrders: orders.length, uniquePaymentMethods: methods });
// };

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
      // Directly use the deliveryDate as a string in the query
      query["metadata._delivery_date"] = deliveryDate; // Expecting "2025-01-28" as string in the DB
    }

    // Filter by search query for name or phone
    if (searchQuery) {
      const regex = new RegExp(searchQuery, "i"); // Case-insensitive regex
      const isFullId = /^[0-9a-fA-F]{24}$/.test(searchQuery); // Check if it's a full ObjectId

      query.$or = [
        { "metadata._shipping_first_name": regex },
        { "metadata._shipping_last_name": regex },
        { "metadata._shipping_phone": regex },
      ];

      if (isFullId) {
        // If the search query is a full ObjectId, search directly
        query.$or.push({ _id: new ObjectId(searchQuery) });
      } else {
        // Convert `_id` to a string inside MongoDB and search
        query.$or.push({
          $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: searchQuery, options: "i" } }
        });
      }
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

exports.updatePackingSlipStatus = async (req, res) => {
  try {
    const { orderIds, packingSlipDownloaded } = req.body.data; // Array of order IDs from the request body

    // Validate that orderIds is an array and not empty
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'Order IDs are required and must be an array' });
    }

    // Validate that packingSlipDownloaded is either 'true' or 'false'
    if (packingSlipDownloaded !== 'true' && packingSlipDownloaded !== 'false') {
      return res.status(400).json({ message: 'packingSlipDownloaded must be either true or false' });
    }

    const updatedValue = packingSlipDownloaded === 'true';

    // Ensure all IDs are valid ObjectIds
    const invalidIds = orderIds.filter(id => !ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ message: 'Invalid order ID(s): ' + invalidIds.join(', ') });
    }

    const ordersCollection = getDB().collection('orders');

    // Update the packingSlipDownloaded field of the orders by their IDs
    const result = await ordersCollection.updateMany(
      { _id: { $in: orderIds.map(id => new ObjectId(id)) } },
      { $set: { packingSlipDownloaded: updatedValue } } // Set the new value
    );
    // If no orders were updated, return a message
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'No orders found to update' });
    }

    res.status(200).json({ message: `${result.modifiedCount} orders packing slip updated.` });
  } catch (error) {
    console.error('Error updating packing slip status:', error);
    res.status(500).json({ message: 'Error updating packing slip status', error: error.message });
  }
};



exports.getAnalytics = async (req, res) => {
  try {
    const ordersCollection = getDB().collection('orders');
    
    // Extract date range from request if provided
    const { startDate, endDate } = req.query;
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

    // Aggregation function for sales and orders
    const aggregateMetrics = async (start, end) => {
      const metrics = await ordersCollection.aggregate([
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
            createdAtDate: { $gte: start, $lte: end }, // Compare the converted Date field
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { 
              $sum: { 
                $cond: {
                  if: { $ne: [{ $type: "$total" }, "missing"] },
                  then: { $convert: { input: { $ifNull: ["$total", "0"] }, to: "double", onError: 0 } },
                  else: 0
                }
              } 
            },
            totalOrders: { $sum: 1 },
            totalTaxes: {
              $sum: {
                $add: [
                  { $convert: { input: { $ifNull: ["$metadata._order_tax", "0"] }, to: "double", onError: 0 } },
                  { $convert: { input: { $ifNull: ["$metadata._order_shipping_tax", "0"] }, to: "double", onError: 0 } }
                ],
              },
            },
            totalProductTaxes: { 
              $sum: { $convert: { input: { $ifNull: ["$metadata._order_tax", "0"] }, to: "double", onError: 0 } }
            },
            totalShippingTaxes: { 
              $sum: { $convert: { input: { $ifNull: ["$metadata._order_shipping_tax", "0"] }, to: "double", onError: 0 } }
            },
            totalDiscounts: { 
              $sum: { $convert: { input: { $ifNull: ["$metadata._cart_discount", "0"] }, to: "double", onError: 0 } }
            },
          },
        },
      ]).toArray();

      const processingOrders = await ordersCollection.countDocuments({
        status: 'processing',
        createdAt: { $gte: start.toISOString(), $lte: end.toISOString() },
      });

      const cancelledOrders = await ordersCollection.countDocuments({
        status: 'cancelled',
        createdAt: { $gte: start.toISOString(), $lte: end.toISOString() },
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
          totalSales: { 
            $sum: { $convert: { input: { $ifNull: ["$total", "0"] }, to: "double", onError: 0 } }
          },
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
                { $convert: { input: { $ifNull: ["$metadata._order_tax", "0"] }, to: "double", onError: 0 } },
                { $convert: { input: { $ifNull: ["$metadata._order_shipping_tax", "0"] }, to: "double", onError: 0 } }
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
          totalDiscounts: { 
            $sum: { $convert: { input: { $ifNull: ["$metadata._cart_discount", "0"] }, to: "double", onError: 0 } }
          },
        },
      },
    ]).toArray();

    const totalProductTaxes = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalProductTaxes: { 
            $sum: { $convert: { input: { $ifNull: ["$metadata._order_tax", "0"] }, to: "double", onError: 0 } }
          },
        },
      },
    ]).toArray();

    const totalShippingTaxes = await ordersCollection.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalShippingTaxes: { 
            $sum: { $convert: { input: { $ifNull: ["$metadata._order_shipping_tax", "0"] }, to: "double", onError: 0 } }
          },
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
    //total active subscriptions
    const totalActiveSubscriptions = await getDB().collection('subscriptions').countDocuments({
      status: 'active',
    });
    // Date ranges for monthly, weekly, yearly, and today
    const { start: startOfMonth, end: endOfMonth } = getDateRange('monthly');
    const { start: startOfWeek, end: endOfWeek } = getDateRange('weekly');
    const { start: startOfYear, end: endOfYear } = getDateRange('yearly');
    const { start: startOfToday, end: endOfToday } = getDateRange('today');
    
    // Get custom date range data if provided
    let customData = null;
    if (hasCustomDateRange) {
      const { start: customStart, end: customEnd } = getDateRange('custom');
      customData = await aggregateMetrics(customStart, customEnd);
    }

    const monthlyData = await aggregateMetrics(startOfMonth, endOfMonth);
    const weeklyData = await aggregateMetrics(startOfWeek, endOfWeek);
    const yearlyData = await aggregateMetrics(startOfYear, endOfYear);
    const todayData = await aggregateMetrics(startOfToday, endOfToday);

    // Additional analytics functions (unchanged)
    const aggregateMonthlyOrders = async () => {
      const result = await ordersCollection.aggregate([
        {
          $match: { status: 'completed' }, // Match only completed orders
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
            totalAsNumber: { $convert: { input: { $ifNull: ["$total", "0"] }, to: "double", onError: 0 } },
          },
        },
        {
          $group: {
            _id: { year: "$year", month: "$month" },
            totalOrders: { $sum: "$totalAsNumber" },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 },
        },
      ]).toArray();

      // Map the result to return it as an array of totals for each month
      const monthlyOrders = Array(12).fill(0); // Initialize array with 12 months

      result.forEach(item => {
        if (item._id && item._id.month) {
          const monthIndex = item._id.month - 1; // MongoDB month is 1-based, array is 0-based
          if (monthIndex >= 0 && monthIndex < 12) {
            monthlyOrders[monthIndex] = item.totalOrders;
          }
        }
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
            createdAtDate: { 
              $cond: {
                if: { $eq: [{ $type: "$createdAt" }, "string"] },
                then: { $dateFromString: { dateString: "$createdAt", onError: new Date(0) } },
                else: "$createdAt"
              }
            },
            totalAsNumber: { $convert: { input: { $ifNull: ["$total", "0"] }, to: "double", onError: 0 } },
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
            _id: { createdAtDate: { $dateToString: { format: "%Y-%m-%d", date: "$createdAtDate", onNull: "1970-01-01" } } },
            totalOrders: { $sum: "$totalAsNumber" },
          },
        },
        {
          $sort: { "_id.createdAtDate": 1 },
        },
      ]).toArray();

      // Initialize an array for the last 30 days with zeros
      const dailyOrders = Array(30).fill(0);

      // Populate the dailyOrders array with data from the result
      result.forEach(item => {
        if (item._id && item._id.createdAtDate) {
          // Find the index corresponding to the date in the last30Days array
          const index = last30Days.indexOf(item._id.createdAtDate);

          // If the date is found in the last 30 days, update the corresponding index in the dailyOrders array
          if (index >= 0) {
            dailyOrders[index] = item.totalOrders;
          }
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
            createdAtDate: { 
              $cond: {
                if: { $eq: [{ $type: "$createdAt" }, "string"] },
                then: { $dateFromString: { dateString: "$createdAt", onError: new Date(0) } },
                else: "$createdAt"
              }
            },
            totalAsNumber: { $convert: { input: { $ifNull: ["$total", "0"] }, to: "double", onError: 0 } },
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
            totalValue: { $convert: { input: "$totalValue", to: "int", onError: 0 } }, // Convert the total value to integer
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
        if (item._id && item._id.year && item._id.day && item._id.hour !== undefined) {
          const orderDate = new Date(item._id.year, 0); // Start of the year
          orderDate.setDate(item._id.day); // Add the day of the year
          orderDate.setHours(item._id.hour); // Add the hour

          const diffInHours = Math.floor((now - orderDate) / (1000 * 60 * 60)); // Difference in hours from now

          if (diffInHours >= 0 && diffInHours < 24) {
            const hourIndex = 23 - diffInHours; // Map to the last 24 hours
            hourlyOrders[hourIndex] = item.totalValue; // Set the total value for that hour
          }
        }
      });

      return hourlyOrders;
    };

    // Fetch additional analytics data
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
      processingOrders: processingOrders[0]?.processingOrders || 0, // Total processing order
      totalActiveSubscriptions,
      monthlyOrders,
      dailyOrders,
      hourlyOrders,
      total: {
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
      yearly: {
        totalSales: yearlyData.totalSales,
        completedOrders: yearlyData.totalOrders,
        totalTaxes: yearlyData.totalTaxes,
        totalProductTaxes: yearlyData.totalProductTaxes,
        totalShippingTaxes: yearlyData.totalShippingTaxes,
        totalDiscounts: yearlyData.totalDiscounts,
        processingOrders: yearlyData.processingOrders,
        cancelledOrders: yearlyData.cancelledOrders,
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
    
    // Add custom date range data if available
    if (customData) {
      analytics.custom = {
        totalSales: customData.totalSales,
        completedOrders: customData.totalOrders,
        totalTaxes: customData.totalTaxes,
        totalProductTaxes: customData.totalProductTaxes,
        totalShippingTaxes: customData.totalShippingTaxes,
        totalDiscounts: customData.totalDiscounts,
        processingOrders: customData.processingOrders,
        cancelledOrders: customData.cancelledOrders,
        dateRange: {
          startDate,
          endDate
        }
      };
    }

    // Send the analytics response
    res.status(200).json(analytics);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(400).json({ message: 'Error fetching analytics', error: error.toString() });
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