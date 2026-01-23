const express = require("express");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary"); //  path check (route kis folder me hai uske hisaab se)

const uploadRouter = express.Router();

// Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "devtalks/voice",     
    resource_type: "video",      
    public_id: `voice-${Date.now()}`,
    format: "webm",
  }),
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, 
});

uploadRouter.post("/upload-audio", upload.single("audio"), (req, res) => {
  console.log("Cloudinary File:", req.file);

  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  // Cloudinary URL
  const audioUrl = req.file?.path; 

  res.json({
    audioUrl,
  });
});

module.exports = uploadRouter;
