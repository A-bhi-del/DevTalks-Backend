const { Server } = require("socket.io");
const { Chat } = require("../models/chat");
const { connectionRequest } = require("../models/connection");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const {
  joinRoom,
  createTransport,
  connectTransport,
  produce,
  consume,
  messageInRoom,
  exitRoom,
  disconnect
} = require("./signaling");

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
                'https://buying-auctions-renewable-partnership.trycloudflare.com',
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
            socket.userId = decoded._id.toString();

            // ADD THIS LINE - Critical for private events like incoming-call
            socket.join(socket.userId.toString());

            // // 🟢 ADD THIS LINE HERE:
            // socket.join(userId.toString());

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

        // JOIN CHAT ROOM
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
               // Send presence immediately
                const target = await User.findById(targetuserId).select("isOnline lastSeen");
                if (target) {
                  socket.emit("updateUserStatus", {
                    userId: targetuserId,
                    isOnline: !!target.isOnline,
                    // offline ho to lastSeen bhejo, online ho to null
                    lastSeen: target.isOnline ? null : (target.lastSeen || null),
                  });
                }


                callback?.({ status: "joined", roomId });
            } catch (err) {
                console.error("Join chat error:", err);
                callback?.({ status: "error", message: "Failed to join chat" });
            }
        });

        socket.on("joinGroup", async ({ groupId }, callback) => {
  try {
    const chat = await Chat.findById(groupId);

    if (!chat || !chat.isGroup) {
      return callback?.({ status: "error", message: "Group not found" });
    }

    const isMember = chat.participants.some(
      (p) => p.toString() === socket.userId.toString()
    );

    if (!isMember) {
      return callback?.({ status: "error", message: "Not a member" });
    }

    socket.join(groupId);
    callback?.({ status: "joined", roomId: groupId });
  } catch (err) {
    console.error("joinGroup error:", err);
    callback?.({ status: "error", message: "Join group failed" });
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
                      // ✅ offline ho to lastSeen bhejo, online ho to null
                      lastSeen: target.isOnline ? null : (target.lastSeen || null),
                  });
                }

            } catch (e) {
                console.error("Presence fetch error:", e);
                socket.emit("error", { message: "Failed to fetch presence" });
            }
        });

        // SEND MESSAGE
      socket.on("sendMessage", async (
          {
            targetuserId,
            text,
            firstName,
            lastName,

            // voice
            messageType,      // "text" | "audio"
            audioUrl,         // string
            audioDuration,    // number (seconds)
            mediaUrl,
            mediaType,
            fileName,
            fileSize,
            mediaPublicId,
          },
          callback
        ) => {
          console.log("sendMessage chal gya", {
            from: userId,
            to: targetuserId,
            type: messageType || "text",
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

            const type = messageType || "text";

            // ✅ text validation
            if (type === "text") {
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
            }

            // ✅ audio validation
            if (type === "audio") {
              if (!audioUrl || typeof audioUrl !== "string") {
                callback?.({ status: "error", message: "Audio URL missing" });
                return;
              }
            }

            if (type === "media") {
              if (!mediaUrl || typeof mediaUrl !== "string") {
                callback?.({ status: "error", message: "Media URL missing" });
                return;
              }
            }


            // ✅ safe audio duration (fix const reassignment bug)
            const safeAudioDuration =
              typeof audioDuration === "number" && audioDuration > 0
                ? audioDuration
                : 0;

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

            // Push message
            chat.messages.push({
              SenderId: userId,
              messageType: type,

              text: type === "text" ? text.trim() : "",

              audioUrl: type === "audio" ? audioUrl : undefined,
              audioDuration: type === "audio" ? safeAudioDuration : 0,

              mediaUrl: type === "media" ? mediaUrl : undefined,
              mediaType: type === "media" ? mediaType : undefined,
              fileName: type === "media" ? fileName : undefined,
              fileSize: type === "media" ? fileSize : 0,
              mediaPublicId: type === "media" ? mediaPublicId : undefined,

              status: "sent",
            });

            await chat.save();

            const savedMessage = chat.messages[chat.messages.length - 1];

            /* ---------------- PAYLOAD ---------------- */
            const payload = {
              _id: savedMessage._id,

              text: savedMessage.text,
              audioUrl: savedMessage.audioUrl,
              audioDuration: savedMessage.audioDuration,
              messageType: savedMessage.messageType,
              senderId: savedMessage.SenderId,
              mediaUrl: savedMessage.mediaUrl,
              mediaType: savedMessage.mediaType,
              fileName: savedMessage.fileName,
              fileSize: savedMessage.fileSize,
              createdAt: savedMessage.createdAt,

              firstName,
              lastName,
            };

            /* ---------------- EMIT MESSAGE ---------------- */
            // 1) Room emit (works if both joined)
          io.to(roomId).emit("receiveMessage", payload);

      // Check if someone is actually in room (receiver may not have joined)
      const socketsInRoom = await io.in(roomId).fetchSockets();

      const receiverSockets = userSockets.get(targetuserId);

      console.log("Receiver sockets check:", {
        targetuserId,
        sockets: receiverSockets ? [...receiverSockets] : null,
        size: receiverSockets?.size || 0,
        socketsInRoom: socketsInRoom.length,
      });

      // ✅ check if receiver is in room (via socket.data.userId)
      const receiverInRoom = socketsInRoom.some(
        (s) => s.data?.userId === targetuserId
      );

      // ✅ if receiver is online but NOT in room -> direct emit
      if (receiverSockets && receiverSockets.size > 0 && !receiverInRoom) {
        for (const sid of receiverSockets) {
          io.to(sid).emit("receiveMessage", payload);
        }
      }

      /* ---------------- DELIVERED CHECK ---------------- */
      // If receiver online (has sockets) -> mark delivered + notify sender
      if (receiverSockets && receiverSockets.size > 0) {
        await Chat.updateOne(
          { _id: chat._id, "messages._id": savedMessage._id },
          { $set: { "messages.$.status": "delivered" } }
        );

        // 🔔 Notify sender (even if sender has multiple tabs)
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
      console.error("❌ Message error FULL:", err);
      console.error("❌ Message error MSG:", err.message);
      console.error("❌ Message error STACK:", err.stack);

      callback?.({
        status: "error",
        message: err.message || "Failed to send message",
      });
    }
  }
);

socket.on("sendGroupMessage", async (data, callback) => {
  try {
    const {
      groupId,
      text,
      firstName,
      lastName,
      messageType,
      audioUrl,
      audioDuration,
      mediaUrl,
      mediaType,
      fileName,
      fileSize,
      mediaPublicId,
    } = data;

    const chat = await Chat.findById(groupId);
    if (!chat || !chat.isGroup) {
      return callback?.({ status: "error", message: "Group not found" });
    }

    const isMember = chat.participants.some(
      (p) => p.toString() === socket.userId.toString()
    );

    if (!isMember) {
      return callback?.({ status: "error", message: "Not a member" });
    }

    const type = messageType || "text";

    chat.messages.push({
      SenderId: socket.userId,
      messageType: type,
      text: type === "text" ? text.trim() : "",
      audioUrl: type === "audio" ? audioUrl : undefined,
      audioDuration: type === "audio" ? audioDuration : 0,
      mediaUrl: type === "media" ? mediaUrl : undefined,
      mediaType: type === "media" ? mediaType : undefined,
      fileName: type === "media" ? fileName : undefined,
      fileSize: type === "media" ? fileSize : 0,
      mediaPublicId: type === "media" ? mediaPublicId : undefined,
      status: "sent",
    });

    await chat.save();

    const savedMessage = chat.messages[chat.messages.length - 1];

    const payload = {
      _id: savedMessage._id,
      senderId: savedMessage.SenderId,
      text: savedMessage.text,

      messageType: savedMessage.messageType,
      audioUrl: savedMessage.audioUrl,
      audioDuration: savedMessage.audioDuration,

      mediaUrl: savedMessage.mediaUrl,
      mediaType: savedMessage.mediaType,
      fileName: savedMessage.fileName,
      fileSize: savedMessage.fileSize,

      createdAt: savedMessage.createdAt,
      firstName,
      lastName,

      groupId,
    };

    io.to(groupId).emit("receiveGroupMessage", payload);

    callback?.({
      status: "sent",
      messageId: savedMessage._id,
      createdAt: savedMessage.createdAt,
    });
  } catch (err) {
    console.error("sendGroupMessage error:", err);
    callback?.({ status: "error", message: "Failed" });
  }
});


        // MARK MESSAGES AS READ
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

        // DELETE MESSAGE FOR ME
        socket.on("delete-message-for-me", async ({ chatId, messageId }) => {
            try {
                const chat = await Chat.findOne({
                _id: chatId,
                participants: socket.userId,
                });

                if (!chat) return;

                const msg = chat.messages.id(messageId);
                if (!msg) return;

                // ensure array exists
                if (!msg.deletedFor) msg.deletedFor = [];

                const uid = socket.userId.toString();

                // add only if not present
                if (!msg.deletedFor.some((x) => x.toString() === uid)) {
                msg.deletedFor.push(socket.userId);
                }

                await chat.save();

                socket.emit("message-deleted-for-me", { messageId });
            } catch (err) {
                console.error("delete-message-for-me error:", err);
            }
        });

        // DELETE MESSAGE FOR EVERYONE
        socket.on("delete-message-for-everyone", async ({ chatId, messageId }) => {
            try {
                const chat = await Chat.findById(chatId);
                if (!chat) return;

                const msg = chat.messages.id(messageId);
                if (!msg) return;

                // Only sender can delete for everyone (your choice)
                if (msg.SenderId.toString() !== socket.userId.toString()) return;

                msg.text = "This message was deleted";
                msg.isDeletedForEveryone = true;
                msg.deletedAt = new Date();

                await chat.save();

                // notify both users
                // Emit to room (if open)
                const roomId = chat.participants.map(x => x.toString()).sort().join("_");
                io.to(roomId).emit("message-deleted-for-everyone", { messageId });

                // Also emit directly to both users (even if chat is closed)
                for (const participantId of chat.participants) {
                const sockets = userSockets.get(participantId.toString());
                if (sockets) {
                    for (const sid of sockets) {
                    io.to(sid).emit("message-deleted-for-everyone", { messageId });
                    }
                }
                }

            } catch (err) {
                console.error("delete-message-for-everyone error:", err);
            }
        });

        // EDIT MESSAGE
        socket.on("edit-message", async ({ chatId, messageId, newText }) => {
            try {
                if (!chatId || !messageId || !newText?.trim()) return;

                const chat = await Chat.findById(chatId);
                if (!chat) return;

                const msg = chat.messages.id(messageId);
                if (!msg) return;

                // ✅ Only sender can edit
                if (msg.SenderId.toString() !== socket.userId.toString()) return;

                // ✅ If deleted for everyone -> no edit
                if (msg.isDeletedForEveryone) return;

                msg.text = newText.trim();
                msg.isEdited = true;
                msg.editedAt = new Date();

                await chat.save();

                // ✅ Notify both users
                const roomId = chat.participants.map(x => x.toString()).sort().join("_");

                io.to(roomId).emit("message-edited", {
                messageId,
                newText: msg.text,
                editedAt: msg.editedAt,
                });

            } catch (err) {
                console.error("❌ edit-message error:", err);
            }
        });

        // ADD REACTION
        socket.on("react-message", async ({ chatId, messageId, emoji }) => {
            try {
                if (!chatId || !messageId || !emoji) return;

                const chat = await Chat.findById(chatId);
                if (!chat) return;

                const msg = chat.messages.id(messageId);
                if (!msg) return;

                if (!msg.reactions) msg.reactions = [];

                const uid = socket.userId.toString();

                // ✅ check if user already reacted
                const existing = msg.reactions.find((r) => r.userId.toString() === uid);

                // ✅ If same emoji clicked again -> remove reaction
                if (existing && existing.emoji === emoji) {
                msg.reactions = msg.reactions.filter((r) => r.userId.toString() !== uid);
                } else {
                // ✅ Replace reaction (remove old, add new)
                msg.reactions = msg.reactions.filter((r) => r.userId.toString() !== uid);
                msg.reactions.push({ userId: socket.userId, emoji });
                }

                await chat.save();

                const roomId = chat.participants.map(x => x.toString()).sort().join("_");

                io.to(roomId).emit("message-reacted", {
                messageId,
                reactions: msg.reactions,
            });

            } catch (err) {
                console.error("❌ react-message error:", err);
            }
        });

        // PIN MESSAGE
        socket.on("pin-message", async ({ chatId, messageId }) => {
            try {
                if (!chatId || !messageId) return;

                const chat = await Chat.findById(chatId);
                if (!chat) return;

                // ✅ unpin all messages first (only 1 pinned allowed)
                chat.messages.forEach((m) => {
                m.isPinned = false;
                m.pinnedAt = null;
                });

                // ✅ pin selected message
                const msg = chat.messages.id(messageId);
                if (!msg) return;

                msg.isPinned = true;
                msg.pinnedAt = new Date();

                await chat.save();

                const roomId = chat.participants.map(x => x.toString()).sort().join("_");

                io.to(roomId).emit("message-pinned", {
                messageId,
                pinnedAt: msg.pinnedAt,
                text: msg.text,
                });
            } catch (err) {
                console.error("❌ pin-message error:", err);
            }
        });

        // UNPIN MESSAGE
        socket.on("unpin-message", async ({ chatId }) => {
        try {
            if (!chatId) return;

            const chat = await Chat.findById(chatId);
            if (!chat) return;

            chat.messages.forEach((m) => {
            m.isPinned = false;
            m.pinnedAt = null;
            });

            await chat.save();

            const roomId = chat.participants.map(x => x.toString()).sort().join("_");

            io.to(roomId).emit("message-unpinned", { chatId });
        } catch (err) {
            console.error("❌ unpin-message error:", err);
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

    try {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen,
      });
    } catch (err) {
      console.error("❌ Error updating offline lastSeen:", err);
    }

    socket.broadcast.emit("updateUserStatus", {
      userId: socket.userId,
      isOnline: false,
      lastSeen,
    });
  } else {
    userConnectionCounts.set(socket.userId, remaining);
  }
});

      socket.on("joinRoom", async ({ roomId, userId}, callback) => {
            await joinRoom({ roomId, userId}, socket, callback);
        });
    
        socket.on("createTransport", async ({ roomId }, callback) => {
            await createTransport({ roomId }, socket, callback);
        });
    
        socket.on("connectTransport", ({ transportId, dtlsParameters }) => {
            connectTransport({ transportId, dtlsParameters }, socket);
        });
    
        socket.on("produce", async ({ roomId, transportId, kind, rtpParameters }, callback)=>{
            await produce({ roomId, transportId, kind, rtpParameters }, socket, callback);
        });
    
        socket.on("consume", async ({ roomId, producerId, transportId, rtpCapabilities }, callback) =>{
            await consume({ roomId, producerId, transportId, rtpCapabilities }, socket, callback);
        });

        socket.on('message', async ({roomId, message, username}) => {
            await messageInRoom({roomId, message, username}, socket);
        })
    
        socket.on("exitRoom", ({ roomId, producerIds })=>{
            exitRoom({ roomId, producerIds }, socket);
        });
    
        socket.on("disconnect", ()=>{
            disconnect(socket);
        });


    });
    
    global.io = io;
    return io;
;
};

module.exports = socketCreation;
