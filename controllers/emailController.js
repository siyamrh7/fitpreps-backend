require('dotenv').config();
const puppeteer = require("puppeteer");
const fs = require('fs');
const path = require('path');

const msal = require('@azure/msal-node');

// const clientSecret = process.env.CLIENT_SECRET;
// const clientId = process.env.CLIENT_ID;
// const tenantId = process.env.TENANT_ID;
 const clientSecret = "AKX8Q~rVIPiMiqjFc69ci9xhfuJyGrV0ibz~4bZT";
const clientId = "aa6579a0-74c7-4736-81e3-71ce0b00883f";
const tenantId = "03158f2f-6310-495a-9653-1ddaabcd3b2b";
const aadEndpoint =
  process.env.AAD_ENDPOINT || 'https://login.microsoftonline.com';
const graphEndpoint =
  process.env.GRAPH_ENDPOINT || 'https://graph.microsoft.com';

const msalConfig = {
  auth: {
    clientId,
    clientSecret,
    authority: aadEndpoint + '/' + tenantId,
  },
};

const tokenRequest = {
  scopes: [graphEndpoint + '/.default'],
};

let tokenCache = null;

const getAccessToken = async () => {
  // Check if token exists and is not expired
  if (!tokenCache || new Date(tokenCache.expiresOn) <= new Date()) {
    console.log("token_expired requesting new token")
    const cca = new msal.ConfidentialClientApplication(msalConfig);
    const tokenInfo = await cca.acquireTokenByClientCredential(tokenRequest);

    tokenCache = {
      accessToken: tokenInfo.accessToken,
      expiresOn: tokenInfo.expiresOn, // Use expiresOn from tokenInfo
      extExpiresOn: tokenInfo.extExpiresOn, // Optional: track extended expiry
    };
  }
  return tokenCache.accessToken;
};

async function generatePdfBuffer(htmlContent) {
  // Launch Puppeteer to render the HTML to a PDF
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Set the HTML content
  await page.setContent(htmlContent);

  // Generate the PDF as a buffer
  const pdfBuffer = await page.pdf({ format: "A4" });

  // Close Puppeteer
  await browser.close();

  return pdfBuffer;
}

exports.contactEmailController = async (mailOptions) => {
  try {
    const accessToken = await getAccessToken();

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: mailOptions, saveToSentItems: false }),
    };

    await fetch(
      `${graphEndpoint}/v1.0/users/info@fitpreps.nl/sendMail`,
      options
    );
  } catch (error) {
    console.error(`Error sending email of contact email.`, error)
  }
}

exports.requestPasswordResetController = async (mailOptions) => {
  try {
    const accessToken = await getAccessToken();

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: mailOptions, saveToSentItems: false }),
    };

    await fetch(
      `${graphEndpoint}/v1.0/users/info@fitpreps.nl/sendMail`,
      options
    );
  } catch (error) {
    console.error(error);
  }
};


exports.newAccountEmailController = async (user, password) => {
  try {
    var html = `<div style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; padding: 0; margin: 0;">
        <tr>
            <td align="center" style="background-color: #ffffff; padding: 40px;">
                <table width="600px" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    <!-- Header Section -->
                    <tr>
                        <td style="background-color: #ff6600; padding: 20px; text-align: center;">
                            <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Welkom bij Fitpreps</h1>
                        </td>
                    </tr>
                    
                    <!-- Content Section -->
                    <tr>
                        <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                            <p style="margin: 0 0 15px 0;">Hey <strong>${user.metadata.first_name}</strong>, Bedankt voor het aanmaken van een account bij Fitpreps.</p>
                            <p style="margin: 0 0 15px 0;"><strong>Je email is:</strong> ${user.email}</p>
                        <p style="margin: 0 0 15px 0;"><strong>Je wachtwoord is:</strong> ${password}</p>

                        </td>
                    </tr>
                    
                    <!-- Button Section -->
                    <tr>
                        <td align="center" style="padding: 20px;">
                            <a href="https://fitpreps.nl" style="display: inline-block; background-color: #ff9900; color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 16px; font-weight: bold; border-radius: 5px;">Naar mijn account</a>
                        </td>
                    </tr>
                    
                    <!-- Footer Section -->
                    <tr>
                        <td align="center" style="background-color: #ff6600; padding: 20px; color: #ffffff; font-size: 14px; line-height: 1.6;">
                            <p style="margin: 0;">Volg ons op</p>
                            <p style="margin: 10px 0;">
                                <a href="https://www.facebook.com/FitPrepsOfficial" style="text-decoration: none; color: #ffffff; margin-right: 10px;">
                                    <img src="https://cdn-icons-png.flaticon.com/512/1384/1384005.png" alt="Facebook" style="width: 24px; height: 24px; vertical-align: middle;">
                                </a>
                                <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="text-decoration: none; color: #ffffff;">
                                    <img src="https://cdn-icons-png.flaticon.com/512/1384/1384015.png" alt="Instagram" style="width: 24px; height: 24px; vertical-align: middle;">
                                </a>
                            </p>
                            <p style="margin: 10px 0;">Deze email is verzonden door: <a href="mailto:info@fitpreps.nl" style="text-decoration: underline; color: #ffffff;">info@fitpreps.nl</a></p>
                            <p style="margin: 10px 0;">Stuur voor vragen een e-mail naar: <a href="mailto:info@fitpreps.nl" style="text-decoration: underline; color: #ffffff;">info@fitpreps.nl</a></p>
                            <p style="margin: 0;">
                                <a href="https://fitpreps.nl/privacy-policy" style="text-decoration: underline; color: #ffffff; margin-right: 10px;">Privacy policy</a> 
                                <a href="https://fitpreps.nl/klantenservice" style="text-decoration: underline; color: #ffffff;">Klantenservice</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</div>`
    const mailOptions = {
      subject: `Bedankt voor het aanmaken van een account bij Fit Preps`,
      //This "from" is optional if you want to send from group email. For this you need to give permissions in that group to send emails from it.
      from: {
        emailAddress: {
          address: 'bestellingen@fitpreps.nl',
        },
      },
      toRecipients: [
        {
          emailAddress: {
            address: user.email,
          },
        },
      ],
      body: {
        content: html,
        contentType: 'html',
      },
      replyTo: [{
        emailAddress: {
          address: 'info@fitpreps.nl',
        }
      }],
    };
    const accessToken = await getAccessToken();

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: mailOptions, saveToSentItems: false }),
    };

    await fetch(
      `${graphEndpoint}/v1.0/users/info@fitpreps.nl/sendMail`,
      options
    );
    // const mailOptions = {
    //   from: email,
    //   to: user.email,
    //   subject: 'Bedankt voor het aanmaken van een account bij Fit Preps',
    //   html,
    // }
    // await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(error);
  }
};



exports.orderEmailController = async (orderData, title, description) => {
  console.log(title)
  try {
 
    if (!orderData) {
      return res.status(400).send({ error: "Email and message are required." });
    }

    const productHTML2 = orderData.items
      .map(
        (item, index) => `
    <tr >
                                    <td
                                        style={{
                                            border: "1px solid #000",
                                            padding: "8px",
                                        }}
                                    >
                                        ${index + 1}
                                    </td>

                                    <td
                                        style={{
                                            border: "1px solid #000",
                                            padding: "8px",
                                        }}
                                    >
                                        ${item.order_item_name}
                                    </td>
                                    <td
                                        style={{
                                            border: "1px solid #000",
                                            padding: "8px",
                                        }}
                                    >
                                        ${item.meta?._qty}
                                    </td>
                                    <td
                                        style={{
                                            border: "1px solid #000",
                                            padding: "8px",
                                        }}
                                    >
                                        €${parseFloat(item.meta?._line_total / item.meta?._qty).toFixed(2)}
                                    </td>
                                    <td
                                        style={{
                                            border: "1px solid #000",
                                            padding: "8px",
                                        }}
                                    >
                                        €
                                        ${parseFloat(item.meta._line_total).toFixed(2)}

                                    </td>
                                </tr>
    `
      )
      .join(''); // Combine all product divs into a single string
    const htmlContent = `
   <!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
        font-size: 14px;
        color: #000;
        padding: 0px;
        margin: 0 auto;
        width: 800px;
        padding:20px;
      }

      h1 {
        text-align: center;
        font-size: 22px;
        font-weight: bold;
        margin-bottom: 10px;
      }

      .divider {
        border-bottom: 1px solid #000;
        margin-bottom: 10px;
        padding-bottom: 5px;
      }

      .flex-container {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .section {
        width: 33%;
      }

      .section p {
        margin: 0;
      }

      .table-container table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }

      .table-container th,
      .table-container td {
        border: 1px solid #000;
        padding: 8px;
        text-align: left;
      }

      .summary {
        text-align: right;
      }

      .summary p {
        margin: 0;
      }

      .summary strong {
        color: #000;
      }

      h3 {
        color: #000;
        margin: 0;
      }
        p {
          margin:0px;
        }
    </style>
  </head>
  <body>
    <div>
      <h1>Fitpreps - Factuur</h1>
      <div class="divider"></div>
      <div class="flex-container">
        <div>
          <p style="font-weight: bold;">Order no. ${orderData._id}</p>
          <p>Order Date: ${new Date(orderData.createdAt).toLocaleDateString('en-US')}</p>
          <p>Shipping Date: ${orderData.metadata?._delivery_date}</p>
        </div>
        <div>
          <p style="font-weight: bold;">Factuur no. ${orderData._id}</p>
          <p>Payment Method: ${orderData.metadata?._payment_method_title}</p>
          <p>Order Status: ${orderData.status}</p>
        </div>
      </div>
      <div class="flex-container">
        <div class="section">
          <p style="font-weight: bold; text-decoration: underline;">From</p>
          <p>Factuur adres: Fitpreps B.V.</p>
          <p>Textielweg 19 - 3812RV -</p>
          <p>Amersfoort</p>
          <p>Info@fitpreps.nl - KvK: 86576291 -</p>
          <p>Btw: NL864011507B01</p>
        </div>
        <div class="section">
          <p style="font-weight: bold; text-decoration: underline;">Bill to</p>
          
          <p>${orderData.metadata._billing_first_name} ${orderData.metadata._billing_last_name}</p>
          <p>${orderData.metadata._billing_address_1} ${orderData.metadata._billing_address_2}</p>
          <p>${orderData.metadata._billing_postcode} ${orderData.metadata._billing_city}</p>
          <p>Email: ${orderData.metadata._billing_email}</p>
          <p>Phone: ${orderData.metadata._billing_phone}</p>
          <p style="margin: 0;">${orderData.metadata._billing_company} KvK: ${orderData.metadata._billing_company_kvk}</p>
          <p style="margin: 0;">Btw: ${orderData.metadata._billing_company_vat}</p>
        </div>
        <div class="section">
          <p style="font-weight: bold; text-decoration: underline;">Ship to</p>
          <p>${orderData.metadata._shipping_first_name} ${orderData.metadata._shipping_last_name}</p>
          <p>${orderData.metadata._shipping_address_1} ${orderData.metadata._shipping_address_2}</p>
          <p>${orderData.metadata._shipping_postcode} ${orderData.metadata._shipping_city}</p>
          <p>Email: ${orderData.metadata._shipping_email}</p>
          <p>Phone: ${orderData.metadata._shipping_phone}</p>
        </div>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Product</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${productHTML2}
          </tbody>
        </table>
      </div>
      <br />
      <div class="summary">
        <p>
          <strong>Subtotal:</strong>
          €${(parseFloat(orderData.total) -
        (parseFloat(orderData.metadata._order_shipping) +
          parseFloat(orderData.metadata._order_shipping_tax))).toFixed(2)}
        </p>
        <p>
          <strong>Shipping Cost:</strong>
          €${(parseFloat(orderData.metadata._order_shipping) +
        parseFloat(orderData.metadata._order_shipping_tax)).toFixed(2)}
        </p>
        <p>
          <strong>Order Tax:</strong> €${parseFloat(orderData.metadata._order_tax).toFixed(2)}
        </p>
        <p>
          <strong>Shipping Tax:</strong> €${parseFloat(orderData.metadata._order_shipping_tax).toFixed(2)}
        </p>
        <p>
          <strong>Total Tax:</strong>
          €${(parseFloat(orderData.metadata._order_tax) +
        parseFloat(orderData.metadata._order_shipping_tax)).toFixed(2)}
        </p>
        <p>
          <strong>Discount:</strong> -€
          ${parseFloat(orderData.metadata._cart_discount).toFixed(2)}
        </p>
        <h3>
          <strong>Total:</strong> €${parseFloat(orderData.total).toFixed(2)}
        </h3>
      </div>
    </div>
       
  </body>
</html>

`;

 // Step 1: Generate PDF buffer from HTML content
 const pdfBuffer = await generatePdfBuffer(htmlContent);

 // Step 2: Create a temporary PDF file in the 'uploads' folder
 const pdfFilePath = path.join(path.resolve(__dirname, '../uploads'), `${orderData._id}.pdf`);
 fs.writeFileSync(pdfFilePath, pdfBuffer);

 // Step 3: Prepare the email attachments
 const attachments = [
   {
     '@odata.type': '#microsoft.graph.fileAttachment',
     name: "Factuur_" + orderData._id + ".pdf",
     contentType: 'application/pdf',
     contentBytes: fs.readFileSync(pdfFilePath).toString('base64'),
   },
 ];
 
    
    const productHTML = orderData.items
      .map(
        (product) => `
      <div style="display: flex; margin-bottom: 10px;">
        <img src="${product.meta._thumbnail.replace("http://localhost:5001", "https://backend.fitpreps.nl")}" alt="${product.order_item_name}" style="width: 100px; height: 75px; margin-right: 10px; border: 1px solid #dddddd;">
        <div>
          <p style="margin: 0; font-size: 16px;"><strong>${product.order_item_name}</strong></p>
          <p style="margin: 5px 0 0; font-size: 14px;">Aantal: ${product.meta._qty}</p>
        </div>
        <p style="margin: 0 0 0 auto; font-size: 16px; font-weight: bold;">€ ${parseFloat(product.meta._line_total).toFixed(2)}</p>
      </div>
    `
      )
      .join(''); // Combine all product divs into a single string
    const html = `<div style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333;">
<div style="max-width: 600px; margin: 0 auto; border: 1px solid #dddddd;">
  <!-- Header -->
  <div style="background-color: #ff4e00; padding: 10px;">
    <h1 style="margin: 0; font-size: 18px; text-align: center; color: #ffffff;">${title}</h1>
  </div>
  
  <!-- Content -->
  <div style="padding: 20px;">
    <p style="margin: 0; font-size: 16px;">
      Beste ${orderData.metadata._billing_first_name}, ${title} <br><br>
      ${description}
    </p>
    
    <h2 style="margin-top: 20px; font-size: 18px;">Overzicht van jouw bestelling met referentie #${orderData._id}</h2>

    <!-- Order Details -->
    <div style="border-bottom: 1px solid #dddddd; padding-bottom: 15px; margin-bottom: 15px;">
    ${productHTML}
    </div>

    <!-- Summary -->
    <table style="width: 100%; font-size: 16px; margin-bottom: 20px;">
      <tr>
        <td style="padding: 5px 0;">Subtotaal</td>
        <td style="padding: 5px 0; text-align: right;">€ ${(parseFloat(orderData.total) - (parseFloat(orderData.metadata._order_shipping) + parseFloat(orderData.metadata._order_shipping_tax))).toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0;">Korting</td>
        <td style="padding: 5px 0; text-align: right;">-€ ${orderData.metadata._cart_discount}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0;">Verzending</td>
        <td style="padding: 5px 0; text-align: right;">€ ${orderData.metadata._order_shipping == "0" ? "Gratis" : (parseFloat(orderData.metadata._order_shipping) + parseFloat(orderData.metadata._order_shipping_tax)).toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0; font-weight: bold;">Totaal</td>
        <td style="padding: 5px 0; text-align: right; font-weight: bold;">€ ${orderData.total}</td>
      </tr>
    </table>

    <!-- Addresses -->
    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 20px;">
      <div style="width: 50%;">
        <h3 style="margin: 0; font-size: 16px;">Factuuradres</h3>
        <p style="margin: 5px 0 0;">${orderData.metadata._billing_first_name} ${orderData.metadata._billing_last_name}<br>${orderData.metadata._billing_address_1}<br>${orderData.metadata._billing_address_2}<br>${orderData.metadata._billing_postcode} ${orderData.metadata._billing_city}<br>${orderData.metadata._billing_country}<br>${orderData.metadata._billing_phone}<br>${orderData.metadata._billing_email}</p>
      </div>
      <div>
        <h3 style="margin: 0; font-size: 16px;">Verzendadres</h3>
        <p style="margin: 5px 0 0;">${orderData.metadata._shipping_first_name} ${orderData.metadata._shipping_last_name}<br>${orderData.metadata._shipping_address_1}<br>${orderData.metadata._shipping_address_2}<br>${orderData.metadata._shipping_postcode} ${orderData.metadata._shipping_city}<br>${orderData.metadata._shipping_country}<br>${orderData.metadata._shipping_phone}</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #dddddd; padding-top: 15px;">
      <p style="margin: 0; font-size: 14px;">Volg ons op</p>
      <p style="margin: 10px 0;">
        <a href="https://www.facebook.com/FitPrepsOfficial" style="margin: 0 5px; text-decoration: none; color: #333;"><img height="20px" width="20px" src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/2048px-2021_Facebook_icon.svg.png" alt="Facebook"></a>
        <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="margin: 0 5px; text-decoration: none; color: #333;"><img height="20px" width="20px" src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/600px-Instagram_icon.png?20200512141346" alt="Instagram"></a>
      </p>
      <p style="margin: 0; font-size: 14px;">Deze email is verzonden door: info@fitpreps.nl</p>
      <p style="margin: 0; font-size: 14px;">Stuur voor vragen een e-mail naar: <a href="mailto:info@fitpreps.nl" style="color: #ff4e00;">info@fitpreps.nl</a></p>
      <p style="margin: 0; font-size: 14px;"><a href="https://fitpreps.nl" style="color: #ff4e00;">Privacy policy</a> | <a href="https://fitpreps.nl" style="color: #ff4e00;">Klantenservice</a></p>
    </div>
  </div>
</div>
</div>
  `


    const mailOptions = {
      subject: `Fitpreps.nl: Nieuwe bestelling #${orderData._id}`,
      //This "from" is optional if you want to send from group email. For this you need to give permissions in that group to send emails from it.
      from: {
        emailAddress: {
          address: 'bestellingen@fitpreps.nl',
        },
      },
      toRecipients: [
        {
          emailAddress: {
            address: orderData.metadata._billing_email,
          },
        },
      ],
      body: {
        content: html,
        contentType: 'html',
      },
      replyTo: [{
        emailAddress: {
          address: 'info@fitpreps.nl',
        }
      }],
      attachments,
    };
   

    // Send email
    const accessToken = await getAccessToken();

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: mailOptions, saveToSentItems: false }),
    };

    const response = await fetch(
      `${graphEndpoint}/v1.0/users/info@fitpreps.nl/sendMail`,
      options
    );
    if (!response.ok) {
      const error = await response.json();
      console.error('Error sending email:', error);
    } else {
      fs.unlinkSync(pdfFilePath);
      console.log('Email sent successfully!');
    }    
  } catch (error) {
    console.log("Error sending email:", error);
  }
};

exports.orderEmailController2 = async (orderData, title, description) => {

  try {
   
    if (!orderData) {
      return res.status(400).send({ error: "Email and message are required." });
    }

    const productHTML2 = orderData.items
      .map(
        (item, index) => `
    <tr >
                                    <td
                                        style={{
                                            border: "1px solid #000",
                                            padding: "8px",
                                        }}
                                    >
                                        ${index + 1}
                                    </td>

                                    <td
                                        style={{
                                            border: "1px solid #000",
                                            padding: "8px",
                                        }}
                                    >
                                        ${item.order_item_name}
                                    </td>
                                    <td
                                        style={{
                                            border: "1px solid #000",
                                            padding: "8px",
                                        }}
                                    >
                                        ${item.meta?._qty}
                                    </td>
                                    <td
                                        style={{
                                            border: "1px solid #000",
                                            padding: "8px",
                                        }}
                                    >
                                        €${parseFloat(item.meta?._line_total / item.meta?._qty).toFixed(2)}
                                    </td>
                                    <td
                                        style={{
                                            border: "1px solid #000",
                                            padding: "8px",
                                        }}
                                    >
                                        €
                                        ${parseFloat(item.meta._line_total).toFixed(2)}

                                    </td>
                                </tr>
    `
      )
      .join(''); // Combine all product divs into a single string
    const htmlContent = `
   <!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
        font-size: 14px;
        color: #000;
        padding: 0px;
        margin: 0 auto;
        width: 800px;
        padding:20px;
      }

      h1 {
        text-align: center;
        font-size: 22px;
        font-weight: bold;
        margin-bottom: 10px;
      }

      .divider {
        border-bottom: 1px solid #000;
        margin-bottom: 10px;
        padding-bottom: 5px;
      }

      .flex-container {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .section {
        width: 33%;
      }

      .section p {
        margin: 0;
      }

      .table-container table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }

      .table-container th,
      .table-container td {
        border: 1px solid #000;
        padding: 8px;
        text-align: left;
      }

      .summary {
        text-align: right;
      }

      .summary p {
        margin: 0;
      }

      .summary strong {
        color: #000;
      }

      h3 {
        color: #000;
        margin: 0;
      }
        p {
          margin:0px;
        }
    </style>
  </head>
  <body>
    <div>
      <h1>Fitpreps - Factuur</h1>
      <div class="divider"></div>
      <div class="flex-container">
        <div>
          <p style="font-weight: bold;">Order no. ${orderData._id}</p>
          <p>Order Date: ${new Date(orderData.createdAt).toLocaleDateString('en-US')}</p>
          <p>Shipping Date: ${orderData.metadata?._delivery_date}</p>
        </div>
        <div>
          <p style="font-weight: bold;">Factuur no. ${orderData._id}</p>
          <p>Payment Method: ${orderData.metadata?._payment_method_title}</p>
          <p>Order Status: ${orderData.status}</p>
        </div>
      </div>
      <div class="flex-container">
        <div class="section">
          <p style="font-weight: bold; text-decoration: underline;">From</p>
           <p>Factuur adres: Fitpreps B.V.</p>
          <p>Textielweg 19 - 3812RV -</p>
          <p>Amersfoort</p>
          <p>Info@fitpreps.nl - KvK: 86576291 -</p>
          <p>Btw: NL864011507B01</p>
        </div>
        <div class="section">
          <p style="font-weight: bold; text-decoration: underline;">Bill to</p>
          
          <p>${orderData.metadata._billing_first_name} ${orderData.metadata._billing_last_name}</p>
          <p>${orderData.metadata._billing_address_1} ${orderData.metadata._billing_address_2}</p>
          <p>${orderData.metadata._billing_postcode} ${orderData.metadata._billing_city}</p>
          <p>Email: ${orderData.metadata._billing_email}</p>
          <p>Phone: ${orderData.metadata._billing_phone}</p>
          <p style="margin: 0;">${orderData.metadata._billing_company} KvK: ${orderData.metadata._billing_company_kvk}</p>
          <p style="margin: 0;">Btw: ${orderData.metadata._billing_company_vat}</p>
        </div>
        <div class="section">
          <p style="font-weight: bold; text-decoration: underline;">Ship to</p>
          <p>${orderData.metadata._shipping_first_name} ${orderData.metadata._shipping_last_name}</p>
          <p>${orderData.metadata._shipping_address_1} ${orderData.metadata._shipping_address_2}</p>
          <p>${orderData.metadata._shipping_postcode} ${orderData.metadata._shipping_city}</p>
          <p>Email: ${orderData.metadata._shipping_email}</p>
          <p>Phone: ${orderData.metadata._shipping_phone}</p>
        </div>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Product</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${productHTML2}
          </tbody>
        </table>
      </div>
      <br />
      <div class="summary">
        <p>
          <strong>Subtotal:</strong>
          €${(parseFloat(orderData.total) -
        (parseFloat(orderData.metadata._order_shipping) +
          parseFloat(orderData.metadata._order_shipping_tax))).toFixed(2)}
        </p>
        <p>
          <strong>Shipping Cost:</strong>
          €${(parseFloat(orderData.metadata._order_shipping) +
        parseFloat(orderData.metadata._order_shipping_tax)).toFixed(2)}
        </p>
        <p>
          <strong>Order Tax:</strong> €${parseFloat(orderData.metadata._order_tax).toFixed(2)}
        </p>
        <p>
          <strong>Shipping Tax:</strong> €${parseFloat(orderData.metadata._order_shipping_tax).toFixed(2)}
        </p>
        <p>
          <strong>Total Tax:</strong>
          €${(parseFloat(orderData.metadata._order_tax) +
        parseFloat(orderData.metadata._order_shipping_tax)).toFixed(2)}
        </p>
        <p>
          <strong>Discount:</strong> -€
          ${parseFloat(orderData.metadata._cart_discount).toFixed(2)}
        </p>
        <h3>
          <strong>Total:</strong> €${parseFloat(orderData.total).toFixed(2)}
        </h3>
      </div>
    </div>
       
  </body>
</html>

`;
 // Step 1: Generate PDF buffer from HTML content
 const pdfBuffer = await generatePdfBuffer(htmlContent);

 // Step 2: Create a temporary PDF file in the 'uploads' folder
 const pdfFilePath = path.join(path.resolve(__dirname, '../uploads'), `${orderData._id}2.pdf`);
 fs.writeFileSync(pdfFilePath, pdfBuffer);

 // Step 3: Prepare the email attachments
 const attachments = [
   {
     '@odata.type': '#microsoft.graph.fileAttachment',
     name: "Factuur_" + orderData._id + ".pdf",
     contentType: 'application/pdf',
     contentBytes: fs.readFileSync(pdfFilePath).toString('base64'),
   },
 ];

 // Step 4: Send the email
    const productHTML = orderData.items
      .map(
        (product) => `
      <div style="display: flex; margin-bottom: 10px;">
        <img src="${product.meta._thumbnail.replace("http://localhost:5001", "https://backend.fitpreps.nl")}" alt="${product.order_item_name}" style="width: 100px; height: 75px; margin-right: 10px; border: 1px solid #dddddd;">
        <div>
          <p style="margin: 0; font-size: 16px;"><strong>${product.order_item_name}</strong></p>
          <p style="margin: 5px 0 0; font-size: 14px;">Aantal: ${product.meta._qty}</p>
        </div>
        <p style="margin: 0 0 0 auto; font-size: 16px; font-weight: bold;">€ ${parseFloat(product.meta._line_total).toFixed(2)}</p>
      </div>
    `
      )
      .join(''); // Combine all product divs into a single string
const html= `<div style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333;">
<div style="max-width: 600px; margin: 0 auto; border: 1px solid #dddddd;">
  <!-- Header -->
  <div style="background-color: #ff4e00; padding: 10px;">
    <h1 style="margin: 0; font-size: 18px; text-align: center; color: #ffffff;">New Order #${orderData._id}</h1>
  </div>
  
  <!-- Content -->
  <div style="padding: 20px;">
    <p style="margin: 0; font-size: 16px;">
      ${title} <br><br>
    </p>
    
    <h2 style="margin-top: 20px; font-size: 18px;">Overzicht van jouw bestelling met referentie #${orderData._id}</h2>

    <!-- Order Details -->
    <div style="border-bottom: 1px solid #dddddd; padding-bottom: 15px; margin-bottom: 15px;">
    ${productHTML}
    </div>

    <!-- Summary -->
    <table style="width: 100%; font-size: 16px; margin-bottom: 20px;">
      <tr>
        <td style="padding: 5px 0;">Subtotaal</td>
        <td style="padding: 5px 0; text-align: right;">€ ${(parseFloat(orderData.total) - (parseFloat(orderData.metadata._order_shipping) + parseFloat(orderData.metadata._order_shipping_tax))).toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0;">Korting</td>
        <td style="padding: 5px 0; text-align: right;">-€ ${orderData.metadata._cart_discount}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0;">Verzending</td>
        <td style="padding: 5px 0; text-align: right;">€ ${orderData.metadata._order_shipping == "0" ? "Gratis" : (parseFloat(orderData.metadata._order_shipping) + parseFloat(orderData.metadata._order_shipping_tax)).toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0; font-weight: bold;">Totaal</td>
        <td style="padding: 5px 0; text-align: right; font-weight: bold;">€ ${orderData.total}</td>
      </tr>
    </table>

    <!-- Addresses -->
    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 20px;">
      <div style="width: 50%;">
        <h3 style="margin: 0; font-size: 16px;">Factuuradres</h3>
        <p style="margin: 5px 0 0;">${orderData.metadata._billing_first_name} ${orderData.metadata._billing_last_name}<br>${orderData.metadata._billing_address_1}<br>${orderData.metadata._billing_address_2}<br>${orderData.metadata._billing_postcode} ${orderData.metadata._billing_city}<br>${orderData.metadata._billing_country}<br>${orderData.metadata._billing_phone}<br>${orderData.metadata._billing_email}</p>
      </div>
      <div>
        <h3 style="margin: 0; font-size: 16px;">Verzendadres</h3>
        <p style="margin: 5px 0 0;">${orderData.metadata._shipping_first_name} ${orderData.metadata._shipping_last_name}<br>${orderData.metadata._shipping_address_1}<br>${orderData.metadata._shipping_address_2}<br>${orderData.metadata._shipping_postcode} ${orderData.metadata._shipping_city}<br>${orderData.metadata._shipping_country}<br>${orderData.metadata._shipping_phone}</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #dddddd; padding-top: 15px;">
      <p style="margin: 0; font-size: 14px;">Volg ons op</p>
      <p style="margin: 10px 0;">
        <a href="https://www.facebook.com/FitPrepsOfficial" style="margin: 0 5px; text-decoration: none; color: #333;"><img height="20px" width="20px" src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/2048px-2021_Facebook_icon.svg.png" alt="Facebook"></a>
        <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="margin: 0 5px; text-decoration: none; color: #333;"><img height="20px" width="20px" src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/600px-Instagram_icon.png?20200512141346" alt="Instagram"></a>
      </p>
      <p style="margin: 0; font-size: 14px;">Deze email is verzonden door: info@fitpreps.nl</p>
      <p style="margin: 0; font-size: 14px;">Stuur voor vragen een e-mail naar: <a href="mailto:info@fitpreps.nl" style="color: #ff4e00;">info@fitpreps.nl</a></p>
      <p style="margin: 0; font-size: 14px;"><a href="https://fitpreps.nl" style="color: #ff4e00;">Privacy policy</a> | <a href="https://fitpreps.nl" style="color: #ff4e00;">Klantenservice</a></p>
    </div>
  </div>
</div>
</div>
  `
    // Mail options
    // const mailOptions = {
    //   from: "Fitpreps",
    //   to: "bestellingen@fitpreps.nl",
    //   subject: `Fitpreps.nl: Nieuwe bestelling #${orderData._id}`,
    //   html: `<div style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333;">
    //     <div style="max-width: 600px; margin: 0 auto; border: 1px solid #dddddd;">
    //       <!-- Header -->
    //       <div style="background-color: #ff4e00; padding: 10px;">
    //         <h1 style="margin: 0; font-size: 18px; text-align: center; color: #ffffff;">New Order #${orderData._id}</h1>
    //       </div>
          
    //       <!-- Content -->
    //       <div style="padding: 20px;">
    //         <p style="margin: 0; font-size: 16px;">
    //           ${title} <br><br>
    //         </p>
            
    //         <h2 style="margin-top: 20px; font-size: 18px;">Overzicht van jouw bestelling met referentie #${orderData._id}</h2>
      
    //         <!-- Order Details -->
    //         <div style="border-bottom: 1px solid #dddddd; padding-bottom: 15px; margin-bottom: 15px;">
    //         ${productHTML}
    //         </div>
      
    //         <!-- Summary -->
    //         <table style="width: 100%; font-size: 16px; margin-bottom: 20px;">
    //           <tr>
    //             <td style="padding: 5px 0;">Subtotaal</td>
    //             <td style="padding: 5px 0; text-align: right;">€ ${(parseFloat(orderData.total) - (parseFloat(orderData.metadata._order_shipping) + parseFloat(orderData.metadata._order_shipping_tax))).toFixed(2)}</td>
    //           </tr>
    //           <tr>
    //             <td style="padding: 5px 0;">Korting</td>
    //             <td style="padding: 5px 0; text-align: right;">-€ ${orderData.metadata._cart_discount}</td>
    //           </tr>
    //           <tr>
    //             <td style="padding: 5px 0;">Verzending</td>
    //             <td style="padding: 5px 0; text-align: right;">€ ${orderData.metadata._order_shipping == "0" ? "Gratis" : (parseFloat(orderData.metadata._order_shipping) + parseFloat(orderData.metadata._order_shipping_tax)).toFixed(2)}</td>
    //           </tr>
    //           <tr>
    //             <td style="padding: 5px 0; font-weight: bold;">Totaal</td>
    //             <td style="padding: 5px 0; text-align: right; font-weight: bold;">€ ${orderData.total}</td>
    //           </tr>
    //         </table>
      
    //         <!-- Addresses -->
    //         <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 20px;">
    //           <div style="width: 50%;">
    //             <h3 style="margin: 0; font-size: 16px;">Factuuradres</h3>
    //             <p style="margin: 5px 0 0;">${orderData.metadata._billing_first_name} ${orderData.metadata._billing_last_name}<br>${orderData.metadata._billing_address_1}<br>${orderData.metadata._billing_address_2}<br>${orderData.metadata._billing_postcode} ${orderData.metadata._billing_city}<br>${orderData.metadata._billing_country}<br>${orderData.metadata._billing_phone}<br>${orderData.metadata._billing_email}</p>
    //           </div>
    //           <div>
    //             <h3 style="margin: 0; font-size: 16px;">Verzendadres</h3>
    //             <p style="margin: 5px 0 0;">${orderData.metadata._shipping_first_name} ${orderData.metadata._shipping_last_name}<br>${orderData.metadata._shipping_address_1}<br>${orderData.metadata._shipping_address_2}<br>${orderData.metadata._shipping_postcode} ${orderData.metadata._shipping_city}<br>${orderData.metadata._shipping_country}<br>${orderData.metadata._shipping_phone}</p>
    //           </div>
    //         </div>
      
    //         <!-- Footer -->
    //         <div style="text-align: center; border-top: 1px solid #dddddd; padding-top: 15px;">
    //           <p style="margin: 0; font-size: 14px;">Volg ons op</p>
    //           <p style="margin: 10px 0;">
    //             <a href="https://www.facebook.com/FitPrepsOfficial" style="margin: 0 5px; text-decoration: none; color: #333;"><img height="20px" width="20px" src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/2048px-2021_Facebook_icon.svg.png" alt="Facebook"></a>
    //             <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="margin: 0 5px; text-decoration: none; color: #333;"><img height="20px" width="20px" src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/600px-Instagram_icon.png?20200512141346" alt="Instagram"></a>
    //           </p>
    //           <p style="margin: 0; font-size: 14px;">Deze email is verzonden door: info@fitpreps.nl</p>
    //           <p style="margin: 0; font-size: 14px;">Stuur voor vragen een e-mail naar: <a href="mailto:info@fitpreps.nl" style="color: #ff4e00;">info@fitpreps.nl</a></p>
    //           <p style="margin: 0; font-size: 14px;"><a href="https://fitpreps.nl" style="color: #ff4e00;">Privacy policy</a> | <a href="https://fitpreps.nl" style="color: #ff4e00;">Klantenservice</a></p>
    //         </div>
    //       </div>
    //     </div>
    // </div>
    //       `,
    //   attachments,
    // };

    const mailOptions = {
      subject: `Fitpreps.nl: Nieuwe bestelling #${orderData._id}`,
      //This "from" is optional if you want to send from group email. For this you need to give permissions in that group to send emails from it.
      from: {
        emailAddress: {
          address: 'bestellingen@fitpreps.nl',
        },
      },
      toRecipients: [
        {
          emailAddress: {
            address: "bestellingen@fitpreps.nl",
          },
        },
      ],
      body: {
        content: html,
        contentType: 'html',
      },
      replyTo: [{
        emailAddress: {
          address: orderData.metadata._billing_email,
        }
      }],
      attachments,
    };
   

    // Send email
    const accessToken = await getAccessToken();

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: mailOptions, saveToSentItems: false }),
    };

    const response = await fetch(
      `${graphEndpoint}/v1.0/users/info@fitpreps.nl/sendMail`,
      options
    );
    if (!response.ok) {
      const error = await response.json();
      console.error('Error sending email:', error);
    } else {
      fs.unlinkSync(pdfFilePath);
      console.log('Email sent successfully!');
    }    
  } catch (error) {
    console.log("Error sending email:", error);
  }
};


