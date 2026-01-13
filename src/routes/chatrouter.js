const express = require("express");
const { userAuth } = require("../middlewares/auth");
const { Chat } = require("../models/chat");

const chatRouter = express.Router();

chatRouter.get("/chat/:targetuserId", userAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { targetuserId } = req.params;

    let chat = await Chat.findOne({
      participants: { $all: [userId, targetuserId] },
    }).populate({
      path: "messages.SenderId",
      select: "_id firstName lastName photoUrl isOnline lastSeen",
    });

    // If no chat exist, create empty chat
    if (!chat) {
      chat = new Chat({
        participants: [userId, targetuserId],
        messages: [],
      });
      await chat.save();
    }

    // ✅ Filter "delete for me"
    const filteredMessages = (chat.messages || []).filter((msg) => {
      return !msg.deletedFor?.some(
        (id) => id.toString() === userId.toString()
      );
    });

    res.status(200).json({
      _id: chat._id,
      participants: chat.participants,
      messages: filteredMessages,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    });
  } catch (err) {
    console.error("❌ GET /chat error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = chatRouter;
