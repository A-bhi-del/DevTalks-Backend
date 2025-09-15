const { Server } = require("socket.io");
const { Chat } = require("../models/chat");
const { connectionRequest } = require("../models/connection");
const User = require("../models/user");
const jwt = require("jsonwebtoken");

// Track multiple simultaneous connections per user
const userConnectionCounts = new Map();

const socketCreation = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "http://localhost:5173",
            credentials: true,
        },
    });

    io.on("connection", async (socket) => {
        // Prefer auth.token; fallback to httpOnly cookie named 'token'
        let token = (socket.handshake.auth && socket.handshake.auth.token) || null;
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
                        const v = decodeURIComponent(pair.slice(eqIdx + 1));
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
            const decoded = await jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded && decoded._id;
            if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
                throw new Error("Invalid token payload");
            }
            socket.userId = userId;
        } catch (err) {
            console.log("Socket auth failed:", err.message);
            socket.disconnect();
            return;
        }

        // Increment connection count for this user
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

        // ✅ Join chat room
        socket.on("joinChat", async ({ targetuserId }) => {
            if (!targetuserId || !targetuserId.match(/^[0-9a-fA-F]{24}$/)) return;

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
                return;
            }

            socket.join(roomId);
        });

        // ✅ Send message
        socket.on("sendMessage", async ({ targetuserId, text, firstName, lastName }) => {
            if (!targetuserId || !text) return;

            try {
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
                    text,
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
            }
        });

        // ✅ Handle disconnect
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
};

module.exports = socketCreation;
