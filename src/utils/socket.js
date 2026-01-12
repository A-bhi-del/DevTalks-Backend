const { Server } = require("socket.io");
const { Chat } = require("../models/chat");
const { connectionRequest } = require("../models/connection");
const User = require("../models/user");
const jwt = require("jsonwebtoken");

const userConnectionCounts = new Map();
const messageRateLimit = new Map(); // Rate limiting for messages
const userSockets = new Map(); // userId -> Set(socket.id)

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
                } catch (_) {
                    // ignore cookie parse errors
                }
            }
        }
        let userId;
        try {
            if (!token) throw new Error("Missing auth token");            
            let decoded;
            try {
                // Try with new secret first
                decoded = await jwt.verify(token, process.env.JWT_SECRET);
            } catch (newSecretError) {
                try {
                    // Fallback to old secret for existing tokens
                    decoded = await jwt.verify(token, "sgvd@2873b");
                } catch (oldSecretError) {
                    throw new Error("Invalid token - please re-login");
                }
            }
            
            userId = decoded && decoded._id;
            if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
                throw new Error("Invalid token payload");
            }
            socket.userId = userId;

            // ✅ Track user -> socket mapping
            if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
            }
            userSockets.get(userId).add(socket.id);

        } catch (err) {
            console.error("Socket auth failed:", err.message);
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

        socket.on("joinChat", async ({ targetuserId }, callback) => {
            try {
                if (!targetuserId || !targetuserId.match(/^[0-9a-fA-F]{24}$/)) {
                callback?.({ status: "error", message: "Invalid target user ID" });
                return;
                }

                const roomId = [userId, targetuserId].sort().join("_");

                const friends = await connectionRequest.findOne({
                $or: [
                    { fromUserId: userId, toUserId: targetuserId, connectionRequestMessage: "accepted" },
                    { fromUserId: targetuserId, toUserId: userId, connectionRequestMessage: "accepted" },
                ],
                });

                if (!friends) {
                callback?.({ status: "error", message: "Users are not friends" });
                return;
                }

                socket.join(roomId);

                // Send presence immediately
                const target = await User.findById(targetuserId).select("isOnline lastSeen");
                if (target) {
                socket.emit("updateUserStatus", {
                    userId: targetuserId,
                    isOnline: !!target.isOnline,
                    lastSeen: target.lastSeen || null,
                });
                }

                callback?.({ status: "joined", roomId });
            } catch (err) {
                console.error("Join chat error:", err);
                callback?.({ status: "error", message: "Failed to join chat" });
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

        socket.on("sendMessage", async ({ targetuserId, text, firstName, lastName }, callback) => {
            console.log("sendMessage chal gya", {
                from: userId,
                to: targetuserId,
            });

            try {
            /* ---------------- RATE LIMIT ---------------- */
            const now = Date.now();
            const userRateLimit =
                messageRateLimit.get(userId) || { count: 0, resetTime: now + 60000 };

            if (now > userRateLimit.resetTime) {
                userRateLimit.count = 0;
                userRateLimit.resetTime = now + 60000;
            }

            if (userRateLimit.count >= 30) {
                callback?.({
                status: "error",
                message: "Rate limit exceeded. Please slow down.",
                });
                return;
            }

            userRateLimit.count++;
            messageRateLimit.set(userId, userRateLimit);

            /* ---------------- VALIDATION ---------------- */
            if (!targetuserId || !targetuserId.match(/^[0-9a-fA-F]{24}$/)) {
                callback?.({ status: "error", message: "Invalid target user ID" });
                return;
            }

            if (!text || typeof text !== "string" || text.trim().length === 0) {
                callback?.({ status: "error", message: "Message cannot be empty" });
                return;
            }

            if (text.length > 1000) {
                callback?.({
                status: "error",
                message: "Message too long (max 1000 characters)",
                });
                return;
            }

            const roomId = [userId, targetuserId].sort().join("_");

            /* ---------------- CHAT SAVE ---------------- */
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

            /* ---------------- ROOM DEBUG ---------------- */
            /* ---------------- EMIT MESSAGE ---------------- */
            const socketsInRoom = await io.in(roomId).fetchSockets();

            if (socketsInRoom.length === 0) {
            console.log("⚠️ No sockets in room:", roomId);
            }
            io.to(roomId).emit("receiveMessage", {
                _id: savedMessage._id,
                text: savedMessage.text,
                senderId: savedMessage.SenderId,
                createdAt: savedMessage.createdAt,
                firstName,
                lastName,
            });

            // ✅ CHECK IF RECEIVER IS ONLINE (DELIVERED)
            const receiverSockets = userSockets.get(targetuserId);
            console.log("Receiver sockets check:", {
                targetuserId,
                sockets: receiverSockets ? [...receiverSockets] : null,
                size: receiverSockets?.size || 0,
            });

            if (receiverSockets && receiverSockets.size > 0) {
            await Chat.updateOne(
                {
                _id: chat._id,
                "messages._id": savedMessage._id,
                },
                {
                $set: {
                    "messages.$.status": "delivered",
                },
                }
            );
            console.log("Delivered DB update executed");
            console.log("Verify delivered status:", verify?.messages?.[0]);


            // 🔔 Notify sender
            const senderSockets = userSockets.get(userId);
            if (senderSockets) {
                for (const sid of senderSockets) {
                io.to(sid).emit("message-delivered", {
                    messageId: savedMessage._id,
                });
                }
            }
            }

            /* ---------------- SUCCESS ACK ---------------- */
            callback?.({
                status: "sent",
                messageId: savedMessage._id,
                createdAt: savedMessage.createdAt,
            });
            } catch (err) {
            console.error("❌ Message error:", err);

            /* ---------------- ERROR ACK ---------------- */
            callback?.({
                status: "error",
                message: "Failed to send message",
            });
            }
        }
        );

        // ✅ MARK MESSAGES AS READ
        socket.on("mark-messages-read", async ({ targetuserId }) => {
        try {
            if (!targetuserId || !targetuserId.match(/^[0-9a-fA-F]{24}$/)) {
            return;
            }

            // Find the chat
            const chat = await Chat.findOne({
            participants: { $all: [socket.userId, targetuserId] },
            });

            if (!chat) return;

            let updated = false;

            chat.messages.forEach((msg) => {
            // Messages sent by OTHER user & not yet read
            if (
                msg.SenderId.toString() === targetuserId &&
                msg.status !== "read"
            ) {
                msg.status = "read";
                msg.readAt = new Date();
                updated = true;
            }
            });

            if (!updated) return;

            await chat.save();

           
            // 🔔 Notify ONLY the sender (even if chat is closed)
            const senderSockets = userSockets.get(targetuserId);

            if (senderSockets) {
            for (const sid of senderSockets) {
                io.to(sid).emit("messages-read", {
                readerId: socket.userId,
                chatWith: targetuserId,
                });
            }
            }


        } catch (err) {
            console.error("❌ mark-messages-read error:", err);
        }
        });

        // Handle disconnect
       socket.on("disconnect", async () => {
        if (!socket.userId) return;

        // remove socket from userSockets
        const sockets = userSockets.get(socket.userId);
        if (sockets) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
            userSockets.delete(socket.userId);
            }
        }

        const current = userConnectionCounts.get(socket.userId) || 1;
        const remaining = Math.max(0, current - 1);

        if (remaining === 0) {
            userConnectionCounts.delete(socket.userId);

            const lastSeen = new Date();

            await User.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            lastSeen,
            });

            socket.broadcast.emit("updateUserStatus", {
            userId: socket.userId,
            isOnline: false,
            lastSeen,
            });
        } else {
            userConnectionCounts.set(socket.userId, remaining);
        }
        });

        });
    
    return io; // Return the io instance
};

module.exports = socketCreation;
