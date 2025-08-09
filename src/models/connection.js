const mongoose = require("mongoose");
const connectionSchema = new mongoose.Schema({
    toUserId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    fromUserId: {
        type: mongoose.Schema.Types.ObjectId
    },
    connectionRequestMessage: {
        type: String,
        enum : {
            values: ["ignored", "accepted", "rejected", "interested", "Blocked"],
            message: `{VALUE} is not supported`
        }

    }
},
{
    timestamps: true,
})

// compound indexing to get result quickly when we fetch from database
connectionSchema.index({fromUserId : 1, toUserId : 1});
// Pre ka use hai... ki validation check before saving the data
connectionSchema.pre("save", function(next) {
    const connectionRequest = this;
    // to use equals() function we have to use toUserId and fromUserId to be in objectId type
    if(connectionRequest.fromUserId.equals(connectionRequest.toUserId)){
        throw new Error("User cannot connect with itself");
    }
    next();
})

const connectionRequest = new mongoose.model("ConnectionRequest", connectionSchema);


module.exports = {
    connectionRequest}