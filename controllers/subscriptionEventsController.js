// Function to track Placed Recurring Subscription Order
async function trackPlacedRecurringSubscriptionOrder(orderData, eventId = null) {
  try {
    // Map order items to Converge format
    const items = orderData.items.map(item => ({
      product_id: item.meta?._id || '',
      variant_id: item.meta?.variant_id || '', 
      sku: item.meta?._id || '',
      name: item.order_item_name,
      variant_name: item.meta?.variant_name || '',
      price: parseFloat((item.meta?._line_total || 0) / (item.meta?._qty || 1)),
      currency: "EUR",
      quantity: parseInt(item.meta?._qty || 1),
      vendor: "Fitpreps",
    }));

    // Calculate order totals from metadata
    const totalTax = parseFloat(orderData.metadata._order_tax || 0) + 
                     parseFloat(orderData.metadata._order_shipping_tax || 0);
    
    const totalShipping = parseFloat(orderData.metadata._order_shipping || 0) + 
                          parseFloat(orderData.metadata._order_shipping_tax || 0);

    const payload = {
      event_name: "Placed Recurring Subscription Order",
      event_id: eventId || orderData._id.toString(),
      properties: {
        id: orderData._id.toString(),
        total_price: parseFloat(orderData.total),
        total_tax: totalTax,
        total_shipping: totalShipping,
        total_discount: parseFloat(orderData.metadata._cart_discount || 0),
        coupon: '',
        currency: "EUR",
        items,
        $first_name: orderData.metadata._shipping_first_name,
        $last_name: orderData.metadata._shipping_last_name,
        $email: orderData.metadata._shipping_email,
        $phone_number: orderData.metadata._shipping_phone,
        $city: orderData.metadata._shipping_city,
        $country_code: orderData.metadata._shipping_country,
        $state: orderData.metadata._shipping_state || '',
        $zip_code: orderData.metadata._shipping_postcode,
        $sales_channel_type: "subscription_contract",
        delivery_date: orderData.metadata._delivery_date,
        delivery_time: orderData.metadata._delivery_time,
      },
      profile_properties: {
        $first_name: orderData.metadata._shipping_first_name,
        $last_name: orderData.metadata._shipping_last_name,
        $email: orderData.metadata._shipping_email,
        $phone_number: orderData.metadata._shipping_phone,
        $city: orderData.metadata._shipping_city,
        $country_code: orderData.metadata._shipping_country,
        $state: orderData.metadata._shipping_state || '',
        $zip_code: orderData.metadata._shipping_postcode,
      },
      aliases: [`urn:email:${orderData.metadata._shipping_email}`],
    };

    const response = await fetch(process.env.CONVERGE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Token": process.env.CONVERGE_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error sending subscription event to Converge:", error);
    
  }
}

// Function to track Started Subscription
async function trackStartedSubscription(subscriptionData, eventId = null) {
  try {
    // Map items if available
    const items = subscriptionData.items?.map(item => ({
      product_id: item.meta?._id || '',
      variant_id: item.meta?.variant_id || '',
      sku: item.meta?._id || '',
      name: item.order_item_name || 'Subscription Plan',
      variant_name: item.meta?.variant_name || '',
      price: subscriptionData.amountPerCycle,
      currency: "EUR", 
      quantity: 1,
      vendor: "Fitpreps",
    })) || [{
      product_id: subscriptionData._id.toString(),
      sku: subscriptionData._id.toString(),
      name: `${subscriptionData.frequency.charAt(0).toUpperCase() + subscriptionData.frequency.slice(1)} Subscription Plan`,
      price: subscriptionData.amountPerCycle,
      currency: "EUR",
      quantity: 1,
      vendor: "Fitpreps",
    }];

    const payload = {
      event_name: "Started Subscription",
      event_id: eventId || subscriptionData._id.toString(),
      properties: {
        id: subscriptionData._id.toString(),
        total_price: subscriptionData.amountPerCycle,
        total_tax: 0, // Add if available in your data
        total_shipping: 0, // Add if available in your data
        currency: "EUR",
        items,
        $first_name: subscriptionData.data._shipping_first_name,
        $last_name: subscriptionData.data._shipping_last_name,
        $email: subscriptionData.data._shipping_email,
        $phone_number: subscriptionData.data._shipping_phone,
        $city: subscriptionData.data._shipping_city,
        $country_code: subscriptionData.data._shipping_country,
        $state: subscriptionData.data._shipping_state || '',
        $zip_code: subscriptionData.data._shipping_postcode,
        $sales_channel_type: "subscription_contract",
        frequency: subscriptionData.frequency,
        payment_status: subscriptionData.paymentStatus,
        start_date: subscriptionData.startDate,
      },
      profile_properties: {
        $first_name: subscriptionData.data._shipping_first_name,
        $last_name: subscriptionData.data._shipping_last_name,
        $email: subscriptionData.data._shipping_email,
        $phone_number: subscriptionData.data._shipping_phone,
        $city: subscriptionData.data._shipping_city,
        $country_code: subscriptionData.data._shipping_country,
        $state: subscriptionData.data._shipping_state || '',
        $zip_code: subscriptionData.data._shipping_postcode,
      },
      aliases: [`urn:email:${subscriptionData.data._shipping_email}`],
    };

    const response = await fetch(process.env.CONVERGE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Token": process.env.CONVERGE_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error sending started subscription event to Converge:", error);
    
  }
}

// Function to track Cancelled Subscription
async function trackCancelledSubscription(subscriptionData, eventId = null) {
  try {
    // Create default item if items not available
    const items = subscriptionData.items?.map(item => ({
      product_id: item.meta?._id || '',
      variant_id: item.meta?.variant_id || '',
      sku: item.meta?._id || '',
      name: item.order_item_name || 'Subscription Plan',
      variant_name: item.meta?.variant_name || '',
      price: subscriptionData.amountPerCycle,
      currency: "EUR",
      quantity: 1,
      vendor: "Fitpreps",
    })) || [{
      product_id: subscriptionData._id.toString(),
      sku: subscriptionData._id.toString(),
      name: `${subscriptionData.frequency.charAt(0).toUpperCase() + subscriptionData.frequency.slice(1)} Subscription Plan`,
      price: subscriptionData.amountPerCycle,
      currency: "EUR",
      quantity: 1,
      vendor: "Fitpreps",
    }];

    const payload = {
      event_name: "Cancelled Subscription",
      event_id: eventId || subscriptionData._id.toString(),
      properties: {
        id: subscriptionData._id.toString(),
        total_price: subscriptionData.amountPerCycle,
        total_tax: 0, // Add if available in your data
        total_shipping: 0, // Add if available in your data
        currency: "EUR",
        items,
        $first_name: subscriptionData.data._shipping_first_name,
        $last_name: subscriptionData.data._shipping_last_name,
        $email: subscriptionData.data._shipping_email,
        $phone_number: subscriptionData.data._shipping_phone,
        $city: subscriptionData.data._shipping_city,
        $country_code: subscriptionData.data._shipping_country,
        $state: subscriptionData.data._shipping_state || '',
        $zip_code: subscriptionData.data._shipping_postcode,
        $sales_channel_type: "subscription_contract",
        frequency: subscriptionData.frequency,
        status: subscriptionData.status,
        cancellation_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
      },
      profile_properties: {
        $first_name: subscriptionData.data._shipping_first_name,
        $last_name: subscriptionData.data._shipping_last_name,
        $email: subscriptionData.data._shipping_email,
        $phone_number: subscriptionData.data._shipping_phone,
        $city: subscriptionData.data._shipping_city,
        $country_code: subscriptionData.data._shipping_country,
        $state: subscriptionData.data._shipping_state || '',
        $zip_code: subscriptionData.data._shipping_postcode,
      },
      aliases: [`urn:email:${subscriptionData.data._shipping_email}`],
    };

    const response = await fetch(process.env.CONVERGE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Token": process.env.CONVERGE_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error sending cancelled subscription event to Converge:", error);
    
  }
}

// Export all functions
module.exports = { 
  trackPlacedRecurringSubscriptionOrder, 
  trackStartedSubscription, 
  trackCancelledSubscription 
};
