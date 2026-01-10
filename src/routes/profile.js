const express = require("express");
const { userAuth } = require("../middlewares/auth");
const { validateProfileData } = require("../utils/validation");
const profileRouter = express.Router();
const User = require("../models/user");
const bcrypt = require("bcryptjs");

profileRouter.get("/profile/view", userAuth, async (req, res) => {
  try {
    const user = req.user;
    res.send(user);
  } catch (err) {
    res.status(500).send("Error in fetching user:" + err.message);
  }
})

profileRouter.patch("/profile/edit", userAuth, async (req, res) => {
  try {
    if (!validateProfileData(req)) {
      throw new Error("Invalid fields");
    }
    const loggedInUser = req.user;

    console.log(loggedInUser);

    Object.keys(req.body).forEach((key) => (loggedInUser[key] = req.body[key]));
    // console.log(loggedInUser);
    await loggedInUser.save();
    res.json({
      message: `${loggedInUser.firstName} your profile is updated successfully`,
      data: loggedInUser,
    });
  } catch (err) {
    res.status(500).send("Error in updating user:" + err.message);
  }
})

module.exports = profileRouter;