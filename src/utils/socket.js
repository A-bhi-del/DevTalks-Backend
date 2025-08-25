const socket = require("socket.io");
const { Chat } = require("../models/chat");
const { connectionRequest } = require("../models/connection");

const socketCreation = (server) => {
    const io = socket(server, {
        cors: {
            origin: "http://localhost:5173"
        }
    })

    io.on("connection", (socket) => {
        socket.on("joinchat", ({firstName, userId, targetuserId}) => { 
            const roomId = [userId, targetuserId].sort().join("_");

            // console.log("User joined room: " + firstName + " " + roomId);
            socket.join(roomId);
        });

        socket.on("sendmessage", async ({userId, targetuserId, text, firstName, lastName}) => {
            
            // console.log("Message coming from " + firstName + ": " + text);
            try{
                const roomId = [userId, targetuserId].sort().join("_");
                // Save message to database

                let chat = await Chat.findOne({
                    participants: { $all: [userId, targetuserId] },
                })

                
                if(!chat){
                    chat = new Chat({
                        participants: [userId, targetuserId],
                        messages: [],
                    })
                }
                
                chat.messages.push({
                    SenderId : userId,
                    text: text,
                    timestamp: new Date(),
                })
                
                io.to(roomId).emit("receivemessage", { text, firstName, lastName });
                await chat.save();
            }
            catch(err){
                console.error(err);
            }
            
        });

        socket.on("disconnect", () => { });
    })
}

module.exports= socketCreation;

// const friends = await connectionRequest.findOne({
//     $or:[
//         { userId,  targetuserId, status: "accepted" },
//         { fromUserId: targetuserId, toUserId: userId, status: "accepted" }
//     ]
// })

// if(!friends){
//     // If no friends connection exists, handle accordingly
//     res.status(403).json({ message: "You are not friends with this user." });
//     return;
// }