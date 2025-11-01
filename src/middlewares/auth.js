const jwt = require("jsonwebtoken");
const User = require("../models/user");
const userAuth = async (req, res, next) => {
  try {
    const { token } = req.cookies;
    console.log("🔐 Auth middleware - Checking token...");
    console.log("🍪 Cookies:", req.cookies);
    console.log("🔑 Token present:", !!token);
    
    if (!token) {
      console.log("❌ No token found in cookies");
      return res.status(401).send("Please login first");
    }

    const decodedMessage = await jwt.verify(token, process.env.JWT_SECRET);
    const { _id } = decodedMessage;
    console.log("✅ Token decoded, user ID:", _id);

    const user = await User.findById(_id);
    if (!user) {
      throw new Error("User not found");
    }
    req.user = user;
    console.log("✅ User authenticated:", user.emailId);
    next();
  } catch (err) {
    console.log("❌ Auth error:", err.message);
    res.status(401).send("Please login first");
  }
};

module.exports = {
  userAuth,
};