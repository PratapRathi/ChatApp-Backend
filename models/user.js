const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");


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
        validate: {
            validator: function (email) {
                return String(email).toLowerCase().match(/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g)
            },
            message: (props)=> `Email (${props.value} is invalid)`
        },
        unique: true
    },
    password: {
        type: String
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
    },
    updatedAt: {
        type: Date
    }
})


// Compare password in DB with password provided by user
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
}





const User = new mongoose.model("User", userSchema);
module.exports = User;