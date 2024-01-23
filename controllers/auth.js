const jwt = require("jsonwebtoken");
const User = require("../models/user");


const signToken = (userID) => jwt.sign({userID}, process.env.JWT_SECRET);


exports.login = async(req, res, next) =>{

    const[email, password] = req.body;
    if(!email || !password) {
        res.status(400).json({
            status: "Error",
            message: "Both email and password are required"
        })
    }

    const userDoc = User.findOne({email: email}).select("+password");

    if(!userDoc || (await User.correctPassword(password, userDoc.password))){
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