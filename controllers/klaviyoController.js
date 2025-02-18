const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;
const KLAVIYO_LIST_ID = "XE7Nbr"; // Get from Klaviyo
const KLAVIYO_REVISION = '2025-01-15'; // Set the revision date (use an appropriate recent date)

const createOrUpdateKlaviyoProfile = async (email, firstName, lastName,phone,city,country) => {
    try {
        const response = await fetch('https://a.klaviyo.com/api/profiles/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
                'revision': KLAVIYO_REVISION
            },
            body: JSON.stringify({
                data: {
                    type: "profile",
                    attributes: {
                        email,
                        first_name: firstName || null,
                        last_name: lastName || null,
                        phone_number: phone || null,
                        location: {
                            city: city || null,
                            country: country || null
                        }
                    }
                }
            })
        });

        // const data = await response.json();
        // if (response.ok) {
        //     return data.data.id; // Return the profile ID
        // } else {
        //     console.error('Error creating/updating profile:', data);
        //     return null;
        // }
        return null
    } catch (error) {
        console.error('Error:', error.message);
        return null;
    }
};
// const makeSeoFriendlyUrl = (name) => {
//     return name
//       .toLowerCase()
//       .replace(/[^\p{L}\p{N}\s-]/gu, '') // Remove special characters but retain letters and numbers (Unicode support)
//       .replace(/\s+/g, '-') // Replace spaces with hyphens
//       .replace(/-+/g, '-'); // Replace multiple hyphens with one
//   };
  
// const createKlaviyoOrder = async (orderData) => {
//     try {
//         const data = {
//             data: {
//               type: 'event',
//               attributes: {
//                 properties: {
//                   OrderId: orderData._id,
//                   ItemNames: orderData.items.map((item) => item.order_item_namename),
//                   Items: orderData.items.map((item) => ({
//                     ProductID: item.meta._id,
//                     SKU: item.meta._id,
//                     ProductName: item.order_item_name,
//                     Quantity:item.meta._qty,
//                     ItemPrice: parseFloat(item.meta._line_total/item.meta._qty).toFixed(2),
//                     RowTotal: item.meta._line_total,
//                     ProductURL:`https://fitpreps.nl/product/${makeSeoFriendlyUrl(item.name)}`,
//                     ImageURL: item._thumbnail,
//                 })),
                 
//                   BillingAddress: {
//                     FirstName: orderData.metadata._billing_first_name,
//                     LastName: orderData.metadata._billing_last_name,
//                     Address1: orderData.metadata._billing_address_1,
//                     City: orderData.metadata._billing_city,
//                     CountryCode: orderData.metadata._billing_country,
//                     Zip: '02110',
//                     Phone: '+15551234567',
//                   },
//                   ShippingAddress: {
//                     Address1: '123 Abc St',
//                   },
//                 },
//                 time: '2022-11-08T00:00:00',
//                 value: 29.98,
//                 value_currency: 'EUR',
//                 unique_id: orderData._id,
//                 metric: {
//                   data: {
//                     type: 'metric',
//                     attributes: {
//                       name: 'Placed Order',
//                     },
//                   },
//                 },
//                 profile: {
//                   data: {
//                     type: 'profile',
//                     attributes: {
//                       email: orderData.metadata._billing_email,
//                       phone_number: orderData.metadata._shipping_email,
//                     },
//                   },
//                 },
//               },
//             },
//           };
          
//           const options = {
//             method: 'POST',
//             headers: {
//               'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
//               'Accept': 'application/json',
//               'Content-Type': 'application/json',
//               'Revision': KLAVIYO_REVISION,
//             },
//             body: JSON.stringify(data),
//           };
          
//           await fetch("https://a.klaviyo.com/api/events/", options)
//             .then((response) => response.json())
//             .then((data) => {
//               console.log('Event successfully sent to Klaviyo:', data);
//             })
//             .catch((error) => {
//               console.error('Error sending event to Klaviyo:', error);
//             });
        

//         // const data = await response.json();
//         // if (response.ok) {
//         //     return data.data.id; // Return the profile ID
//         // } else {
//         //     console.error('Error creating/updating profile:', data);
//         //     return null;
//         // }
//         return null
//     } catch (error) {
//         console.error('Error:', error.message);
//         return null;
//     }
// };
const addUserToKlaviyo = async (email, firstName, lastName,phone,city,country) => {
    await createOrUpdateKlaviyoProfile(email, firstName, lastName,phone,city,country);
 
};




module.exports = addUserToKlaviyo;
