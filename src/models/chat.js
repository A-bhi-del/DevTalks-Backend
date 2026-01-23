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
      default: "",
    },
    
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },

    readAt: {
      type: Date,
      default: null,
    },

     deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    isEdited: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: { type: String },
      },
    ],
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },

    audioUrl: {
      type: String,
      default: null,
    },

    audioDuration: {
      type: Number, 
      default: 0,
    },
    
    // media support
    mediaUrl: {
      type: String,
      default: null,
    },

    mediaType: {
      type: String,
      enum: ["image", "video", "file"],
      default: null,
    },

    fileName: {
      type: String,
      default: null,
    },

    fileSize: {
      type: Number,
      default: 0,
    },

    mediaPublicId: {
      type: String,
      default: null,
    },

    messageType: {
      type: String,
      enum: ["text", "audio", "media"],
      default: "text",
    },


  },
  {
    timestamps: true, 
    strict: true
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
