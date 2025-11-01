const express = require("express");
const notificationRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const Notification = require("../models/notification");
const User = require("../models/user");
const { connectionRequest } = require("../models/connection");

// Create interest notification
notificationRouter.post("/notifications/create-interest", userAuth, async (req, res) => {
    try {
        const { toUserId, title, message } = req.body;
        const fromUserId = req.user._id;

        // Get the interested user's details
        const fromUser = await User.findById(fromUserId).select('firstName lastName photoUrl');
        
        if (!fromUser) {
            return res.status(404).send("User not found");
        }

        // Create notification
        const notification = new Notification({
            fromUserId: fromUserId,
            toUserId: toUserId,
            type: 'interest',
            title: `${fromUser.firstName} ${fromUser.lastName} is interested in you!`,
            message: `${fromUser.firstName} ${fromUser.lastName} showed interest in your profile`,
            relatedUserId: fromUserId
        });

        await notification.save();

        res.json({ 
            message: "Interest notification created successfully",
            notification 
        });
    } catch (err) {
        res.status(500).send("Error creating interest notification: " + err.message);
    }
});

// Get all notifications for logged in user
notificationRouter.get("/notifications", userAuth, async (req, res) => {
    try {
        const userId = req.user._id;
        
        const notifications = await Notification.find({ toUserId: userId })
            .populate('fromUserId', 'firstName lastName photoUrl')
            .populate('relatedUserId', 'firstName lastName photoUrl')
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({ 
            toUserId: userId, 
            isRead: false 
        });

        res.json({
            notifications,
            unreadCount
        });
    } catch (err) {
        res.status(500).send("Error fetching notifications: " + err.message);
    }
});

// Mark notification as read
notificationRouter.patch("/notifications/:notificationId/read", userAuth, async (req, res) => {
    try {
        const notificationId = req.params.notificationId;
        const userId = req.user._id;

        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, toUserId: userId },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).send("Notification not found");
        }

        res.json({ message: "Notification marked as read", notification });
    } catch (err) {
        res.status(500).send("Error marking notification as read: " + err.message);
    }
});

// Mark all notifications as read
notificationRouter.patch("/notifications/mark-all-read", userAuth, async (req, res) => {
    try {
        const userId = req.user._id;

        await Notification.updateMany(
            { toUserId: userId, isRead: false },
            { isRead: true }
        );

        res.json({ message: "All notifications marked as read" });
    } catch (err) {
        res.status(500).send("Error marking all notifications as read: " + err.message);
    }
});

// Accept interest notification (create connection)
notificationRouter.post("/notifications/:notificationId/accept", userAuth, async (req, res) => {
    try {
        const notificationId = req.params.notificationId;
        const userId = req.user._id;

        const notification = await Notification.findById(notificationId);
        
        if (!notification || notification.toUserId.toString() !== userId.toString()) {
            return res.status(404).send("Notification not found");
        }

        if (notification.type !== 'interest') {
            return res.status(400).send("Invalid notification type");
        }

        // Create connection request
        const newConnection = new connectionRequest({
            fromUserId: notification.fromUserId,
            toUserId: notification.toUserId,
            connectionRequestMessage: "accepted"
        });

        await newConnection.save();

        // Mark notification as read
        notification.isRead = true;
        await notification.save();

        // Create acceptance notification for the other user
        const acceptanceNotification = new Notification({
            fromUserId: userId,
            toUserId: notification.fromUserId,
            type: 'connection_accepted',
            title: 'Connection Accepted!',
            message: `${req.user.firstName} ${req.user.lastName} accepted your interest`,
            relatedUserId: userId
        });

        await acceptanceNotification.save();

        res.json({ 
            message: "Interest accepted successfully",
            connection: newConnection
        });
    } catch (err) {
        res.status(500).send("Error accepting interest: " + err.message);
    }
});

// Reject interest notification
notificationRouter.post("/notifications/:notificationId/reject", userAuth, async (req, res) => {
    try {
        const notificationId = req.params.notificationId;
        const userId = req.user._id;

        const notification = await Notification.findById(notificationId);
        
        if (!notification || notification.toUserId.toString() !== userId.toString()) {
            return res.status(404).send("Notification not found");
        }

        if (notification.type !== 'interest') {
            return res.status(400).send("Invalid notification type");
        }

        // Mark notification as read
        notification.isRead = true;
        await notification.save();

        // Create rejection notification for the other user
        const rejectionNotification = new Notification({
            fromUserId: userId,
            toUserId: notification.fromUserId,
            type: 'connection_rejected',
            title: 'Interest Declined',
            message: `${req.user.firstName} ${req.user.lastName} declined your interest`,
            relatedUserId: userId
        });

        await rejectionNotification.save();

        res.json({ message: "Interest rejected successfully" });
    } catch (err) {
        res.status(500).send("Error rejecting interest: " + err.message);
    }
});

// Delete notification
notificationRouter.delete("/notifications/:notificationId", userAuth, async (req, res) => {
    try {
        const notificationId = req.params.notificationId;
        const userId = req.user._id;

        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            toUserId: userId
        });

        if (!notification) {
            return res.status(404).send("Notification not found");
        }

        res.json({ message: "Notification deleted successfully" });
    } catch (err) {
        res.status(500).send("Error deleting notification: " + err.message);
    }
});

module.exports = notificationRouter;
