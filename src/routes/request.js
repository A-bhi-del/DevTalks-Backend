const express = require("express");
const { userAuth } = require("../middlewares/auth");
const { connectionRequest } = require("../models/connection");
const requestRouter = express.Router();
const User = require("../models/user");


requestRouter.post("/request/send/:status/:toUserId", userAuth, async (req, res) => {
  try {
    const user = req.user;
    const sender = await User.findById(req.params.toUserId);
    const fromUserId = req.user._id;
    const toUserId = req.params.toUserId;
    const status = req.params.status;

    // i checkes that the given status is allowed or not
    const isAllowed = ["ignored", "interested"];
    if (!isAllowed.includes(status)) {
      return res.status(400).send("Invalid Try again");
    }

    //i checked the touserId is already exist or not
    const id_is_exist = await User.findById(toUserId);
    if (!id_is_exist) {
      return res.status(400).send("user Id is not exist");
    }

    // validations for check there is connection request is alreay exist or
    // the user that get connecto request has send same request to user where he got the request
    const connectionRequestExist = await connectionRequest.findOne({
      $or: [
        { toUserId, fromUserId },
        { fromUserId: toUserId, toUserId: fromUserId },
        // {fromUserId:toUserId}
      ]
    })

    if (connectionRequestExist) {
      return res.status(400).send("Request is already exist");
    }

    const connectRequestsent = await connectionRequest({
      toUserId,
      fromUserId,
      connectionRequestMessage: status
    })

    // Here we save the connection request
    const data = await connectRequestsent.save();
    res.json({
      message: `${user.firstName} sent connection request to ${sender.firstName}`,
      data,
    })

  } catch (err) {
    res.status(500).send("Error in sending request:" + err.message);
  }
})


requestRouter.post("/request/receive/:status/:requestId", userAuth, async (req, res) => {
  try {
    const loggedInuser = req.user;
    // const receiver = await User.findById(req.params.fromUserId);
    // const requestId = req.params.requestId;
    // const status = req.params.status;
    const {status, requestId} = req.params;
    // const fromUserId = await connectionRequest.findById(requestId);
    // const sender = await User.findById({fromUserId});

    const isAllowed = ["accepted", "rejected"];
    if (!isAllowed.includes(status)) {
      return res.status(400).send("Invalid status Try again");
    }

    // maine yaaha pr ye galti ki thi ki maine status ko connection schema me connectionrequestMesssage likha tha
    const connectionRequestExist = await connectionRequest.findOne({
      _id: requestId,
      toUserId: loggedInuser._id,
      connectionRequestMessage: "interested"
    });
    


    if (!connectionRequestExist) {
      return res.status(400).json({
        message: "connection request is not exist"
      });
    }

    connectionRequestExist.connectionRequestMessage = status;
    const data = await connectionRequestExist.save();

    res.json({
      message: `connection request has ${status} `,
      data
    })

  } catch (err) {
    res.status(500).send("Error in getting request : " + err.message);
  }
})


module.exports = requestRouter;