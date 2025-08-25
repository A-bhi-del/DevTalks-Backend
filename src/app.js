const express = require("express");
const connectDB = require("./config/database.js");
const app = express();
const cookieParser = require("cookie-parser");
const socketCreation = require("./utils/socket.js");
const http = require("http");
const cors = require("cors");
require("dotenv").config();

app.use(cors(
  {
    origin: "http://localhost:5173",
    credentials: true
  }
))
app.use(express.json());
app.use(cookieParser());

const authRouter = require("./routes/authrouter.js");
const profileRouter = require("./routes/profile.js");
const requestRouter = require("./routes/request.js");
const userRouter = require("./routes/user.js");
const chatRouter = require("./routes/chatrouter.js");


app.use("/" , authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);
app.use("/", chatRouter);

const server = http.createServer(app);
socketCreation(server);


connectDB()
.then(() => {
    console.log("MongoDB is connected");
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log('Server is running on port 3000');
    });
})
.catch((err) => {
    console.error("Mongodb is not connected "+ err.message);
})


