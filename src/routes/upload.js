const express = require("express");
const multer = require("multer");
const path = require("path");

const uploadRouter = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "src/uploads/"),
    filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + Math.random() + path.extname(file.originalname)),
});

const upload = multer({ storage });

uploadRouter.post("/upload-audio", upload.single("audio"), (req, res) => {
     console.log("✅ File received:", req.file);
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  res.json({
    audioUrl: fileUrl,
  });
});

module.exports = uploadRouter;
