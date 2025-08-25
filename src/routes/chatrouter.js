const express = require("express");
const { userAuth } = require("../middlewares/auth");
const { Chat } = require("../models/chat");

const chatRouter = express.Router();

chatRouter.get("/chat/:targetuserId",userAuth, async (req, res) => {
    try{
        const userId = req.user._id;
        const {targetuserId} = req.params;

        let chat = await Chat.findOne({
            participants: { $all: [userId, targetuserId] },
        }).populate({
            path: "messages.SenderId",
            select: " _id firstName lastName",
        });

        if (!chat) {
            chat = new Chat({
                participants: [userId, targetuserId],
                messages: [],
            });
            await chat.save();
        }

        res.status(200).json(chat);

    }catch(err){
        console.error(err);
    }
})

module.exports = chatRouter;