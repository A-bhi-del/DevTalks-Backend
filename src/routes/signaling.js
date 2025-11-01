const express = require("express");
const signalingRouter = express.Router();
const { userAuth } = require("../middlewares/auth");

// Store active calls
const activeCalls = new Map();

// Initiate a call
signalingRouter.post("/call/initiate", userAuth, async (req, res) => {
    try {
        const { toUserId, callType } = req.body; // 'voice' or 'video'
        const fromUserId = req.user._id;

        // Check if user is already in a call
        if (activeCalls.has(fromUserId)) {
            return res.status(400).json({ 
                message: "You are already in a call",
                error: "USER_IN_CALL"
            });
        }

        // Check if target user is available
        if (activeCalls.has(toUserId)) {
            return res.status(400).json({ 
                message: "User is busy",
                error: "USER_BUSY"
            });
        }

        // Create call session
        const callId = `${fromUserId}_${toUserId}_${Date.now()}`;
        const callData = {
            callId,
            fromUserId,
            toUserId,
            callType,
            status: 'initiated',
            createdAt: new Date()
        };

        activeCalls.set(fromUserId, callData);
        activeCalls.set(toUserId, callData);

        // Emit call notification to target user
        req.io.to(toUserId).emit('incoming-call', {
            callId,
            fromUserId,
            fromUserName: `${req.user.firstName} ${req.user.lastName}`,
            callType
        });

        res.json({
            message: "Call initiated successfully",
            callId,
            callData
        });

    } catch (err) {
        res.status(500).json({ 
            message: "Error initiating call", 
            error: err.message 
        });
    }
});

// Accept a call
signalingRouter.post("/call/accept", userAuth, async (req, res) => {
    try {
        const { callId } = req.body;
        const userId = req.user._id;

        const callData = activeCalls.get(userId);
        if (!callData || callData.callId !== callId) {
            return res.status(404).json({ 
                message: "Call not found",
                error: "CALL_NOT_FOUND"
            });
        }

        // Update call status
        callData.status = 'accepted';
        callData.acceptedAt = new Date();

        // Notify caller that call was accepted
        req.io.to(callData.fromUserId).emit('call-accepted', {
            callId,
            acceptedBy: userId
        });

        res.json({
            message: "Call accepted",
            callData
        });

    } catch (err) {
        res.status(500).json({ 
            message: "Error accepting call", 
            error: err.message 
        });
    }
});

// Reject a call
signalingRouter.post("/call/reject", userAuth, async (req, res) => {
    try {
        const { callId } = req.body;
        const userId = req.user._id;

        const callData = activeCalls.get(userId);
        if (!callData || callData.callId !== callId) {
            return res.status(404).json({ 
                message: "Call not found",
                error: "CALL_NOT_FOUND"
            });
        }

        // Notify caller that call was rejected
        req.io.to(callData.fromUserId).emit('call-rejected', {
            callId,
            rejectedBy: userId
        });

        // Remove call from active calls
        activeCalls.delete(callData.fromUserId);
        activeCalls.delete(callData.toUserId);

        res.json({
            message: "Call rejected"
        });

    } catch (err) {
        res.status(500).json({ 
            message: "Error rejecting call", 
            error: err.message 
        });
    }
});

// End a call
signalingRouter.post("/call/end", userAuth, async (req, res) => {
    try {
        const { callId } = req.body;
        const userId = req.user._id;

        const callData = activeCalls.get(userId);
        if (!callData || callData.callId !== callId) {
            return res.status(404).json({ 
                message: "Call not found",
                error: "CALL_NOT_FOUND"
            });
        }

        // Notify other participant that call ended
        const otherUserId = callData.fromUserId === userId ? callData.toUserId : callData.fromUserId;
        req.io.to(otherUserId).emit('call-ended', {
            callId,
            endedBy: userId
        });

        // Remove call from active calls
        activeCalls.delete(callData.fromUserId);
        activeCalls.delete(callData.toUserId);

        res.json({
            message: "Call ended"
        });

    } catch (err) {
        res.status(500).json({ 
            message: "Error ending call", 
            error: err.message 
        });
    }
});

// Handle WebRTC signaling
signalingRouter.post("/call/signaling", userAuth, async (req, res) => {
    try {
        const { toUserId, type, data } = req.body;
        const fromUserId = req.user._id;

        // Forward signaling data to target user
        req.io.to(toUserId).emit('webrtc-signaling', {
            fromUserId,
            type, // 'offer', 'answer', 'ice-candidate'
            data
        });

        res.json({
            message: "Signaling data sent"
        });

    } catch (err) {
        res.status(500).json({ 
            message: "Error handling signaling", 
            error: err.message 
        });
    }
});

// Get call status
signalingRouter.get("/call/status/:callId", userAuth, async (req, res) => {
    try {
        const { callId } = req.params;
        const userId = req.user._id;

        const callData = activeCalls.get(userId);
        if (!callData || callData.callId !== callId) {
            return res.status(404).json({ 
                message: "Call not found",
                error: "CALL_NOT_FOUND"
            });
        }

        res.json({
            callData
        });

    } catch (err) {
        res.status(500).json({ 
            message: "Error getting call status", 
            error: err.message 
        });
    }
});

module.exports = signalingRouter;
