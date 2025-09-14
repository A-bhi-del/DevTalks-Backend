const { Server } = require("socket.io");
const { Chat } = require("../models/chat");
const { connectionRequest } = require("../models/connection");
const User = require("../models/user");

const socketCreation = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "http://localhost:5173",
            credentials: true,
        },
    });

    io.on("connection", async (socket) => {
        const { userId } = socket.handshake.auth;

        // ✅ Validate userId
        if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
            console.log("Invalid userId provided, closing connection:", userId);
            socket.disconnect();
            return;
        }

        socket.userId = userId;

        try {
            // ✅ Mark user as online
            await User.findByIdAndUpdate(userId, {
                isOnline: true,
                lastSeen: null,
            });
        } catch (err) {
            console.error("Error updating user status:", err);
        }

        console.log("User connected:", userId);

        // Broadcast online status
        socket.broadcast.emit("updateuserStatus", {
            userId,
            isOnline: true,
            lastSeen: null,
        });

        // ✅ Join chat room
        socket.on("joinChat", async ({ targetuserId }) => {
            if (!targetuserId || !targetuserId.match(/^[0-9a-fA-F]{24}$/)) return;

            const roomId = [userId, targetuserId].sort().join("_");

            // Optional: check friendship
            const friends = await connectionRequest.findOne({
                $or: [
                    { userId, targetuserId, status: "accepted" },
                    { fromUserId: targetuserId, toUserId: userId, status: "accepted" },
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
                    timestamp: new Date(),
                });

                await chat.save();

                // Emit message to room
                io.to(roomId).emit("receiveMessage", { text, firstName, lastName });
            } catch (err) {
                console.error("Message error:", err);
            }
        });

        // ✅ Handle disconnect
        socket.on("disconnect", async () => {
            if (!socket.userId) return;

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
        });
    });
};

module.exports = socketCreation;
