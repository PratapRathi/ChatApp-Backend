const router = require("express").Router();
const userController = require("../controllers/userController");
const authController = require("../controllers/auth");


router.patch("/update-me", authController.protect, userController.upateMe);

router.post("/get-users",authController.protect, userController.getUsers);

module.exports = router;