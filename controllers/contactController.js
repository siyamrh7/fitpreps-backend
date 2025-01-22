const path = require('path');
const emailQueue = require('./emailQueue');
const fs =require('fs');
exports.contactController = async (req, res) => {


  try {
    const { email, phone, whatsapp, reason, message } = req.body;
    const file = req.file; // The uploaded file

    if (!email || !message) {
      return res.status(400).send({ error: "Email and message are required." });
    }
 

   
    const attachments = file
    ? [
        {
          '@odata.type': '#microsoft.graph.fileAttachment', // Required type for Microsoft Graph API attachments
          name: file.originalname, // Original file name
          contentType: `image/${path.extname(file.originalname).substring(1)}`, // Derive MIME type from file extension
          contentBytes: fs
            .readFileSync(
              path.join(
                path.resolve(__dirname, '../uploads'),
                file.filename
              )
            )
            .toString('base64'), // Read and encode file content as Base64
        },
      ]
    : [];
  
    const mailOptions = {
      subject: `Contact Form Submission - ${reason || "No Reason Provided"}`,
      //This "from" is optional if you want to send from group email. For this you need to give permissions in that group to send emails from it.
      from: {
        emailAddress: {
          address: 'bestellingen@fitpreps.nl',
        },
      },
      toRecipients: [
        {
          emailAddress: {
            address: "info@fitpreps.nl",
          },
        },
      ],
      body: {
        content:`
              <h3>Contact Form Submission</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Phone:</strong> ${phone || "Not Provided"}</p>
              <p><strong>WhatsApp:</strong> ${whatsapp || "Not Provided"}</p>
              <p><strong>Reason:</strong> ${reason || "No Reason Provided"}</p>
              <p><strong>Message:</strong> ${message}</p>
           `,
        contentType: 'html',
      },
      replyTo: [{emailAddress: {
        address: email,
      }}],
      attachments,
    };
    // Send email
    await emailQueue.add({mailOptions,emailType:"contact"});
    // await transporter.sendMail(mailOptions);
    res.status(200).send({ success: "Email sent successfully with attachments!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).send({ error: "Error sending email. Please try again later." });
  }
};

