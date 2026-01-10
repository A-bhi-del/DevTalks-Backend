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

        if (!chat) {
            chat = new Chat({
                participants: [userId, targetuserId],
                messages: [],
            });
            await chat.save();
        }

        res.status(200).json(chat);

    } catch (err) {
        console.error(err);
    }
})

// chatRouter.delete("/chat/:messageId/for-everyone", userAuth, async (req, res) => {
//   try {
//     const { messageId } = req.params;
//     const userId = req.user._id;

//     const updatedChat = await Chat.findOneAndUpdate(
//       {
//         "messages._id": messageId,
//         "messages.SenderId": userId, // Only sender can delete globally
//       },
//       {
//         $set: {
//           "messages.$.deletedForEveryone": true,
//           "messages.$.text": "This message was deleted",
//         },
//       },
//       { new: true }
//     );

//     if (!updatedChat) {
//       return res.status(404).json({
//         success: false,
//         message: "Message not found or you're not the sender",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Message deleted for everyone",
//       chat: updatedChat,
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });


// chatRouter.delete("/chat/:messageId/for-me", userAuth, async (req, res) => {
//     try {
//         const { messageId } = req.params;
//         const userId = req.user._id;

//         const updatedChat = await Chat.findOneAndUpdate(
//             {
//                 "messages._id": messageId,
//                 participants: userId,
//             },
//             {
//                 $addToSet: { "messages.$.deletedFor": userId }, // Add to deletedFor array
//             },
//             { new: true }
//         );

//         if (!updatedChat) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Message not found or you are not a participant",
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: "Message deleted for you",
//             chat: updatedChat,
//         });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

module.exports = chatRouter;