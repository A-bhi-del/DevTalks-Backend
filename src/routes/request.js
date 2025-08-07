const express = require("express");
const {userAuth} = require("../middlewares/auth");
const { connectionRequest } = require("../models/connection");
const requestRouter = express.Router();
const User = require("../models/user");


requestRouter.post("/request/send/:status/:toUserId" , userAuth , async (req, res) => {
  try{
    const user = req.user;
    const receiver = await User.findById(req.params.toUserId);
    const fromUserId = req.user._id;
    const toUserId = req.params.toUserId;
    const status = req.params.status;

    const isAllowed = ["ignore", "interested"];
    if(!isAllowed.includes(status)){
      return res.status(400).send("Invalid Try again");
    }

    const id_is_exist = await User.findById(toUserId);
    if(!id_is_exist){
      return res.status(400).send("user Id is not exist");
    }

    const connectionRequestExist = await connectionRequest.findOne({
      $or:[
        {toUserId, fromUserId},
        {fromUserId: toUserId, toUserId: fromUserId},
        {fromUserId:toUserId}
      ]
    })

    if(connectionRequestExist){
      return res.status(400).send("Request is already exist");
    }

    const connectRequestsent = await connectionRequest({
      toUserId,
      fromUserId,
      connectionRequestMessage: status
    })

    const data = await connectRequestsent.save();
    res.json({
      message: `${user.firstName} sent connection request to ${receiver.firstName}`,
      data,
    })

  }catch(err){
    res.status(500).send("Error in sending request:" + err.message);
  }
})


module.exports = requestRouter;