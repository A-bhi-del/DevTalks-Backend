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

chatRouter.post("/group/create", userAuth, async (req, res) => {
  try {
    const { name, members } = req.body;
    const userId = req.user._id;

    if (!name || !members || members.length < 2) {
      return res.status(400).json({ message: "Group needs at least 3 members" });
    }

    const uniqueMembers = [...new Set([userId.toString(), ...members])];

    const group = await Chat.create({
      isGroup: true,
      participants: uniqueMembers,
      groupInfo: {
        name,
        admin: [userId],
      },
      messages: [],
    });

    res.json(group);
  } catch (err) {
    console.error("Group create error:", err);
    res.status(500).json({ message: "Group create failed" });
  }
});

// MY GROUPS (must be above /group/:groupId)
chatRouter.get("/group/my", userAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await Chat.find({
      isGroup: true,
      participants: userId,
    })
      .select("_id participants groupInfo updatedAt createdAt")
      .sort({ updatedAt: -1 });

    res.json({ groups }); // ✅ frontend expects this
  } catch (err) {
    console.error("Group my error:", err);
    res.status(500).json({ message: "Failed to fetch groups" });
  }
});

chatRouter.get("/group/:groupId", userAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.params;

    const chat = await Chat.findById(groupId).populate({
      path: "messages.SenderId",
      select: "_id firstName lastName photoUrl",
    });

    if (!chat || !chat.isGroup) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isMember = chat.participants.some(
      (p) => p.toString() === userId.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: "Not a group member" });
    }

    const filteredMessages = (chat.messages || []).filter((msg) => {
      return !msg.deletedFor?.some((id) => id.toString() === userId.toString());
    });

    res.json({
      _id: chat._id,
      participants: chat.participants,
      groupInfo: chat.groupInfo,
      messages: filteredMessages,
    });
  } catch (err) {
    console.error("Group fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = chatRouter;
