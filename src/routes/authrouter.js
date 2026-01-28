const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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

        // Cookie settings based on environment or HTTPS origin
        // USE secure + sameSite: none when:
        // 1. NODE_ENV is production, OR
        // 2. Request comes from HTTPS origin (e.g., Cloudflare tunnel)
        const origin = req.headers.origin || req.headers.referer || '';
        const isHttpsOrigin = origin.startsWith('https://');
        const isProduction = process.env.NODE_ENV === 'production';
        const needsCrossOriginCookies = isProduction || isHttpsOrigin;

        const cookieOptions = {
            httpOnly: true,
            expires: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
        };

        // For cross-origin HTTPS requests: use secure + sameSite: none
        // For localhost: use sameSite: lax (works with http://localhost)
        if (needsCrossOriginCookies) {
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

            // Cookie settings based on environment or HTTPS origin
            // USE secure + sameSite: none when:
            // 1. NODE_ENV is production, OR
            // 2. Request comes from HTTPS origin (e.g., Cloudflare tunnel)
            const origin = req.headers.origin || req.headers.referer || '';
            const isHttpsOrigin = origin.startsWith('https://');
            const isProduction = process.env.NODE_ENV === 'production';
            const needsCrossOriginCookies = isProduction || isHttpsOrigin;

            const cookieOptions = {
                httpOnly: true,
                expires: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
            };

            // For cross-origin HTTPS requests: use secure + sameSite: none
            // For localhost: use sameSite: lax (works with http://localhost)
            if (needsCrossOriginCookies) {
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

// Token refresh endpoint to help users get new tokens with updated JWT secret
authRouter.post("/refresh-token", async (req, res) => {
    try {
        const { token: oldToken } = req.cookies;

        if (!oldToken) {
            return res.status(401).json({ message: "No token found" });
        }

        let decoded;
        try {
            // Try with new secret first
            decoded = await jwt.verify(oldToken, process.env.JWT_SECRET);
        } catch (newSecretError) {
            try {
                // Fallback to old secret
                decoded = await jwt.verify(oldToken, "sgvd@2873b");
                console.log("🔄 Refreshing token from old secret to new secret");
            } catch (oldSecretError) {
                return res.status(401).json({ message: "Invalid token - please login again" });
            }
        }

        const user = await User.findById(decoded._id);
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        // Generate new token with current secret
        const newToken = await user.getJWT();

        // Cookie settings based on environment or HTTPS origin
        const origin = req.headers.origin || req.headers.referer || '';
        const isHttpsOrigin = origin.startsWith('https://');
        const isProduction = process.env.NODE_ENV === 'production';
        const needsCrossOriginCookies = isProduction || isHttpsOrigin;

        const cookieOptions = {
            httpOnly: true,
            expires: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
        };

        if (needsCrossOriginCookies) {
            cookieOptions.secure = true;
            cookieOptions.sameSite = 'none';
        } else {
            cookieOptions.secure = false;
            cookieOptions.sameSite = 'lax';
        }

        res.cookie("token", newToken, cookieOptions);

        res.json({
            message: "Token refreshed successfully",
            data: user
        });

    } catch (err) {
        res.status(500).json({ message: "Error refreshing token: " + err.message });
    }
})

// Test endpoint to check current token
authRouter.get("/test-token", async (req, res) => {
    try {
        const { token } = req.cookies;

        if (!token) {
            return res.status(401).json({ message: "No token found" });
        }

        let decoded;
        let secretUsed = "unknown";

        try {
            decoded = await jwt.verify(token, process.env.JWT_SECRET);
            secretUsed = "new";
        } catch (newSecretError) {
            try {
                decoded = await jwt.verify(token, "sgvd@2873b");
                secretUsed = "old";
            } catch (oldSecretError) {
                return res.status(401).json({ message: "Invalid token" });
            }
        }

        res.json({
            message: "Token is valid",
            secretUsed,
            userId: decoded._id,
            tokenPreview: token.substring(0, 50) + "..."
        });

    } catch (err) {
        res.status(500).json({ message: "Error testing token: " + err.message });
    }
})


module.exports = authRouter;