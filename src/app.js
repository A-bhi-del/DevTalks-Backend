const express = require("express");
const connectDB = require("./config/database.js");
const app = express();
const cookieParser = require("cookie-parser");
app.use(express.json());
app.use(cookieParser());

const authRouter = require("./routes/authrouter.js");
const profileRouter = require("./routes/profile.js");
const requestRouter = require("./routes/request.js");

app.use("/" , authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);


connectDB()
.then(() => {
    console.log("MongoDB is connected");
    app.listen(3000, () => {
      console.log('Server is running on port 3000');
    });
})
.catch((err) => {
    console.error("Mongodb is not connected ")
})


