const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "devtalks/voice",
    resource_type: "video", // ✅ audio/webm needs video type
    format: "webm",
    public_id: `voice-${Date.now()}`,
  }),
});

const audioUpload = multer({ storage });

module.exports = audioUpload;
