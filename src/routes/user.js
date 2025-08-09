const express = require("express");
const userRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const { connectionRequest } = require("../models/connection");

userRouter.get("/user/connections", userAuth, async (req, res) => {
    try{
        const loggedInuser = req.user;

        const connections = await connectionRequest.find({
            toUserId: loggedInuser._id,
            connectionRequestMessage: "accepted"
        })

        if(!connections){
            return res.status(400).send("No connections found");
        }

        res.status(200).json({
            message: "Connections found",
            data: connections
        });

    }catch(err){
        res.status(500).send("Erroe message : " + err.message);
    }
})


userRouter.get("/user/requests", userAuth, async (req, res) => {
    try{
        const loggedInuser = req.user;
        const requests = await connectionRequest.find({
            toUserId: loggedInuser._id,
            connectionRequestMessage: "interested"
        })
        if(!requests){
            return res.status(400).send("No requests found");
        }
        res.status(200).json({
            message: "Requests found",
            data: requests
        });

    }catch(err){
        res.status(500).send("Erroe message : " + err.message); 
    }
})

module.exports = userRouter;