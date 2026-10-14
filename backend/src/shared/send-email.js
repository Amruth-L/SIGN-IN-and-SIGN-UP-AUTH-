const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async (to, subject, otpCode, name) => {
  const safeName = String(name || 'there').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #10b981; text-align: center;">CampusMesh</h2>
      <p style="font-size: 16px; color: #333;">Hello ${safeName},</p>
      <p style="font-size: 16px; color: #333;">Your verification code is:</p>
      <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otpCode}</span>
      </div>
      <p style="font-size: 14px; color: #666;">This code expires in 10 minutes.</p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;" />
      <p style="font-size: 14px; color: #999;">Thank you,<br/>CampusMesh Team</p>
    </div>
  `;

  const mailOptions = {
    from: `"CampusMesh" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlContent,
    text: `${subject}: ${otpCode}. This code expires in 10 minutes.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    throw error; // Re-throw to handle in controller
  }
};

module.exports = sendEmail;

