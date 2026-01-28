const express = require("express");
const { userAuth } = require("../middlewares/auth");

const callRouter = express.Router();

// In-memory active calls
const activeCalls = new Map();

// Helper
const getIO = () => {
  if (!global.io) {
    console.error("❌ Socket.io not initialized");
    return null;
  }
  return global.io;
};


// INITIATE CALL
callRouter.post("/call/initiate", userAuth, (req, res) => {
    console.log("*********")
    console.log("📞 /call/initiate body:", req.body);

  if (!req.user || !req.user._id) {
  console.error("❌ call/initiate: req.user missing");
  return res.status(401).json({ message: "Unauthorized" });
}

const fromUserId = req.user._id.toString();
  const { toUserId, callType } = req.body;

  if (!toUserId || !callType) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const callId = `${fromUserId}_${toUserId}_${Date.now()}`;

  activeCalls.set(callId, {
    callId,
    fromUserId,
    toUserId,
    callType,
    status: "ringing"
  });

  console.log("📞 Call initiated:", callId);

  const io = getIO();
if (io) {
  io.to(toUserId.toString()).emit("incoming-call", {
    callId,
    fromUserId,
    fromUserName: req.user.firstName,
    callType
  });
}


  res.json({ callId });
});

// ACCEPT CALL
callRouter.post("/call/accept", userAuth, (req, res) => {
  const { callId } = req.body;
  const call = activeCalls.get(callId);

  if (!call) return res.status(404).json({ message: "Call not found" });

  call.status = "accepted";

  console.log("✅ Call accepted:", callId);

  getIO().to(call.fromUserId.toString()).emit("call-accepted", {
    callId
  });

  res.json({ success: true });
});

// REJECT CALL
callRouter.post("/call/reject", userAuth, (req, res) => {
  const { callId } = req.body;
  const call = activeCalls.get(callId);

  if (!call) return res.status(404).json({ message: "Call not found" });

  console.log("❌ Call rejected:", callId);

  getIO().to(call.fromUserId.toString()).emit("call-rejected", {
    callId
  });

  activeCalls.delete(callId);

  res.json({ success: true });
});

// END CALL
callRouter.post("/call/end", userAuth, (req, res) => {
  const { callId } = req.body;
  const call = activeCalls.get(callId);

  if (!call) return res.status(404).json({ message: "Call not found" });

  console.log("📴 Call ended:", callId);

  getIO().to(call.fromUserId.toString()).emit("call-ended", { callId });
  getIO().to(call.toUserId.toString()).emit("call-ended", { callId });

  activeCalls.delete(callId);

  res.json({ success: true });
});

module.exports = callRouter;
