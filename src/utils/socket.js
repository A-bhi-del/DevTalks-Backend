const { Server } = require("socket.io");
const { Chat } = require("../models/chat");
const { connectionRequest } = require("../models/connection");
const User = require("../models/user");
const jwt = require("jsonwebtoken");

const userConnectionCounts = new Map();
const messageRateLimit = new Map(); // Rate limiting for messages

// Cleanup function for memory management
const cleanupMaps = () => {
    const now = Date.now();
    // Clean up old rate limit entries (older than 5 minutes)
    for (const [userId, rateLimit] of messageRateLimit.entries()) {
        if (now > rateLimit.resetTime + 300000) { // 5 minutes after reset
            messageRateLimit.delete(userId);
        }
    }
};

// Run cleanup every 5 minutes
setInterval(cleanupMaps, 300000);

const socketCreation = (server) => {
    const io = new Server(server, {
        cors: {
            origin: [
                "https://dev-talks-frontend-5f7l.vercel.app",
                "https://dev-talks-frontend-5f7l-rcypxnt4l-a-bhi-dels-projects.vercel.app", 
                "http://localhost:5173",
                "http://127.0.0.1:5173"
            ],
            credentials: true,
            methods: ["GET", "POST"],
            allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
        },
        transports: ["websocket", "polling"],
        allowEIO3: true
    });

    io.on("connection", async (socket) => {
        console.log("🔌 New socket connection attempt");
        console.log("🔍 Socket handshake auth:", socket.handshake.auth);
        console.log("🔍 Socket handshake headers:", socket.handshake.headers.cookie);
        
        let token = (socket.handshake.auth && socket.handshake.auth.token) || null;
        console.log("🔑 Token from auth:", !!token, token ? token.substring(0, 20) + '...' : 'null');
        if (!token) {
            const rawCookie = socket.handshake.headers && socket.handshake.headers.cookie;
            if (rawCookie && typeof rawCookie === "string") {
                try {
                    const pairs = rawCookie.split(";").map((p) => p.trim()).filter(Boolean);
                    const map = new Map();
                    for (const pair of pairs) {
                        const eqIdx = pair.indexOf("=");
                        if (eqIdx === -1) continue;
                        const k = pair.slice(0, eqIdx).trim();
                        const v = decodeURI(pair.slice(eqIdx + 1));
                        map.set(k, v);
                    }
                    token = map.get("token") || null;
                    console.log("🔑 Token from cookie:", !!token, token ? token.substring(0, 20) + '...' : 'null');
                } catch (_) {
                    // ignore cookie parse errors
                }
            }
        }
        let userId;
        try {
            if (!token) throw new Error("Missing auth token");
            console.log("🔐 Verifying token with JWT_SECRET");
            
            let decoded;
            try {
                // Try with new secret first
                decoded = await jwt.verify(token, process.env.JWT_SECRET);
            } catch (newSecretError) {
                console.log("🔄 New secret failed, trying old secret for backward compatibility");
                try {
                    // Fallback to old secret for existing tokens
                    decoded = await jwt.verify(token, "sgvd@2873b");
                    console.log("⚠️ Token verified with old secret - user should re-login");
                } catch (oldSecretError) {
                    throw new Error("Invalid token - please re-login");
                }
            }
            
            userId = decoded && decoded._id;
            if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
                throw new Error("Invalid token payload");
            }
            socket.userId = userId;
            console.log("✅ Socket authenticated for user:", userId);
        } catch (err) {
            console.error("❌ Socket auth failed:", err.message);
            socket.emit("error", { message: "Authentication failed: " + err.message });
            socket.disconnect();
            return;
        }

        // Increment connection count for this user (thread-safe)
        const prevCount = userConnectionCounts.get(userId) || 0;
        const nextCount = prevCount + 1;
        userConnectionCounts.set(userId, nextCount);

        // Only on first active connection mark online and broadcast
        if (prevCount === 0) {
            try {
                await User.findByIdAndUpdate(userId, {
                    isOnline: true,
                    lastSeen: null,
                });
            } catch (err) {
                console.error("Error updating user status:", err);
            }

            console.log("User connected:", userId);

            socket.broadcast.emit("updateUserStatus", {
                userId,
                isOnline: true,
                lastSeen: null,
            });
        }

        //  Join chat room
        socket.on("joinChat", async ({ targetuserId }) => {
            try {
                if (!targetuserId || !targetuserId.match(/^[0-9a-fA-F]{24}$/)) {
                    socket.emit("error", { message: "Invalid target user ID" });
                    return;
                }

                const roomId = [userId, targetuserId].sort().join("_");

                // Optional: check friendship
                const friends = await connectionRequest.findOne({
                    $or: [
                        { fromUserId: userId, toUserId: targetuserId, connectionRequestMessage: "accepted" },
                        { fromUserId: targetuserId, toUserId: userId, connectionRequestMessage: "accepted" },
                    ],
                });
                if (!friends) {
                    console.log("Users are not friends:", userId, targetuserId);
                    socket.emit("error", { message: "Users are not friends" });
                    return;
                }

                socket.join(roomId);

                // Target का current presence तुरंत भेजें
                try {
                    const target = await User.findById(targetuserId).select("isOnline lastSeen");
                    if (target) {
                        socket.emit("updateUserStatus", {
                            userId: targetuserId,
                            isOnline: !!target.isOnline,
                            lastSeen: target.lastSeen || null,
                        });
                    }
                } catch (e) {
                    console.error("Presence fetch error:", e);
                }
            } catch (err) {
                console.error("Join chat error:", err);
                socket.emit("error", { message: "Failed to join chat" });
            }
        });

        //  Get presence fallback
        socket.on("getPresence", async ({ userId: targetId }) => {
            try {
                if (!targetId || !targetId.match(/^[0-9a-fA-F]{24}$/)) {
                    socket.emit("error", { message: "Invalid user ID" });
                    return;
                }
                const target = await User.findById(targetId).select("isOnline lastSeen");
                if (target) {
                    socket.emit("updateUserStatus", {
                        userId: targetId,
                        isOnline: !!target.isOnline,
                        lastSeen: target.lastSeen || null,
                    });
                }
            } catch (e) {
                console.error("Presence fetch error:", e);
                socket.emit("error", { message: "Failed to fetch presence" });
            }
        });

        //  Send message
        socket.on("sendMessage", async ({ targetuserId, text, firstName, lastName }) => {
            try {
                // Rate limiting check
                const now = Date.now();
                const userRateLimit = messageRateLimit.get(userId) || { count: 0, resetTime: now + 60000 }; // 1 minute window
                
                if (now > userRateLimit.resetTime) {
                    userRateLimit.count = 0;
                    userRateLimit.resetTime = now + 60000;
                }
                
                if (userRateLimit.count >= 30) { // Max 30 messages per minute
                    socket.emit("error", { message: "Rate limit exceeded. Please slow down." });
                    return;
                }
                
                userRateLimit.count++;
                messageRateLimit.set(userId, userRateLimit);

                // Input validation
                if (!targetuserId || !targetuserId.match(/^[0-9a-fA-F]{24}$/)) {
                    socket.emit("error", { message: "Invalid target user ID" });
                    return;
                }
                if (!text || typeof text !== 'string' || text.trim().length === 0) {
                    socket.emit("error", { message: "Message cannot be empty" });
                    return;
                }
                if (text.length > 1000) {
                    socket.emit("error", { message: "Message too long (max 1000 characters)" });
                    return;
                }

                const roomId = [userId, targetuserId].sort().join("_");

                // Find or create chat
                let chat = await Chat.findOne({
                    participants: { $all: [userId, targetuserId] },
                });

                if (!chat) {
                    chat = new Chat({
                        participants: [userId, targetuserId],
                        messages: [],
                    });
                }

                chat.messages.push({
                    SenderId: userId,
                    text: text.trim(),
                });

                await chat.save();
                const savedMessage = chat.messages[chat.messages.length - 1];

                // Emit message to room
                io.to(roomId).emit("receiveMessage", {
                    _id: savedMessage._id,
                    text: savedMessage.text,
                    senderId: savedMessage.SenderId,
                    createdAt: savedMessage.createdAt,
                    firstName,
                    lastName,
                });
            } catch (err) {
                console.error("Message error:", err);
                socket.emit("error", { message: "Failed to send message" });
            }
        });

        // Handle disconnect
        socket.on("disconnect", async () => {
            if (!socket.userId) return;

            const current = userConnectionCounts.get(socket.userId) || 1;
            const remaining = Math.max(0, current - 1);
            if (remaining === 0) {
                userConnectionCounts.delete(socket.userId);

                const lastSeen = new Date();
                try {
                    await User.findByIdAndUpdate(socket.userId, {
                        isOnline: false,
                        lastSeen,
                    });
                } catch (err) {
                    console.error("Error updating user offline status:", err);
                }

                socket.broadcast.emit("updateUserStatus", {
                    userId: socket.userId,
                    isOnline: false,
                    lastSeen,
                });

                console.log("User disconnected:", socket.userId);
            } else {
                userConnectionCounts.set(socket.userId, remaining);
            }
        });
    });
    
    return io; // Return the io instance
};

module.exports = socketCreation;
