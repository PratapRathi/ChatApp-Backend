const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");
const crypto = require('crypto');


const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, "First Name is required"]
    },
    lastName: {
        type: String,
        required: [true, "Last Name is required"]
    },
    avatar: {
        type: String,
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        validate: {
            validator: function (email) {
                return String(email).toLowerCase().match(/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g)
            },
            message: (props)=> `(${props.value} is invalid)`
        }
    },
    password: {
        type: String,
        required: [true, "Password is required"]
    },
    passwordChangedAt: {
        type: Date
    },
    passwordResetToken: {
        type: String,
    },
    passwordResetExpire: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    updatedAt: {
        type: Date
    },
    verified: {
        type: Boolean,
        default: false
    },
    otp: {
        type: String
    },
    otp_expiry_time: {
        type: Date
    }
})


// Hash OTP using bcrypt before saving to the DataBase
userSchema.pre("save", async function(next) {
    // Only run this function if OTP is actually modified
    if(!this.isModified("otp") || !this.otp) return next();

    // Hash the OTP with the cost of 12
    this.otp = await bcrypt.hash(this.otp, 12);
    next();
})


// Hash Password using bcrypt before saving to the DataBase
userSchema.pre("save", async function(next) {
    // Only run this function if OTP is actually modified
    if(!this.isModified("password")) return next();

    // Hash the OTP with the cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    // this.passwordConfirm = await bcrypt.hash(this.passwordConfirm, 12);
    next();
})


// Compare password in DB with password provided by user
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
}


// Compare OTP in DB with OTP provided by user
userSchema.methods.correctOTP = async function(candidateOTP, userOTP) {
    return await bcrypt.compare(candidateOTP, userOTP);
}


// Generate Password reset token
userSchema.methods.createPasswordResetToken = function() {
    // generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    // Saving resetToken and expire time in DB after making hash
    this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    this.passwordResetExpire = Date.now() + 10*60*1000; // adding 10 minutes
    return resetToken;
}


// Checking that timeStamp of token is later than password-change
userSchema.methods.passwordChangedAfterToken = function(timeStamp) {
    return timeStamp < this.passwordChangedAt ;
}





const User = new mongoose.model("User", userSchema);
module.exports = User;