const express = require("express");
const mediaUpload = require("../middlewares/mediaUpload");

const router = express.Router();

router.post("/upload-media", mediaUpload.single("media"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const url = req.file.path;       // cloudinary URL
  const publicId = req.file.filename; // public_id

  const mime = req.file.mimetype || "";
  let mediaType = "file";
  if (mime.startsWith("image/")) mediaType = "image";
  else if (mime.startsWith("video/")) mediaType = "video";

  res.json({
    mediaUrl: url,
    mediaPublicId: publicId,
    mediaType,
    fileName: req.file.originalname,
    fileSize: req.file.size || 0,
  });
});

module.exports = router;
