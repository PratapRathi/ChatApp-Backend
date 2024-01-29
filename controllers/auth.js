const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const filterObj = require("../utils/filterObj.js");
const otpGenerator = require('otp-generator');
const crypto = require('crypto');
const { promisify } = require("util");
const sendMail = require("../services/mailer.js")


// Sign token using JWT for sending towards client side
const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET);


// Register new user
exports.register = async (req, res, next) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        const filteredBody = filterObj(req.body, "firstName", "lastName", "email");

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
            try {
                const updated_user = await User.findOneAndUpdate({ email: email }, filteredBody, { new: true, validateModifiedOnly: true });
                updated_user.password = password;
                await updated_user.save();
                // Generate OTP and send Email to the user
                req.userId = updated_user._id;
                next();
            } catch (error) {
                res.status(400).json({
                    status: "error",
                    message: `${error}`
                })
            }
        }

        // If user record user is not available in our Database
        else {
            try {
                const new_user = await User.create({...filteredBody, password});
                req.userId = new_user._id;
                next();
            } catch (error) {
                res.status(400).json({
                    status: "error",
                    message: `${error}`
                })
            }
        }
    } catch (error) {
        console.log(error);
    }

};

// Send OTP after user SignUp
exports.sendOTP = async (req, res, next) => {
    try {
        const { userId } = req;
        const new_otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })

        const otp_expiry_time = Date.now() + 10 * 60 * 1000; // 10 after otp is sent
        const user = await User.findByIdAndUpdate(userId, { otp_expiry_time });
        user.otp = new_otp.toString();
        await user.save({ new: true, validateModifiedOnly: true });

        // Send mail to the user
        await sendMail.sendOTP({ to: user.email, subject: "OTP for TAWK", otp: new_otp });

        res.status(200).json({
            status: "success",
            message: "OTP sent successfully",
        });
    } catch (error) {
        console.log(error);
    }
}


exports.verifyOTP = async (req, res, next) => {
    try {
        // verify OTP and update user record accordingly
        const { email, otp } = req.body;
        // Searching for user with provided email and checking otp is expired or not
        const user = await User.findOne({ email, otp_expiry_time: { $gt: Date.now() } });
        if (!user || !otp) {
            res.status(400).json({
                status: "error",
                message: "OTP expired or Email is invalid",
            });
            return;
        }

        // comparing OTP in DB and provided by user
        if (!await user.correctOTP(otp, user.otp)) {
            res.status(400).json({
                status: "error",
                message: "OTP is Incorrect",
            });
            return
        }

        // OTP is correct
        user.verified = true;
        user.otp = undefined;
        user.otp_expiry_time = undefined;
        await user.save({ new: true, validateModifiedOnly: true });

        // Sending token after verifying the otp
        const token = signToken(user._id);
        res.status(200).json({
            status: "success",
            message: "OTP verified successfully!",
            token
        });
    } catch (error) {
        console.log(error);
    }
}


// Login existing user
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({
                status: "error",
                message: "Both email and password are required"
            })
            return
        }

        const userDoc = await User.findOne({ email: email }).select("+password");

        if (!userDoc || !(await userDoc.correctPassword(password, userDoc.password))) {
            res.status(400).json({
                status: "error",
                message: "Email or Password is incorrect"
            })
            return
        }

        // If user is not verified and tried to login
        if (!userDoc.verified){
            res.status(400).json({
                status: "error",
                message: "User not Verified! Please verify with OTP"
            })
            return
        }

        // Sending token after verifying the email and password
        const token = signToken(userDoc._id);
        res.status(200).json({
            status: "success",
            message: "Logged in successfully",
            token
        });
    } catch (error) {
        console.log(error);
    }
}


exports.protect = async (req, res, next) => {
    try {
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
        const this_user = await User.findById(decoded.userId);
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
    } catch (error) {
        console.log(error);
    }
}


exports.forgotPassword = async (req, res, next) => {
    try {
        // 1) Search user with email
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            res.status(400).json({
                status: "error",
                message: `User does not exist with this Email`
            })
            return;
        }

        // 2) Generate a random reset token
        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        const resetURL = `http://localhost:3000/auth/new-password?token=${resetToken}`;

        try {
            //  Send Email with reset URL
            await sendMail.sendPasswordReset({ to: user.email, subject: "Password reset link for TAWK", token: resetURL });

            res.status(200).json({
                status: "success",
                message: `Reset password link sent to the ${user.email}`,
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
    } catch (error) {
        console.log(error);
    }
}


exports.resetPassword = async (req, res, next) => {
    try {
        // 1) Get user based on Token
        const hashedToken = crypto.createHash("sha256").update(req.body.token).digest("hex");
        const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpire: { $gt: Date.now() } });

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
    } catch (error) {
        console.log(error);
    }
}