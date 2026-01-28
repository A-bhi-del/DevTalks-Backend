// import { io } from "../server";
// import { rooms, worker} from "./mediasoupWorker";
// Add this helper function at the top of the file

// import { worker } from "./mediasoupWorker";

const { getWorker, rooms } = require("./mediasoupWorker");
// const worker = getWorker();


 const joinRoom = async ({ roomId, userId}, socket, callback) => {
    // roomId will be same as classId of the class(id)
    // const isUserAllowedToJoin = await studentAuthorization(roomId, userId);
    // //console.log("isUserAllowedToJoin and usrId=>",isUserAllowedToJoin, userId, roomId)
    // let mssg
    // if(!isUserAllowedToJoin){
    //     mssg="User not allowed to join the room";
    //     //console.error("User not allowed");
    //     return callback({ error: "User not allowed to join the room" });
    // }
    // 
    const worker = getWorker();
    if (!worker) {
    return callback({ error: "Mediasoup worker is not ready" });
    }

    if (!rooms[roomId]) {
        rooms[roomId] = {
            router: await getWorker().createRouter({
                mediaCodecs: [
                    { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
                    { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
                ],
            }),
            users: {},
            producers: new Map(),
        };
    }
    rooms[roomId].users[socket.id] = { transports: [], producers: [], consumers: [] };
    socket.join(roomId);

    const existingProducerIds = Array.from(rooms[roomId].producers.keys());
    //console.log(`Sending existing producers to ${socket.id} in room ${roomId}:`, existingProducerIds);
    mssg = 'User is the part of the class room'

    callback({ 
        routerRtpCapabilities: rooms[roomId].router.rtpCapabilities,
        existingProducerIds,
        message:mssg
    });
}

 const createTransport = async ({ roomId }, socket, callback) => {
    const room = rooms[roomId];
    if (!room) return;

    const stunServer = {
        iceServers: [
            { urls: "stun:stun.1.google.com:19302" },
            { urls: "stun:stun1.1.google.com:19302" },
            { urls: "stun:stun2.1.google.com:19302" },
            { urls: "stun:stun3.1.google.com:19302" }
        ]
    }

    const transport = await room.router.createWebRtcTransport({
        listenIps: [{ ip: "0.0.0.0", announcedIp: `${process.env.ANNOUNCE_IP}` }],
        enableUdp: true,
        enableTcp: true,
    });

    room.users[socket.id].transports.push(transport);

    callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        iceServers: stunServer.iceServers
    });
}

 const connectTransport = ({ transportId, dtlsParameters }, socket) => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room) {
            const transport = room.users[socket.id]?.transports.find((t) => t.id === transportId);
            if (transport) transport.connect({ dtlsParameters });
        }
    }
}

 const produce = async ({ roomId, transportId, kind, rtpParameters }, socket, callback) => {
    const room = rooms[roomId];
    const producer = await room.users[socket.id].transports
        .find((t) => t.id === transportId)
        .produce({ kind, rtpParameters });

    room.users[socket.id].producers.push(producer);
    room.producers.set(producer.id, socket.id);

    //console.log(`✅ New Producer Created: ${producer.id}`);
    socket.to(roomId).emit("newProducer", producer.id);
    //console.log("🚀 Broadcasting new producer:", producer.id, "-to room-", roomId);
    callback({ id: producer.id });
}

 const consume = async ({ roomId, producerId, transportId, rtpCapabilities }, socket, callback) => {
    const room = rooms[roomId];
    if (!room) return;

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: "Cannot consume" });
    }

    const transport = room.users[socket.id].transports.find((t) => t.id === transportId);
    if (!transport) return;

    const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: false,
    });

    room.users[socket.id].consumers.push(consumer);

    callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
    });
}

 const messageInRoom = async({roomId, message, username}, socket)=>{
    socket.to(roomId).emit("receiveMessage", {message, username});
    // console.log("messaeg >", message," room >", roomId);
}

// producerIds is string[](array here) defined by me.
 const exitRoom = ({ roomId, producerIds }, socket) => {
    const room = rooms[roomId];
    if (!room) return;

    //console.log(`User ${socket.id} exiting room ${roomId} with producers:`, producerIds);

    // Notify other clients in the room about each producer that’s leaving
    producerIds.forEach((producerId) => {
        socket.to(roomId).emit("participantLeft", producerId);
        room.producers.delete(producerId); // Clean up producer from room
        //console.log(`Notified room ${roomId} that producer ${producerId} left`);
    });

    // Clean up user data
    room.users[socket.id].transports.forEach(t => t.close());
    room.users[socket.id].producers.forEach(p => p.close());
    room.users[socket.id].consumers.forEach(c => c.close());
    delete room.users[socket.id];

    // Remove socket from room and delete room if empty
    socket.leave(roomId);
    if (Object.keys(room.users).length === 0) {
        delete rooms[roomId];
        //console.log(`Room ${roomId} deleted as it is now empty`);
    }
}

 const disconnect = (socket) => {
    //console.log(`User disconnected: ${socket.id}`);
    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room && room.users[socket.id]) {
            const producerIds = room.users[socket.id].producers.map(p => p.id);
            // Notify other clients about the disconnect
            producerIds.forEach((producerId) => {
                socket.to(roomId).emit("participantLeft", producerId);
                room.producers.delete(producerId);
                //console.log(`Notified room ${roomId} that producer ${producerId} left due to disconnect`);
            });

            // Clean up user resources
            room.users[socket.id].transports.forEach(t => t.close());
            room.users[socket.id].producers.forEach(p => p.close());
            room.users[socket.id].consumers.forEach(c => c.close());
            delete room.users[socket.id];

            // Delete room if empty
            if (Object.keys(room.users).length === 0) {
                delete rooms[roomId];
                //console.log(`Room ${roomId} deleted as it is now empty`);
            }
        }
    }
}

module.exports = {joinRoom, createTransport, connectTransport, produce, consume, messageInRoom, exitRoom, disconnect}