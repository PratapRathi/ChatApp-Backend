const jwt = require("jsonwebtoken");
const User = require("../models/user");
const filterObj = require("../utils/filterObj.js");
const otpGenerator = require('otp-generator');
const crypto = require('crypto');
const { promisify } = require("util");


// Sign token using JWT for sending towards client side
const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET);


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


exports.verifyOTP = async (req, res, next) => {
    // verify OTP and update user record accordingly
    const { email, otp } = req.body;
    // Searching for user with provided email and checking otp is expired or not
    const user = await User.findOne({ email, otp_expiry_time: { $gt: Date.now() } });
    if (!user) {
        res.status(400).json({
            status: "error",
            message: "OTP expired or Email is invalid",
        });
    }

    // comparing OTP in DB and provided by user
    if (!await user.correctOTP(otp, user.otp)) {
        res.status(400).json({
            status: "error",
            message: "OTP is Incorrect",
        });
    }

    // OTP is correct
    user.verified = true;
    user.otp = undefined;
    await user.save({ new: true, validateModifiedOnly: true });

    // Sending token after verifying the otp
    const token = signToken(user._id);
    res.status(200).json({
        status: "success",
        message: "OTP verified successfully!",
        token
    });

}


// Login existing user
exports.login = async (req, res, next) => {

    const [email, password] = req.body;
    if (!email || !password) {
        res.status(400).json({
            status: "error",
            message: "Both email and password are required"
        })
    }

    const userDoc = User.findOne({ email: email }).select("+password");

    if (!userDoc || (await userDoc.correctPassword(password, userDoc.password))) {
        res.status(400).json({
            status: "error",
            message: "Email or Password in incorrect"
        })
    }

    // Sending token after verifying the email and password
    const token = signToken(userDoc._id);
    res.status(200).json({
        status: "success",
        message: "Logged in successfully",
        token
    });

}


exports.protect = async (req, res, next) => {
    // 1) Getting token(JWT) and checking if its actually there
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    }
    else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }
    else {
        res.status(400).json({
            status: "error",
            message: "You are not logged In! Please login to get access",
        });
        return;
    }

    // 2) Verfication of token
    const decoded = promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exist
    const this_user = User.findById(decoded.userId);
    if (!this_user) {
        res.status(400).json({
            status: "error",
            message: "User doesn't exist",
        });
    }

    // 4) check if user changed their password after token was issued
    if (this_user.passwordChangedAfterToken(decoded.iat)) {
        res.status(400).json({
            status: "error",
            message: "User changed the password! Please login again",
        });
    }

    // 5) Giving control to next middleware with decoded user updated in req
    req.user = this_user;
    next();
}


exports.forgotPassword = async (req, res, next) => {
    // 1) Search user with email
    const user = User.findOne({ email: req.body.email });
    if (!user) {
        res.status(400).json({
            status: "error",
            message: "User does not exist with this Email"
        })
        return;
    }

    // 2) Generate a random reset token
    const resetToken = user.createPasswordResetToken();

    const resetURL = `https://www.tawk.com/auth/reset-password/code=${resetToken}`;

    try {
        // TODO => Send Email with reset URL

        res.status(200).json({
            status: "success",
            message: "Reset password link sent to the Email",
        });

    } catch (error) {
        user.passwordResetToken = undefined;
        user.passwordResetExpire = undefined;

        await user.save({ validateBeforeSave: false });
        res.status(500).json({
            status: "error",
            message: "There is an error in sending Email, please try again later"
        })
    }

}


exports.resetPassword = async (req, res, next) => {
    // 1) Get user based on Token
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const user = User.findOne({ passwordResetToken: hashedToken, passwordResetExpire: { $gt: Date.now() } });

    // 2) If token is incorrect or expired
    if (!user) {
        res.status(400).json({
            status: "error",
            message: "Token is Invalid or Expired"
        })
        return;
    }

    // 3) Update user password in DB and set reset-token and expiry to undefined
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpire = undefined;
    // user.passwordChangedAt = Date.now();

    await user.save();

    // 4) Login the user and new JWT

    // TODO => send Email to user about password change information

    const token = signToken(user._id);
    res.status(200).json({
        status: "success",
        message: "Password reset successfully",
        token
    });

}