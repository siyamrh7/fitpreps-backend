
// const trackEventController = async (req, res) => {
//   const { event, eventId, content_ids, content_type, value, currency } = req.body;

//   // if (!event || !eventId) {
//   //   return res.status(400).json({ error: 'Missing required fields: event or eventId' });
//   // }

//   const pixelData = {
//     event_name: event,
//     event_time: Math.floor(Date.now() / 1000), // Get current Unix timestamp
//     event_id: eventId, // Unique event ID for deduplication
//     custom_data: {
//       content_ids: content_ids || [],
//       content_type: content_type || 'product',
//       value: value || 0,
//       currency: 'EUR',
//     },
//   };

//   try {
//     // Send the event data to Facebook Pixel API using fetch
//     const response = await fetch(
//       `https://graph.facebook.com/v13.0/${process.env.FACEBOOK_PIXEL_ID}/events`, // Facebook Pixel endpoint
//       {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${process.env.FACEBOOK_ACCESS_TOKEN}`, // Facebook Access Token
//         },
//         body: JSON.stringify({
//           data: [req.body], // Facebook expects an array of events
//           "test_event_code": "TEST49720"

//         }),
//       }
//     );

//     const responseData = await response.json();
//     console.log( responseData);
//     if (response.status === 200) {
//       return res.status(200).json({ message: 'Event tracked successfully', data: responseData });
//     } else {
//       return res.status(response.status).json({ error: 'Failed to track event on Facebook', data: responseData });
//     }
//   } catch (error) {
//     console.error('Error tracking event:', error);
//     return res.status(500).json({ error: 'Error sending event to Facebook Pixel' });
//   }
// };

// module.exports = { trackEventController };
// const trackEventController = async (req, res) => {

//   // Prepare the payload for Facebook
 
//   try {
//     // Send the event to Facebook's API
//     const response = await fetch(`https://graph.facebook.com/v12.0/${process.env.FACEBOOK_PIXEL_ID}/events`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         data: [req.body], // Wrap payload in a "data" array
//         access_token: process.env.FACEBOOK_ACCESS_TOKEN, // Replace with your Facebook Access Token
//         "test_event_code": "TEST49720"
//       }),
//     });

//     const result = await response.json();
//     res.status(200).json({ success: true, result });
//   } catch (error) {
//     console.error("Error sending event to Facebook:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };
const trackEventController = async (req, res) => {

  // Prepare the payload for Facebook
 
  try {
    const {orderData}=req.body
    // Send the event to Facebook's API
    const response = await fetch(process.env.CONVERGE_API,{
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Token": `${process.env.CONVERGE_TOKEN}`, // Add your Converge token here
      },
      body: JSON.stringify({
        event_name: "Placed Order",
        event_id: req.body.event_id, // Your order ID, necessary for deduplication
        properties: {
          id: orderData._id,
          total_price:parseFloat(orderData.total).toFixed(2),//orderData.total,
          total_tax: parseFloat(parseFloat(orderData.metadata._order_tax)+parseFloat(orderData.metadata._order_shipping_tax)).toFixed(2),
          total_shipping:  parseFloat(parseFloat(orderData.metadata._order_shipping).toFixed(2) + parseFloat(orderData.metadata._order_shipping_tax).toFixed(2)).toFixed(2),
          currency: "EUR",
          items: orderData.items.map((item) => {
            return {
              product_id: item.meta._id,
              sku: item.meta._id,
              name: item.order_item_name,
              price: parseFloat(item.meta._line_total).toFixed(2),
              currency: "EUR",
              quantity: parseInt(item.meta._qty),
              vendor: "Fitpreps",
            };
          }),
          $first_name: orderData.metadata._billing_first_name,
          $last_name: orderData.metadata._billing_last_name,
          $email: orderData.metadata._billing_email,
          $phone_number: orderData.metadata._billing_phone,
          $city: orderData.metadata._billing_city,
          $country_code: orderData.metadata._billing_country,
          $state: orderData.metadata._billing_address_1,
          $zip_code: orderData.metadata._billing_postcode,
          $is_new_customer: orderData.user_id ? false : true, // Important
        },
        profile_properties: {
          $first_name: orderData.metadata._billing_first_name,
          $last_name: orderData.metadata._billing_last_name,
          $email: orderData.metadata._billing_email,
          $phone_number: orderData.metadata._billing_phone,
          $city: orderData.metadata._billing_city,
          $country_code: orderData.metadata._billing_country,
          $state: orderData.metadata._billing_address_1,
          $zip_code: orderData.metadata._billing_postcode,
        },
        aliases: [`urn:email:${orderData.metadata._billing_email}`],
      }),
    });

    const result = await response.json();
    console.log(result)
    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("Error sending event to Facebook:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { trackEventController };