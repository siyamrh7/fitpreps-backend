const nodemailer = require("nodemailer");
const path = require('path');

exports.contactController = async (req, res) => {


  try {
    const { email, phone, whatsapp, reason, message } = req.body;
    const file = req.file; // The uploaded file

    if (!email || !message) {
      return res.status(400).send({ error: "Email and message are required." });
    }
    // Configure transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.CONTACT_MAIL, // Replace with your email
        pass: process.env.CONTACT_MAIL_PASS, // Replace with your password or app password
      },
    });

    // Attach file if it exists
    const attachments = file
      ? [
        {
          filename: file.originalname,
          path: path.join(path.resolve(__dirname, "../uploads"), file.filename),
        },
      ]
      : [];

    // Mail options
    const mailOptions = {
      from: process.env.CONTACT_MAIL,
      to: process.env.CONTACT_MAIL,
      subject: `Contact Form Submission - ${reason || "No Reason Provided"}`,
      html: `
              <h3>Contact Form Submission</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Phone:</strong> ${phone || "Not Provided"}</p>
              <p><strong>WhatsApp:</strong> ${whatsapp || "Not Provided"}</p>
              <p><strong>Reason:</strong> ${reason || "No Reason Provided"}</p>
              <p><strong>Message:</strong> ${message}</p>
          `,
      attachments,
    };

    // Send email
    await transporter.sendMail(mailOptions);
    res.status(200).send({ success: "Email sent successfully with attachments!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).send({ error: "Error sending email. Please try again later." });
  }
};


exports.orderEmailController = async (orderData,title,description) => {


  try {
    // const { orderData } = req.body;
    // const file = req.file; // The uploaded file

    if (!orderData) {
      return res.status(400).send({ error: "Email and message are required." });
    }
    // Configure transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.CONTACT_MAIL, // Replace with your email
        pass: process.env.CONTACT_MAIL_PASS, // Replace with your password or app password
      },
    });

    // Attach file if it exists
    // const attachments = file
    //   ? [
    //     {
    //       filename: file.originalname,
    //       path: path.join(path.resolve(__dirname, "../uploads"), file.filename),
    //     },
    //   ]
    //   : [];
    const productHTML = orderData.items
    .map(
      (product) => `
      <div style="display: flex; margin-bottom: 10px;">
        <img src="${product.meta._thumbnail.replace("http://localhost:5001", "https://backend.fitpreps.nl")}" alt="${product.order_item_name}" style="width: 100px; height: 75px; margin-right: 10px; border: 1px solid #dddddd;">
        <div>
          <p style="margin: 0; font-size: 16px;"><strong>${product.order_item_name}</strong></p>
          <p style="margin: 5px 0 0; font-size: 14px;">Aantal: ${product.meta._qty}</p>
        </div>
        <p style="margin: 0 0 0 auto; font-size: 16px; font-weight: bold;">€ ${product.meta._line_total}</p>
      </div>
    `
    )
    .join(''); // Combine all product divs into a single string
  
    // Mail options
    const mailOptions = {
      from: "Fitpreps",
      to: orderData.metadata._shipping_email,
      subject: `Fitpreps.nl: Nieuwe bestelling #${orderData._id}`,
      html: `<div style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333;">
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
                <td style="padding: 5px 0; text-align: right;">€ ${orderData.metadata._order_shipping=="0" ? "Gratis" : (parseFloat(orderData.metadata._order_shipping) + parseFloat(orderData.metadata._order_shipping_tax)).toFixed(2)}</td>
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
          `,
      
    };

    // Send email
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log("Error sending email:", error);
  }
};
