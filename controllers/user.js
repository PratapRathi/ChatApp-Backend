const User = require("../models/user");
const filterObj = require("../utils/filterObj")

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