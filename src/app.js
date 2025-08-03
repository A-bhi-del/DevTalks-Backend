const express = require("express");
const connectDB = require("./config/database.js");
const app = express();
const dotenv = require("dotenv");
dotenv.config({});
const cors = require("cors");
const User = require("./models/user.js");


app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

app.post("/signup", async (req, res) => {
  const user = new User(req.body);

  try{
    await user.save();
    res.status(200).send("User is added successfully");
  } catch(err){
    res.status(500).send("Error in signing up:"+ err.message);
  }
})

app.get("/user", async (req, res) => {
  const email = req.body.emailId;
  try{
    const user =await User.findOne({emailId : email});
    if(user.length === 0){
      res.status(404).send("user not found");
    }
    res.status(200).send(user);
  } catch(err){
    res.status(500).send("Error in fetching user:" + err.message);
  }
})

app.get("/feed", async (req, res) => {
  try{
    const users = await User.find();
    res.status(200).send(users);
  }catch(err){
    res.status(500).send("Error while fetching all users:" + err.message);
  }
})

app.delete("/delete", async (req, res) => {
  const useremail = req.body.emailId;
  try{
    const user = await User.findOneAndDelete({emailId: useremail});
    if(!user){
      res.status(404).send("user is not found");
    }
    res.status(200).send("User is deleted successfully");
  } catch(err){
    res.status(500).send("Error in deleting user:" + err.message);
  }
})

app.patch("/edit/:userId", async (req, res) => {
  const userId = req.params?.userId;
  const data = req.body;
  try{
    const ALLOWED_UPDATES = ["firstName", "lastName","emailId", "age", "skills", "about", "password"];
    const isAllowedToUpdate = Object.keys(data).every((k) => ALLOWED_UPDATES.includes(k));
    if(!isAllowedToUpdate){
      throw new Error("Invalid update fields");
      // res.status(400).send("Invalid update fields");
      // return ;
    }

    if(data.skills && data.skills.length > 10){
      throw new Error("Skills should not be more than 10");
    }

    const user = await User.findByIdAndUpdate(userId, data);
    // console.log(user);
    if(!user){
      res.status(404).send("user is not exist");
    } 
    res.status(200).send("user is updated successfully");
  } catch(err) {
    res.status(500).send("Error in updating user:" + err.message);
  }
})
  

// app.post("/signup", async (req, res) => {
//   try {
//     const { firstName, lastName, emailId, password, age} = req.body;
//     const existUser = await User.findOne({emailId: emailId.toLowerCase()});
//     if(existUser){
//       res.status(400).send("User is already exist");
//     }
  
//   const hasPassword = await bcrypt.hash(password, 10);

//   const user = new User({
//     firstName,
//     lastName,
//     emailId: emailId.toLowerCase(),
//     password: hasPassword,
//     age
//   })
//   await user.save();
//   res.status(200).send("User is created successfully");

// }

//   catch(err){
//     res.status(500).send("Error in signing up:"+ err.message);
//   }

// })

// app.post("/login", async (req, res) => {
//   const {emailId, password} = req.body;
//   try {
//     const user = await User.findOne({emailId});
//     if(!user){
//       return res.status(404).send("User not found");
//     }
//     const isMatch = await bcrypt.compare(password, user.password);
//     if(!isMatch){
//       return res.status(404).send("Invalid credentials");
//     }
//     const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
//     res.status(200).json({ token });

//   } catch(err) {
//     res.status(500).send("Error logging in: " + err.message);
//   }
// });


// app.get("/admin", adminAuth, (req, res, next) => {
//   console.log("Admin 1 is running");
//   res.send("Admin 1 response");
// })
// app.use("/user",userAuth, (req, res, next) => {
//   console.log("user 1 is running");
//   res.send("user 1 response");
//   // next();
// })

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


