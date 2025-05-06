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
                        <td style="background-color: #FF5100; padding: 20px; text-align: center;">
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
                            <a href="https://fitpreps.nl" style="display: inline-block; background-color: #FF5100; color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 16px; font-weight: bold; border-radius: 5px;">Naar mijn account</a>
                        </td>
                    </tr>
                    
                    <!-- Footer Section -->
                    <tr>
                        <td align="center" style="background-color: #FF5100; padding: 20px; color: #ffffff; font-size: 14px; line-height: 1.6;">
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
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
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
          Heb je vragen, opmerkingen of iets vergeten te kiezen? Laat het ons weten via <a href="mailto:info@fitpreps.nl" style="color:#FD5001;">info@fitpreps.nl</a> – we helpen je graag verder.
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
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
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
        
        <div style="background-color:#f9f5f2; border-left:4px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD5001; font-size:18px;">Wat gebeurt er nu?</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Je punten zijn toegevoegd aan je account.</li>
            <li style="margin-bottom:10px;">Je kunt nu je maaltijden kiezen én een leverdag selecteren binnen de week van jouw gekozen startdatum.</li>
            <li style="margin-bottom:0;">Levering is mogelijk op maandag t/m vrijdag binnen die week.</li>
          </ul>
        </div>
        
        <div style="background-color:#fffbf0; border:2px dashed #FD5001; padding:20px; margin:25px 0; border-radius:8px; text-align:center;">
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
          Heb je vragen? Neem gerust contact met ons op via <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a> of log in op je account.
        </p>
        
        <!-- Call to Action Button -->
        <div style="text-align:center; margin:30px 0;">
          <a href="https://fitpreps.nl/login" style="background-color:#FD5001; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
            Kies je maaltijden
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
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD5001; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD5001; text-decoration:none;">Instagram</a>
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
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
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
        
        <div style="background-color:#f9f5f2; border-left:4px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD5001; font-size:18px;">Wat gebeurt er nu?</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Je punten zijn toegevoegd aan je account.</li>
            <li style="margin-bottom:10px;">Je kunt nu je maaltijden kiezen én een leverdag selecteren voor deze maand.</li>
            <li style="margin-bottom:0;">De leverdag moet plaatsvinden tussen nu en het einde van je abonnementsmaand (levering van maandag t/m vrijdag mogelijk).</li>
          </ul>
        </div>
        
        <div style="background-color:#fffbf0; border:2px dashed #FD5001; padding:20px; margin:25px 0; border-radius:8px; text-align:center;">
          <h3 style="margin-top:0; color:#333; font-size:18px;">Let op:</h3>
          <p style="margin-bottom:0; font-size:16px;">
            Je ontvangt één levering per maand, dus kies zorgvuldig je maaltijden en leverdatum.<br>
            We sturen je een herinnering als je dit nog niet hebt gedaan.
          </p>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          Heb je vragen? Je kunt ons altijd bereiken via <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a>.
        </p>
        
        <!-- Call to Action Button -->
        <div style="text-align:center; margin:30px 0;">
          <a href="https://fitpreps.nl/login" style="background-color:#FD5001; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
           Kies je maaltijden
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
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD5001; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD5001; text-decoration:none;">Instagram</a>
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



exports.subscriptionPausedController = async (mailOptions) => {
  try {
    const { to, name, ResumeLink } = mailOptions;
    const subject = 'Je abonnement staat tijdelijk op pauze';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Je abonnement staat tijdelijk op pauze</title>
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
              <div style="background:#FD5001; width:70px; height:70px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                <span style="font-size:12px; color:white;">FITPREPS</span>
              </div>
            </td>
          </tr>

          <!-- Title + Preheader -->
          <tr>
            <td style="text-align:center;">
              <h1 style="margin:0; font-size:26px; font-family:'Georgia', serif; color:#222;">Je abonnement staat tijdelijk op pauze</h1>
              <p style="font-size:15px; color:#777; margin-top:10px;">Je kunt je abonnement maximaal 4 weken per jaar pauzeren – daarna wordt het automatisch hervat.</p>
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
              <div style="background:#fff7f4; border-left:5px solid #FD5001; border-radius:12px; padding:20px;">
                <h3 style="margin-top:0; font-size:17px; color:#FD5001;">Wat betekent dit voor jou?</h3>
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
              <p style="font-size:15px; color:#333;">Wil je vóór die tijd weer starten?</p>
              <a href=""https://fitpreps.nl/login" style="background-color:#FD5001; color:#ffffff; padding:12px 32px; font-size:15px; font-weight:bold; text-decoration:none; border-radius:32px; display:inline-block;">
                Hervat mijn abonnement
              </a>
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="padding-top:20px; font-size:15px; color:#555; text-align:center;">
              <p style="margin-bottom:6px;">Heb je vragen of hulp nodig?</p>
              <p style="margin:0;">We staan voor je klaar via <a href="mailto:info@fitpreps.nl" style="color:#FD5001;">info@fitpreps.nl</a></p>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding-top:40px; font-size:15px; color:#333;">
              <p style="text-align:center;">Tot snel!<br><strong>Met gezonde groet,<br>Team Fit Preps</strong></p>
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
              <a href="https://fitpreps.nl/login" style="display: inline-block; background-color: #ff4e00; color: #ffffff; text-decoration: none; padding: 10px 20px; font-size: 16px; border-radius: 5px;">View My Subscription</a>
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
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
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
        <div style="background-color:#f0f9f4; border:2px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px; text-align:center;">
          <h2 style="margin:0; color:#FD5001; font-size:22px;">${deliveryDate}</h2>
        </div>
        
        <!-- Delivery Information -->
        <div style="background-color:#f9f5f2; border-left:4px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD5001; font-size:18px;">Leverinformatie:</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Je pakket wordt geleverd op de dag van levering tussen 17:00 en 22:00 uur.</li>
            <li style="margin-bottom:0;">Zodra je bestelling is meegegeven aan de bezorgdienst, ontvang je op de dag van levering een e-mail met je track & trace code, zodat je precies kunt volgen wanneer je jouw maaltijden kunt verwachten.</li>
          </ul>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          Zorg ervoor dat je beschikbaar bent op het opgegeven adres tijdens dit tijdvak. Heb je vragen over je levering? Mail ons gerust via <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a>.
        </p>
        
        <!-- Order Tracking Button (Optional) -->
        <div style="text-align:center; margin:30px 0;">
          <a href="https://fitpreps.nl/profile" style="background-color:#FD5001; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
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
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD5001; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD5001; text-decoration:none;">Instagram</a>
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
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
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
        <div style="background-color:#f0f9f4; border:2px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px; text-align:center;">
          <h2 style="margin:0; color:#FD5001; font-size:22px;">${deliveryDate} (tussen 17:00 en 22:00 uur)</h2>
        </div>
        
        <!-- Delivery Information -->
        <div style="background-color:#f9f5f2; border-left:4px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD5001; font-size:18px;">Wat kun je verwachten?</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Je ontvangt al je geselecteerde maaltijden in één levering.</li>
            <li style="margin-bottom:10px;">Op de dag van levering ontvang je een e-mail met een track & trace link, zodat je precies weet wanneer je het pakket kunt verwachten.</li>
            <li style="margin-bottom:0;">Zorg ervoor dat er iemand aanwezig is op het bezorgadres om het pakket in ontvangst te nemen tijdens het genoemde tijdvak.</li>
          </ul>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          Heb je vragen of wil je iets wijzigen? Stuur ons gerust een bericht via <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a>.
        </p>
        
        <!-- Order Tracking Button -->
        <div style="text-align:center; margin:30px 0;">
          <a href="https://fitpreps.nl/profile" style="background-color:#FD5001; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
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
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD5001; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD5001; text-decoration:none;">Instagram</a>
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

// Weekly subscription cancellation email
exports.subscriptionWeeklyCancelledController = async (mailOptions) => {
  try {
    const { to, name } = mailOptions;
    const subject = 'Je hebt je wekelijkse abonnement opgezegd';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Je hebt je wekelijkse abonnement opgezegd</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f7f7; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">Je hebt je wekelijkse abonnement opgezegd</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">Er wordt nog één keer een betaling gedaan en je ontvangt een laatste levering.</p>
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hi ${name},</p>
        
        <p style="font-size:16px; line-height:1.6;">
          We hebben je opzegging voor je wekelijkse Fit Preps abonnement ontvangen en verwerkt. Bedankt voor het vertrouwen in ons de afgelopen periode!
        </p>
        
        <div style="background-color:#f9f5f2; border-left:4px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD5001; font-size:18px;">Wat betekent dit?</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Op de eerstvolgende maandag wordt er nog één keer een betaling afgeschreven.</li>
            <li style="margin-bottom:10px;">Je ontvangt dan ook voor de laatste keer punten, zodat je nog een laatste levering kunt samenstellen.</li>
            <li style="margin-bottom:0;">Na deze levering wordt je abonnement automatisch stopgezet – er volgen geen betalingen of leveringen meer.</li>
          </ul>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          We hopen je in de toekomst weer terug te mogen verwelkomen!
        </p>
        
        <p style="font-size:16px; line-height:1.6;">
          Heb je vragen? Mail ons gerust via <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a> – we helpen je graag.
        </p>
        
        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          Met gezonde groet,<br>
          <strong>Team Fit Preps</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:0; font-size:14px; color:#888888;">
          Volg ons op 
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD5001; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD5001; text-decoration:none;">Instagram</a>
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
    console.error('Error sending weekly subscription cancelled email:', error);
    throw error;
  }
};

// Monthly subscription cancellation email
exports.subscriptionMonthlyCancelledController = async (mailOptions) => {
  try {
    const { to, name } = mailOptions;
    const subject = 'Je hebt je maandelijkse abonnement opgezegd';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Je hebt je maandelijkse abonnement opgezegd</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f7f7; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">Je hebt je maandelijkse abonnement opgezegd</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">Je volgende abonnementsmaand is je laatste – daarna stopt alles automatisch.</p>
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hi ${name},</p>
        
        <p style="font-size:16px; line-height:1.6;">
          We hebben je opzegging voor je maandelijkse Fit Preps abonnement ontvangen en verwerkt.
          Bedankt dat je klant bij ons was – we waarderen het enorm!
        </p>
        
        <div style="background-color:#f9f5f2; border-left:4px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD5001; font-size:18px;">Wat betekent dit?</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Je huidige maand loopt nog zoals gepland.</li>
            <li style="margin-bottom:10px;">Op je eerstvolgende verlengdatum wordt er voor de laatste keer een betaling gedaan.</li>
            <li style="margin-bottom:10px;">Je ontvangt dan ook voor de laatste keer punten om maaltijden te bestellen.</li>
            <li style="margin-bottom:0;">Na die levering wordt je abonnement automatisch stopgezet – er volgen geen verdere betalingen of leveringen.</li>
          </ul>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          We hopen je in de toekomst opnieuw te mogen verwelkomen!
        </p>
        
        <p style="font-size:16px; line-height:1.6;">
          Heb je vragen? Mail ons gerust via <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a> – we helpen je graag verder.
        </p>
        
        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          Met gezonde groet,<br>
          <strong>Team Fit Preps</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:0; font-size:14px; color:#888888;">
          Volg ons op 
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD5001; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD5001; text-decoration:none;">Instagram</a>
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
    console.error('Error sending monthly subscription cancelled email:', error);
    throw error;
  }
};

// Owner notification when someone starts a new subscription
exports.newSubscriptionNotificationController = async (subscriptionData) => {
  try {
    const { customer, plan, startDate, total, items } = subscriptionData;
    
    // Format items if they exist
    const itemsHTML = items && items.length ? items
      .map(item => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${item.name || 'N/A'}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity || '1'}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">€${parseFloat(item.price || 0).toFixed(2)}</td>
        </tr>
      `).join('') 
      : '<tr><td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: center;">Geen items gespecificeerd</td></tr>';
    
    const subject = `Nieuwe Abonnement Gestart: ${customer.name || 'Nieuwe Klant'} of ${total} - ${plan}`;
    const html = `
    <!DOCTYPE html>
    <html lang="nl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nieuwe Abonnement Notificatie</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f7f7f7; font-family:'Helvetica Neue', Arial, sans-serif;">
    
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <tr>
          <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
            <h1 style="color:#ffffff; font-size:26px; margin:0;">Nieuwe Abonnement Gestart! 🚀</h1>
            <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">Een nieuwe klant heeft zich aangemeld bij Fit Preps</p>
          </td>
        </tr>
        
        <!-- Main Content -->
        <tr>
          <td style="padding:30px; color:#333333;">
            <h2 style="font-size:20px; margin-top:0;">Abonnement Details:</h2>
            
            <!-- Customer Info -->
            <table width="100%" style="border-collapse: collapse; margin-bottom: 25px;">
              <tr>
                <td width="30%" style="font-weight:bold; padding: 8px 0;">Klant:</td>
                <td style="padding: 8px 0;">${customer.name || 'N/A'}</td>
              </tr>
              <tr>
                <td style="font-weight:bold; padding: 8px 0;">Email:</td>
                <td style="padding: 8px 0;">${customer.email || 'N/A'}</td>
              </tr>
              <tr>
                <td style="font-weight:bold; padding: 8px 0;">Telefoon:</td>
                <td style="padding: 8px 0;">${customer.phone || 'N/A'}</td>
              </tr>
              <tr>
                <td style="font-weight:bold; padding: 8px 0;">Abonnement Type:</td>
                <td style="padding: 8px 0;">${plan || 'N/A'}</td>
              </tr>
              <tr>
                <td style="font-weight:bold; padding: 8px 0;">Start Datum:</td>
                <td style="padding: 8px 0;">${startDate || new Date().toLocaleDateString('nl-NL')}</td>
              </tr>
              <tr>
                <td style="font-weight:bold; padding: 8px 0;">Totaalbedrag:</td>
                <td style="padding: 8px 0; font-weight: bold; color: #FD5001;">€${parseFloat(total || 0).toFixed(2)}</td>
              </tr>
            </table>
            
        
            
            <!-- CTA Button -->
            <div style="text-align:center; margin:30px 0 20px;">
              <a href="https://fitpreps.nl/admin/subscriptions" style="background-color:#FD5001; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
                Bekijk in Admin Dashboard
              </a>
            </div>
            
            <p style="font-size:16px; line-height:1.6; margin-top:20px; color: #666;">
              Dit is een automatische notificatie over een nieuw abonnement in het Fit Preps systeem.
            </p>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
            <p style="margin:10px 0 0; font-size:14px; color:#888888;">
              © ${new Date().getFullYear()} Fit Preps • Systeem Notificatie
            </p>
          </td>
        </tr>
        
      </table>
    
    </body>
    </html>
    `;
    
    // Send email to the owner's email address
    await sendEmail('info@fitpreps.nl', subject, html);
    console.log('New subscription notification sent to owner');
    
  } catch (error) {
    console.error('Error sending new subscription notification email:', error);
  }
};

// Weekly subscription renewal notification
exports.weeklyRenewalNotificationController = async (mailOptions) => {
  try {
    const { to, name } = mailOptions;
    const subject = 'Nieuwe week, nieuwe maaltijden – Je punten zijn toegevoegd!';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nieuwe week, nieuwe maaltijden – Je punten zijn toegevoegd!</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f7f7; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">Nieuwe week, nieuwe maaltijden!</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">Je punten zijn toegevoegd aan je account</p>
      </td>
    </tr>
    
    <!-- Hero Image -->
    <tr>
      <td>
        <img src="https://res.cloudinary.com/dwrk5sbbb/image/upload/v1744423616/fitpreps/qsweql7kcuhevqzwexbd.webp" alt="Fit Preps Maaltijden" style="width:100%; height:auto; display:block;">
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hi ${name},</p>
        
        <p style="font-size:16px; line-height:1.6;">
          Het is maandag, dus dat betekent dat je wekelijkse Fit Preps abonnement is vernieuwd.
          Je punten zijn zojuist toegevoegd aan je account en je kunt vanaf nu je maaltijden kiezen voor de komende week.
        </p>
        
        <div style="background-color:#f9f5f2; border-left:4px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD5001; font-size:18px;">Wat kun je nu doen?</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Log in op je account</li>
            <li style="margin-bottom:10px;">Kies je favoriete maaltijden</li>
            <li style="margin-bottom:0;">Selecteer je leverdag voor volgende week (maandag t/m vrijdag)</li>
          </ul>
        </div>
        
        <div style="background-color:#fffbf0; border:2px dashed #FD5001; padding:20px; margin:25px 0; border-radius:8px; text-align:center;">
          <h3 style="margin-top:0; color:#333; font-size:18px;">Let op:</h3>
          <p style="margin-bottom:0; font-size:16px;">
            Als je geen keuze maakt, sturen we je automatisch dezelfde maaltijden als vorige week op dezelfde leverdag.<br>
            We herinneren je hieraan nogmaals via e-mail op vrijdag en zondag.
          </p>
        </div>
        
        <!-- Call to Action Button -->
        <div style="text-align:center; margin:30px 0;">
          <a href="https://fitpreps.nl/login" style="background-color:#FD5001; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
            Kies je maaltijden
          </a>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          Heb je vragen? Mail ons gerust via <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a>.
        </p>
        
        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          Fijne week en eet smakelijk!<br>
          <strong>Team Fit Preps</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:0; font-size:14px; color:#888888;">
          Volg ons op 
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD5001; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD5001; text-decoration:none;">Instagram</a>
        </p>
        <p style="margin:10px 0 0; font-size:14px; color:#888888;">
          © ${new Date().getFullYear()} Fit Preps • Alle rechten voorbehouden
        </p>
      </td>
    </tr>
    
  </table>

</body>
</html>
    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending weekly renewal notification email:', error);
    throw error;
  }
};

// Monthly subscription renewal notification
exports.monthlyRenewalNotificationController = async (mailOptions) => {
  try {
    const { to, name } = mailOptions;
    const subject = 'Nieuwe maand, nieuwe maaltijden – Je punten zijn toegevoegd!';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nieuwe maand, nieuwe maaltijden – Je punten zijn toegevoegd!</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f7f7; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">Nieuwe maand, nieuwe maaltijden!</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">Je punten zijn toegevoegd aan je account</p>
      </td>
    </tr>
    
    <!-- Hero Image -->
    <tr>
      <td>
        <img src="https://res.cloudinary.com/dwrk5sbbb/image/upload/v1744428317/fitpreps/ptc18wwvbhvqtotr6cyf.webp" alt="Fit Preps Maaltijden" style="width:100%; height:auto; display:block;">
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hi ${name},</p>
        
        <p style="font-size:16px; line-height:1.6;">
          Het is tijd voor een nieuwe maand, dus dat betekent dat je maandelijkse Fit Preps abonnement is vernieuwd.
          Je punten zijn zojuist toegevoegd aan je account en je kunt vanaf nu je maaltijden kiezen voor deze maand.
        </p>
        
        <div style="background-color:#f9f5f2; border-left:4px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD5001; font-size:18px;">Wat kun je nu doen?</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Log in op je account</li>
            <li style="margin-bottom:10px;">Kies je favoriete maaltijden</li>
            <li style="margin-bottom:0;">Selecteer je leverdag voor deze maand (maandag t/m vrijdag)</li>
          </ul>
        </div>
        
        <div style="background-color:#fffbf0; border:2px dashed #FD5001; padding:20px; margin:25px 0; border-radius:8px; text-align:center;">
          <h3 style="margin-top:0; color:#333; font-size:18px;">Let op:</h3>
          <p style="margin-bottom:0; font-size:16px;">
            Als je geen keuze maakt, sturen we je automatisch dezelfde maaltijden als vorige maand op dezelfde leverdag.<br>
            Zorg dat je op tijd je keuze doorgeeft voor optimale planning.
          </p>
        </div>
        
        <!-- Call to Action Button -->
        <div style="text-align:center; margin:30px 0;">
          <a href="https://fitpreps.nl/login" style="background-color:#FD5001; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
            Kies je maaltijden
          </a>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          Heb je vragen? Mail ons gerust via <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a>.
        </p>
        
        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          Fijne maand en eet smakelijk!<br>
          <strong>Team Fit Preps</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:0; font-size:14px; color:#888888;">
          Volg ons op 
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD5001; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD5001; text-decoration:none;">Instagram</a>
        </p>
        <p style="margin:10px 0 0; font-size:14px; color:#888888;">
          © ${new Date().getFullYear()} Fit Preps • Alle rechten voorbehouden
        </p>
      </td>
    </tr>
    
  </table>

</body>
</html>
    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending monthly renewal notification email:', error);
    throw error;
  }
};

// Friday meal reminder email
exports.fridayMealReminderController = async (mailOptions) => {
  try {
    const { to, name } = mailOptions;
    const subject = 'Vergeet je niet je maaltijden te kiezen voor volgende week?';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vergeet je niet je maaltijden te kiezen?</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f7f7; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">Vergeet je niet je maaltijden te kiezen?</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">Er is nog tijd om te selecteren voor volgende week</p>
      </td>
    </tr>
    
    <!-- Hero Image -->
    <tr>
      <td>
        <img src="https://res.cloudinary.com/dwrk5sbbb/image/upload/v1744423616/fitpreps/qsweql7kcuhevqzwexbd.webp" alt="Fit Preps Maaltijden" style="width:100%; height:auto; display:block;">
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hi ${name},</p>
        
        <p style="font-size:16px; line-height:1.6;">
          We zagen dat je je maaltijden voor volgende week nog niet hebt gekozen.
          Geen zorgen, je hebt nog de tijd!
        </p>
        
        <p style="font-size:16px; line-height:1.6;">
          Je kunt je maaltijden en leverdag voor volgende week nog selecteren tot zondag 23:59 uur.
        </p>
        
        <div style="background-color:#f9f5f2; border-left:4px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD5001; font-size:18px;">Wat moet je doen?</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Log in op je account</li>
            <li style="margin-bottom:10px;">Kies je maaltijden voor volgende week</li>
            <li style="margin-bottom:0;">Selecteer een leverdag (maandag t/m vrijdag)</li>
          </ul>
        </div>
        
        <div style="background-color:#fffbf0; border:2px dashed #FD5001; padding:20px; margin:25px 0; border-radius:8px; text-align:center;">
          <h3 style="margin-top:0; color:#333; font-size:18px;">Let op:</h3>
          <p style="margin-bottom:0; font-size:16px;">
            Als je voor zondag 23:59 geen keuze maakt, ontvang je automatisch dezelfde maaltijden als vorige week op dezelfde leverdag.
          </p>
        </div>
        
        <!-- Call to Action Button -->
        <div style="text-align:center; margin:30px 0;">
          <a href="https://fitpreps.nl/login" style="background-color:#FD5001; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
            Kies je maaltijden nu
          </a>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          Heb je vragen? Stuur ons gerust een berichtje via <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a>.
        </p>
        
        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          Fijn weekend!<br>
          <strong>Team Fit Preps</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:0; font-size:14px; color:#888888;">
          Volg ons op 
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD5001; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD5001; text-decoration:none;">Instagram</a>
        </p>
        <p style="margin:10px 0 0; font-size:14px; color:#888888;">
          © ${new Date().getFullYear()} Fit Preps • Alle rechten voorbehouden
        </p>
      </td>
    </tr>
    
  </table>

</body>
</html>
    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending Friday meal reminder email:', error);
    throw error;
  }
};

// Sunday meal reminder email (final reminder)
exports.sundayMealReminderController = async (mailOptions) => {
  try {
    const { to, name } = mailOptions;
    const subject = 'Laatste reminder – Maaltijden voor volgende week';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laatste reminder – Maaltijden voor volgende week</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f7f7; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">Laatste reminder</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">Vandaag is de deadline voor je maaltijdkeuze</p>
      </td>
    </tr>
    
    <!-- Countdown Banner -->
    <tr>
      <td style="background-color:#fff1ea; padding:15px; text-align:center; font-weight:bold; color:#333; font-size:16px;">
        ⏰ Nog enkele uren beschikbaar: Tot vanavond 23:59
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hi ${name},</p>
        
        <p style="font-size:16px; line-height:1.6;">
          Je hebt nog geen keuze gemaakt voor je maaltijden en leverdag van volgende week.
        </p>
        
        <div style="background-color:#fffbf0; border:2px dashed #FD5001; padding:20px; margin:25px 0; border-radius:8px; text-align:center;">
          <h3 style="margin-top:0; color:#333; font-size:18px;">Geen stress</h3>
          <p style="margin-bottom:0; font-size:16px;">
            Als je bewust dezelfde maaltijden en leverdag als vorige week wilt, hoef je niets te doen. We zorgen ervoor dat je dezelfde selectie ontvangt op dezelfde dag als vorige week.
          </p>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          Wil je toch iets aanpassen? Dan kan dat nog tot vanavond 23:59 via je account:
        </p>
        
        <div style="background-color:#f9f5f2; border-left:4px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px;">
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Log in</li>
            <li style="margin-bottom:10px;">Kies je maaltijden</li>
            <li style="margin-bottom:0;">Selecteer een leverdag (maandag t/m vrijdag)</li>
          </ul>
        </div>
        
        <!-- Call to Action Button -->
        <div style="text-align:center; margin:30px 0;">
          <a href="https://fitpreps.nl/subscriptions/addmeals" style="background-color:#FD5001; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
            Aanpassen vóór 23:59
          </a>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          Heb je vragen of hulp nodig? Stuur gerust een mailtje naar <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a>.
        </p>
        
        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          Fijne zondag!<br>
          <strong>Team Fit Preps</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:0; font-size:14px; color:#888888;">
          Volg ons op 
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD5001; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD5001; text-decoration:none;">Instagram</a>
        </p>
        <p style="margin:10px 0 0; font-size:14px; color:#888888;">
          © ${new Date().getFullYear()} Fit Preps • Alle rechten voorbehouden
        </p>
      </td>
    </tr>
    
  </table>

</body>
</html>
    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending Sunday meal reminder email:', error);
    throw error;
  }
};


// Monthly meal reminder for subscribers who haven't chosen meals
exports.monthlyMealReminderControllerFirst = async (mailOptions) => {
  try {
    const { to, name } = mailOptions;
    const subject = 'Je hebt je maaltijden nog niet gekozen voor deze maand';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Je hebt je maaltijden nog niet gekozen</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f7f7; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">Je maaltijden staan klaar om gekozen te worden</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">Selecteer je favoriete gerechten voor deze maand</p>
      </td>
    </tr>
    
    <!-- Hero Image -->
    <tr>
      <td>
        <img src="https://res.cloudinary.com/dwrk5sbbb/image/upload/v1744428317/fitpreps/ptc18wwvbhvqtotr6cyf.webp" alt="Fit Preps Maaltijden" style="width:100%; height:auto; display:block;">
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hi ${name},</p>
        
        <p style="font-size:16px; line-height:1.6;">
          Je abonnement is inmiddels een week actief, maar we zien dat je nog geen maaltijden en leverdatum hebt gekozen voor deze maand.
        </p>
        
        <p style="font-size:16px; line-height:1.6;">
          <strong>Geen zorgen – je hebt nog steeds de tijd!</strong>
        </p>
        
        <p style="font-size:16px; line-height:1.6;">
          Je kunt je maaltijden eenvoudig selecteren en een leverdag kiezen (maandag t/m vrijdag), zolang dit binnen je abonnementsperiode valt.
        </p>
        
        <div style="background-color:#f9f5f2; border-left:4px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD5001; font-size:18px;">Wat moet je doen?</h3>
          <ul style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Log in op je account</li>
            <li style="margin-bottom:10px;">Kies je maaltijden</li>
            <li style="margin-bottom:0;">Selecteer je gewenste leverdag</li>
          </ul>
        </div>
        
        <!-- Call to Action Button -->
        <div style="text-align:center; margin:30px 0;">
          <a href="https://fitpreps.nl/login" style="background-color:#FD5001; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
            Maaltijden kiezen
          </a>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          Heb je hulp nodig of vragen? Stuur ons gerust een berichtje via <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a>.
        </p>
        
        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          We kijken ernaar uit om je maaltijden te bezorgen!<br>
          <strong>Team Fit Preps</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:0; font-size:14px; color:#888888;">
          Volg ons op 
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD5001; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD5001; text-decoration:none;">Instagram</a>
        </p>
        <p style="margin:10px 0 0; font-size:14px; color:#888888;">
          © ${new Date().getFullYear()} Fit Preps • Alle rechten voorbehouden
        </p>
      </td>
    </tr>
    
  </table>

</body>
</html>
    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending monthly meal reminder email:', error);
    throw error;
  }
};


// Monthly Second chance email for customers who haven't selected meals before subscription end
exports.monthlyMealReminderControllerSecond = async (mailOptions) => {
  try {
    const { to, name, lastDeliveryDate } = mailOptions;
    const subject = 'Nog geen maaltijden gekozen? Laatste kans voor deze maand!';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Laatste kans om maaltijden te kiezen</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:'Segoe UI', sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:660px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.07);">

    <!-- Header -->
    <tr>
      <td style="background-color:#FD5001; text-align:center; padding:40px 30px 20px 30px;">
        <h1 style="margin:0; font-size:28px; color:#fff; font-family:'Georgia', serif;">Laatste kans voor deze maand!</h1>
        <p style="color:#ffe9dc; font-size:15px; margin-top:10px;">Je maandabonnement loopt bijna af</p>
      </td>
    </tr>
    <tr>
      <td style="line-height:0;">
        <svg viewBox="0 0 500 50" preserveAspectRatio="none" style="display:block; width:100%; height:50px;">
          <path d="M0,0 C150,100 350,-50 500,30 L500,00 L0,0 Z" style="fill:#FD5001;"></path>
        </svg>
      </td>
    </tr>

    <!-- Hero Image -->
    <tr>
      <td>
        <img src="https://res.cloudinary.com/dwrk5sbbb/image/upload/v1744428317/fitpreps/ptc18wwvbhvqtotr6cyf.webp" alt="Fit Preps Maaltijden" style="width:100%; display:block; height:auto;">
      </td>
    </tr>

    <!-- Message Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.7;">Hi <strong>${name}</strong>,</p>

        <p style="font-size:16px; line-height:1.7;">
          Je maandabonnement loopt bijna af, maar we zien dat je nog geen maaltijden en leverdatum hebt gekozen.
        </p>

        <p style="font-size:16px; line-height:1.7;">
          Geen probleem, je hebt nog een paar dagen om je bestelling te plaatsen.
          Als je geen keuze maakt, sturen we je maaltijden automatisch op de laatst mogelijke leverdag van deze maand, 
          met dezelfde selectie als vorige maand (indien beschikbaar).
        </p>

        <!-- Info Block -->
        <div style="background:#fff6f2; border-left:5px solid #FD5001; padding:20px; border-radius:8px; margin:30px 0;">
          <h3 style="margin-top:0; margin-bottom:10px; font-size:18px; color:#333;">Wat kun je nu doen?</h3>
          <ul style="padding-left:20px; margin:0;">
            <li style="padding:5px 0; font-size:16px;">Log in op je account</li>
            <li style="padding:5px 0; font-size:16px;">Kies je maaltijden</li>
            <li style="padding:5px 0; font-size:16px;">Selecteer je leverdag (maandag t/m vrijdag, vóór einde abonnementsperiode)</li>
          </ul>
        </div>

        <p style="font-size:16px; line-height:1.7; font-weight:bold;">
          Let op: Je hebt tot uiterlijk ${lastDeliveryDate || 'het einde van de maand'} om je keuze door te geven.
        </p>
      </td>
    </tr>

    <!-- CTA Button -->
    <tr>
      <td style="padding:0 30px 30px; text-align:center;">
        <a href="https://fitpreps.nl/profile" style="background-color:#FD5001; color:#ffffff; padding:14px 36px; font-size:16px; font-weight:bold; border-radius:30px; text-decoration:none; display:inline-block;">
          Kies mijn maaltijden
        </a>
      </td>
    </tr>

    <!-- Support Info -->
    <tr>
      <td style="padding:0 30px 30px; color:#555555; font-size:15px;">
        <p style="margin:0 0 16px 0;">Vragen? Mail ons via info@fitpreps.nl – we helpen je graag verder.</p>
        <p style="margin:0 0 16px 0;">Met gezonde groet,<br><strong>Team Fit Preps</strong></p>
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
    console.error('Error sending monthly last chance reminder:', error);
    throw error;
  }
};



// Monthly last day reminder - for customers who haven't selected meals and delivery is tomorrow
exports.monthlyMealReminderControllerLast = async (mailOptions) => {
  try {
    const { to, name } = mailOptions;
    const subject = 'Laatste kans: je maaltijden worden morgen geleverd';
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Laatste kans: je maaltijden worden morgen geleverd</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:'Segoe UI', sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:660px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.07);">

    <!-- Header -->
    <tr>
      <td style="background-color:#FD5001; text-align:center; padding:40px 30px 20px 30px;">
        <h1 style="margin:0; font-size:28px; color:#fff; font-family:'Georgia', serif;">Laatste kans!</h1>
        <p style="color:#ffe9dc; font-size:15px; margin-top:10px;">Je maaltijden worden morgen geleverd</p>
      </td>
    </tr>
    <tr>
      <td style="line-height:0;">
        <svg viewBox="0 0 500 50" preserveAspectRatio="none" style="display:block; width:100%; height:50px;">
          <path d="M0,0 C150,100 350,-50 500,30 L500,00 L0,0 Z" style="fill:#FD5001;"></path>
        </svg>
      </td>
    </tr>

    <!-- Urgent Banner -->
    <tr>
      <td style="background-color:#fff1ea; border-bottom:1px solid #ffe0d0; padding:15px; text-align:center; font-weight:bold; color:#FD5001; font-size:16px;">
        ⏰ Laatste dag om je keuze door te geven: tot vanavond 23:59
      </td>
    </tr>

    <!-- Message Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.7;">Hi <strong>${name}</strong>,</p>

        <p style="font-size:16px; line-height:1.7;">
          Je hebt nog geen maaltijden gekozen voor deze maand, en <strong>morgen is de laatste mogelijke leverdag</strong> binnen jouw abonnement.
        </p>

        <p style="font-size:16px; line-height:1.7;">
          Als je vandaag geen keuze maakt, zullen we je dezelfde maaltijden leveren als vorige maand, op het adres dat bij ons bekend is.
        </p>

        <!-- Info Block -->
        <div style="background:#fff6f2; border-left:5px solid #FD5001; padding:20px; border-radius:8px; margin:30px 0;">
          <h3 style="margin-top:0; margin-bottom:10px; font-size:18px; color:#333;">Wil je toch nog iets wijzigen?</h3>
          <p style="font-size:16px; margin-top:0; margin-bottom:10px;">Dan heb je nog tot vandaag 23:59 om:</p>
          <ul style="padding-left:20px; margin:0;">
            <li style="padding:5px 0; font-size:16px;">Je maaltijden aan te passen</li>
            <li style="padding:5px 0; font-size:16px;">Een andere leverdag te kiezen (indien beschikbaar)</li>
          </ul>
        </div>
      </td>
    </tr>

    <!-- CTA Button -->
    <tr>
      <td style="padding:0 30px 30px; text-align:center;">
        <a href="https://fitpreps.nl/profile" style="background-color:#FD5001; color:#ffffff; padding:14px 36px; font-size:16px; font-weight:bold; border-radius:30px; text-decoration:none; display:inline-block;">
          Laatste wijziging maken
        </a>
      </td>
    </tr>

    <!-- Support Info -->
    <tr>
      <td style="padding:0 30px 30px; color:#555555; font-size:15px;">
        <p style="margin:0 0 16px 0;">Heb je vragen of hulp nodig? Mail ons via <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a>.</p>
        <p style="margin:0 0 16px 0;">We staan morgen voor je klaar!<br><strong>Team Fit Preps</strong></p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#f1f1f1; text-align:center; padding:20px; font-size:12px; color:#999999;">
        © ${new Date().getFullYear()} Fit Preps • Alle rechten voorbehouden
      </td>
    </tr>
  </table>

</body>
</html>
    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending monthly last day reminder:', error);
    throw error;
  }
};

exports.dailyEmailSummaryControllerOwner = async (mailOptions) => {
  try {
    const { to, emailStats } = mailOptions;
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const subject = `Daily Email Summary Report - ${date}`;
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Email Summary Report</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:660px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.07);">

    <!-- Header -->
    <tr>
      <td style="background-color:#FD5001; text-align:center; padding:30px 20px;">
        <h1 style="margin:0; font-size:24px; color:#fff;">Daily Email Summary Report</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">${date}</p>
      </td>
    </tr>

    <!-- Summary Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hello,</p>

        <p style="font-size:16px; line-height:1.6;">
          Here is a summary of reminder emails sent to customers today:
        </p>

        <!-- Statistics Table -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:25px 0; border-collapse:collapse;">
          <tr style="background-color:#f9f9f9;">
            <th style="padding:12px 15px; text-align:left; border:1px solid #ddd;">Email Type</th>
            <th style="padding:12px 15px; text-align:center; border:1px solid #ddd;">Count</th>
          </tr>
          ${Object.entries(emailStats).map(([type, count]) => `
            <tr>
              <td style="padding:12px 15px; border:1px solid #ddd;">${type}</td>
              <td style="padding:12px 15px; text-align:center; border:1px solid #ddd;">${count}</td>
            </tr>
          `).join('')}
          <tr style="background-color:#f0f0f0; font-weight:bold;">
            <td style="padding:12px 15px; border:1px solid #ddd;">Total</td>
            <td style="padding:12px 15px; text-align:center; border:1px solid #ddd;">${Object.values(emailStats).reduce((sum, count) => sum + count, 0)}</td>
          </tr>
        </table>

        <!-- Additional Info -->
        <div style="background-color:#f0f9f4; border-left:4px solid #FD5001; padding:20px; margin:30px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#333; font-size:18px;">Overview</h3>
          <p style="margin:0; font-size:15px; line-height:1.6;">
            These email reminders were automatically sent to customers based on subscription status and meal selection activity.
            Use this information to monitor customer engagement and identify potential improvements to the reminder system.
          </p>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#f1f1f1; text-align:center; padding:20px; font-size:12px; color:#666666;">
        <p style="margin:0;">This is an automated report. Please do not reply to this email.</p>
        <p style="margin:10px 0 0;">© ${new Date().getFullYear()} Fit Preps • All rights reserved</p>
      </td>
    </tr>
  </table>

</body>
</html>
    `;
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error('Error sending daily email summary:', error);
    throw error;
  }
};

// Notify owner when a subscription payment fails
exports.paymentFailureNotificationController = async (subscriptionData) => {
  try {
    const { customerName, customerEmail, subscriptionId, amount, paymentDate, errorMessage, plan } = subscriptionData;
    
    const subject = `⚠️ Mislukte Betaling: ${customerName} - ${plan} Abonnement`;
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Betalingsfout Notificatie</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f7f7; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#ff3a30; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">⚠️ Betalingsfout Gedetecteerd</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">Een abonnementsverlenging is mislukt</p>
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hallo,</p>
        
        <p style="font-size:16px; line-height:1.6;">
          Er is een probleem opgetreden bij het verwerken van een terugkerende betaling voor een abonnement.
          Hieronder staan de details:
        </p>
        
        <!-- Payment Info -->
        <table width="100%" style="border-collapse: collapse; margin: 25px 0; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
          <tr style="background-color:#f5f5f5;">
            <td style="padding: 12px 15px; font-weight: bold; border-bottom: 1px solid #eee;">Klant</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #eee;">${customerName}</td>
          </tr>
          <tr>
            <td style="padding: 12px 15px; font-weight: bold; border-bottom: 1px solid #eee;">Email</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #eee;">${customerEmail}</td>
          </tr>
          <tr style="background-color:#f5f5f5;">
            <td style="padding: 12px 15px; font-weight: bold; border-bottom: 1px solid #eee;">Abonnement ID</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #eee;">${subscriptionId}</td>
          </tr>
          <tr>
            <td style="padding: 12px 15px; font-weight: bold; border-bottom: 1px solid #eee;">Abonnement Type</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #eee;">${plan}</td>
          </tr>
          <tr style="background-color:#f5f5f5;">
            <td style="padding: 12px 15px; font-weight: bold; border-bottom: 1px solid #eee;">Bedrag</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #eee;">€${parseFloat(amount || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 12px 15px; font-weight: bold; border-bottom: 1px solid #eee;">Poging Datum</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #eee;">${paymentDate}</td>
          </tr>
          <tr style="background-color:#fff1f0;">
            <td style="padding: 12px 15px; font-weight: bold; color: #ff3a30;">Foutmelding</td>
            <td style="padding: 12px 15px; color: #ff3a30;">${errorMessage || 'Onbekende fout bij betalingsverwerking'}</td>
          </tr>
        </table>
        
        <div style="background-color:#fff1f0; border-left:4px solid #ff3a30; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#ff3a30; font-size:18px;">Aanbevolen Actie:</h3>
          <p style="margin-bottom:10px; font-size:16px;">
            Deze klant heeft mogelijk problemen met hun betaalmethode. Aanbevolen acties:
          </p>
          <ol style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:5px;">Contact opnemen met de klant om hen over de mislukte betaling te informeren</li>
            <li style="margin-bottom:5px;">Verzoeken om hun betaalgegevens bij te werken</li>
            <li style="margin-bottom:0;">Handmatig de betaling opnieuw proberen te verwerken na bevestiging</li>
          </ol>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align:center; margin:30px 0 20px;">
          <a href="https://admin.fitpreps.nl/admin/subscriptions" style="background-color:#FD5001; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
            Bekijk in Admin Dashboard
          </a>
        </div>
        
        <p style="font-size:16px; line-height:1.6; margin-top:20px; color: #666;">
          Dit is een automatisch gegenereerde notificatie. Snel handelen wordt aanbevolen om abonnementsbehoud te garanderen.
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:10px 0 0; font-size:14px; color:#888888;">
          © ${new Date().getFullYear()} Fit Preps • Systeem Notificatie
        </p>
      </td>
    </tr>
    
  </table>

</body>
</html>
    `;
    
    // Send email to the owner's email address
    await sendEmail('info@fitpreps.nl', subject, html);
    await sendEmail('siyamrh7@gmail.com', subject, html);

    console.log('Payment failure notification sent to owner');
    
    // If needed, also notify the customer about the payment failure
    const customerSubject = 'Belangrijk: We konden je betaling niet verwerken';
    const customerHtml = `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Betalingsprobleem met je Fit Preps abonnement</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f7f7; font-family:'Helvetica Neue', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color:#FD5001; padding:30px 20px; text-align:center;">
        <h1 style="color:#ffffff; font-size:26px; margin:0;">Betalingsprobleem Gedetecteerd</h1>
        <p style="color:#ffe9dc; font-size:16px; margin-top:8px;">We hebben je hulp nodig om je abonnement te behouden</p>
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding:30px; color:#333333;">
        <p style="font-size:16px; line-height:1.6;">Hallo ${customerName},</p>
        
        <p style="font-size:16px; line-height:1.6;">
          We hebben geprobeerd je maandelijkse betaling van €${parseFloat(amount || 0).toFixed(2)} voor je ${plan} abonnement te verwerken, maar helaas is dit niet gelukt.
        </p>
        
        <div style="background-color:#f9f5f2; border-left:4px solid #FD5001; padding:20px; margin:25px 0; border-radius:8px;">
          <h3 style="margin-top:0; color:#FD5001; font-size:18px;">Wat kun je doen?</h3>
          <ol style="padding-left:20px; margin-bottom:0;">
            <li style="margin-bottom:10px;">Log in op je account</li>
            <li style="margin-bottom:10px;">Controleer of je betaalgegevens nog up-to-date zijn</li>
            <li style="margin-bottom:0;">Update indien nodig je betaalmethode</li>
          </ol>
        </div>
        
        <p style="font-size:16px; line-height:1.6;">
          We zullen de betaling binnenkort opnieuw proberen. Als je vragen hebt of hulp nodig hebt, 
          neem dan gerust contact met ons op via <a href="mailto:info@fitpreps.nl" style="color:#FD5001; text-decoration:underline;">info@fitpreps.nl</a>.
        </p>
        
        <!-- Call to Action Button -->
        <div style="text-align:center; margin:30px 0;">
          <a href="https://fitpreps.nl/profile" style="background-color:#FD5001; color:#ffffff; padding:14px 32px; font-size:16px; text-decoration:none; border-radius:6px; display:inline-block;">
            Update Mijn Betaalgegevens
          </a>
        </div>
        
        <p style="font-size:16px; line-height:1.6; margin-top:30px;">
          Met vriendelijke groet,<br>
          <strong>Team Fit Preps</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:20px; text-align:center; background-color:#f9f9f9; border-top:1px solid #eeeeee;">
        <p style="margin:0; font-size:14px; color:#888888;">
          Volg ons op 
          <a href="https://www.facebook.com/FitPrepsOfficial" style="color:#FD5001; text-decoration:none;">Facebook</a> en 
          <a href="https://www.instagram.com/fitpreps.nl/?hl=en" style="color:#FD5001; text-decoration:none;">Instagram</a>
        </p>
        <p style="margin:10px 0 0; font-size:14px; color:#888888;">
          © ${new Date().getFullYear()} Fit Preps • Alle rechten voorbehouden
        </p>
      </td>
    </tr>
    
  </table>

</body>
</html>
    `;
    
    // Send email to the customer
    await sendEmail(customerEmail, customerSubject, customerHtml);
    console.log('Payment failure notification sent to customer');
    
  } catch (error) {
    console.error('Error sending payment failure notification emails:', error);
  }
};
