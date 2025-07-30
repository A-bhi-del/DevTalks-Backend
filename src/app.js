const express = require("express");
const connectDB =require("./config/database");
const User = require("./models/user");
// const { adminAuth, userAuth } = require("./utils/middlewares/auth");

const app = express();

app.post("/signup", async (req, res) => {
  const user = new User({
    firstName: "Tanu",
    lastName: "Verma",
    emailId: "H8m3O@example.com",
    password: "password123",
    age: 25,
  })

  try{
     await user.save();
     res.status(201).send("user created succesfully");
  } catch(err){
    res.status(400).send("Error to create a user:" + err.message);
  }

})


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


