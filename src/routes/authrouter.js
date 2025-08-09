const express = require("express");
const bcrypt = require("bcryptjs");
const authRouter = express.Router();
const {validateSignupData} = require("../utils/validation");
const User = require("../models/user");
const validator = require("validator");

authRouter.post("/signup", async (req, res) => {
    try {
        //validation
        validateSignupData(req);
        const { password, emailId, firstName, lastName, age, gender } = req.body;
        const hashPassword = await bcrypt.hash(password, 10);

        const user = new User({
            firstName,
            lastName,
            emailId,
            password: hashPassword,
            age,
            gender,
        });

        await user.save();
        res.status(200).send("User is added successfully");
    } catch (err) {
        res.status(500).send("Error in signing up:" + err.message);
    }
})

authRouter.post("/login", async (req, res) => {
    try {
        const { emailId, password } = req.body;
        if (!validator.isEmail(emailId)) {
            throw new Error("emailId is not valid");
        }

        const user = await User.findOne({ emailId: emailId }).select("+password");
        if (!user) {
            throw new Error("User not found");
        }

        const passwordisValid = await user.validatePassword(password);
        if (passwordisValid) {
            const token = await user.getJWT();
            // console.log(token);
            res.cookie("token", token, {
                expires: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            });
            res.status(200).send("Login successfully");
        } else {
            throw new Error("Invalid credentials");
        }

    } catch (err) {
        res.status(500).send("Error in logging in:" + err.message);
    }
})

authRouter.post("/logout", async (req, res) => {
    res.cookie("token", null, {
        expires: new Date(Date.now()),
    })
    res.send("Logout successfully");
})


module.exports = authRouter;