const User = require("../models/user");
const FriendRequest = require("../models/friendRequest");
const filterObj = require("../utils/filterObj");

exports.upateMe = async(req,res,next) => {
    const{user} = req;
    const filteredBody = filterObj(req.body, "firstName","lastName","about","avatar");
    const update_user = await User.findByIdAndUpdate(user._id, filteredBody, {new:true, validateModifiedOnly:true})

    res.status(200).json({
        status: "success0",
        data: update_user,
        message: "Profile updated successfully!"
    })
}

exports.getUsers = async (req,res,next)=>{
    const all_users = await User.find({
        verified:"true",
    }).select("firstName lastName _id");

    this_user = req.user;

    const remaining_user = all_users.filter( (user) => 
        !this_user.friends.includes(user._id) && 
        user._id.toString() !== req.user._id.toString()
    );

    res.status(200).json({
        status:"success",
        data: remaining_user,
        message: "Users fetched successfully"
    })
}

exports.getRequest = async (req, res, next) => {
    const requests = await FriendRequest.find({recipient: req.user._id}).populate("sender", "_id firstName lastName");
    res.status(200).json({
        status: "success",
        data: requests,
        message: "Friends-Request fetched successfully!"
    })
}

exports.getFriends = async (req, res, next) => {
    try {
        const this_user = await User.findById(req.user._id).populate("friends", "_id firstName lastName");
        res.status(200).json({
            status: "success",
            data: this_user.friends,
            message: "Friends fetched successfully!"
        })
    } catch (error) {
        res.status(200).json({
            status: "error",
            message: "Error in fetching friends from DataBase!"
        })
    }
}