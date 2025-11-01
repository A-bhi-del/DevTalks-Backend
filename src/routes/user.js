const express = require("express");
const userRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const { connectionRequest } = require("../models/connection");
const User = require("../models/user");

const USER_DATA = "firstName lastName gender age photoUrl about skills";

userRouter.get("/user/connections", userAuth, async (req, res) => {
    try {
        const loggedInuser = req.user;
        // when a person accept the request than they both become friends so both are the connection of each so we need to find touserid or fromuserid
        const connections1 = await connectionRequest.find({
            toUserId: loggedInuser._id, connectionRequestMessage: "accepted"
        }).populate("fromUserId", USER_DATA);

        const connections2 = await connectionRequest.find({
            fromUserId: loggedInuser._id, connectionRequestMessage: "accepted"
        }).populate("toUserId", USER_DATA);
        // .populate("fromUserId", ["firstName", "lastName"]);  second way of writing the same thing to use populate 
        if (!connections1 && !connections2) { // jab dono false ho tabhi return kare 
            return res.status(400).send("No connections found");
        }

        // i am fetching the user data from the connections array
        const Data1 = connections1.map(row => row.fromUserId);
        const Data2 = connections2.map(row => row.toUserId);

        const allConnections = [...Data1, ...Data2];

        res.status(200).json({
            message: "Connections found",
            data: allConnections
        });

    } catch (err) {
        res.status(500).send("Error message : " + err.message);
    }
})


userRouter.get("/user/requests", userAuth, async (req, res) => {
    try {
        const loggedInuser = req.user;
        const requests = await connectionRequest.find({
            toUserId: loggedInuser._id,
            connectionRequestMessage: "interested"
        }).populate("fromUserId", "firstName lastName gender age photoUrl about skills");
        if (!requests) {
            return res.status(400).send("No requests found");
        }
        res.status(200).json({
            message: "Requests found",
            data: requests
        });

    } catch (err) {
        res.status(500).send("Erroe message : " + err.message);
    }
})


userRouter.get("/user/feed", userAuth, async (req, res) => {
    try {
        console.log("Feed endpoint hit by user:", req.user._id);
        const loggedInuser = req.user;
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 15;
        limit = limit > 15 ? 15 : limit;
        const skip = (page - 1) * limit;

        // First, let's check total users in database
        const totalUsers = await User.countDocuments();
        console.log("Total users in database:", totalUsers);

        const Requests = await connectionRequest.find({
            $or: [
                { fromUserId: loggedInuser._id },
                { toUserId: loggedInuser._id }
            ]
        }).select("fromUserId toUserId");

        const HidConnectionRequest = new Set();
        Requests.forEach((req) => {
            HidConnectionRequest.add(req.fromUserId.toString());
            HidConnectionRequest.add(req.toUserId.toString());
        });

        const users_that_can_be_seen_by_a_loggedinuser = await User.find({
            $and: [
                { _id: { $nin: Array.from(HidConnectionRequest) } },
                { _id: { $ne: loggedInuser._id } }
            ]
        }).select(USER_DATA).skip(skip).limit(limit);

        console.log("Hidden connections count:", HidConnectionRequest.size);
        console.log("Users found for feed:", users_that_can_be_seen_by_a_loggedinuser.length);
        console.log("Users data:", users_that_can_be_seen_by_a_loggedinuser);

        res.json({
            users: users_that_can_be_seen_by_a_loggedinuser,
            hasMore: users_that_can_be_seen_by_a_loggedinuser.length === limit,
            page,
            totalHidden: HidConnectionRequest.size,
            totalUsers: totalUsers
        });

    } catch (err) {
        res.status(500).send("Error in fetching feed:" + err.message);
    }
})

module.exports = userRouter;


//***POPULATE  - it is used to fetch data from other model that have a relation  */