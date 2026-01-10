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

    let decodedMessage;
    try {
      // Try with new secret first
      decodedMessage = await jwt.verify(token, process.env.JWT_SECRET);
    } catch (newSecretError) {
      console.log("🔄 New secret failed, trying old secret for backward compatibility");
      try {
        // Fallback to old secret for existing tokens
        decodedMessage = await jwt.verify(token, "sgvd@2873b");
        console.log("⚠️ Token verified with old secret - user should re-login");
      } catch (oldSecretError) {
        throw new Error("Invalid token - please re-login");
      }
    }
    
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