const express = require("express");
const connectDB = require("./config/database.js");
const app = express();
const dotenv = require("dotenv");
const cors = require("cors");
const User = require("./models/user.js");
const { validateSignupData } = require("./utils/validation.js");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { userAuth } = require("./middlewares/auth.js");
dotenv.config({});

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.post("/signup", async (req, res) => {

  try{
    //validation
  validateSignupData(req);
  const {password, emailId, firstName, lastName, age, gender} = req.body;
  const hashPassword =await bcrypt.hash(password, 10);

  const user = new User({
    firstName,
    lastName,
    emailId,
    password: hashPassword,
    age,
    gender,
  });

    await user.save();
    res.status(200).send("User is added successfully");
  } catch(err){
    res.status(500).send("Error in signing up:"+ err.message);
  }
})

app.post("/login", async (req, res) => {
  try {
    const {emailId, password} = req.body;
    if(!validator.isEmail(emailId)){
      throw new Error("emailId is not valid");
    }

    const user = await User.findOne({emailId : emailId}).select("+password");
    if(!user){
      throw new Error("User not found");
    }

    const passwordisValid = await user.validatePassword(password);
    if(passwordisValid){
      const token = await user.getJWT();
      // console.log(token);
      res.cookie("token", token, {
        expires: new Date(Date.now() + 60000),
      });
      res.status(200).send("Login successfully");
    } else {
      throw new Error("Invalid credentials");
    }

  } catch(err) {
    res.status(500).send("Error in logging in:" + err.message);
  }
})

app.get("/profile",userAuth, async (req, res) => {
  try{
    const user = req.user;
    res.send(user);
  }catch(err){
    res.status(500).send("Error in fetching user:" + err.message);
  }
})

app.post("/sendconnectionReq",userAuth, async (req, res) => {
  const user = req.user;
  res.status(200).send(user.firstName + " " + "has sent connection request");
})
  

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


