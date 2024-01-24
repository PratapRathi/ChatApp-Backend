const jwt = require("jsonwebtoken");
const User = require("../models/user");
const filterObj = require("../utils/filterObj.js");
const otpGenerator = require('otp-generator');


// Sign token using JWT for sending towards client side
const signToken = (userID) => jwt.sign({ userID }, process.env.JWT_SECRET);


// Register new user
exports.register = async (req, res, next) => {
    const { firstName, lastName, email, password } = req.body;

    const filteredBody = filterObj(req.body, "firstName", "lastName", "email", "password");

    // Check if a verfied user already present with given Email address
    const existing_user = await User.findOne({ email: email });

    if (existing_user && existing_user.verified) {
        res.status(400).json({
            status: "error",
            message: "user already exist, please login"
        })
    }
    // If user record user is available but not verified their Email
    else if (existing_user) {
        const updated_user = await User.findOneAndUpdate({ email: email }, filteredBody, { new: true, validateModifiedOnly: true });
        // Generate OTP and send Email to the user
        req.userId = updated_user._id;
        next();
    }
    // If user record user is not available in our Database
    else {
        const new_user = await User.create(filteredBody);
        // Generate OTP and send Email to the user
        req.userId = new_user._id;
        next();
    }

}

// Send OTP after user SignUp
exports.sendOTP = async (req, res, next) => {
    const { userId } = req;
    const new_otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })

    const otp_expiry_time = Date.now() + 10 * 60 * 1000; // 10 after otp is sent
    await User.findByIdAndUpdate(userId, { otp: new_otp, otp_expiry_time });

    // TODO Send mail to the user


    res.status(200).json({
        status: "success",
        message: "OTP sent successfully",
    });

}


// Login existing user
exports.login = async (req, res, next) => {

    const [email, password] = req.body;
    if (!email || !password) {
        res.status(400).json({
            status: "Error",
            message: "Both email and password are required"
        })
    }

    const userDoc = User.findOne({ email: email }).select("+password");

    if (!userDoc || (await User.correctPassword(password, userDoc.password))) {
        res.status(400).json({
            status: "Error",
            message: "Email or Password in incorrect"
        })
    }

    const token = signToken(userDoc._id);

    res.status(200).json({
        status: "success",
        message: "Logged in successfully",
        token
    });

}