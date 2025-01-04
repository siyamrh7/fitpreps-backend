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
