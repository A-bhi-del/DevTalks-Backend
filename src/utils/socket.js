const socket = require("socket.io");

const socketCreation = (server) => {
    const io = socket(server, {
        cors: {
            origin: "http://localhost:5173"
        }
    })

    io.on("connection", (socket) => {
        socket.on("joinchat", ({userId, targetuserId}) => { 
            const roomId = [userId, targetuserId].sort().join("_");

            console.log("User joined room: " + roomId);
            socket.join(roomId);
        });

        socket.on("sendmessage", ({userId, targetuserId, text, firstName}) => {
            const roomId = [userId, targetuserId].sort().join("_");
            console.log("Message coming from " + firstName + ": " + text);
            io.to(roomId).emit("receivemessage", {userId, text, firstName});
         });

        socket.on("disconnect", () => { });
    })
}

module.exports= socketCreation;
