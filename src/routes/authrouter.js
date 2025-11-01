const express = require("express");
const bcrypt = require("bcryptjs");
const authRouter = express.Router();
const { validateSignupData } = require("../utils/validation");
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

        const savedUser = await user.save();
        const token = await savedUser.getJWT();
        
        // Cookie settings based on environment
        const isProduction = process.env.NODE_ENV === 'production';
        
        const cookieOptions = {
            httpOnly: true,
            expires: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
        };
        
        // For production (deployed): use secure + sameSite: none (for cross-origin)
        // For localhost: use sameSite: lax (works with http://localhost)
        if (isProduction) {
            cookieOptions.secure = true;
            cookieOptions.sameSite = 'none';
        } else {
            // Local development - no secure flag needed, use lax for same-origin
            cookieOptions.secure = false;
            cookieOptions.sameSite = 'lax';
        }
        
        console.log("🍪 Setting cookie with options:", cookieOptions);
        res.cookie("token", token, cookieOptions);

        res.status(200).json({
            message: "User signed up successfully",
            data: savedUser
        });
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
            
            // Cookie settings based on environment
            const isProduction = process.env.NODE_ENV === 'production';
            
            const cookieOptions = {
                httpOnly: true,
                expires: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
            };
            
            // For production (deployed): use secure + sameSite: none (for cross-origin)
            // For localhost: use sameSite: lax (works with http://localhost)
            if (isProduction) {
                cookieOptions.secure = true;
                cookieOptions.sameSite = 'none';
            } else {
                // Local development - no secure flag needed, use lax for same-origin
                cookieOptions.secure = false;
                cookieOptions.sameSite = 'lax';
            }
            
            console.log("🍪 Setting cookie with options:", cookieOptions);
            res.cookie("token", token, cookieOptions);

            console.log("✅ Login successful for user:", emailId);
            res.status(200).json({
                message: "User logged in successfully",
                data: user
            });
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