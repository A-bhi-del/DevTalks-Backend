const mongoose = require("mongoose");
const connectionSchema = new mongoose.Schema({
    toUserId: {
        type: String,
        required: true
    },
    fromUserId: {
        type: String
    },
    connectionRequestMessage: {
        type: String,
        enum : {
            values: ["ignore", "accepted", "rejected", "interested"],
            message: `{VALUE} is not supported`
        }

    }
},
{
    timestamps: true,
})

const connectionRequest = new mongoose.model("ConnectionRequest", connectionSchema);


module.exports = {
    connectionRequest}