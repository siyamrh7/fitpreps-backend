
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
              price: parseFloat((item.meta?._line_total || 0) / (item.meta?._qty || 1)),
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
          $sales_channel_type: "web",
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
    
    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("Error sending event to Facebook:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
async function trackPlacedOrder(orderData, eventId = null) {
  try {
    // Send the event to Converge's API
    const response = await fetch(process.env.CONVERGE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Token": process.env.CONVERGE_TOKEN,
      },
      body: JSON.stringify({
        event_name: "Placed Order",
        event_id: orderData._id.toString(),
        properties: {
          id: orderData._id,
          total_price: parseFloat(orderData.total).toFixed(2),
          total_tax: parseFloat(parseFloat(orderData.metadata._order_tax) + parseFloat(orderData.metadata._order_shipping_tax)).toFixed(2),
          total_shipping: parseFloat(parseFloat(orderData.metadata._order_shipping).toFixed(2) + parseFloat(orderData.metadata._order_shipping_tax).toFixed(2)).toFixed(2),
          currency: "EUR",
          items: orderData.items.map((item) => {
            return {
              product_id: item.meta._id,
              sku: item.meta._id,
              name: item.order_item_name,
              price: parseFloat((item.meta?._line_total || 0) / (item.meta?._qty || 1)),
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
          $is_new_customer: orderData.user_id ? false : true, // Assuming the user is not new,
          $sales_channel_type: "web",
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
    return result;
  } catch (error) {
    console.error("Error sending event to Converge:", error);
  }
}
module.exports = { trackEventController,trackPlacedOrder };