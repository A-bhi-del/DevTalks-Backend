const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    SenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    text: {
      type: String,
      required: true,
    },

    // deletedForEveryone: {
    //   type: Boolean,
    //   default: false,
    // },

    // deletedFor: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId, 
    //     ref: "User",
    //   },
    // ],
  },
  {
    timestamps: true, 
  }
);

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    messages: [messageSchema],
  },
  {
    timestamps: true,
  }
);

const Chat = mongoose.model("Chat", chatSchema);

module.exports = {
  Chat,
};
