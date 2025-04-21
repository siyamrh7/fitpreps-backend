require('dotenv').config();
const puppeteer = require("puppeteer");
const fs = require('fs');
const path = require('path');

const msal = require('@azure/msal-node');

const clientSecret = process.env.CLIENT_SECRET;
const clientId = process.env.CLIENT_ID;
const tenantId = process.env.TENANT_ID;

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
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
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
      Beste Naam: ${orderData.metadata._billing_first_name}, ${title} <br><br>
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
        <td style="padding: 5px 0; text-align: right;">-€ ${parseFloat(orderData.metadata._cart_discount).toFixed(2)}</td>
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
      bccRecipients: [  // Add BCC here
        {
          emailAddress: {
            address: 'fitpreps.nl+8a098fd01d@invite.trustpilot.com', // Trustpilot BCC email
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
    const html = `<div style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333;">
<div style="max-width: 600px; margin: 0 auto; border: 1px solid #dddddd;">
  <!-- Header -->
  <div style="background-color: #ff4e00; padding: 10px;">
   <!--  <h1 style="margin: 0; font-size: 18px; text-align: center; color: #ffffff;">New order</h1>  -->
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
        <td style="padding: 5px 0; text-align: right;">-€ ${parseFloat(orderData.metadata._cart_discount).toFixed(2)}</td>
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




// Helper function to send emails
const sendEmail = async (to, subject, html) => {
  try {
    const accessToken = await getAccessToken();

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const mailOptions = {
      subject: subject,
      from: {
        emailAddress: {
          address: 'info@fitpreps.nl',
        },
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
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

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: mailOptions, saveToSentItems: false }),
    };

    await fetch(
      `${graphEndpoint}/v1.0/users/info@fitpreps.nl/sendMail`,
      options
    );

    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};



//subscription confirmation controller 
exports.subscriptionConfirmationController = async (mailOptions) => {
  try {
    const { to, name, profile } = mailOptions;
    const subject = 'Je abonnementsvorm is succesvol aangepast';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Je abonnementsvorm is succesvol aangepast</title>
</head>
<body style="margin:0; padding:0; background:#f7f8fa; font-family:'Segoe UI', sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px; margin:auto; padding:60px 20px;">
    <tr>
      <td>

        <!-- Layout met zijbalk -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-left:6px solid #FD4F01; background:#ffffff; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding:40px 40px 30px;">

              <!-- Titelbalk -->
              <table width="100%">
                <tr>
                  <td style="background:#FD4F01; padding:20px; border-radius:14px">
                    <h1 style="margin:0; font-size:26px;  color:#fff;">Je abonnementsvorm is succesvol aangepast</h1>
                    <p style="margin:10px 0 0; font-size:15px; color:#ffe9de;">Je aanvraag is goedgekeurd en de wijziging is direct doorgevoerd.</p>
                  </td>
                </tr>
              </table>

              <!-- Inhoud -->
              <div style="margin-top:30px; font-size:15px; line-height:1.7; color:#333;">
                <p>Hi <strong>${name}</strong>,</p>

                <p>
                  Goed nieuws: je verzoek om je abonnementsvorm aan te passen is goedgekeurd en de wijziging is direct doorgevoerd in je account.
                </p>

                <p>
                  Vanaf nu geldt je nieuwe abonnementsvorm en kun je daar je maaltijden en levermomenten op afstemmen zoals je gewend bent.
                </p>
              </div>

              <!-- Wat nu box -->
              <div style="margin-top:40px; background:#fdf5f2; border-radius:10px; padding:20px 24px; border-left:5px solid #FD4F01;">
                <h3 style="margin:0 0 10px; font-size:16px; color:#FD4F01;">Wat nu?</h3>
                <p style="margin:0; font-size:15px; color:#444;">
                  Log in op je account om te zien wat er veranderd is en om je maaltijden te kiezen voor de komende levering.
                </p>
              </div>

              <!-- Knop -->
              <div style="margin-top:35px; text-align:left;">
                <a href="${profile}" style="background-color:#FD4F01; color:#ffffff; padding:14px 28px; font-size:15px; text-decoration:none; font-weight:600; border-radius:8px; display:inline-block;">
                  Naar Mijn Account
                </a>
              </div>

              <!-- Ondersteuning & afsluiting -->
              <div style="margin-top:40px; font-size:15px; color:#555; line-height:1.6;">
                <p>
                  Heb je vragen over je nieuwe abonnement of hulp nodig bij het kiezen van maaltijden? Laat het ons weten – we helpen je graag verder via 
                  <a href="mailto:info@fitpreps.nl" style="color:#FD4F01;">info@fitpreps.nl</a>.
                </p>

                <p style="margin-top:24px;">
                  Bedankt voor je vertrouwen in Fit Preps – en veel plezier met je vernieuwde abonnement!
                </p>

                <p style="margin:0;">Met gezonde groet,<br><strong>Team Fit Preps</strong></p>
              </div>

            </td>
          </tr>
        </table>

        <!-- Footer -->
        <p style="margin-top:30px; font-size:12px; color:#999; text-align:center;">© 2025 Fit Preps • Alle rechten voorbehouden</p>

      </td>
    </tr>
  </table>

</body>
</html>
 `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending subscription adjusted email:', error);
    throw error;
  }
};



//subscription welcome message 
exports.subscriptionWelcomeController = async (mailOptions) => {
  try {
    const { to, name, profile } = mailOptions;
    const subject = 'Je abonnementsvorm is succesvol aangepast';
    const html = `
  <!DOCTYPE html>
<html lang="nl" style="margin:0; padding:0;">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welkom bij Fit Preps</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:Arial, sans-serif;">

  <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:auto; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#FD4F01; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:28px; margin:0;">Welkom bij Fit Preps!</h1>
        <p style="color:#dfffeb; font-size:16px; margin-top:10px;">Alles is geregeld. Jouw maaltijden komen eraan!</p>
      </td>
    </tr>

    <!-- Hero Image -->
    <tr>
      <td>
        <img src="https://res.cloudinary.com/dwrk5sbbb/image/upload/f_auto,q_auto/v1/fitpreps/vxhrzk4irakkxwropnu3" alt="Gezonde Maaltijd" style="width:100%; height:auto;" />
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding:0px 20px 0px 20px;  color:#333;">
        <p style="font-size:18px;">Hi <strong>${name}</strong>,</p>
        <p style="font-size:16px; line-height:1.6;">
          Bedankt voor je bestelling – jouw <strong>Fit Preps</strong> abonnement is succesvol gestart!
        </p>
        <p style="font-size:16px; line-height:1.6;">
          We hebben je betaling ontvangen en je eerste week staat al gepland. Goed bezig, dit is de eerste stap naar minder stress en meer gemak in je week.
        </p>

     

      
        <p style="font-size:16px; line-height:1.6;">
          Vanaf nu ontvang je automatisch op jouw gekozen ritme een herinnering om je nieuwe maaltijden te selecteren voor de volgende levering. Geen zorgen – we houden je op de hoogte per mail.
        </p>

        <!-- Supporting Image -->
        <div style="margin: 30px 0; text-align:center;">
          <img src="https://res.cloudinary.com/dwrk5sbbb/image/upload/v1744422915/fitpreps/lozqmqihwtt9awbgenq7.webp" alt="Maaltijd Opties" style="width:90%; max-width:500px; border-radius:8px;" />
        </div>

        <p style="font-size:16px; line-height:1.6;">
          Heb je vragen, opmerkingen of iets vergeten te kiezen? Laat het ons weten via <a href="mailto:info@fitpreps.nl" style="color:#FD4F01;">info@fitpreps.nl</a> – we helpen je graag verder.
        </p>

        <p style="font-size:16px; line-height:1.6; margin-top:40px;">
          Welkom bij Fit Preps – lekker bezig!
        </p>

        <p style="font-size:16px;">Met gezonde groet, <br><strong>Team Fit Preps</strong></p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#f5f5f5; text-align:center; padding:20px; font-size:12px; color:#999;">
        © 2025 Fit Preps • Alle rechten voorbehouden
      </td>
    </tr>
  </table>
</body>
</html>

    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending subscription adjusted email:', error);
    throw error;
  }
};

// Weekly subscription started email (Nederlands)
exports.weeklySubscriptionStartedController = async (mailOptions) => {
  try {
    const { to, name } = mailOptions;
    const subject = 'Je wekelijkse abonnement is gestart – Tijd om je maaltijden te kiezen!';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Je wekelijkse abonnement is gestart</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f7f7; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#FD4F01; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">Je wekelijkse abonnement is gestart!</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">Tijd om je maaltijden te kiezen</p>
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hi ${name},</p>
        
        <p style="font-size:16px; line-height:1.6;">
          Bedankt voor je bestelling en het starten van je wekelijkse Fit Preps abonnement!
          Je betaling is succesvol verwerkt en je abonnement is nu actief.
        </p>
        
        <div style="background-color:#f9f5f2; border-left:4px solid #FD4F01; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD4F01; font-size:18px;">Wat gebeurt er nu?</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Je punten zijn toegevoegd aan je account.</li>
            <li style="margin-bottom:10px;">Je kunt nu je maaltijden kiezen én een leverdag selecteren binnen de week van jouw gekozen startdatum.</li>
            <li style="margin-bottom:0;">Levering is mogelijk op maandag t/m vrijdag binnen die week.</li>
          </ul>
        </div>
        
        <div style="background-color:#fffbf0; border:2px dashed #FD4F01; padding:20px; margin:25px 0; border-radius:8px; text-align:center;">
          <h3 style="margin-top:0; color:#333; font-size:18px;">Belangrijk:</h3>
          <p style="margin-bottom:0; font-size:16px;">
            Zorg ervoor dat je jouw keuze op tijd maakt, zodat je levering goed wordt ingepland.<br>
            Heb je geen selectie gemaakt? Dan ontvang je vanaf week 2 automatisch dezelfde maaltijden op dezelfde leverdag als de week ervoor.
          </p>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          <strong>Herinneringen:</strong><br>
          Als je je maaltijden nog niet hebt gekozen, ontvang je op vrijdag en zondag automatisch een herinnering.
        </p>
        
        <p style="font-size:16px; line-height:1.6;">
          Heb je vragen? Neem gerust contact met ons op via <a href="mailto:info@fitpreps.nl" style="color:#FD4F01; text-decoration:underline;">info@fitpreps.nl</a> of log in op je account.
        </p>
        
        <!-- Call to Action Button -->
        <div style="text-align:center; margin:30px 0;">
          <a href="${process.env.FRONTEND_URI}/subscriptions/addmeals" style="background-color:#FD4F01; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
            Kies Mijn Maaltijden
          </a>
        </div>
        
        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          Sportieve groet,<br>
          <strong>Team Fit Preps</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:0; font-size:14px; color:#888888;">
          Volg ons op 
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD4F01; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD4F01; text-decoration:none;">Instagram</a>
        </p>
        <p style="margin:10px 0 0; font-size:14px; color:#888888;">
          © 2025 Fit Preps • Alle rechten voorbehouden
        </p>
      </td>
    </tr>
    
  </table>

</body>
</html>
    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending weekly subscription started email:', error);
    throw error;
  }
};

// Monthly subscription started email (Nederlands)
exports.monthlySubscriptionStartedController = async (mailOptions) => {
  try {
    const { to, name } = mailOptions;
    const subject = 'Je maandabonnement is gestart – Je kunt nu je maaltijden kiezen!';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Je maandabonnement is gestart</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f7f7; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header with Image -->
    <tr>
      <td style="background-color:#FD4F01; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">Je maandabonnement is gestart!</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">Je kunt nu je maaltijden kiezen</p>
      </td>
    </tr>
    
    <!-- Hero Image -->
    <tr>
      <td>
        <img src="https://res.cloudinary.com/dwrk5sbbb/image/upload/v1744426962/fitpreps/u2xmo1qiczex0cce4mos.webp" alt="Fit Preps Maaltijden" style="width:100%; height:auto; display:block;">
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hi ${name},</p>
        
        <p style="font-size:16px; line-height:1.6;">
          Bedankt voor je bestelling en welkom bij je maandelijkse Fit Preps abonnement!
          Je betaling is succesvol verwerkt en je abonnement is nu actief.
        </p>
        
        <div style="background-color:#f9f5f2; border-left:4px solid #FD4F01; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD4F01; font-size:18px;">Wat gebeurt er nu?</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Je punten zijn toegevoegd aan je account.</li>
            <li style="margin-bottom:10px;">Je kunt nu je maaltijden kiezen én een leverdag selecteren voor deze maand.</li>
            <li style="margin-bottom:0;">De leverdag moet plaatsvinden tussen nu en het einde van je abonnementsmaand (levering van maandag t/m vrijdag mogelijk).</li>
          </ul>
        </div>
        
        <div style="background-color:#fffbf0; border:2px dashed #FD4F01; padding:20px; margin:25px 0; border-radius:8px; text-align:center;">
          <h3 style="margin-top:0; color:#333; font-size:18px;">Let op:</h3>
          <p style="margin-bottom:0; font-size:16px;">
            Je ontvangt één levering per maand, dus kies zorgvuldig je maaltijden en leverdatum.<br>
            We sturen je een herinnering als je dit nog niet hebt gedaan.
          </p>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          Heb je vragen? Je kunt ons altijd bereiken via <a href="mailto:info@fitpreps.nl" style="color:#FD4F01; text-decoration:underline;">info@fitpreps.nl</a>.
        </p>
        
        <!-- Call to Action Button -->
        <div style="text-align:center; margin:30px 0;">
          <a href="${process.env.FRONTEND_URI}/subscriptions/addmeals" style="background-color:#FD4F01; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
            Kies Mijn Maaltijden
          </a>
        </div>
        
        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          Veel plezier met je maaltijden!<br>
          <strong>Team Fit Preps</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:0; font-size:14px; color:#888888;">
          Volg ons op 
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD4F01; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD4F01; text-decoration:none;">Instagram</a>
        </p>
        <p style="margin:10px 0 0; font-size:14px; color:#888888;">
          © 2025 Fit Preps • Alle rechten voorbehouden
        </p>
      </td>
    </tr>
    
  </table>

</body>
</html>
    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending monthly subscription started email:', error);
    throw error;
  }
};

// Weekly meal reminder email
exports.weeklyMealReminderController = async (mailOptions) => {
  try {
    const { to, name, nextDeliveryDate, mealPlan } = mailOptions;
    const subject = 'Herinnering: Kies je maaltijden';
    const html = `
  <!DOCTYPE html>
<html lang="nl" style="margin:0; padding:0;">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Herinnering: Kies je maaltijden</title>
</head>
<body style="margin:0; padding:0; background-color:#f2f4f6; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.05);">

    <!-- Banner -->
    <tr>
      <td style="background-color:#ffffff; padding:0;">
        <img src="https://res.cloudinary.com/dwrk5sbbb/image/upload/v1744423616/fitpreps/qsweql7kcuhevqzwexbd.webp" alt="Maaltijd Herinnering" style="width:100%; height:auto; display:block;">
      </td>
    </tr>

    <!-- Header Text -->
    <tr>
      <td style="text-align:center; padding:40px 30px 10px 30px;">
        <h2 style="margin:0; font-size:24px; color:#333333;">Heb jij je maaltijden al gekozen?</h2>
        <p style="color:#FD4F01; font-size:14px; margin-top:8px;">Je hebt nog tot <strong>zondag 23:59 uur</strong> om je keuzes door te geven!</p>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding:20px 30px 0 30px; color:#444444;">
        <p style="font-size:16px; line-height:1.6;">Hi <strong>${name}</strong>,</p>

        <p style="font-size:16px; line-height:1.6;">
          Een kleine reminder van ons: je hebt nog tot <strong>zondag 23:59 uur</strong> de tijd om jouw maaltijden en leverdag voor volgende week te kiezen!
        </p>

        <p style="font-size:16px; line-height:1.6;">
          Je zit nog ruim op tijd – maar het is wel fijn om het alvast te regelen, zodat je volgende week weer lekker en zonder stress kunt genieten van je Fit Preps maaltijden.
        </p>

        <!-- Call to Action -->
        <div style="text-align:center; margin:30px 0;">
          <a href="${process.env.FRONTEND_URI}" style="background-color:#FD4F01; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:8px; display:inline-block; font-weight:bold;">
            Kies Mijn Maaltijden
          </a>
        </div>

        <p style="font-size:16px; line-height:1.6;">
          Zin in een favoriet gerecht of juist iets nieuws proberen? Elke week staat er weer iets lekkers voor je klaar.
        </p>

        <p style="font-size:16px; line-height:1.6;">
          Nog niks geselecteerd? Geen zorgen – zondag sturen we je nog een laatste reminder. Maar eerder geregeld is eerder ontspannen, toch?
        </p>

        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          Fijn weekend alvast!
        </p>

        <p style="font-size:16px;">Met gezonde groet, <br><strong>Team Fit Preps</strong></p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#f8f8f8; text-align:center; padding:20px; font-size:12px; color:#999;">
        © 2025 Fit Preps • Alle rechten voorbehouden
      </td>
    </tr>
  </table>

</body>
</html>

    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending weekly meal reminder:', error);
    throw error;
  }
};

// Sunday meal reminder email
exports.sundayMealReminderController = async (mailOptions) => {
  try {
    const { to, name, nextDeliveryDate, mealPlan } = mailOptions;
    const subject = 'Tijd om je maaltijden te kiezen';
    const html = `
     <!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tijd om je maaltijden te kiezen</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:'Segoe UI', sans-serif;">

  <table  width="100%" cellpadding="0" cellspacing="0" style="max-width:660px; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.07);">

    <!-- Wavy Header with Brand Color -->
    <tr>
      <td style="background-color:#FD4F01; position:relative; text-align:center; padding:50px 30px 20px 30px;">
        <h1 style="margin:0; font-size:28px; color:#fff; font-family:'Georgia', serif;">Tijd om je maaltijden voor volgende maand te kiezen!</h1>
        <p style="color:#ffe9dc; font-size:15px; margin-top:10px;">Je nieuwe Fit Preps maand komt eraan – vergeet je selectie niet.</p>
      </td>
    </tr>
    <tr>
      <td style="line-height:0;">
        <svg viewBox="0 0 500 50" preserveAspectRatio="none" style="display:block; width:100%; height:50px;">
          <path d="M0,0 C150,100 350,-50 500,30 L500,00 L0,0 Z" style="fill:#FD4F01;"></path>
        </svg>
      </td>
    </tr>

    <!-- Message Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="font-size:16px; line-height:1.7;">
          Even een korte reminder: jouw nieuwe maand bij Fit Preps komt eraan – en dat betekent dat het weer tijd is om je maaltijden en leverdagen te kiezen.
        </p>
        <p style="font-size:16px; line-height:1.7;">
          Je bent nog ruim op tijd, maar dit is een mooi moment om alvast je favorieten aan te vinken (of iets nieuws te proberen!).
        </p>
      </td>
    </tr>

    <!-- CTA Block -->
    <tr>
      <td style="padding:20px 30px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="border-radius:12px; background:#fff6f2; border:2px dashed #FD4F01;">
          <tr>
            <td style="text-align:center; padding:24px;">
              <p style="margin:0 0 15px; font-size:16px; color:#333;">
                Log in op je account om je selectie te maken:
              </p>
              <a href="${process.env.FRONTEND_URI}/profile" style="background-color:#FD4F01; color:#ffffff; padding:14px 36px; font-size:16px; font-weight:bold; border-radius:30px; text-decoration:none; display:inline-block;">
                Maak mijn selectie
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer Message -->
    <tr>
      <td style="padding:30px; color:#555555; font-size:15px;">
        <p style="margin:0 0 16px 0;">Hulp nodig of vragen? Reageer gerust op deze mail – we staan voor je klaar.</p>
        <p style="margin:0 0 16px 0;">Je bent er bijna – nog een paar klikken en jouw nieuwe maand vol gemak en gezonde maaltijden staat klaar.</p>
        <p style="margin:0;">Met gezonde groet,<br><strong>Team Fit Preps</strong></p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#f1f1f1; text-align:center; padding:20px; font-size:12px; color:#999999;">
        © 2025 Fit Preps • Alle rechten voorbehouden
      </td>
    </tr>
  </table>

</body>
</html>

    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending Sunday meal reminder:', error);
    throw error;
  }
};

// Monthly renewal reminder email
exports.monthlyRenewalReminderController = async (mailOptions) => {
  try {
    const { to, name, subscription } = mailOptions;
    const subject = 'Laatste Kans';
    const html = `
   <!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Laatste Kans</title>
</head>
<body style="margin:0; padding:0; background:#f2f3f4; font-family:'Segoe UI', sans-serif;">

  <table align="center" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px; margin:auto; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.08);">

    <!-- Hero Image -->
    <tr>
      <td>
        <img src="https://res.cloudinary.com/dwrk5sbbb/image/upload/v1744428317/fitpreps/ptc18wwvbhvqtotr6cyf.webp" alt="Maaltijd Preview" style="width:100%; display:block; height:auto;">
      </td>
    </tr>

    <!-- Header Text -->
    <tr>
      <td style="padding:40px 30px 10px 30px; text-align:center;">
        <h1 style="margin:0; font-size:28px; font-family:'Georgia', serif; color:#FD4F01;">Laatste kans om je maaltijden voor volgende maand te kiezen!</h1>
        <p style="font-size:14px; color:#888; margin-top:10px;">Morgen start je nieuwe maand – nu kun je nog je keuze aanpassen.</p>
      </td>
    </tr>

    <!-- Body Text -->
    <tr>
      <td style="padding:20px 30px 10px 30px; color:#333;">
        <p style="font-size:16px; line-height:1.7;">Hi <strong>${name}</strong>,</p>

        <p style="font-size:16px; line-height:1.7;">
          Een snelle heads-up: jouw nieuwe Fit Preps maand start <strong>morgen</strong>.
        </p>

        <p style="font-size:16px; line-height:1.7;">
          Heb je je maaltijden en leverdag nog niet gekozen? Dan is dit je <strong>laatste kans</strong> om je selectie aan te passen.
        </p>

        <!-- Info Block -->
        <div style="background:#fef9f6; border-left:5px solid #FD4F01; padding:20px; border-radius:8px; margin:30px 0;">
          <p style="margin:0; font-size:15px; color:#444;">
            <strong>Wat als je niets doet?</strong><br>
            Geen probleem – dan houden we automatisch dezelfde maaltijden en leverdag aan als afgelopen maand. Lekker makkelijk.<br><br>
            Maar… als je iets nieuws wilde proberen of je planning is veranderd, dan is <strong>nú</strong> het moment om dat door te geven.
          </p>
        </div>

        <p style="font-size:16px; line-height:1.7;">
          Zo ben je er zeker van dat je krijgt wat je écht wilt – en op een moment dat het jou uitkomt.
        </p>
      </td>
    </tr>

    <!-- CTA Card -->
    <tr>
      <td style="padding:0 30px 40px;">
        <table align="center" style="width:100%; background-color:#fff4ef; border-radius:14px; box-shadow:0 0 20px rgba(253,79,1,0.15); text-align:center; padding:30px;">
          <tr>
            <td>
              <p style="margin:0 0 20px; font-size:15px; color:#333;">Pas je selectie aan via je account:</p>
              <a href="${process.env.FRONTEND_URI}" style="background-color:#FD4F01; color:#ffffff; padding:14px 36px; font-size:16px; font-weight:bold; text-decoration:none; border-radius:30px; display:inline-block;">
                Selectie Aanpassen
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer Message -->
    <tr>
      <td style="padding:0 30px 30px; color:#555; font-size:15px;">
        <p style="margin-bottom:16px;">Hulp nodig? Reageer gerust op deze mail – we helpen je graag.</p>
        <p style="margin:0;">Met gezonde groet,<br><strong>Team Fit Preps</strong></p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#f1f1f1; text-align:center; padding:20px; font-size:12px; color:#999;">
        © 2025 Fit Preps • Alle rechten voorbehouden
      </td>
    </tr>
  </table>

</body>
</html>

    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending monthly renewal reminder:', error);
    throw error;
  }
};

// Subscription cancelled email
exports.subscriptionCancelledController = async (mailOptions) => {
  try {
    const { to, name } = mailOptions;
    const subject = 'Laatste Kansbevestiging van opgezegd abonnement';
    const html = `
      <!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Laatste Kans</title>
</head>
<body style="margin:0; padding:0; background:#f5f5f5; font-family:'Segoe UI', sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px; margin:auto; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.05);">

    <!-- Wavy Goodbye Header -->
    <tr>
      <td style="background-color:#FD4F01; text-align:center; padding:60px 30px 20px;">
        <h1 style="margin:0; font-size:28px; color:#ffffff; font-family:'Georgia', serif;">We hebben genoten van je als klant!</h1>
        <p style="color:#ffe6db; font-size:15px; margin-top:10px;">Je abonnement is opgezegd – dit kun je nog verwachten.</p>
      </td>
    </tr>
    <tr>
      <td style="line-height:0;">
        <svg viewBox="0 0 500 60" preserveAspectRatio="none" style="display:block; width:100%; height:60px;">
          <path d="M0,0 C150,60 350,0 500,60 L500,00 L0,0 Z" style="fill:#FD4F01;"></path>
        </svg>
      </td>
    </tr>

    <!-- Message Content -->
    <tr>
      <td style="padding:30px; color:#333;">
        <p style="font-size:16px; line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="font-size:16px; line-height:1.7;">
          Wat jammer dat je stopt – maar bovenal: bedankt dat je deel was van de Fit Preps-reis!
        </p>
        <p style="font-size:16px; line-height:1.7;">
          We hopen dat onze maaltijden jouw week makkelijker hebben gemaakt en je geholpen hebben om je goed te voelen. Mocht je ooit terug willen komen: je bent altijd welkom – we zouden je graag weer zien!
        </p>
      </td>
    </tr>

    <!-- Info Section -->
    <tr>
      <td style="padding:0 30px 30px;">
        <table width="100%" style="background:#fff9f6; border-radius:14px; padding:25px; box-shadow:inset 0 0 0 1px #fbe0d6;">
          <tr>
            <td>
              <h3 style="margin:0 0 15px; font-size:18px; color:#FD4F01;">📦 Wat gebeurt er nu?</h3>
              <ul style="padding-left:20px; margin:0; color:#444; font-size:15px; line-height:1.7;">
                <li><strong>Laatste levering:</strong>  op je gekozen dag</li>
                <li><strong>Laatste betaling:</strong> wordt automatisch verwerkt voor deze levering</li>
              </ul>
              <p style="margin-top:16px; font-size:15px;">
                Daarna stopt je abonnement en worden er geen kosten meer in rekening gebracht.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- CTA Reminder -->
    <tr>
      <td style="padding:0 30px;">
        <div style="background:#fefefe; border-radius:12px; padding:24px; text-align:center; border:2px solid #FD4F01; margin-bottom:30px;">
          <p style="font-size:15px; color:#444; margin:0;">
            Je kunt je laatste maaltijden en leverdag nog kiezen via je account.
          </p>
        </div>
      </td>
    </tr>

    <!-- Footer Note -->
    <tr>
      <td style="padding:0 30px 40px; font-size:16px; color:#333;">
        <p style="margin-bottom:18px;">
          Nogmaals bedankt dat je voor Fit Preps hebt gekozen – en hopelijk tot ziens!
        </p>
        <p>Met gezonde groet,<br><strong>Team Fit Preps</strong></p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#f1f1f1; text-align:center; padding:20px; font-size:12px; color:#999;">
        © 2025 Fit Preps • Alle rechten voorbehouden
      </td>
    </tr>

  </table>
</body>
</html>

    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending subscription cancelled email:', error);
    throw error;
  }
};

// Subscription paused email
exports.subscriptionPausedController = async (mailOptions) => {
  try {
    const { to, name, ResumeLink } = mailOptions;
    const subject = 'Abonnement Gepauzeerd Confirmation';
    const html = `
     <!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Abonnement Gepauzeerd</title>
</head>
<body style="margin:0; padding:0; background:#eef1f3; font-family:'Segoe UI', sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:700px; margin:auto; padding:50px 0;">
    <tr>
      <td align="center">

        <!-- Frosted Card Container -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.9); backdrop-filter:blur(6px); border-radius:16px; padding:40px; box-shadow:0 20px 40px rgba(0,0,0,0.08);">
          
          <!-- Icon Header -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <div style="background:#FD4F01; width:70px; height:70px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                <span style="font-size:12px; color:white;">FITPREPS</span>
              </div>
            </td>
          </tr>

          <!-- Title + Preheader -->
          <tr>
            <td style="text-align:center;">
              <h1 style="margin:0; font-size:26px; font-family:'Georgia', serif; color:#222;">Je abonnement staat tijdelijk op pauze</h1>
              <p style="font-size:15px; color:#777; margin-top:10px;">Je kunt maximaal 4 weken per jaar pauzeren – daarna hervatten we automatisch.</p>
            </td>
          </tr>

          <!-- Main Message -->
          <tr>
            <td style="padding-top:30px; color:#333;">
              <p style="font-size:16px; line-height:1.7;">Hi <strong>${name}</strong>,</p>
              <p style="font-size:16px; line-height:1.7;">
                We hebben je verzoek ontvangen – je abonnement is succesvol op pauze gezet.
              </p>
              <p style="font-size:16px; line-height:1.7;">
                Je hoeft je voorlopig even geen zorgen te maken over leveringen of betalingen. Maar goed om te weten: je kunt je abonnement maximaal 4 weken per kalenderjaar pauzeren. Daarna wordt het automatisch weer geactiveerd.
              </p>
            </td>
          </tr>

          <!-- Highlight Info Box -->
          <tr>
            <td style="padding-top:25px;">
              <div style="background:#fff7f4; border-left:5px solid #FD4F01; border-radius:12px; padding:20px;">
                <h3 style="margin-top:0; font-size:17px; color:#FD4F01;">Wat betekent dit voor jou?</h3>
                <ul style="font-size:15px; color:#444; line-height:1.7; padding-left:18px;">
                  <li>Tijdens de pauze ontvang je geen maaltijden en worden er geen betalingen afgeschreven.</li>
                  <li>Na 4 weken wordt je abonnement automatisch hervat, tenzij je het eerder zelf weer activeert via je account.</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Call-to-Action -->
          <tr>
            <td style="text-align:center; padding:30px 0;">
              <p style="font-size:15px; color:#333;">Wil je eerder terugkomen?</p>
              <a href="${ResumeLink}" style="background-color:#FD4F01; color:#ffffff; padding:12px 32px; font-size:15px; font-weight:bold; text-decoration:none; border-radius:32px; display:inline-block;">
                Hervat mijn abonnement
              </a>
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="padding-top:20px; font-size:15px; color:#555; text-align:center;">
              <p style="margin-bottom:6px;">Heb je vragen of hulp nodig?</p>
              <p style="margin:0;"><a href="mailto:[klantenservice e-mailadres]" style="color:#FD4F01;">[klantenservice e-mailadres]</a></p>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding-top:40px; font-size:15px; color:#333;">
              <p style="text-align:center;">Tot snel!<br><strong>Team Fit Preps</strong></p>
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <p style="font-size:12px; color:#999; text-align:center; margin-top:25px;">
          © 2025 Fit Preps • Alle rechten voorbehouden
        </p>

      </td>
    </tr>
  </table>

</body>
</html>

    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending subscription paused email:', error);
    throw error;
  }
};

// Subscription adjusted email
exports.subscriptionAdjustedController = async (mailOptions) => {
  try {
    const { to, name, changes, newAmount } = mailOptions;
    const subject = 'Subscription Adjustment Confirmation';
    const html = `
      <div style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #dddddd;">
          <!-- Header -->
          <div style="background-color: #ff4e00; padding: 10px;">
            <h1 style="margin: 0; font-size: 18px; text-align: center; color: #ffffff;">Subscription Adjustment Confirmation</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 20px;">
            <h2 style="margin: 0 0 15px 0; font-size: 18px;">Hello ${name},</h2>
            <p style="margin: 0 0 15px 0; font-size: 16px;">Your subscription has been adjusted as requested.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p style="margin: 0 0 10px 0; font-size: 16px;"><strong>Changes made:</strong></p>
              <ul style="margin: 0 0 5px 0; padding-left: 20px; font-size: 16px;">
                ${Object.entries(changes).map(([key, value]) => `<li style="margin-bottom: 5px;">${key}: ${value}</li>`).join('')}
              </ul>
              <p style="margin: 10px 0 5px 0; font-size: 16px;"><strong>Your new monthly amount will be €${newAmount}</strong></p>
            </div>
            
            <p style="margin: 0 0 15px 0; font-size: 16px;">These changes will take effect on your next billing cycle.</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="https://fitpreps.nl/account" style="display: inline-block; background-color: #ff4e00; color: #ffffff; text-decoration: none; padding: 10px 20px; font-size: 16px; border-radius: 5px;">View My Subscription</a>
            </div>
            
            <p style="margin: 0 0 15px 0; font-size: 16px;">Thank you for your business!</p>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; border-top: 1px solid #dddddd; padding-top: 15px; background-color: #f9f9f9; padding: 15px;">
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
    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending subscription adjusted email:', error);
    throw error;
  }
};



exports.universalReminderController = async (mailOptions) => {
  try {
    const {
      to,
      name,
      reminderTitle = 'Herinnering: Kies je maaltijden',
      reminderSubject = 'Herinnering: Kies je maaltijden',
      buttonText = 'Kies Mijn Maaltijden'
    } = mailOptions;

    const subject = reminderSubject;
    const html = `
   <!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Laatste Kans om je Maaltijden te Kiezen</title>
</head>
<body style="margin:0; padding:0; background-color:#f6f6f6; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 0 20px rgba(0,0,0,0.08);">

    <!-- Hero Block -->
    <tr>
      <td style="padding:40px 30px 30px 30px; background-color:#ffffff; text-align:center;">
        <h1 style="margin:0; font-size:28px; color:#FD4F01;">Laatste Kans: Kies Vandaag je Maaltijden</h1>
        <p style="margin-top:10px; color:#555; font-size:16px;">U heeft tot <strong>zondag 23:59 uur</strong>  de tijd voordat u uw bestelling plaatst.</p>
      </td>
    </tr>

    <!-- Countdown Bar -->
    <tr>
      <td style="background-color:#fff1ea; padding:20px; text-align:center;">
        <p style="margin:0; font-size:16px; color:#333;">
          ⏳ Nog geen maaltijden gekozen? Dan herhalen we automatisch je vorige selectie.
        </p>
      </td>
    </tr>

    <!-- Visual Image Section -->
    <tr>
      <td style="text-align: center;width: 100%;">
        <img src="https://res.cloudinary.com/dwrk5sbbb/image/upload/v1744426962/fitpreps/u2xmo1qiczex0cce4mos.webp" alt="Fit Preps Herinnering" style="margin:auto; width:50%; display:block; height:auto;text-align: center;" />
      </td>
    </tr>

    <!-- Message Section -->
    <tr>
      <td style="padding:30px 30px 10px 30px; color:#333;">
        <p style="font-size:16px; line-height:1.6;">
          Hi <strong>${name}</strong>,
        </p>
        <p style="font-size:16px; line-height:1.6;">
          Een korte reminder – vandaag is je <strong>laatste kans</strong> om jouw maaltijden en leverdag voor komende week te kiezen.
        </p>
        <p style="font-size:16px; line-height:1.6;">
          Kies je niets? Dan nemen we automatisch jouw keuzes van vorige week over, inclusief de leverdag. Geen probleem natuurlijk – maar we willen je wel de kans geven om eventueel iets anders te kiezen (of juist iets nieuws te proberen!).
        </p>
      </td>
    </tr>

    <!-- CTA Card -->
    <tr>
      <td style="padding:20px 30px;">
        <div style="background-color:#fdf1eb; padding:24px; border-radius:10px; text-align:center; border:2px solid #FD4F01;">
          <p style="font-size:16px; color:#333; margin-bottom:20px;">
            ✅ Er is nog tijd – maar wacht niet te lang!
          </p>
          <a href="${process.env.FRONTEND_URI}/subscriptions/addmeals" style="background-color:#FD4F01; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; font-weight:bold; border-radius:30px; display:inline-block;">
            Kies Mijn Maaltijden
          </a>
        </div>
      </td>
    </tr>

    <!-- Support Section -->
    <tr>
      <td style="padding:20px 30px; font-size:15px; line-height:1.6; color:#444;">
        <p style="margin-top:0;">Na middernacht gaat je bestelling naar de keuken en staat alles vast.</p>
        <p style="margin-bottom:0;">Heb je vragen of hulp nodig? Stuur ons gerust een berichtje – we helpen je graag.</p>
      </td>
    </tr>

    <!-- Sign-off -->
    <tr>
      <td style="padding:20px 30px 30px 30px; font-size:15px; color:#333;">
        <p style="margin:0;">Met gezonde groet,<br><strong>Team Fit Preps</strong></p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#f2f2f2; text-align:center; padding:20px; font-size:12px; color:#888;">
        © 2025 Fit Preps • Alle rechten voorbehouden
      </td>
    </tr>

  </table>
</body>
</html>

    `;

    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending reminder email:', error);
    throw error;
  }
};

exports.universalReminderController2 = async (mailOptions) => {
  try {
    const {
      to,
      name,
      reminderTitle = 'Herinnering: Kies je maaltijden',
      reminderSubject = 'Herinnering: Kies je maaltijden',
      buttonText = 'Kies Mijn Maaltijden'
    } = mailOptions;

    const subject = reminderSubject;
    const html = `
 <!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tijd om je maaltijden te kiezen</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:'Segoe UI', sans-serif;">

  <table  width="100%" cellpadding="0" cellspacing="0" style="max-width:660px; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.07);margin: auto;">

    <!-- Wavy Header with Brand Color -->
    <tr>
      <td style="background-color:#FD4F01; position:relative; text-align:center; padding:50px 30px 20px 30px;">
        <h1 style="margin:0; font-size:28px; color:#fff; font-family:'Georgia', serif;">Tijd om je maaltijden voor volgende maand te kiezen!</h1>
        <p style="color:#ffe9dc; font-size:15px; margin-top:10px;">Je nieuwe Fit Preps maand komt eraan – vergeet je selectie niet.</p>
      </td>
    </tr>
    <tr>
      <td style="line-height:0;">
        <svg viewBox="0 0 500 50" preserveAspectRatio="none" style="display:block; width:100%; height:50px;">
          <path d="M0,0 C150,100 350,-50 500,30 L500,00 L0,0 Z" style="fill:#FD4F01;"></path>
        </svg>
      </td>
    </tr>

    <!-- Message Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="font-size:16px; line-height:1.7;">
          Even een korte reminder: jouw nieuwe maand bij Fit Preps komt eraan – en dat betekent dat het weer tijd is om je maaltijden en leverdagen te kiezen.
        </p>
        <p style="font-size:16px; line-height:1.7;">
          Je bent nog ruim op tijd, maar dit is een mooi moment om alvast je favorieten aan te vinken (of iets nieuws te proberen!).
        </p>
      </td>
    </tr>

    <!-- CTA Block -->
    <tr>
      <td style="padding:20px 30px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="border-radius:12px; background:#fff6f2; border:2px dashed #FD4F01;">
          <tr>
            <td style="text-align:center; padding:24px;">
              <p style="margin:0 0 15px; font-size:16px; color:#333;">
                Log in op je account om je selectie te maken:
              </p>
              <a href="${process.env.FRONTEND_URI}/subscriptions/addmeals" style="background-color:#FD4F01; color:#ffffff; padding:14px 36px; font-size:16px; font-weight:bold; border-radius:30px; text-decoration:none; display:inline-block;">
                Maak mijn selectie
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer Message -->
    <tr>
      <td style="padding:30px; color:#555555; font-size:15px;">
        <p style="margin:0 0 16px 0;">Hulp nodig of vragen? Reageer gerust op deze mail – we staan voor je klaar.</p>
        <p style="margin:0 0 16px 0;">Je bent er bijna – nog een paar klikken en jouw nieuwe maand vol gemak en gezonde maaltijden staat klaar.</p>
        <p style="margin:0;">Met gezonde groet,<br><strong>Team Fit Preps</strong></p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#f1f1f1; text-align:center; padding:20px; font-size:12px; color:#999999;">
        © 2025 Fit Preps • Alle rechten voorbehouden
      </td>
    </tr>
  </table>

</body>
</html>


    `;

    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending reminder email:', error);
    throw error;
  }
};

// Order confirmation email (Nederlands)
exports.orderConfirmationEmailControllerWeekly = async (mailOptions) => {
  try {
    const { to, name, deliveryDate } = mailOptions;
    const subject = 'Je bestelling is succesvol geplaatst – dit is je leverdatum!';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Je bestelling is succesvol geplaatst</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#FD4F01; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">Je bestelling is succesvol geplaatst!</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">We gaan meteen voor je aan de slag</p>
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hi ${name},</p>
        
        <p style="font-size:16px; line-height:1.6;">
          Bedankt voor je bestelling bij Fit Preps – we gaan meteen voor je aan de slag!
          Je bestelling is succesvol verwerkt en staat ingepland voor levering op:
        </p>
        
        <!-- Delivery Date Highlight -->
        <div style="background-color:#f0f9f4; border:2px solid #FD4F01; padding:20px; margin:25px 0; border-radius:8px; text-align:center;">
          <h2 style="margin:0; color:#FD4F01; font-size:22px;">${deliveryDate}</h2>
        </div>
        
        <!-- Delivery Information -->
        <div style="background-color:#f9f5f2; border-left:4px solid #FD4F01; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD4F01; font-size:18px;">Leverinformatie:</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Je pakket wordt geleverd op de dag van levering tussen 17:00 en 22:00 uur.</li>
            <li style="margin-bottom:0;">Zodra je bestelling is meegegeven aan de bezorgdienst, ontvang je op de dag van levering een e-mail met je track & trace code, zodat je precies kunt volgen wanneer je jouw maaltijden kunt verwachten.</li>
          </ul>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          Zorg ervoor dat je beschikbaar bent op het opgegeven adres tijdens dit tijdvak. Heb je vragen over je levering? Mail ons gerust via <a href="mailto:info@fitpreps.nl" style="color:#FD4F01; text-decoration:underline;">info@fitpreps.nl</a>.
        </p>
        
        <!-- Order Tracking Button (Optional) -->
        <div style="text-align:center; margin:30px 0;">
          <a href="${process.env.FRONTEND_URI}/orders" style="background-color:#FD4F01; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
            Bekijk Mijn Bestelling
          </a>
        </div>
        
        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          Eet smakelijk & sportieve groet,<br>
          <strong>Team Fit Preps</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:0; font-size:14px; color:#888888;">
          Volg ons op 
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD4F01; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD4F01; text-decoration:none;">Instagram</a>
        </p>
        <p style="margin:10px 0 0; font-size:14px; color:#888888;">
          © 2025 Fit Preps • Alle rechten voorbehouden
        </p>
      </td>
    </tr>
    
  </table>

</body>
</html>
    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    throw error;
  }
};

// Monthly order confirmation email (Nederlands)
exports.orderConfirmationEmailControllerMonthly = async (mailOptions) => {
  try {
    const { to, name, deliveryDate } = mailOptions;
    const subject = `Je bestelling is succesvol geplaatst – Levering op ${deliveryDate}`;
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Je bestelling is succesvol geplaatst</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#FD4F01; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">Je bestelling is succesvol geplaatst!</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">Je maaltijdselectie voor deze maand is bevestigd</p>
      </td>
    </tr>
    
    <!-- Hero Image -->
    <tr>
      <td>
        <img src="https://res.cloudinary.com/dwrk5sbbb/image/upload/v1744426962/fitpreps/u2xmo1qiczex0cce4mos.webp" alt="Fit Preps Maaltijden" style="width:100%; height:auto; display:block;">
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hi ${name},</p>
        
        <p style="font-size:16px; line-height:1.6;">
          Top! Je hebt je maaltijden succesvol geselecteerd voor deze maand.
          Je bestelling is bevestigd en staat ingepland voor levering op:
        </p>
        
        <!-- Delivery Date Highlight -->
        <div style="background-color:#f0f9f4; border:2px solid #FD4F01; padding:20px; margin:25px 0; border-radius:8px; text-align:center;">
          <h2 style="margin:0; color:#FD4F01; font-size:22px;">${deliveryDate} (tussen 17:00 en 22:00 uur)</h2>
        </div>
        
        <!-- Delivery Information -->
        <div style="background-color:#f9f5f2; border-left:4px solid #FD4F01; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD4F01; font-size:18px;">Wat kun je verwachten?</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Je ontvangt al je geselecteerde maaltijden in één levering.</li>
            <li style="margin-bottom:10px;">Op de dag van levering ontvang je een e-mail met een track & trace link, zodat je precies weet wanneer je het pakket kunt verwachten.</li>
            <li style="margin-bottom:0;">Zorg ervoor dat er iemand aanwezig is op het bezorgadres om het pakket in ontvangst te nemen tijdens het genoemde tijdvak.</li>
          </ul>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          Heb je vragen of wil je iets wijzigen? Stuur ons gerust een bericht via <a href="mailto:info@fitpreps.nl" style="color:#FD4F01; text-decoration:underline;">info@fitpreps.nl</a>.
        </p>
        
        <!-- Order Tracking Button -->
        <div style="text-align:center; margin:30px 0;">
          <a href="${process.env.FRONTEND_URI}/orders" style="background-color:#FD4F01; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
            Bekijk Mijn Bestelling
          </a>
        </div>
        
        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          Veel plezier met je maaltijden!<br>
          <strong>Team Fit Preps</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:0; font-size:14px; color:#888888;">
          Volg ons op 
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD4F01; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD4F01; text-decoration:none;">Instagram</a>
        </p>
        <p style="margin:10px 0 0; font-size:14px; color:#888888;">
          © 2025 Fit Preps • Alle rechten voorbehouden
        </p>
      </td>
    </tr>
    
  </table>

</body>
</html>
    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending monthly order confirmation email:', error);
    throw error;
  }
};