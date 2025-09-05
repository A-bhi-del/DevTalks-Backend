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

    // ✅ Track if a message is deleted globally
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },

    // ✅ Track which users have deleted it only for themselves
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId, // store user IDs who deleted for themselves
        ref: "User",
      },
    ],
  },
  {
    timestamps: true, // gives createdAt & updatedAt
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
