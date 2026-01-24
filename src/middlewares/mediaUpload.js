const multer = require("multer");
const path = require("path"); // ✅ add this
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const mime = file.mimetype || "";
    const ext = path.extname(file.originalname || ""); // ✅ define ext

    // ✅ images
    if (mime.startsWith("image/")) {
      return {
        folder: "devtalks/media",
        resource_type: "image",
        public_id: `img-${Date.now()}${ext}`,
      };
    }

    // ✅ videos
    if (mime.startsWith("video/")) {
      return {
        folder: "devtalks/media",
        resource_type: "video",
        public_id: `vid-${Date.now()}${ext}`,
      };
    }

    // ✅ pdf (raw)
    if (mime === "application/pdf") {
      return {
        folder: "devtalks/files",
        resource_type: "raw",
        public_id: `pdf-${Date.now()}${ext || ".pdf"}`, // ✅ force pdf ext
      };
    }

    // ✅ other files
    return {
      folder: "devtalks/files",
      resource_type: "raw",
      public_id: `file-${Date.now()}${ext}`,
    };
  },
});

const mediaUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // ✅ 25MB
});

module.exports = mediaUpload;
