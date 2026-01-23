const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const mime = file.mimetype || "";

    // ✅ images
    if (mime.startsWith("image/")) {
      return {
        folder: "devtalks/media",
        resource_type: "image",
        public_id: `img-${Date.now()}`,
      };
    }

    // ✅ videos
    if (mime.startsWith("video/")) {
      return {
        folder: "devtalks/media",
        resource_type: "video",
        public_id: `vid-${Date.now()}`,
      };
    }

    // ✅ other files (pdf etc) -> must be "raw"
    return {
      folder: "devtalks/files",
      resource_type: "raw",
      public_id: `file-${Date.now()}`,
    };
  },
});

const mediaUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // ✅ 25MB
});

module.exports = mediaUpload;
