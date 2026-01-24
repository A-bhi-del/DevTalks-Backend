const express = require("express");
const mediaUpload = require("../middlewares/mediaUpload");

const router = express.Router();

router.post("/upload-media", mediaUpload.single("media"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const url = req.file.path; // ✅ cloudinary secure URL mostly

  // ✅ public_id correct
  const publicId = req.file.public_id || req.file.filename || null;

  const mime = req.file.mimetype || "";
  let mediaType = "file";
  if (mime.startsWith("image/")) mediaType = "image";
  else if (mime.startsWith("video/")) mediaType = "video";

  // ✅ FORCE DOWNLOAD URL (most stable)
  // Works properly for raw/pdf too
  const downloadUrl = url.replace("/upload/", "/upload/fl_attachment/");

  res.json({
    mediaUrl: url,
    mediaPublicId: publicId,
    mediaType,
    fileName: req.file.originalname,
    fileSize: req.file.bytes || req.file.size || 0,
    mimeType: mime, // ✅ debugging
  });
});

module.exports = router;
