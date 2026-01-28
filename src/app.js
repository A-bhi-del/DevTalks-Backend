const express = require("express");
const connectDB = require("./config/database.js");
const app = express();
const cookieParser = require("cookie-parser");
const socketCreation = require("./utils/socket.js");
const http = require("http");
const cors = require("cors");
const path = require("path");

require("dotenv").config();

app.use(cors({
  origin: [
    'https://buying-auctions-renewable-partnership.trycloudflare.com',
    'https://dev-talks-frontend-5f7l.vercel.app',  // Production
    'https://dev-talks-frontend-5f7l-rcypxnt4l-a-bhi-dels-projects.vercel.app', // Preview
    'http://localhost:5173' // Local development on port 5173
  ],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/ok", (req, res) => {
  res.send("OK HEALTH CHECK");
});


const authRouter = require("./routes/authrouter.js");
const profileRouter = require("./routes/profile.js");
const requestRouter = require("./routes/request.js");
const userRouter = require("./routes/user.js");
const chatRouter = require("./routes/chatrouter.js");
const notificationRouter = require("./routes/notification.js");
const uploadRouter = require("./routes/upload.js");
const router = require("./routes/mediaUpload.js");
const { createWorkerFunc } = require("./utils/mediasoupWorker.js");
const callRouter = require("./routes/call.js");


chatRouter.use((req, res, next) => {
  console.log("Chat Router hit for:", req.method, req.originalUrl);
  next();
});

app.use("/" , authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);
app.use("/", chatRouter);
app.use("/", notificationRouter);
app.use("/", uploadRouter);
app.use("/", router);
app.use("/", callRouter);


const server = http.createServer(app);
socketCreation(server);

connectDB()
.then(async () => {
    await createWorkerFunc(); 
    console.log("MongoDB is connected Successfully 🫡");
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log('Server is running on port 3000');
    });
})


