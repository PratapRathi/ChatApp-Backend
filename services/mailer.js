const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config({ path: "../config.env" });
const mailTemplate = require("./mailTemplate");


// Create Transporter and setting up sender mail configuration
let transporter = nodemailer.createTransport({
    service: "Gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: "tawkrealchatapp@gmail.com",
        pass: process.env.EMAIL_APP_PASSWORD
    }
})

// Send Mail function and exporting it for API 
const sendOTP = async function main({ to, subject, otp }) {
    try {
        const html = mailTemplate.OTP(otp)
        return await transporter.sendMail({ to, subject, html:html });
    } catch (error) {
        console.log(error);
    }
}

const sendPasswordReset = async function main({ to, subject, token }) {
    try {
        const html = mailTemplate.PasswordReset(token);
        return await transporter.sendMail({ to, subject, html:html });
    } catch (error) {
        console.log(error);
    }
}


// ({ to: "example@gmail.com", subject: "Hello from Nodemailer", text: "Hello world?" });
module.exports = {sendOTP, sendPasswordReset};