const express = require("express");
const { adminAuth, userAuth } = require("./utils/middlewares/auth");

const app = express();


app.get("/admin", adminAuth, (req, res, next) => {
  console.log("Admin 1 is running");
  res.send("Admin 1 response");
})
app.use("/user",userAuth, (req, res, next) => {
  console.log("user 1 is running");
  res.send("user 1 response");
  // next();
})

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});